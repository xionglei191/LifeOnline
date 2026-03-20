# 《Soul Constitution》v0.7
## LifeOS 灵魂动作层首个 PR 施工单草案

这一版不再只是架构图，也不再只是代码落位图，
而是进一步压成：

> 如果现在真的开始做 `SoulAction`，第一个 PR 到底应该写什么、不该写什么、做到什么程度才算完成？

v0.7 的目标是把第一步压到接近施工单的程度。

---

# 1. v0.7 的定位

在 v0.6 里，已经明确了：
- 哪些目录要新增
- 哪些现有文件要改
- 第一阶段应该拆成几个小 PR

因此 v0.7 不再讨论整个计划，
而只聚焦：

> **PR1：只建立 `SoulAction` 的运行态骨架。**

这一步只做三件事：
1. 建表
2. 建类型
3. 建 store

除此之外，先都不做。

这是为了保证第一步：
- 极小
- 低风险
- 可验证
- 不干扰现有执行主链

---

# 2. PR1 的目标定义

PR1 完成后，系统应该具备的最小能力是：

## 2.1 数据库里存在 `soul_actions` 表
并且可以稳定保存：
- 动作来源
- 动作类型
- 动作状态
- payload
- 执行结果摘要
- 错误信息

---

## 2.2 server 内存在一套稳定的 `SoulAction` 类型
至少包括：
- status
- category
- type
- action 主对象

这样后面 generator / gate / dispatcher 才有稳定依托。

---

## 2.3 server 内存在一组最小 store 函数
至少可以完成：
- create
- getById
- list
- updateStatus
- complete
- fail

这样第二个 PR 才能在它上面接 generator 和 dispatcher。

---

## 2.4 现有功能行为不变
PR1 不应该改变：
- worker task 行为
- schedule 行为
- API 行为
- Vault 行为
- indexer 行为

也就是说它本质上是：

> 给未来灵魂动作层铺地基，但暂时不让它介入现有系统运行。

---

# 3. PR1 必改文件

## 3.1 [packages/server/src/db/schema.ts](packages/server/src/db/schema.ts)
### 需要做什么
新增：
- `SOUL_ACTION_TABLE_COLUMNS_SQL`
- `SOUL_ACTION_INDEXES_SQL`
- 在 `SCHEMA` 中拼接 `CREATE TABLE IF NOT EXISTS soul_actions`

### 建议字段
第一版建议字段尽量少而完整：

```sql
id TEXT PRIMARY KEY,
created_at TEXT NOT NULL,
updated_at TEXT NOT NULL,
source_type TEXT NOT NULL,
source_id TEXT NOT NULL,
action_category TEXT NOT NULL,
action_type TEXT NOT NULL,
target_type TEXT,
priority TEXT NOT NULL,
status TEXT NOT NULL,
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
error_message TEXT
```

### 建议索引
第一版就够用的索引：
- `status`
- `action_type`
- `source_type`
- `created_at`

原因：
- 后续 review 常按状态看
- 后续调试常按动作类型看
- 后续分析常按来源类型看
- 时间序列查看是基础能力

---

## 3.2 [packages/server/src/db/client.ts](packages/server/src/db/client.ts)
### 需要做什么
PR1 只需要做一件事：
- 确保 `initDatabase()` 能在现有 `SCHEMA` 基础上把 `soul_actions` 表初始化出来

### 可选但推荐
在 `initDatabase()` 里加入最轻量的增量迁移位点，为以后扩列留口子。

例如未来如果后来增加：
- `approval_note`
- `worker_task_id`
- `reviewed_at`

可以继续沿用现有的 `PRAGMA table_info(...)` 风格追加。

### PR1 不要做什么
- 不要在这里开始写复杂 `SoulAction` 业务逻辑
- 不要引入 rebuild 逻辑，除非第一版 schema 本身有约束问题
- 不要顺手改现有 worker/schedule 表

---

# 4. PR1 必新增文件

## 4.1 `packages/server/src/soul/soulActionTypes.ts`
### 作用
放纯类型定义。

### 第一版建议内容
建议只放：
- `SoulActionStatus`
- `SoulActionCategory`
- `SoulActionTargetType`
- `SoulActionType`
- `SoulAction`
- `CreateSoulActionInput`
- `ListSoulActionFilters`

