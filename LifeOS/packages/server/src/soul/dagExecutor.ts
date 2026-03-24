/**
 * DAG Executor — orchestrates chained multi-step physical actions.
 *
 * Execution strategy:
 *   1. Topologically sort nodes by their dependencies
 *   2. Execute nodes layer-by-layer (all nodes in a layer have their deps satisfied)
 *   3. Fail-fast: if any node fails, mark downstream nodes as "skipped"
 *      and record the breakpoint
 */
import { randomUUID } from 'crypto';
import type {
  PhysicalActionDag,
  DagNode,
  DagEdge,
  DagStatus,
  DagNodeStatus,
  PhysicalActionStep,
} from '@lifeos/shared';
import { submitPhysicalAction } from '../integrations/executionEngine.js';
import { getDb } from '../db/client.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('dagExecutor');

// ---------------------------------------------------------------------------
// DB Helpers
// ---------------------------------------------------------------------------

function rowToDag(row: any): PhysicalActionDag {
  return {
    id: row.id,
    sourceSoulActionId: row.source_soul_action_id,
    description: row.description,
    nodes: JSON.parse(row.nodes_json),
    edges: JSON.parse(row.edges_json),
    status: row.status,
    breakpointNodeId: row.breakpoint_node_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function insertDag(dag: PhysicalActionDag): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO physical_action_dags (id, source_soul_action_id, description, nodes_json, edges_json, status, breakpoint_node_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    dag.id, dag.sourceSoulActionId, dag.description,
    JSON.stringify(dag.nodes), JSON.stringify(dag.edges),
    dag.status, dag.breakpointNodeId, dag.createdAt, dag.updatedAt,
  );
}

function persistDag(dag: PhysicalActionDag): void {
  const db = getDb();
  db.prepare(`
    UPDATE physical_action_dags
    SET nodes_json = ?, edges_json = ?, status = ?, breakpoint_node_id = ?, updated_at = ?
    WHERE id = ?
  `).run(
    JSON.stringify(dag.nodes), JSON.stringify(dag.edges),
    dag.status, dag.breakpointNodeId, dag.updatedAt, dag.id,
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a DAG from a list of action steps.
 * Each step may declare `dependsOn` referencing other step indices (0-based)
 * or explicit IDs. If no dependencies, the step is a root node.
 */
export function createDag(
  steps: PhysicalActionStep[],
  sourceSoulActionId?: string,
  description?: string,
): PhysicalActionDag {
  const now = new Date().toISOString();

  // Assign stable IDs to each step based on index
  const nodes: DagNode[] = steps.map((step, idx) => ({
    id: `node-${idx}`,
    type: step.type,
    payload: step.payload,
    title: step.title,
    dependsOn: (step.dependsOn ?? []).map(dep => {
      // Support both numeric index references ("0", "1") and explicit node IDs
      const numDep = Number(dep);
      return !isNaN(numDep) ? `node-${numDep}` : dep;
    }),
    status: 'waiting' as DagNodeStatus,
    physicalActionId: null,
    errorMessage: null,
  }));

  // Derive edges from dependsOn
  const edges: DagEdge[] = [];
  for (const node of nodes) {
    for (const dep of node.dependsOn) {
      edges.push({ from: dep, to: node.id });
    }
  }

  const dag: PhysicalActionDag = {
    id: randomUUID(),
    sourceSoulActionId: sourceSoulActionId ?? null,
    description: description ?? steps.map(s => s.title).join(' → '),
    nodes,
    edges,
    status: 'pending',
    breakpointNodeId: null,
    createdAt: now,
    updatedAt: now,
  };

  insertDag(dag);
  logger.info(`DAG created: ${dag.id} with ${nodes.length} nodes`);
  return dag;
}

/**
 * Execute a DAG by walking through topologically sorted layers.
 * Returns the final DAG state.
 */
export async function executeDag(dagId: string): Promise<PhysicalActionDag> {
  const dag = getDag(dagId);
  if (!dag) throw new Error(`DAG not found: ${dagId}`);

  dag.status = 'running';
  dag.updatedAt = new Date().toISOString();
  persistDag(dag);

  const layers = topologicalSort(dag.nodes);
  logger.info(`DAG ${dagId}: ${layers.length} execution layers`, {
    layers: layers.map(l => l.map(n => n.id)),
  });

  let failed = false;

  for (const layer of layers) {
    if (failed) {
      // Mark all remaining nodes as skipped
      for (const node of layer) {
        node.status = 'skipped';
      }
      continue;
    }

    // Execute all nodes in this layer (they have no inter-dependencies)
    // For safety, execute sequentially within a layer too
    for (const node of layer) {
      if (failed) {
        node.status = 'skipped';
        continue;
      }

      node.status = 'executing';
      dag.updatedAt = new Date().toISOString();

      try {
        const submitted = await submitPhysicalAction(
          node.type,
          node.payload,
          node.title,
          undefined, // sourceNoteId
          dag.sourceSoulActionId ?? undefined,
        );
        node.physicalActionId = submitted.id;

        // For DAG execution we treat submission as success
        // (the actual execution happens asynchronously via worker)
        if (submitted.status === 'rejected') {
          throw new Error(`Action was rejected by approval gate`);
        }

        node.status = 'completed';
        logger.info(`DAG ${dagId} node ${node.id} completed → PA ${submitted.id}`);
      } catch (err: any) {
        node.status = 'failed';
        node.errorMessage = err.message || 'Unknown DAG node execution error';
        dag.breakpointNodeId = node.id;
        failed = true;
        logger.error(`DAG ${dagId} node ${node.id} failed:`, err);
      }
    }
  }

  // Determine final DAG status
  const allCompleted = dag.nodes.every(n => n.status === 'completed');
  const anyFailed = dag.nodes.some(n => n.status === 'failed');
  const anySkipped = dag.nodes.some(n => n.status === 'skipped');

  if (allCompleted) {
    dag.status = 'completed';
  } else if (anyFailed && anySkipped) {
    dag.status = 'partial_failure';
  } else if (anyFailed) {
    dag.status = 'failed';
  }

  dag.updatedAt = new Date().toISOString();
  persistDag(dag);
  logger.info(`DAG ${dagId} finished: ${dag.status}`, {
    breakpoint: dag.breakpointNodeId,
  });

  return dag;
}

/**
 * Get a DAG by ID.
 */
export function getDag(dagId: string): PhysicalActionDag | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM physical_action_dags WHERE id = ?').get(dagId) as any;
  return row ? rowToDag(row) : null;
}

/**
 * List all DAGs (most recent first).
 */
export function listDags(limit = 50): PhysicalActionDag[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM physical_action_dags ORDER BY created_at DESC LIMIT ?').all(limit) as any[];
  return rows.map(rowToDag);
}

// ---------------------------------------------------------------------------
// Topological Sort (Kahn's Algorithm)
// ---------------------------------------------------------------------------

function topologicalSort(nodes: DagNode[]): DagNode[][] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  // Initialize
  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  // Build adjacency and in-degree
  for (const node of nodes) {
    for (const dep of node.dependsOn) {
      if (adjacency.has(dep)) {
        adjacency.get(dep)!.push(node.id);
        inDegree.set(node.id, (inDegree.get(node.id) ?? 0) + 1);
      }
    }
  }

  const layers: DagNode[][] = [];
  const queue: string[] = [];

  // Find all root nodes (in-degree 0)
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  while (queue.length > 0) {
    const layer: DagNode[] = [];
    const nextQueue: string[] = [];

    for (const id of queue) {
      const node = nodeMap.get(id);
      if (node) layer.push(node);

      for (const neighbor of adjacency.get(id) ?? []) {
        const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDeg);
        if (newDeg === 0) nextQueue.push(neighbor);
      }
    }

    if (layer.length > 0) layers.push(layer);
    queue.length = 0;
    queue.push(...nextQueue);
  }

  // Check for cycles
  const sortedCount = layers.reduce((sum, l) => sum + l.length, 0);
  if (sortedCount !== nodes.length) {
    logger.error(`DAG has a cycle! Sorted ${sortedCount}/${nodes.length} nodes.`);
    // Include remaining unsorted nodes as a final layer to avoid data loss
    const sortedIds = new Set(layers.flat().map(n => n.id));
    const unsorted = nodes.filter(n => !sortedIds.has(n.id));
    if (unsorted.length > 0) layers.push(unsorted);
  }

  return layers;
}
