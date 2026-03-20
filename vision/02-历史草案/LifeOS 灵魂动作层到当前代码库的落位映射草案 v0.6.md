# 《Soul Constitution》v0.6
## LifeOS 灵魂动作层到当前代码库的落位映射草案

这一版不再只谈“应该有什么”，而是直接把 v0.5 中的最小骨架映射到当前 LifeOS 真实代码库里。

要回答的问题是：

> 如果现在开始做 `SoulAction`，在当前仓库中到底该改哪些文件、加哪些模块、复用哪些现有链路、第一阶段最小 PR 应该怎么切？

这版的目标仍然不是直接改代码，
而是把后续实现路径压到**几乎可以按图施工**的程度。

---

# 1. 当前代码基线的关键现实

基于当前代码库，可以确认几件非常重要的现实边界：

## 1.1 SQLite 初始化与迁移集中在 `db/`
当前数据库初始化和迁移集中在：
- `packages/server/src/db/schema.ts`
- `packages/server/src/db/client.ts`

这意味着：
- `soul_actions` 表不应该零散地在别处偷偷创建
- 第一版最适合沿用现有模式，在 `schema.ts` 定义，在 `client.ts` 做增量迁移

---

## 1.2 worker task 已经是成熟执行后端
当前执行主链已经很明确：
- `packages/server/src/workers/workerTasks.ts`
- `packages/server/src/workers/taskScheduler.ts`

其中：
- `workerTasks.ts` 负责 task 定义、持久化、执行、结果写回
- `taskScheduler.ts` 负责 schedule 到点后创建 task 并触发执行

这意味着：

> `SoulAction` 第一阶段最不应该做的事，就是绕开这套 worker 执行体系重新造一个并行执行系统。

它应该复用现有 worker task 作为执行后端之一。

---

## 1.3 API 入口目前集中在 `api/handlers.ts` 和 `api/routes.ts`
当前 HTTP 路由非常集中：
- `packages/server/src/api/handlers.ts`
- `packages/server/src/api/routes.ts`

这意味着第一版如果要暴露：
- 查看 `SoulAction` 列表
- 手动批准某个 action
- 手动 dispatch / discard 某个 action

最自然的落点仍然是当前 API 模块，而不是新起一套孤立接口系统。

---

## 1.4 当前架构的真实主轴仍然是“内容 → 索引 / 任务 → 写回”
从 [README.md](README.md) 和 [SUMMARY.md](SUMMARY.md) 可以确认：
- Vault 是内容真相
- SQLite 是索引与运行态
- worker task 是自动化主路径
- schedule 只负责触发
- OpenClaw 是被派发的外部执行器

因此 v0.6 的基本判断非常明确：

> `SoulAction` 应插在“认知判断”和“现有任务 / 写回 / 交互”之间，而不是推翻现有主链路。

---

# 2. `SoulAction` 在当前代码库里的推荐落点

第一阶段最合适的目录结构是：

```text
packages/server/src/soul/
  soulActionTypes.ts
  soulActionStore.ts
  soulActionGenerator.ts
  interventionGate.ts
  soulActionDispatcher.ts
```

这是一个非常小但语义清晰的模块组。

---

## 2.1 `soulActionTypes.ts`
### 作用
放：
- `SoulAction` 类型
- `SoulActionStatus`
- `SoulActionCategory`
- 第一批 `SoulActionType`
- 输入/输出 payload 的窄类型

### 为什么应该单独放
因为这层会被多处共享：
- store
- generator
- gate
- dispatcher
- API handler
- 未来 web 控制台类型映射

如果把这些类型直接塞进 `workerTasks.ts` 或 `handlers.ts`，后面会很快变脏。

---

## 2.2 `soulActionStore.ts`
### 作用
封装：
- `createSoulAction(...)`
- `getSoulAction(...)`
- `listSoulActions(...)`
- `updateSoulActionStatus(...)`
- `completeSoulAction(...)`
- `failSoulAction(...)`

### 为什么应该单独放
因为当前 `workerTasks.ts` 已经承担了太多执行逻辑。

如果第一版又把 `soul_actions` 的 CRUD 全塞进 `workerTasks.ts`，
会在架构上直接把灵魂动作层“误归类”为 worker 细节。

