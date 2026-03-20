# 《Soul Constitution》v0.8
## LifeOS 灵魂动作层 PR1 逐文件实现草案

这一版继续往下压，不再只停留在“做哪些文件”，
而是进一步回答：

> PR1 里每个文件具体应该写出什么结构、什么常量、什么函数签名，才既够用又保守？

v0.8 的目标就是把 PR1 压到接近伪代码级实现稿。

---

# 1. PR1 仍然只做三件事

先再次压实边界：

PR1 只做：
1. `schema.ts` 新增 `soul_actions` 表与索引
2. 新增 `soulActionTypes.ts`
3. 新增 `soulActionStore.ts`
4. `client.ts` 做最小初始化/迁移接入

除此之外都不做。

也就是说，v0.8 虽然更接近实现，但仍然不跨出 PR1 范围。

---

# 2. [packages/server/src/db/schema.ts](packages/server/src/db/schema.ts) 应怎么写

当前 `schema.ts` 的风格非常清楚：
- 先定义列 SQL 常量
- 再定义索引 SQL 常量
- 最后拼接到总 `SCHEMA`

所以 `soul_actions` 应完全沿用这个风格。

---

## 2.1 建议新增的常量一：`SOUL_ACTION_TABLE_COLUMNS_SQL`
建议新增：

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
```

### 为什么这版只对 `priority` 和 `status` 加 CHECK
因为：
- 这两个枚举已经很稳定
- 直接影响最基本生命周期一致性

而：
- `source_type`
- `action_category`
- `action_type`
- `target_type`

虽然概念上也可做 CHECK，
但 PR1 先不建议做死。

原因：
- 这些字段还在快速演化
- 一上来做硬 CHECK，后续每加一个类型都要迁移/重建
- 会把第一步搞重

所以 v0.8 的判断是：

> PR1 先对最稳定的生命周期字段做约束，对语义仍在演化的字段保持柔性。

---

## 2.2 建议新增的常量二：`SOUL_ACTION_INDEXES_SQL`
建议新增：

```ts
export const SOUL_ACTION_INDEXES_SQL = `CREATE INDEX IF NOT EXISTS idx_soul_actions_status ON soul_actions(status);
CREATE INDEX IF NOT EXISTS idx_soul_actions_action_type ON soul_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_soul_actions_source_type ON soul_actions(source_type);
CREATE INDEX IF NOT EXISTS idx_soul_actions_created_at ON soul_actions(created_at);`;
```

### 为什么先不加更多索引
例如先不加：
- `source_id`
- `approval_status`
- `target_type`

因为 PR1 的目标只是：
- 列表
- 调试
- 基础 review

而不是性能优化阶段。

---

## 2.3 `SCHEMA` 中应如何拼接
建议风格与现有 `worker_tasks` / `task_schedules` 保持一致：

```ts
CREATE TABLE IF NOT EXISTS soul_actions (
${SOUL_ACTION_TABLE_COLUMNS_SQL}
);

${SOUL_ACTION_INDEXES_SQL}
```

### 放置位置建议
建议放在：
- `worker_tasks`
- `task_schedules`
- `ai_prompts`

之间或之后都可以，
但更建议放在 `task_schedules` 后、`ai_prompts` 前。

原因：
- 它本质也是运行态对象
- 语义上更接近 worker/schedule，而不是 AI 配置表

---

# 3. [packages/server/src/db/client.ts](packages/server/src/db/client.ts) 应怎么接

PR1 对 `client.ts` 的要求非常克制。

---

## 3.1 import 应增加什么
如果在 `schema.ts` 中导出了新的常量，
`client.ts` 的 import 建议从：

```ts
import { SCHEMA, WORKER_TASK_TABLE_COLUMNS_SQL, WORKER_TASK_INDEXES_SQL, TASK_SCHEDULE_TABLE_COLUMNS_SQL, TASK_SCHEDULE_INDEXES_SQL } from './schema.js';
```

变成：

```ts
import {
  SCHEMA,
  WORKER_TASK_TABLE_COLUMNS_SQL,
  WORKER_TASK_INDEXES_SQL,
  TASK_SCHEDULE_TABLE_COLUMNS_SQL,
  TASK_SCHEDULE_INDEXES_SQL,
  SOUL_ACTION_TABLE_COLUMNS_SQL,
  SOUL_ACTION_INDEXES_SQL,
} from './schema.js';
```

虽然 PR1 里暂时可能未直接使用 `SOUL_ACTION_TABLE_COLUMNS_SQL` / `SOUL_ACTION_INDEXES_SQL`，
但如果后面要做表重建或列修复，保留入口是合理的。

不过更保守的做法也成立：
- PR1 先只 import `SCHEMA`
- 新常量只留在 `schema.ts`

v0.8 更偏向第二种：

> 如果 `client.ts` 当前不直接使用这些新常量，就先不要额外 import，避免未使用导入。

---

## 3.2 `initDatabase()` 第一版最适合怎么改
第一版只需要继续保持：

```ts
database.exec(SCHEMA);
```

也就是说，
只要 `SCHEMA` 已经包含 `soul_actions`，
理论上 PR1 就已经能建表。

---

## 3.3 要不要加 `PRAGMA table_info(soul_actions)` 迁移段
v0.8 的建议是：

### 可以不加
因为 PR1 是第一次引入 `soul_actions`，
还没有历史包袱。

也就是说：
- 第一次只靠 `CREATE TABLE IF NOT EXISTS` 就够了
- 不必为了未来预演过多迁移逻辑

### 什么时候再加
等 PR2 / PR3 真要加列时，
再仿照当前已有模式补：
- `ALTER TABLE ... ADD COLUMN ...`

所以 v0.8 的判断很明确：

> PR1 的 `client.ts` 只要能跟着 `SCHEMA` 初始化出表即可，不要过早引入空转迁移代码。

---

# 4. `packages/server/src/soul/soulActionTypes.ts` 应怎么写

这个文件应该尽量纯。

---

## 4.1 第一组：基础枚举类型
建议先写：

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
```

