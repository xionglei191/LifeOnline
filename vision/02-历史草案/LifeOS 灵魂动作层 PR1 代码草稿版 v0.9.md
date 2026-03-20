# 《Soul Constitution》v0.9
## LifeOS 灵魂动作层 PR1 代码草稿版

这一版开始从“逐文件实现草案”进入“接近真实代码”的层次。

也就是说，v0.9 的目标不再只是描述结构，
而是直接给出一版**可以非常接近复制进代码库的草稿**。

注意：
- 这仍然是设计稿，不是直接改仓库
- 目标是让后续真正实现时几乎不需要重新发明结构
- 范围仍然严格限定在 PR1：`schema.ts`、`client.ts`、`soulActionTypes.ts`、`soulActionStore.ts`

---

# 1. `schema.ts` 草稿

建议在 [schema.ts](LifeOS/packages/server/src/db/schema.ts) 中新增如下内容。

## 1.1 新增常量

```ts
export const SOUL_ACTION_TABLE_COLUMNS_SQL = `  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  action_category TEXT NOT NULL,
  action_type TEXT NOT NULL,
  target_type TEXT,
  priority TEXT NOT NULL CHECK(priority IN ('low', 'medium', 'high')),
  status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'dispatched', 'completed', 'failed', 'discarded')),
  payload_json TEXT NOT NULL,
  reason TEXT,
  requires_approval INTEGER NOT NULL DEFAULT 0,
  approval_status TEXT,
  dispatch_attempts INTEGER NOT NULL DEFAULT 0,
  dispatched_at TEXT,
  completed_at TEXT,
  failed_at TEXT,
  feedback_ref TEXT,
  result_summary TEXT,
  error_message TEXT`;

export const SOUL_ACTION_INDEXES_SQL = `CREATE INDEX IF NOT EXISTS idx_soul_actions_status ON soul_actions(status);
CREATE INDEX IF NOT EXISTS idx_soul_actions_action_type ON soul_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_soul_actions_source_type ON soul_actions(source_type);
CREATE INDEX IF NOT EXISTS idx_soul_actions_created_at ON soul_actions(created_at);`;
```

## 1.2 拼接回 `SCHEMA`

建议在 `task_schedules` 之后、`ai_prompts` 之前插入：

```ts
CREATE TABLE IF NOT EXISTS soul_actions (
${SOUL_ACTION_TABLE_COLUMNS_SQL}
);

${SOUL_ACTION_INDEXES_SQL}
```

## 1.3 结果形态示意

也就是说 `SCHEMA` 局部会变成：

```ts
CREATE TABLE IF NOT EXISTS task_schedules (
${TASK_SCHEDULE_TABLE_COLUMNS_SQL}
);

${TASK_SCHEDULE_INDEXES_SQL}

CREATE TABLE IF NOT EXISTS soul_actions (
${SOUL_ACTION_TABLE_COLUMNS_SQL}
);

${SOUL_ACTION_INDEXES_SQL}

CREATE TABLE IF NOT EXISTS ai_prompts (
  ...
);
```

---

# 2. `client.ts` 草稿

v0.9 对 [client.ts](LifeOS/packages/server/src/db/client.ts) 的判断依然非常克制。

## 2.1 推荐改法

**第一版不需要额外新增任何 `soul_actions` 专属迁移段。**

也就是说，只要：

```ts
database.exec(SCHEMA);
```

继续存在，就已经足够让新表被初始化出来。

## 2.2 为什么这里不写更多
因为 PR1 还没有历史 `soul_actions` 表，需要兼容的老结构为空。
所以这里最稳的方案是：
- 不写空转迁移
- 不做额外 rebuild
- 不提前为未来字段变更背包袱

## 2.3 唯一建议
如果后续 reviewer 担心“以后扩列怎么办”，
可以在文档或注释层说明：
- 后续如需扩列，再按已有 `PRAGMA table_info(...)` 风格增量加列即可

但 **PR1 代码里本身不必预写这段**。

---

# 3. `soulActionTypes.ts` 草稿

建议新增文件：
- `packages/server/src/soul/soulActionTypes.ts`

推荐第一版内容如下。