### 建议收敛的第一版 `actionType`
虽然 PR1 还不会真正 dispatch，
但类型层面就应提前把首批动作收敛好：
- `ask_followup_question`
- `update_persona_snapshot`
- `create_event_node`
- `persist_continuity_markdown`
- `launch_daily_report`
- `launch_weekly_report`
- `launch_openclaw_task`
- `sync_continuity_to_r2`

### 为什么 PR1 就定义这些
因为类型是未来 generator / dispatcher 的约束边界。
先把边界收住，后续实现不会发散得太快。

---

## 4.2 `packages/server/src/soul/soulActionStore.ts`
### 作用
只做 store，不做 generator / gate / dispatcher。

### 第一版建议导出函数
建议只导出这 6 个：

```ts
createSoulAction(input: CreateSoulActionInput): SoulAction
getSoulAction(id: string): SoulAction | null
listSoulActions(filters?: ListSoulActionFilters): SoulAction[]
updateSoulActionStatus(id: string, status: SoulActionStatus): SoulAction
completeSoulAction(id: string, resultSummary?: string, feedbackRef?: string): SoulAction
failSoulAction(id: string, errorMessage: string): SoulAction
```

### 为什么先只做这 6 个
因为它们已经足够支撑：
- 未来 generator 写入候选动作
- 未来 review 查看动作
- 未来 dispatcher 更新状态
- 未来失败回写

再多就是过早设计。

---

# 5. PR1 的 store 设计原则

## 5.1 不要把业务判断塞进 store
store 只负责：
- 存
- 取
- 列
- 改状态

它不应该判断：
- 这个动作要不要被允许
- 这个动作该不该 dispatch
- 这个动作是不是高风险

这些都属于后续 gate / dispatcher 的事情。

---

## 5.2 不要让 store 依赖 worker / Vault / R2
`soulActionStore.ts` 第一版不该 import：
- `workerTasks.ts`
- `fileManager.ts`
- `frontmatterBuilder.ts`
- `openclawClient.ts`

原因很直接：
- store 是运行态存储层
- 不是执行层
- 依赖一旦反过来，后面会立刻耦合失控

---

## 5.3 统一序列化策略
第一版建议：
- `payload` 统一存 `payload_json`
- 读取时统一 `JSON.parse`
- 空对象也保存为 `'{}'`

这一步必须在 PR1 就稳定下来，
否则后面 generator / dispatcher 容易出现 payload 语义漂移。

---

# 6. PR1 的类型设计建议

## 6.1 `sourceType` 第一版先收窄
建议先限定为：
- `brainstorm_session`
- `persona_state`
- `event_node`
- `intervention_decision`
- `continuity_record`
- `schedule`
- `system`

第一版不要搞“任意字符串”。

原因：
- 可读
- 可审计
- 未来统计分析更稳定

---

## 6.2 `status` 第一版建议固定为
- `pending`
- `approved`
- `dispatched`
- `completed`
- `failed`
- `discarded`

这已经足够表达第一阶段生命周期。
不需要在 PR1 就引入：
- `observed`
- `deferred`
- `cancelled`
- `blocked`

这些等 gate / review 真跑起来后再判断是否值得加。

---

## 6.3 `priority` 第一版继续沿用 low / medium / high
原因：
- 与当前系统已有优先级语义一致
- 不需要新引入更复杂等级系统

---

# 7. PR1 明确不做的事

这是 v0.7 最关键的一部分。

## 7.1 不做 generator
不新增：
- `generateSoulActions(...)`
- 规则判断
- 候选动作自动生成

因为那属于 PR2。

---

## 7.2 不做 gate
不新增：
- `shouldDispatchSoulAction(...)`
- approval 逻辑
- 风险判断逻辑

因为那属于 PR2。

---

## 7.3 不做 dispatcher
不新增：
- dispatch 到 worker
- dispatch 到 Vault
- dispatch 到 R2
- dispatch 到交互层

因为那属于 PR2 / PR3。

---

## 7.4 不改 API
PR1 不应该碰：
- [packages/server/src/api/handlers.ts](packages/server/src/api/handlers.ts)
- [packages/server/src/api/routes.ts](packages/server/src/api/routes.ts)