---

## 4.2 第二组：第一版 `SoulActionType`
建议写死为：

```ts
export type SoulActionType =
  | 'ask_followup_question'
  | 'update_persona_snapshot'
  | 'create_event_node'
  | 'persist_continuity_markdown'
  | 'launch_daily_report'
  | 'launch_weekly_report'
  | 'launch_openclaw_task'
  | 'sync_continuity_to_r2';
```

### 为什么写死
因为 PR1 就应该先把边界定清楚。
如果现在就写成 `string`，
后面 generator / dispatcher 设计很容易开始滑。

---

## 4.3 第三组：主对象类型
建议结构：

```ts
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
```

### 为什么 `targetType` / `reason` / `feedbackRef` 等先允许 `null`
因为 PR1 阶段很多动作还只是“存在中的候选运行态”，
并不是每条记录都会立刻具备完整语义。

先允许 nullable，
后续比过早强约束更稳。

---

## 4.4 第四组：输入类型
建议新增两个：

```ts
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

### 为什么暂时不要太多过滤器
PR1 只需要够 review / 调试。
先不要加：
- 时间范围
- targetType
- priority
- approvalStatus
- sourceId 模糊组合

这些等 API 真跑起来再说。

---

# 5. `packages/server/src/soul/soulActionStore.ts` 应怎么写

PR1 这个文件是最核心的实现文件。

---

## 5.1 第一部分：imports
建议只引：

```ts
import crypto from 'crypto';
import { getDb } from '../db/client.js';
import type {
  CreateSoulActionInput,
  ListSoulActionFilters,
  SoulAction,
  SoulActionStatus,
} from './soulActionTypes.js';
```

### 为什么只这些
因为 PR1 store 只应依赖：
- UUID
- DB
- 类型

不能再多。

---

## 5.2 第二部分：row 类型
建议新增：

```ts
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
```

### 为什么 row 层允许部分 string 宽类型
因为数据库行就是数据库行。
PR1 不需要在 row interface 上做过度类型美化，
真正收口在 `rowToSoulAction(...)` 即可。

---

## 5.3 第三部分：row mapper
建议核心私有函数：

```ts
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
```

### 为什么 mapper 里再 parse
因为 PR1 应统一保证：
- 对外永远暴露结构化 `payload`
- 对内永远存 `payload_json`

这条线不能模糊。

---

## 5.4 第四部分：id / 时间辅助函数
建议加两个极小私有函数：

```ts
function buildSoulActionId(): string {
  return crypto.randomUUID();
}