它更合理的身份应该是：
- 独立运行态对象
- 由 dispatcher / API / future review 流共同读写

---

## 2.3 `soulActionGenerator.ts`
### 作用
把：
- `BrainstormSession`
- `PersonaState`
- `EventNode`
- `ContinuityRecord`
- `schedule`
- 系统 review 触发

转成 `SoulAction[]` 候选。

### 第一阶段建议
先只做规则型 generator，
不要把模型调用、复杂评分、策略学习都塞进去。

也就是说第一版 generator 更像：
- 条件判断器
- 候选动作生产器

而不是自治 agent。

---

## 2.4 `interventionGate.ts`
### 作用
承接 v0.5 里的：
- `shouldDispatchSoulAction(...)`

### 为什么需要独立文件
因为它是 v0.1 里“主动性边界”的第一工程落点。

它负责把这些边界压成代码规则：
- 哪些动作默认可自动 dispatch
- 哪些动作需要 approval
- 哪些动作应该 defer / observe / discard

这个模块从职责上更接近“治理层”，不应直接混进 generator 或 dispatcher。

---

## 2.5 `soulActionDispatcher.ts`
### 作用
把通过 gate 的 action 真正交给：
- SQLite 更新
- Vault 输出
- worker task
- OpenClaw
- R2
- 用户交互层

### 为什么单独放
因为这是动作层真正的执行桥。

它和 `workerTasks.ts` 的关系应该是：
- `workerTasks.ts` 是某些动作的执行后端
- `soulActionDispatcher.ts` 是上层动作调度器

而不是反过来。

---

# 3. 数据库层应该怎么接

## 3.1 `schema.ts` 应新增 `soul_actions` 表定义
推荐在：
- [schema.ts](packages/server/src/db/schema.ts)

新增内容：
- `SOUL_ACTION_TABLE_COLUMNS_SQL`
- `SOUL_ACTION_INDEXES_SQL`
- 把 `CREATE TABLE IF NOT EXISTS soul_actions` 接入 `SCHEMA`

建议延续当前已有风格：
- 表列 SQL 常量单独抽出
- 索引 SQL 常量单独抽出
- 最后拼回 `SCHEMA`

这样它与 `worker_tasks` / `task_schedules` 保持统一。

---

## 3.2 `client.ts` 应新增迁移逻辑
推荐在：
- [client.ts](packages/server/src/db/client.ts)

新增两类迁移：

### 第一类：表不存在时创建
如果 `SCHEMA` 已接入，这一步自然会完成。

### 第二类：未来列扩展的增量迁移
参考当前已有模式：
- `schedule_id` 增量列
- `inbox_origin` 增量列
- `consecutive_failures` / `last_error` 增量列

`SoulAction` 未来也大概率会逐步加列，
所以第一版就应该按这个模式设计，避免以后每次都重建表。

---

## 3.3 `soul_actions` 第一版不建议做外键强绑定
虽然从概念上它会引用：
- note
- worker task
- schedule
- continuity record

但第一版不建议在 SQLite 层面做重外键约束。

原因：
- 当前现有表设计本身也更偏轻外键
- 灵魂层对象仍在快速演化
- 先保证动作日志稳定，比先做强关系模型更重要

也就是说第一阶段更适合：
- 用 `source_type + source_id`
- 用 `feedback_ref`
- 用 `result_summary`

来表达关联，而不是立即做复杂关系图。

---

# 4. 与现有 worker 体系如何衔接

## 4.1 第一阶段不要改 worker task 协议层
当前 worker task 类型和共享协议已经较稳定：
- `@lifeos/shared`
- `workerTasks.ts`
- `taskScheduler.ts`

因此第一阶段更适合：
- 不急着把 `SoulAction` 搬进 shared
- 先让它留在 server-local 范围内
- 把它视为 LifeOS backend 内部认知运行态对象

原因很简单：
- 现在还没到要让 web 或别的进程强依赖它的阶段
- 先在 server 内收敛语义更安全

---

## 4.2 `dispatchSoulAction(...)` 到 worker 的桥接方式
最自然的复用点就是：
- 直接调用 [workerTasks.ts](packages/server/src/workers/workerTasks.ts) 里现有的 `createWorkerTask(...)`
- 再调用 `startWorkerTaskExecution(...)`