```ts
export type SoulActionStatus =
  | 'pending'
  | 'approved'
  | 'dispatched'
  | 'completed'
  | 'failed'
  | 'discarded';

export type SoulActionCategory =
  | 'state_update'
  | 'memory_promotion'
  | 'interaction'
  | 'task_launch'
  | 'artifact_output'
  | 'bridge_sync';

export type SoulActionTargetType =
  | 'sqlite'
  | 'vault'
  | 'worker_task'
  | 'openclaw'
  | 'r2'
  | 'user';

export type SoulActionSourceType =
  | 'brainstorm_session'
  | 'persona_state'
  | 'event_node'
  | 'intervention_decision'
  | 'continuity_record'
  | 'schedule'
  | 'system';

export type SoulActionType =
  | 'ask_followup_question'
  | 'update_persona_snapshot'
  | 'create_event_node'
  | 'persist_continuity_markdown'
  | 'launch_daily_report'
  | 'launch_weekly_report'
  | 'launch_openclaw_task'
  | 'sync_continuity_to_r2';

export interface SoulAction {
  id: string;
  createdAt: string;
  updatedAt: string;
  sourceType: SoulActionSourceType;
  sourceId: string;
  actionCategory: SoulActionCategory;
  actionType: SoulActionType;
  targetType: SoulActionTargetType | null;
  priority: 'low' | 'medium' | 'high';
  status: SoulActionStatus;
  payload: Record<string, unknown>;
  reason: string | null;
  requiresApproval: boolean;
  approvalStatus: 'pending' | 'approved' | 'rejected' | null;
  dispatchAttempts: number;
  dispatchedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  feedbackRef: string | null;
  resultSummary: string | null;
  errorMessage: string | null;
}

export interface CreateSoulActionInput {
  sourceType: SoulActionSourceType;
  sourceId: string;
  actionCategory: SoulActionCategory;
  actionType: SoulActionType;
  targetType?: SoulActionTargetType | null;
  priority?: 'low' | 'medium' | 'high';
  payload?: Record<string, unknown>;
  reason?: string | null;
  requiresApproval?: boolean;
  approvalStatus?: 'pending' | 'approved' | 'rejected' | null;
}

export interface ListSoulActionFilters {
  status?: SoulActionStatus;
  actionType?: SoulActionType;
  sourceType?: SoulActionSourceType;
  limit?: number;
}
```

## 3.1 这一版为什么够用
因为它已经能完整承接：
- 表结构
- store 输出
- 后续 generator 输入
- 后续 dispatcher 生命周期

但又没有提前加入：
- payload 子类型系统
- action-specific union payload
- review 模型
- 风险等级模型

这正是 PR1 需要的克制。

---

# 4. `soulActionStore.ts` 草稿

建议新增文件：
- `packages/server/src/soul/soulActionStore.ts`

推荐第一版内容如下。