原因：
- 只做骨架
- 不暴露半成品接口
- 避免把 PR 范围扩大

---

## 7.5 不改 `workerTasks.ts` 与 `taskScheduler.ts`
PR1 不应该动：
- [packages/server/src/workers/workerTasks.ts](packages/server/src/workers/workerTasks.ts)
- [packages/server/src/workers/taskScheduler.ts](packages/server/src/workers/taskScheduler.ts)

除非只是极小的类型引用修正，否则都不应动。

因为第一步的目的就是：
- 建地基
- 不碰施工主干道

---

# 8. PR1 的建议代码骨架

## 8.1 `soulActionTypes.ts` 最小结构
建议先有：

```ts
export type SoulActionStatus = 'pending' | 'approved' | 'dispatched' | 'completed' | 'failed' | 'discarded'

export type SoulActionCategory =
  | 'state_update'
  | 'memory_promotion'
  | 'interaction'
  | 'task_launch'
  | 'artifact_output'
  | 'bridge_sync'

export type SoulActionTargetType = 'sqlite' | 'vault' | 'worker_task' | 'openclaw' | 'r2' | 'user'

export type SoulActionType =
  | 'ask_followup_question'
  | 'update_persona_snapshot'
  | 'create_event_node'
  | 'persist_continuity_markdown'
  | 'launch_daily_report'
  | 'launch_weekly_report'
  | 'launch_openclaw_task'
  | 'sync_continuity_to_r2'
```

然后再定义 `SoulAction` 主对象和 store 输入/过滤器类型。

---

## 8.2 `soulActionStore.ts` 的实现风格
建议完全沿用当前仓库风格：
- `getDb()`
- row interface
- row -> object mapper
- SQL 语句直写
- 保持显式，不做 repository framework

原因：
- 与 `workerTasks.ts` / `taskScheduler.ts` 一致
- 第一版最容易 review
- 最容易和当前项目代码风格融在一起

---

# 9. PR1 完成后的可验证状态

PR1 完成后，最小验收不看“功能酷不酷”，只看骨架是否稳定。

## 9.1 数据库验收
应满足：
- 初始化数据库后存在 `soul_actions` 表
- 存在预期索引
- 不影响现有表初始化

---

## 9.2 类型验收
应满足：
- server 可编译
- `soul/` 目录中的类型定义无循环依赖
- 第一批 actionType 已被收窄固定

---

## 9.3 store 验收
应满足：
- 可以插入一条 `SoulAction`
- 可以按 id 读取
- 可以按状态 / 类型过滤 list
- 可以把状态更新为 completed / failed
- `payload_json` 能正确往返序列化

---

## 9.4 回归验收
应满足：
- 现有 worker task 创建/执行不受影响
- 现有 schedule 不受影响
- 现有 API 不受影响
- 现有 build/typecheck 通过

---

# 10. PR1 最适合的提交粒度

为了后续 review 清晰，PR1 内部也最好分成几步提交思路：

## Step A
只改数据库：
- `schema.ts`
- `client.ts`

## Step B
新增纯类型：
- `soulActionTypes.ts`

## Step C
新增 store：
- `soulActionStore.ts`

即使最后合成一个 PR，也最好按这个顺序实现。
这样任何问题都更容易定位。

---

# 11. PR1 完成后，PR2 的起点应该是什么

v0.7 还要明确一件事：
PR1 做完以后，不要立刻失控扩张。

PR2 的起点应该严格限定为：
- 复用 PR1 的 store
- 新增 generator
- 新增 gate
- 新增 dispatcher
- 只支持低风险动作

也就是说，PR1 的成功标准不是“已经很智能”，
而是：

> 后面的 generator / gate / dispatcher 终于有了一个稳定可依赖的地基。

---

# 12. 一句话总结 v0.7

> v0.7 的意义，是把 `SoulAction` 的第一步从“落位图”进一步压成“首个真实 PR 施工单”：第一步只建表、只建类型、只建 store，不碰 API、不碰 worker、不碰调度，让灵魂动作层先以最小、最稳、最可验证的方式长出第一块骨架。