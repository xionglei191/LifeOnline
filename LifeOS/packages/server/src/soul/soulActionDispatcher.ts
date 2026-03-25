import { createWorkerTask, executeWorkerTask } from '../workers/workerTasks.js';
import { createOrReuseSoulAction, getSoulAction } from './soulActions.js';
import { getDb } from '../db/client.js';
import { executePromotionSoulAction } from './pr6PromotionExecutor.js';
import type { EventNode } from './eventNodes.js';
import type { ContinuityRecord } from './continuityRecords.js';
import type { SoulActionCandidate } from './soulActionGenerator.js';
import type { InterventionGateDecision } from './interventionGate.js';
import type { SoulAction } from './types.js';
import { loadConfig } from '../config/configManager.js';
import { createFile } from '../vault/fileManager.js';
import { isR2Configured, uploadToR2 } from '../infra/r2Client.js';
import { appendInsightToSession, getBrainstormSessionByNoteId } from './brainstormSessions.js';
import { mapSoulActionToPhysicalAction } from './physicalActionMapper.js';
import { submitPhysicalAction } from '../integrations/executionEngine.js';
import path from 'path';
import fs from 'fs';

export interface SoulActionDispatchResult {
  dispatched: boolean;
  reason: string;
  soulActionId: string | null;
  workerTaskId: string | null;
  executionSummary?: {
    objectType: 'event_node' | 'continuity_record' | 'worker_task' | 'followup_question' | 'continuity_markdown' | 'r2_sync' | 'multiple_choices' | 'physical_action' | null;
    objectId: string | null;
    operation: 'created' | 'updated' | 'enqueued' | 'awaiting_answer' | 'persisted' | 'synced' | null;
    summary: string | null;
  } | null;
  eventNode?: EventNode | null;
  continuityRecord?: ContinuityRecord | null;
}

function buildWorkerTaskRequestFromSoulAction(action: SoulAction) {
  if (action.actionKind === 'update_persona_snapshot') {
    return {
      taskType: 'update_persona_snapshot' as const,
      input: { noteId: action.sourceNoteId },
      sourceNoteId: action.sourceNoteId,
      sourceReintegrationId: action.sourceReintegrationId ?? undefined,
    };
  }

  if (action.actionKind === 'extract_tasks') {
    return {
      taskType: 'extract_tasks' as const,
      input: { noteId: action.sourceNoteId },
      sourceNoteId: action.sourceNoteId,
      sourceReintegrationId: action.sourceReintegrationId ?? undefined,
    };
  }

  if (action.actionKind === 'launch_daily_report') {
    return {
      taskType: 'daily_report' as const,
      sourceNoteId: action.sourceNoteId,
      sourceReintegrationId: action.sourceReintegrationId ?? undefined,
    };
  }

  if (action.actionKind === 'launch_weekly_report') {
    return {
      taskType: 'weekly_report' as const,
      sourceNoteId: action.sourceNoteId,
      sourceReintegrationId: action.sourceReintegrationId ?? undefined,
    };
  }

  if (action.actionKind === 'launch_openclaw_task') {
    return {
      taskType: 'openclaw_task' as const,
      input: { instruction: action.governanceReason ?? '' },
      sourceNoteId: action.sourceNoteId,
      sourceReintegrationId: action.sourceReintegrationId ?? undefined,
    };
  }

  throw new Error(`Unsupported soul action kind for worker dispatch: ${action.actionKind}`);
}

export async function dispatchSoulActionCandidate(
  candidate: SoulActionCandidate,
  gateDecision: InterventionGateDecision,
): Promise<SoulActionDispatchResult> {
  // observe_only / discard → do nothing
  if (gateDecision.decision === 'observe_only' || gateDecision.decision === 'discard') {
    return {
      dispatched: false,
      reason: gateDecision.reason,
      soulActionId: null,
      workerTaskId: null,
    };
  }

  // queue_for_review → create pending soul action for human review
  if (gateDecision.decision === 'queue_for_review') {
    const soulAction = createOrReuseSoulAction({
      sourceNoteId: candidate.sourceNoteId,
      actionKind: candidate.actionKind,
      governanceReason: gateDecision.reason,
    });

    return {
      dispatched: false,
      reason: gateDecision.reason,
      soulActionId: soulAction.id,
      workerTaskId: null,
    };
  }

  // dispatch_now → create pre-approved soul action and dispatch immediately
  const soulAction = createOrReuseSoulAction({
    sourceNoteId: candidate.sourceNoteId,
    actionKind: candidate.actionKind,
    governanceStatus: 'approved',
    governanceReason: gateDecision.reason,
  });

  return dispatchApprovedSoulAction(soulAction.id);
}

