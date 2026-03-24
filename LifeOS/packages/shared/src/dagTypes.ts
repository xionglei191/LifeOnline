/**
 * DAG Types — defines the structure for chained multi-step physical actions
 * with dependency ordering and partial failure tracking.
 */

// ---------------------------------------------------------------------------
// Node & Edge
// ---------------------------------------------------------------------------

export const SUPPORTED_DAG_NODE_STATUSES = [
  'waiting',
  'executing',
  'completed',
  'failed',
  'skipped',
] as const;
export type DagNodeStatus = typeof SUPPORTED_DAG_NODE_STATUSES[number];

export interface DagNode {
  /** Unique node ID within the DAG */
  id: string;
  /** PhysicalAction type for this step */
  type: import('./physicalActionTypes.js').PhysicalActionType;
  /** Payload for this step */
  payload: import('./physicalActionTypes.js').PhysicalActionPayload;
  /** Human-readable title for this step */
  title: string;
  /** IDs of upstream nodes that must complete before this node can execute */
  dependsOn: string[];
  /** Current execution status */
  status: DagNodeStatus;
  /** ID of the PhysicalAction created for this node (set after submission) */
  physicalActionId: string | null;
  /** Error message if this node failed */
  errorMessage: string | null;
}

export interface DagEdge {
  from: string;
  to: string;
}

// ---------------------------------------------------------------------------
// DAG Status
// ---------------------------------------------------------------------------

export const SUPPORTED_DAG_STATUSES = [
  'pending',
  'running',
  'completed',
  'partial_failure',
  'failed',
] as const;
export type DagStatus = typeof SUPPORTED_DAG_STATUSES[number];

// ---------------------------------------------------------------------------
// Core DAG Interface
// ---------------------------------------------------------------------------

export interface PhysicalActionDag {
  id: string;
  /** The SoulAction that initiated this DAG */
  sourceSoulActionId: string | null;
  /** Human-readable description of the overall intent */
  description: string;
  /** Ordered list of nodes */
  nodes: DagNode[];
  /** Derived edges (from dependsOn) */
  edges: DagEdge[];
  /** Overall DAG status */
  status: DagStatus;
  /** Node ID where execution stopped due to failure */
  breakpointNodeId: string | null;
  /** Timestamps */
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Mapper Step (used by physicalActionMapper to describe multi-step intents)
// ---------------------------------------------------------------------------

export interface PhysicalActionStep {
  type: import('./physicalActionTypes.js').PhysicalActionType;
  payload: import('./physicalActionTypes.js').PhysicalActionPayload;
  title: string;
  dependsOn?: string[];
}