也就是说：

```text
SoulActionDispatcher
  ↓
createWorkerTask(...)
  ↓
startWorkerTaskExecution(...)
  ↓
现有 worker 生命周期
```

这是当前代码库里最稳、最短的接法。

---

## 4.3 首批适合桥接的动作
基于当前已有 task types，第一批最容易接上的动作就是：
- `launch_daily_report` → `daily_report`
- `launch_weekly_report` → `weekly_report`
- `launch_openclaw_task` → `openclaw_task`

而下面这些动作暂时不必强行走 worker：
- `ask_followup_question`
- `update_persona_snapshot`
- `create_event_node`
- `persist_continuity_markdown`
- `sync_continuity_to_r2`

因为它们本质更像：
- 轻量状态更新
- 本地可读沉淀
- 交互回显
- 单次同步函数

不一定值得为了“统一”而过度 task 化。

---

## 4.4 为什么不要一开始新增大量 soul worker
虽然 v0.3 / v0.4 里提过未来可能有：
- `derive_persona_state`
- `parse_brainstorm_session`
- `promote_event_node`
- `promote_continuity_record`

但 v0.6 的判断是：

> 第一阶段先不要把这些都做成 worker task type。

更合适的是：
- 先在 `soul/` 内做同步函数或轻量 handler
- 等语义稳定后，再决定哪些值得升级成 worker task

这样能避免过早把认知层细节固化到共享任务协议里。

---

# 5. 与 schedule 的关系怎么处理

## 5.1 第一阶段不改 `taskScheduler.ts` 的主模型
当前 [taskScheduler.ts](packages/server/src/workers/taskScheduler.ts) 的职责非常清晰：
- 存 schedule
- 定时触发
- 创建 worker task
- 启动执行

第一阶段不建议把它改造成“直接触发 SoulAction”的 scheduler。

原因：
- 会让现有成熟链路变复杂
- 容易把 schedule 和认知判断缠在一起
- 风险高且收益不大

---

## 5.2 更适合的第一阶段关系
第一阶段应该是：
- schedule 继续创建 worker task
- 灵魂层额外允许“基于 schedule 产生候选 SoulAction”

例如：
- 每日 review schedule 到点
- generator 发现应触发 `launch_daily_report`
- gate 判定为低风险
- dispatcher 再桥接回现有 `daily_report` worker

也就是说：

> schedule 在第一阶段仍是底层触发器，而不是灵魂层本体。

---

# 6. API 层第一阶段该不该暴露 SoulAction

v0.6 的建议是：

## 6.1 第一阶段可以先做“只读 + 少量操作”
推荐先在：
- [handlers.ts](packages/server/src/api/handlers.ts)
- [routes.ts](packages/server/src/api/routes.ts)

增加最小接口：
- `GET /api/soul-actions`
- `GET /api/soul-actions/:id`
- `POST /api/soul-actions/:id/dispatch`
- `POST /api/soul-actions/:id/discard`
- `POST /api/soul-actions/:id/approve`

这已经足够支持：
- 查看候选动作
- 手动放行
- 手动丢弃
- 调试 dispatcher

---

## 6.2 第一阶段不建议做过重的创建接口
不建议一开始开放：
- `POST /api/soul-actions` 任意手工创建

因为第一阶段最重要的是保证：
- action 是由系统内部语义生成的
- 不是任何人随便塞个 payload 进来

更稳妥的方式是：
- 由 generator 内部创建
- API 主要承担 review / approval / dispatch 操作

---

# 7. 与 Vault / frontmatter / indexer 的衔接

## 7.1 `artifact_output` 不应直接穿透多个模块
当前已有的 Vault 写入能力已经集中在：
- `vault/fileManager.ts`
- `vault/frontmatterBuilder.ts`
- worker 结果写回辅助逻辑

因此 `persist_continuity_markdown` 这类动作更适合：
- 由 soul dispatcher 调用一个很小的 artifact handler
- handler 再复用现有 fileManager / frontmatterBuilder

而不是让 generator 或 API 直接拼 markdown 写文件。

---

## 7.2 第一阶段不建议改 indexer 主模型
因为当前 indexer 主链已经稳定：
- 应用写 Vault 文件
- enqueue reindex
- watcher / indexer 更新 SQLite `notes`