export async function dispatchApprovedSoulAction(soulActionId: string): Promise<SoulActionDispatchResult> {
  const soulAction = getSoulAction(soulActionId);
  if (!soulAction) {
    return {
      dispatched: false,
      reason: 'soul action not found',
      soulActionId: null,
      workerTaskId: null,
    };
  }

  if (soulAction.governanceStatus !== 'approved') {
    return {
      dispatched: false,
      reason: 'only approved soul actions can be dispatched',
      soulActionId: soulAction.id,
      workerTaskId: null,
    };
  }

  if (soulAction.executionStatus !== 'not_dispatched') {
    return {
      dispatched: false,
      reason: 'only not_dispatched soul actions can be dispatched',
      soulActionId: soulAction.id,
      workerTaskId: soulAction.workerTaskId,
    };
  }

  if (
    soulAction.actionKind === 'create_event_node'
    || soulAction.actionKind === 'promote_event_node'
    || soulAction.actionKind === 'promote_continuity_record'
  ) {
    const result = executePromotionSoulAction(soulAction);
    const now = new Date().toISOString();
    getDb().prepare(`
      UPDATE soul_actions
      SET execution_status = ?, updated_at = ?, started_at = ?, finished_at = ?, error = NULL, result_summary = ?
      WHERE id = ?
    `).run('succeeded', now, now, now, result.summary, soulAction.id);

    // Feedback P2: write execution result back to the originating BrainstormSession
    if (soulAction.sourceNoteId) {
      const session = getBrainstormSessionByNoteId(soulAction.sourceNoteId);
      if (session) {
        appendInsightToSession(session.id, `[execution: ${soulAction.actionKind}] ${result.summary}`);
      }
    }

    return {
      dispatched: true,
      reason: result.summary,
      soulActionId: soulAction.id,
      workerTaskId: null,
      executionSummary: result.eventNode
        ? {
            objectType: 'event_node',
            objectId: result.eventNode.id,
            operation: result.summary.startsWith('已更新') ? 'updated' : 'created',
            summary: result.summary,
          }
        : result.continuityRecord
          ? {
              objectType: 'continuity_record',
              objectId: result.continuityRecord.id,
              operation: result.summary.startsWith('已更新') ? 'updated' : 'created',
              summary: result.summary,
            }
          : null,
      eventNode: result.eventNode,
      continuityRecord: result.continuityRecord,
    };
  }

  // ask_followup_question → mark as pending (awaiting user answer), no worker task
  if (soulAction.actionKind === 'ask_followup_question') {
    const now = new Date().toISOString();
    getDb().prepare(`
      UPDATE soul_actions
      SET execution_status = 'pending', updated_at = ?, started_at = ?
      WHERE id = ?
    `).run(now, now, soulAction.id);
    return {
      dispatched: true,
      reason: '追问已发出，等待用户回答',
      soulActionId: soulAction.id,
      workerTaskId: null,
      executionSummary: {
        objectType: 'followup_question',
        objectId: soulAction.id,
        operation: 'awaiting_answer',
        summary: soulAction.governanceReason ?? '追问已发出',
      },
      eventNode: null,
      continuityRecord: null,
    };
  }

  // persist_continuity_markdown → write Vault file directly, no worker task
  if (soulAction.actionKind === 'persist_continuity_markdown') {
    const now = new Date().toISOString();
    const config = await loadConfig();
    const dateStr = now.slice(0, 10); // YYYY-MM-DD
    const insightContent = soulAction.governanceReason ?? '认知洞察';

    // Build the Markdown content
    const md = [
      '---',
      `source_note_id: ${soulAction.sourceNoteId}`,
      `soul_action_id: ${soulAction.id}`,
      `created_at: ${now}`,
      'type: continuity_insight',
      '---',
      '',
      `# 连续性认知记录`,
      '',
      insightContent,
      '',
      `> 生成时间: ${now}`,
      `> 来源笔记: ${soulAction.sourceNoteId}`,
    ].join('\n');

    // Write to Vault: soul/continuity/YYYY-MM-DD-{action-id-suffix}.md
    const idSuffix = soulAction.id.split(':').pop() ?? soulAction.id.slice(-8);
    const continuityDir = path.join(config.vaultPath, 'soul', 'continuity');
    const filePath = path.join(continuityDir, `${dateStr}-${idSuffix}.md`);

    try {
      await createFile(filePath, md);
    } catch (e) {
      // Mark as failed if file write fails
      getDb().prepare(`
        UPDATE soul_actions SET execution_status = 'failed', error = ?, updated_at = ?, finished_at = ? WHERE id = ?
      `).run(String(e), now, now, soulAction.id);
      return {
        dispatched: false,
        reason: `Vault 写入失败: ${e}`,
        soulActionId: soulAction.id,
        workerTaskId: null,
        executionSummary: null,
        eventNode: null,
        continuityRecord: null,
      };
    }

    // Mark as succeeded
    getDb().prepare(`
      UPDATE soul_actions
      SET execution_status = 'succeeded', updated_at = ?, started_at = ?, finished_at = ?, result_summary = ?
      WHERE id = ?
    `).run(now, now, now, `已写入 ${filePath}`, soulAction.id);

    return {
      dispatched: true,
      reason: '连续性认知已持久化到 Vault',
      soulActionId: soulAction.id,
      workerTaskId: null,
      executionSummary: {
        objectType: 'continuity_markdown',
        objectId: soulAction.id,
        operation: 'persisted',
        summary: `已写入 ${filePath}`,
      },
      eventNode: null,
      continuityRecord: null,
    };
  }

  // sync_continuity_to_r2 → upload Vault file to R2 cold storage
  if (soulAction.actionKind === 'sync_continuity_to_r2') {
    const now = new Date().toISOString();

    if (!isR2Configured()) {
      getDb().prepare(`
        UPDATE soul_actions SET execution_status = 'failed', error = ?, updated_at = ?, finished_at = ? WHERE id = ?
      `).run('R2 未配置。请设置环境变量: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME', now, now, soulAction.id);
      return {
        dispatched: false,
        reason: 'R2 未配置，无法同步',
        soulActionId: soulAction.id,
        workerTaskId: null,
        executionSummary: null,
        eventNode: null,
        continuityRecord: null,
      };
    }

    // Find the Vault file to upload (from governance reason or result summary)
    const fileHint = soulAction.governanceReason ?? '';
    const config = await loadConfig();
    let filePath: string;
    let fileContent: string;

    // Try to find a continuity file from the hint
    const continuityDir = path.join(config.vaultPath, 'soul', 'continuity');
    try {
      if (fileHint.includes(continuityDir)) {
        filePath = fileHint.match(new RegExp(`${continuityDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\s]+\\.md`))?.[0] ?? '';
      } else {
        // Find the most recent continuity file
        const files = fs.existsSync(continuityDir) ? fs.readdirSync(continuityDir).filter(f => f.endsWith('.md')).sort().reverse() : [];
        filePath = files.length > 0 ? path.join(continuityDir, files[0]) : '';
      }

      if (!filePath || !fs.existsSync(filePath)) {
        throw new Error('未找到可同步的 continuity 文件');
      }

      fileContent = await fs.promises.readFile(filePath, 'utf-8');
    } catch (e) {
      getDb().prepare(`
        UPDATE soul_actions SET execution_status = 'failed', error = ?, updated_at = ?, finished_at = ? WHERE id = ?
      `).run(String(e), now, now, soulAction.id);
      return {
        dispatched: false,
        reason: `文件读取失败: ${e}`,
        soulActionId: soulAction.id,
        workerTaskId: null,
        executionSummary: null,
        eventNode: null,
        continuityRecord: null,
      };
    }

    // Upload to R2
    const r2Key = `continuity/${path.basename(filePath)}`;
    try {
      await uploadToR2(r2Key, fileContent);
    } catch (e) {
      getDb().prepare(`
        UPDATE soul_actions SET execution_status = 'failed', error = ?, updated_at = ?, finished_at = ? WHERE id = ?
      `).run(String(e), now, now, soulAction.id);
      return {
        dispatched: false,
        reason: `R2 上传失败: ${e}`,
        soulActionId: soulAction.id,
        workerTaskId: null,
        executionSummary: null,
        eventNode: null,
        continuityRecord: null,
      };
    }

    getDb().prepare(`
      UPDATE soul_actions
      SET execution_status = 'succeeded', updated_at = ?, started_at = ?, finished_at = ?, result_summary = ?
      WHERE id = ?
    `).run(now, now, now, `已同步到 R2: ${r2Key}`, soulAction.id);

    return {
      dispatched: true,
      reason: '已同步到 R2 冷存储',
      soulActionId: soulAction.id,
      workerTaskId: null,
      executionSummary: {
        objectType: 'r2_sync',
        objectId: soulAction.id,
        operation: 'synced',
        summary: `已同步 ${path.basename(filePath)} → R2:${r2Key}`,
      },
      eventNode: null,
      continuityRecord: null,
    };
  }

  // dispatch_physical_action -> translate via mapper and submit to execution engine (single or DAG)
  if (soulAction.actionKind === 'dispatch_physical_action') {
    const now = new Date().toISOString();
    const intent = soulAction.governanceReason || '';
    
    const mapperResult = await mapSoulActionToPhysicalAction(intent);
    
    if (!mapperResult) {
      getDb().prepare(`
        UPDATE soul_actions SET execution_status = 'failed', error = ?, updated_at = ?, finished_at = ? WHERE id = ?
      `).run('物理动作转换解析失败 (Mapper returned null)', now, now, soulAction.id);
      
      return {
        dispatched: false,
        reason: '物理动作解析失败，无法提取确切结构',
        soulActionId: soulAction.id,
        workerTaskId: null,
      };
    }

    // --- Multi-step DAG path ---
    if (mapperResult.kind === 'multi') {
      const { createDag, executeDag } = await import('./dagExecutor.js');
      const dag = createDag(mapperResult.steps, soulAction.id, intent);
      
      // Fire DAG execution asynchronously
      executeDag(dag.id).catch(e => console.error('[dagExecutor] DAG execution failed', e));

      getDb().prepare(`
        UPDATE soul_actions
        SET execution_status = 'succeeded', updated_at = ?, started_at = ?, finished_at = ?, result_summary = ?
        WHERE id = ?
      `).run(now, now, now, `DAG 已创建并启动: ${dag.nodes.length} 步, dagId=${dag.id}`, soulAction.id);

      return {
        dispatched: true,
        reason: `已创建 ${dag.nodes.length} 步物理动作 DAG`,
        soulActionId: soulAction.id,
        workerTaskId: null,
        executionSummary: {
          objectType: 'physical_action',
          objectId: dag.id,
          operation: 'enqueued',
          summary: `DAG (${dag.nodes.length} nodes): ${dag.description}`,
        },
      };
    }

    // --- Single-step path (unchanged logic) ---
    let defaultTitle = `物理动作: ${mapperResult.type}`;
    switch (mapperResult.type) {
      case 'calendar_event': defaultTitle = (mapperResult.payload as import('@lifeos/shared').CalendarEventPayload).title; break;
      case 'send_email': defaultTitle = (mapperResult.payload as import('@lifeos/shared').SendEmailPayload).subject; break;
      case 'webhook_call': defaultTitle = `Webhook: ${(mapperResult.payload as import('@lifeos/shared').WebhookCallPayload).url}`; break;
      case 'iot_command': defaultTitle = `IoT: ${(mapperResult.payload as import('@lifeos/shared').IoTCommandPayload).command}`; break;
    }
    const submitted = await submitPhysicalAction(
      mapperResult.type, 
      mapperResult.payload, 
      defaultTitle, 
      soulAction.sourceNoteId ?? undefined,
      soulAction.id
    );

    getDb().prepare(`
      UPDATE soul_actions
      SET execution_status = 'succeeded', updated_at = ?, started_at = ?, finished_at = ?, result_summary = ?
      WHERE id = ?
    `).run(now, now, now, `物理动作已创建: [${submitted.type}] 状态为 ${submitted.status}`, soulAction.id);

    return {
      dispatched: true,
      reason: `已提交物理动作至执行引擎: ${submitted.type}`,
      soulActionId: soulAction.id,
      workerTaskId: null,
      executionSummary: {
        objectType: 'physical_action',
        objectId: submitted.id,
        operation: 'enqueued',
        summary: `触发 ${submitted.type} (${submitted.status})`,
      },
    };
  }

  // multiple_choices → explicitly queue for human review and selection
  if (soulAction.actionKind === 'multiple_choices') {
    const now = new Date().toISOString();
    getDb().prepare(`
      UPDATE soul_actions
      SET execution_status = 'pending', updated_at = ?, started_at = ?
      WHERE id = ?
    `).run(now, now, soulAction.id);
    return {
      dispatched: true,
      reason: '已生成双生子风险备选方案，等待人工抉择',
      soulActionId: soulAction.id,
      workerTaskId: null,
      executionSummary: {
        objectType: 'multiple_choices',
        objectId: soulAction.id,
        operation: 'awaiting_answer',
        summary: soulAction.governanceReason ?? '双生子方案等待抉择',
      },
      eventNode: null,
      continuityRecord: null,
    };
  }

  const request = buildWorkerTaskRequestFromSoulAction(soulAction);
  const task = createWorkerTask(request);
  await executeWorkerTask(task.id);

  // Feedback P2: write execution result back to the originating BrainstormSession (fire-and-forget)
  if (soulAction.sourceNoteId) {
    try {
      const session = getBrainstormSessionByNoteId(soulAction.sourceNoteId);
      if (session) {
        appendInsightToSession(session.id, `[execution: ${soulAction.actionKind}] 工作任务已入队 (task: ${task.id})`);
      }
    } catch { /* best-effort, never block dispatch */ }
  }

  return {
    dispatched: true,
    reason: 'approved soul action dispatched through worker host',
    soulActionId: soulAction.id,
    workerTaskId: task.id,
    executionSummary: {
      objectType: 'worker_task',
      objectId: task.id,
      operation: 'enqueued',
      summary: 'approved soul action dispatched through worker host',
    },
    eventNode: null,
    continuityRecord: null,
  };
}