function getNowIsoString(): string {
  return new Date().toISOString();
}
```

### 为什么不直接内联
因为后面 create / update / complete / fail 都会用，
抽出来更稳，但又不会过度抽象。

---

## 5.5 第五部分：`createSoulAction(...)`
建议签名：

```ts
export function createSoulAction(input: CreateSoulActionInput): SoulAction
```

建议行为：
- 默认：
  - `priority = 'medium'`
  - `payload = {}`
  - `requiresApproval = false`
  - `approvalStatus = null`
  - `status = 'pending'`
- 插入数据库
- 再调用 `getSoulAction(id)!` 返回完整对象

### 为什么 create 后再查一次
因为当前项目很多地方都沿用“写入后取标准对象”的思路。
这样：
- 返回结构统一
- 少写重复映射逻辑

---

## 5.6 第六部分：`getSoulAction(...)`
建议签名：

```ts
export function getSoulAction(id: string): SoulAction | null
```

行为很简单：
- `SELECT * FROM soul_actions WHERE id = ?`
- 找到就 `rowToSoulAction`
- 否则 `null`

不要额外抛错。

原因：
- store 查询函数应保持中性
- 是否要抛错留给上层决定

---

## 5.7 第七部分：`listSoulActions(...)`
建议签名：

```ts
export function listSoulActions(filters: ListSoulActionFilters = {}): SoulAction[]
```

建议行为：
- 动态拼 where
- 允许按：
  - `status`
  - `actionType`
  - `sourceType`
- 默认排序：`ORDER BY created_at DESC`
- 默认 `LIMIT 100`

### 为什么 PR1 就加默认 limit
因为动作日志天然会增长。
即使现在还没 API，也应从第一版就防止无边界列表查询。

---

## 5.8 第八部分：`updateSoulActionStatus(...)`
建议签名：

```ts
export function updateSoulActionStatus(id: string, status: SoulActionStatus): SoulAction
```

建议行为：
- 只更新：
  - `status`
  - `updated_at`
- 再读取返回
- 如果不存在，抛 `Error('Soul action not found')`

### 为什么这里可以抛错
因为这是命令型更新函数。
更新不存在对象本身就是异常路径。

---

## 5.9 第九部分：`completeSoulAction(...)`
建议签名：

```ts
export function completeSoulAction(id: string, resultSummary?: string, feedbackRef?: string): SoulAction
```

建议更新字段：
- `status = 'completed'`
- `updated_at`
- `completed_at`
- `result_summary`
- `feedback_ref`

### 为什么不在这里自动补 dispatched 状态
因为 PR1 还没有 dispatcher。
complete 只是提供未来调用的稳定落点，
不要在这里预埋过多状态机假设。

---

## 5.10 第十部分：`failSoulAction(...)`
建议签名：

```ts
export function failSoulAction(id: string, errorMessage: string): SoulAction
```

建议更新字段：
- `status = 'failed'`
- `updated_at`
- `failed_at`
- `error_message`

### 为什么 PR1 不单独提供 `discardSoulAction(...)`
因为当前 PR1 只需要最小 store。
`discarded` 状态未来完全可以先用：
- `updateSoulActionStatus(id, 'discarded')`

来完成。
没有必要立刻再多加一个专用函数。

---

# 6. PR1 的代码风格注意点

## 6.1 不要引入类
建议全部保持函数式导出。

原因：
- 当前 server 风格本来就更偏函数模块
- PR1 不需要 repository class
- 少一层对象状态，review 更清楚

---

## 6.2 不要引入自定义错误体系
PR1 暂时不需要新增：
- `SoulActionNotFoundError`
- `SoulActionValidationError`

先用普通 `Error` 足够。
等 API / dispatcher 真出现后再决定是否值得升级。

---

## 6.3 不要引入事务包装器
PR1 每个动作都只是单条写入或更新。
现在还不需要事务抽象。

原因：
- 会让第一步复杂化
- 当前收益太低

---

# 7. PR1 的最小测试/验证思路

虽然 v0.8 不是测试稿，但最好把最小验证点压出来。

## 7.1 schema 验证
应确认：
- 初始化数据库后可见 `soul_actions`
- 索引已存在

## 7.2 store 验证
应确认：
- `createSoulAction(...)` 可成功插入
- `getSoulAction(...)` 可成功读取
- `listSoulActions(...)` 可按 `status` / `actionType` / `sourceType` 过滤
- `completeSoulAction(...)` 正确写入 `completed_at`
- `failSoulAction(...)` 正确写入 `failed_at` 和 `error_message`

## 7.3 回归验证
应确认：
- `pnpm build` 通过
- 现有 worker / schedule / API 未受影响

---

# 8. v0.8 的最终判断

v0.8 最重要的收束是：

## 8.1 `schema.ts` 和 `soulActionStore.ts` 是 PR1 的真正核心
不是 API，
不是 worker，
不是调度，
而是：
- 一张稳定的动作主表
- 一个稳定的运行态存储模块

## 8.2 类型要先收窄，数据库约束要先保守
也就是说：
- TS 类型边界可以先严格
- SQL 语义字段约束应先柔性

这样后面扩展最不痛。

## 8.3 PR1 做完后，后面的 generator / gate / dispatcher 才真正有了地板
没有这层，后面每一步都会漂。
有了这层，后面每一步都能落地。

---

# 9. 一句话总结 v0.8

> v0.8 的意义，是把 `SoulAction` 的首个 PR 从“施工单”进一步压成“逐文件实现草案”：`schema.ts` 该加哪两段 SQL，`soulActionTypes.ts` 该收哪些类型，`soulActionStore.ts` 该有哪些函数和 row mapper，`client.ts` 又该保持多克制，全部都被压到了接近伪代码级的实现密度。