```ts
import crypto from 'crypto';
import { getDb } from '../db/client.js';
import type {
  CreateSoulActionInput,
  ListSoulActionFilters,
  SoulAction,
  SoulActionStatus,
} from './soulActionTypes.js';

interface SoulActionRow {
  id: string;
  created_at: string;
  updated_at: string;
  source_type: string;
  source_id: string;
  action_category: string;
  action_type: string;
  target_type: string | null;
  priority: 'low' | 'medium' | 'high';
  status: SoulActionStatus;
  payload_json: string;
  reason: string | null;
  requires_approval: number;
  approval_status: 'pending' | 'approved' | 'rejected' | null;
  dispatch_attempts: number;
  dispatched_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  feedback_ref: string | null;
  result_summary: string | null;
  error_message: string | null;
}

function buildSoulActionId(): string {
  return crypto.randomUUID();
}

function getNowIsoString(): string {
  return new Date().toISOString();
}

function rowToSoulAction(row: SoulActionRow): SoulAction {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sourceType: row.source_type as SoulAction['sourceType'],
    sourceId: row.source_id,
    actionCategory: row.action_category as SoulAction['actionCategory'],
    actionType: row.action_type as SoulAction['actionType'],
    targetType: row.target_type as SoulAction['targetType'],
    priority: row.priority,
    status: row.status,
    payload: JSON.parse(row.payload_json),
    reason: row.reason,
    requiresApproval: row.requires_approval === 1,
    approvalStatus: row.approval_status,
    dispatchAttempts: row.dispatch_attempts,
    dispatchedAt: row.dispatched_at,
    completedAt: row.completed_at,
    failedAt: row.failed_at,
    feedbackRef: row.feedback_ref,
    resultSummary: row.result_summary,
    errorMessage: row.error_message,
  };
}

export function createSoulAction(input: CreateSoulActionInput): SoulAction {
  const db = getDb();
  const now = getNowIsoString();
  const id = buildSoulActionId();

  db.prepare(`
    INSERT INTO soul_actions (
      id,
      created_at,
      updated_at,
      source_type,
      source_id,
      action_category,
      action_type,
      target_type,
      priority,
      status,
      payload_json,
      reason,
      requires_approval,
      approval_status,
      dispatch_attempts,
      dispatched_at,
      completed_at,
      failed_at,
      feedback_ref,
      result_summary,
      error_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, NULL, NULL, NULL, NULL)
  `).run(
    id,
    now,
    now,
    input.sourceType,
    input.sourceId,
    input.actionCategory,
    input.actionType,
    input.targetType ?? null,
    input.priority ?? 'medium',
    'pending',
    JSON.stringify(input.payload ?? {}),
    input.reason ?? null,
    input.requiresApproval ? 1 : 0,
    input.approvalStatus ?? null,
  );

  return getSoulAction(id)!;
}

export function getSoulAction(id: string): SoulAction | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM soul_actions WHERE id = ?').get(id) as SoulActionRow | undefined;
  return row ? rowToSoulAction(row) : null;
}

export function listSoulActions(filters: ListSoulActionFilters = {}): SoulAction[] {
  const db = getDb();
  const clauses: string[] = [];
  const params: Array<string | number> = [];

  if (filters.status) {
    clauses.push('status = ?');
    params.push(filters.status);
  }

  if (filters.actionType) {
    clauses.push('action_type = ?');
    params.push(filters.actionType);
  }

  if (filters.sourceType) {
    clauses.push('source_type = ?');
    params.push(filters.sourceType);
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const limit = Math.max(1, Math.min(filters.limit ?? 100, 500));

  const rows = db
    .prepare(`SELECT * FROM soul_actions ${whereClause} ORDER BY created_at DESC LIMIT ?`)
    .all(...params, limit) as SoulActionRow[];

  return rows.map(rowToSoulAction);
}

export function updateSoulActionStatus(id: string, status: SoulActionStatus): SoulAction {
  const db = getDb();
  const now = getNowIsoString();

  const result = db.prepare(`
    UPDATE soul_actions
    SET status = ?, updated_at = ?
    WHERE id = ?
  `).run(status, now, id);

  if (result.changes === 0) {
    throw new Error('Soul action not found');
  }

  return getSoulAction(id)!;
}

export function completeSoulAction(id: string, resultSummary?: string, feedbackRef?: string): SoulAction {
  const db = getDb();
  const now = getNowIsoString();

  const result = db.prepare(`
    UPDATE soul_actions
    SET status = 'completed',
        updated_at = ?,
        completed_at = ?,
        result_summary = ?,
        feedback_ref = ?
    WHERE id = ?
  `).run(now, now, resultSummary ?? null, feedbackRef ?? null, id);

  if (result.changes === 0) {
    throw new Error('Soul action not found');
  }

  return getSoulAction(id)!;
}

export function failSoulAction(id: string, errorMessage: string): SoulAction {
  const db = getDb();
  const now = getNowIsoString();

  const result = db.prepare(`
    UPDATE soul_actions
    SET status = 'failed',
        updated_at = ?,
        failed_at = ?,
        error_message = ?
    WHERE id = ?
  `).run(now, now, errorMessage, id);

  if (result.changes === 0) {
    throw new Error('Soul action not found');
  }

  return getSoulAction(id)!;
}
```

---

# 5. 这版代码草稿里哪些地方故意没做

这很重要。

## 5.1 没做 `discardSoulAction(...)`
因为现在完全可以先用：

```ts
updateSoulActionStatus(id, 'discarded')
```

先不必增加专用函数。

## 5.2 没做 `approveSoulAction(...)`
因为 approval 语义属于 PR2 / PR3 的 review/gate 范围。
PR1 只提供最低层运行态支撑。

## 5.3 没做事务
因为所有操作仍然是单条 insert / update。
事务现在收益不大。

## 5.4 没做 payload 校验器
因为 PR1 还没有真正的 generator 和 dispatcher。
现在 payload 只需要是结构稳定的 `Record<string, unknown>` 即可。

---

# 6. 如果真的按 v0.9 实现，PR1 应达到什么状态

完成后应满足：

- 数据库初始化后存在 `soul_actions`
- server build 通过
- store 能：
  - create
  - get
  - list
  - update status
  - complete
  - fail
- 现有功能零行为变化

也就是说，v0.9 对 PR1 的定义已经非常明确：

> 这不是一个“让灵魂开始执行”的 PR，而是一个“让灵魂动作层第一次拥有真实、稳定、可读写运行态”的 PR。

---

# 7. v0.9 之后最自然的下一步

当 PR1 真的存在后，下一版最自然的不是继续打磨 store，
而是进入 PR2 的设计稿，也就是：

- `soulActionGenerator.ts`
- `interventionGate.ts`
- `soulActionDispatcher.ts`

并且只接第一批低风险动作：
- `ask_followup_question`
- `update_persona_snapshot`
- `create_event_node`
- `persist_continuity_markdown`

到那时，灵魂动作层才会第一次从“存在”走向“流动”。

---

# 8. 一句话总结 v0.9

> v0.9 的意义，是把 `SoulAction` 的首个 PR 从“逐文件实现草案”进一步压成“接近真实 TypeScript 代码的草稿版”：表结构、类型定义、store 函数、row mapper、SQL 语句，都已经被写到几乎可以直接复制进仓库再微调的程度。