`SoulAction` 第一阶段只需要遵守这个约定：
- 凡是输出到 Vault，就显式 enqueue reindex

不需要单独为灵魂层再搞一套同步系统。

---

# 8. 第一版 PR 最合理的切法

v0.6 很关键的一点，是不要把未来实现做成一个巨大 PR。

推荐切成 3 个极小而清晰的阶段。

---

## PR 1：只建立动作运行态骨架
### 范围
- `db/schema.ts`
- `db/client.ts`
- 新增 `src/soul/soulActionTypes.ts`
- 新增 `src/soul/soulActionStore.ts`

### 目标
- 建立 `soul_actions` 表
- 建立基础 TS 类型
- 建立 CRUD / 状态更新能力

### 明确不要做
- 不接 worker
- 不接 API
- 不接 generator
- 不做任何自动 dispatch

这是最小、最稳的第一步。

---

## PR 2：接入 generator + gate + dispatcher，但只支持低风险动作
### 范围
- 新增 `soulActionGenerator.ts`
- 新增 `interventionGate.ts`
- 新增 `soulActionDispatcher.ts`
- 只接：
  - `ask_followup_question`
  - `update_persona_snapshot`
  - `create_event_node`
  - `persist_continuity_markdown`

### 目标
- 让 `SoulAction` 开始真正跑起来
- 但仍然留在低风险闭环里

---

## PR 3：桥接现有 worker 和 review API
### 范围
- 在 API 层新增最小 soul-actions 接口
- dispatcher 接入：
  - `launch_daily_report`
  - `launch_weekly_report`
  - `launch_openclaw_task`
- 允许 review / approve / manual dispatch

### 目标
- 让灵魂动作层真正开始指挥现有执行体系
- 同时保留人工闸门与审计能力

---

# 9. 第一阶段最适合改动的具体文件清单

## 必改
- [packages/server/src/db/schema.ts](packages/server/src/db/schema.ts)
- [packages/server/src/db/client.ts](packages/server/src/db/client.ts)
- [packages/server/src/api/handlers.ts](packages/server/src/api/handlers.ts)
- [packages/server/src/api/routes.ts](packages/server/src/api/routes.ts)

## 新增
- `packages/server/src/soul/soulActionTypes.ts`
- `packages/server/src/soul/soulActionStore.ts`
- `packages/server/src/soul/soulActionGenerator.ts`
- `packages/server/src/soul/interventionGate.ts`
- `packages/server/src/soul/soulActionDispatcher.ts`

## 复用，不建议大改
- [packages/server/src/workers/workerTasks.ts](packages/server/src/workers/workerTasks.ts)
- [packages/server/src/workers/taskScheduler.ts](packages/server/src/workers/taskScheduler.ts)
- `packages/server/src/vault/fileManager.ts`
- `packages/server/src/vault/frontmatterBuilder.ts`
- indexer 相关模块

这个切法的核心精神是：
- 新能力尽量长在现有架构之上
- 尽量不打断已经稳定的 worker / schedule / indexer 主链

---

# 10. v0.6 的最终判断

v0.6 最重要的收束有三个：

## 10.1 `SoulAction` 第一阶段应是 server-local 内部骨架
先不要急着把它推广成 shared protocol。
先在 backend 内收敛语义、跑通链路、打磨治理边界。

## 10.2 第一阶段应复用 worker，而不是改造 worker
灵魂动作层应长在 `workerTasks` 之上，而不是把 `workerTasks` 改造成灵魂层。

## 10.3 第一阶段应先做小 PR 串联，而不是大爆炸重构
先有表，再有 store，再有 generator/gate/dispatcher，再接 review API 和现有 worker。
这是最符合当前 LifeOS 架构与代码现实的路径。

---

# 11. 一句话总结 v0.6

> v0.6 的意义，是把 `SoulAction` 从“最小实现骨架”进一步压成“当前代码库中的精确落位图”：该进 `db/` 的进 `db/`，该新建 `soul/` 的新建 `soul/`，该复用 `workerTasks` 和 `taskScheduler` 的继续复用，并把第一阶段实现切成几个极小、低风险、几乎可以直接开工的 PR。