# LifeOnline 第一阶段项目开发任务书（进度对齐正式版）

## 一、文稿定位

这份任务书不是新的愿景草案，也不是继续发散架构讨论。

它的用途只有一个：

> 把 `vision/` 中已经收束的第一阶段路线，和当前仓库里已经存在的实现锚点，整理成一份可持续复用的正式进度对齐文稿，方便后续与你逐轮对齐“已经做到哪里、还缺什么、下一步该做什么”。

因此，本文件坚持三条口径：

1. **只认已收束路线，不重造路线。**
2. **只认代码/验证可锚定的当前状态，不拿概念完成冒充实现完成。**
3. **优先服务快速落地，不继续陷入无止境的 PR4 周边微补强。**

---

## 二、项目总目标（第一阶段）

LifeOnline 第一阶段的目标，不是直接做成“完全自治系统”，而是先在 `LifeOS` 后端宿主内长出一个**最小但真实可治理的联合认知运行态**。

第一阶段的最小闭环应是：

```text
输入
  ↓
理解
  ↓
动作候选
  ↓
Gate / Review / Dispatch
  ↓
执行
  ↓
反馈回流
  ↓
连续性更新或下一轮候选
```

对应到当前工程边界：

- `LifeOnline`：整个项目总名
- `LingGuangCatcher`：现实输入侧
- `LifeOS`：第一阶段后台宿主
- `Vault`：内容事实源
- `OpenClaw`：外部执行器
- `R2`：桥接 / 冷存储 / 连续性备份

当前第一阶段的工程主战场，仍应以：
- `LifeOS/packages/server`

为准。

---

## 三、治理总约束（全阶段有效）

后续所有进度对齐与实施推进，都应受以下约束：

### 1. 记录优先于放权
第一阶段更重要的是：
- 动作有没有被稳定记录；
- 为什么产生；
- 如何被治理；
- 执行结果如何；
- 是否值得以后进一步放权。

而不是立刻追求系统“看起来很主动”。

### 2. 低风险闭环优先于高风险扩张
主线优先顺序应是：
- 先低风险 action 闭环；
- 再治理队列与 review；
- 再结果回流骨架；
- 最后才进入高阈值 continuity / event promotion。

### 3. approve 与 dispatch 必须分离
- `approve` 解决“是否获得执行资格”；
- `dispatch` 解决“是否现在真正下发执行”。

第一阶段不能把两者混成一步。

### 4. review queue 是 `soul_actions` 视图，不是平行系统
第一阶段不应先发散出独立复杂 review 子系统。
review queue 应优先理解为：
- 一组满足治理条件的 `SoulAction` 视图。

### 5. reintegration 不得绕过 Gate / Review / Dispatcher
反馈回流可以：
- 形成 summary，
- 提供候选，
- 提供判断依据。

但不能：
- 直接跳过治理链，
- 直接替代 review，
- 直接偷偷写最终长期产物。

### 6. continuity promotion 属于高阈值路径
`ContinuityRecord` 不应被当成普通输出物。
任何 continuity promotion 都应视为高门槛、高责任、强证据路径。

---

## 四、当前代码现实（截至本版文稿）

本节只写当前仓库里已经能被代码明确锚定的现实。

### 4.1 已明确存在的执行主链锚点
当前主执行内核位于：
- `LifeOS/packages/server/src/workers/workerTasks.ts`

其中已经可以确认：
- `WorkerTask` 执行主链集中在该文件；
- `daily_report` / `weekly_report` / `summarize_note` / `extract_tasks` / `classify_inbox` / `openclaw_task` 的任务执行路由都以这里为中心；
- terminal task 结束后已存在 best-effort reintegration hook。

关键锚点：
- `workerTasks.ts:223-230`

### 4.2 已明确存在的 PR1 最小 SoulAction 骨架锚点
当前已存在：
- `LifeOS/packages/server/src/soul/soulActions.ts`
- `LifeOS/packages/server/src/soul/types.ts`
- `LifeOS/packages/server/src/db/schema.ts`
- `LifeOS/packages/server/src/db/client.ts`

其中已可确认：
- `src/soul/` 并非空白，已存在最小 `SoulAction` 类型与运行态同步模块；
- `schema.ts` 已定义 `soul_actions` 表结构与索引；
- `client.ts` 已在数据库初始化流程中确保 `soul_actions` 表存在并在缺列时重建；
- `soulActions.ts` 已提供最小 create/get/list、worker task 绑定、terminal lifecycle 同步能力；
- 当前范围仍然很窄：仅明确覆盖 `extract_tasks`，且本质上仍是对 `workerTasks` 生命周期的 server-local 镜像层。

关键锚点：
- `soulActions.ts:48-52`
- `soulActions.ts:71-154`
- `schema.ts:41-57`
- `client.ts:87-124`
- `client.ts:201`

### 4.3 已明确存在的 PR4 最小回流骨架锚点
当前已存在：
- `LifeOS/packages/server/src/workers/feedbackReintegration.ts`
- `LifeOS/packages/server/src/workers/continuityIntegrator.ts`
- `LifeOS/packages/server/test/feedbackReintegration.test.ts`

其中已可确认：
- `feedbackReintegration.ts` 已定义 supported reintegration task types、terminal status、payload shape、payload builder；
- `continuityIntegrator.ts` 已定义 `target` / `strength` / `summary` 的最小判定语义；
- `workerTasks.ts` 已在真实 terminal worker path 中调用 reintegration hook，而不只是纸面草稿；
- reintegration 当前仍是 **best-effort + side-effect free skeleton**，并未进入对象层持久化更新。

关键锚点：
- `workerTasks.ts:229-236`
- `feedbackReintegration.ts:3-10`
- `feedbackReintegration.ts:35-53`
- `continuityIntegrator.ts:25-41`
- `continuityIntegrator.ts:43-52`

### 4.4 已明确存在的验证锚点
当前 test 锚点位于：
- `LifeOS/packages/server/test/feedbackReintegration.test.ts`

已可确认覆盖方向包括：
- `extract_tasks` 的 SoulAction create/reuse/bind/sync；
- stable payload shape；
- stable continuity result；
- failed / cancelled observational summary；
- succeeded-without-resultSummary fallback summary；
- real execution path reintegration coverage（已延伸到 `classify_inbox` / `extract_tasks` / `daily_report` / `weekly_report` 等路径）。

### 4.5 当前实现形态 vs 目标形态

#### 当前实现形态
- `SoulAction` 当前先作为 `workerTasks` 的生命周期镜像层存在；
- `soul_actions` 当前是 server-local SQLite 持久化，不是独立治理系统；
- 现有 SoulAction 范围仅保守覆盖 `extract_tasks`；
- reintegration 当前先落在 `src/workers/`，保持 best-effort、side-effect-free。

#### 目标形态
- 后续再补 `generator` / `gate` / `dispatcher` / `review queue`；
- 后续再决定是否将相关能力进一步向 `src/soul/` 中枢收束；
- 后续若进入更深层 reintegration，仍须在治理边界内逐步推进，而不是把当前骨架误读为完整闭环。

### 4.6 当前尚不能按“已落地”口径书写的部分
经过代码核查，目前**不能**把以下内容写成“已实现”：

- 完整 `src/soul/` 模块体系已经齐备；
- `SoulAction` 已覆盖多 task types 或形成通用、产品化的独立治理主线；
- 低风险 action framework 已形成广覆盖、可扩展的通用闭环；
- review queue / review API 已形成完整产品化治理控制面；
- persona/event/continuity 对象层 reintegration 已全面产品化落地。

核验依据：
- 当前 `src/soul/` 已存在最小 `generator` / `gate` / `dispatcher` / review queue / review API，但覆盖范围仍窄；
- 当前 schema/client 已能稳定承载 `soul_actions` 与最小治理状态迁移，但尚未证明更广 action coverage 与产品化治理 runtime；
- 当前能明确锚定的是“PR1 最小骨架 + PR2/PR3 最小治理闭环 + worker-side PR4 skeleton + PR5/PR6 保守最小落地”，而不是完整自治治理系统。
---

## 五、阶段路线图总览（PR1–PR6）

本阶段路线按 `vision/` 固定为六段，不在本文件中改动顺序。

### 路线主序
1. PR1：SoulAction 运行态骨架
2. PR2：低风险闭环
3. PR3：Review / Governance / Execution Bridge
4. PR4：Reintegration Skeleton
5. PR5：Lightweight Persona / Intervention Reintegration
6. PR6：High-threshold Event / Continuity Reintegration

---

## 六、各阶段正式任务定义

---

## PR1｜SoulAction 运行态骨架

### 阶段目标
建立 `SoulAction` 的最小运行态地基，使其成为可记录、可读取、可列出、可更新状态的正式治理对象。

### 当前状态
**部分落地 / 最小骨架已落地（保守口径）。**

当前已可确认：
- `src/soul/` 已存在最小 `SoulAction` 模块，不再是“待核实是否存在”；
- `soul_actions` 表、最小 store/query、worker task 绑定与生命周期同步已落地；
- 当前实现范围仍很窄，只明确覆盖 `extract_tasks`，且以 worker-mirrored、server-local persistence 为主；
- 因此不能写成“PR1 完整完成”，但也不能再写成“未开始”。
### In Scope
- `soul_actions` 持久化结构；
- runtime type boundary；
- store CRUD / status transitions；
- 与现有执行链并存但不干扰。

### Out of Scope
- generator；
- gate；
- dispatcher；
- review API；
- continuity promotion；
- 大规模 shared contract 外提。

### 关键文件 / 模块区
现阶段应锚定：
- `LifeOS/packages/server/src/db/schema.ts`
- `LifeOS/packages/server/src/db/client.ts`
- `LifeOS/packages/server/src/soul/soulActions.ts`
- `LifeOS/packages/server/src/soul/types.ts`

### 完成定义
只有在以下条件满足时，PR1 才能按“完成”口径书写：
- 存在可用的 `SoulAction` persistence host；
- 具备 create/get/list/update/complete/fail 等最小 store 能力；
- 不改变既有 `workerTasks` / `taskScheduler` / API 主行为。

### 验证检查点
- DB 初始化可稳定产生 SoulAction 运行态结构；
- 类型与 store 可编译并完成基本 round-trip；
- 现有 worker/scheduler 无回归。

---

## PR2｜低风险闭环

### 阶段目标
让最小 low-risk action 真正形成：

```text
candidate -> gate -> dispatch -> execute
```

的第一条可验证闭环。

### 当前状态
**最小落地（保守口径）。**

当前已可确认：
- `LifeOS/packages/server/src/soul/soulActionGenerator.ts` 已存在，能够生成以 `update_persona_snapshot` / `extract_tasks` 为中心的最小 candidate；
- `LifeOS/packages/server/src/soul/interventionGate.ts` 已存在，且输出的是显式治理决策，而不是隐含 boolean；
- `LifeOS/packages/server/src/soul/soulActionDispatcher.ts` 已形成最小 `queue_for_review -> approve -> dispatch -> execute` 闭环，dispatch 仍经由现有 worker 宿主执行；
- 当前范围仍然很窄，只覆盖保守、低风险、可解释的最小 action 闭环，不应写成通用低风险 action framework 已完成。

### In Scope
- `soulActionGenerator.ts`；
- `interventionGate.ts`；
- `soulActionDispatcher.ts`；
- 首批低风险 action：
  - `ask_followup_question`
  - `update_persona_snapshot`
  - `create_event_node`
  - `persist_continuity_markdown`

### Out of Scope
- 高风险自动放权；
- 大规模对象层扩张；
- continuity promotion；
- 复杂规则引擎；
- shared protocol 大面积抽象。

### 关键文件 / 模块区
规划目标区：
- `LifeOS/packages/server/src/soul/soulActionGenerator.ts`
- `LifeOS/packages/server/src/soul/interventionGate.ts`
- `LifeOS/packages/server/src/soul/soulActionDispatcher.ts`

宿主锚点：
- `LifeOS/packages/server/src/workers/workerTasks.ts`
- `LifeOS/packages/server/src/workers/taskScheduler.ts`

### 完成定义
只有在以下条件满足时，PR2 才能按“完成”口径书写：
- 至少有 1–2 个 low-risk actions 跑通最小闭环；
- Gate 输出显式治理结果，而不是隐含 boolean；
- Dispatcher 不绕开当前执行宿主；
- 闭环有真实行为验证，而非仅停留在类型层。

### 验证检查点
- 至少一条 action 跑通 `candidate -> gate -> dispatch -> execute`；
- Gate 能区分 `dispatch_now` / `observe_only` / `queue_for_review` 等结果；
- 不破坏当前 worker 主链。

---

## PR3｜Review / Governance / Execution Bridge

### 阶段目标
把“被 Gate 拦下或延后的动作如何继续被人机共同接住”正式落成治理执行面。

### 当前状态
**最小落地（保守口径）。**

当前已可确认：
- `soul_actions` 已具备 `pending_review` / `approved` / `deferred` / `discarded` 等最小治理状态；
- 已有 review queue list / detail，以及 `approve` / `dispatch` / `defer` / `discard` 最小治理操作；
- `approve` 与 `dispatch` 已在当前实现中分离保留，未被混成一步；
- `handlers.ts` / `routes.ts` 已提供最小 review/governance API，但当前仍不是完整产品化治理控制面。

### In Scope
- review queue list / detail；
- `approve` / `dispatch` / `defer` / `discard`；
- review queue 作为 `soul_actions` 视图；
- `daily_report` / `weekly_report` / `openclaw_task` 的治理桥接入口。

### Out of Scope
- 复杂审批平台；
- 任意外部创建 SoulAction 的开放接口；
- 大而全控制台；
- 提前做自治编排器。

### 关键文件 / 模块区
宿主锚点：
- `LifeOS/packages/server/src/api/handlers.ts`
- `LifeOS/packages/server/src/api/routes.ts`
- `LifeOS/packages/server/src/workers/workerTasks.ts`

规划目标区：
- `LifeOS/packages/server/src/soul/`

### 完成定义
只有在以下条件满足时，PR3 才能按“完成”口径书写：
- review queue 可列出、可查看、可处理；
- `approve` 与 `dispatch` 分离仍被保留；
- 高阈值动作不再只能“硬放”或“丢失”；
- review 历史具备最小可追踪性。

### 验证检查点
- `pending_review` / `approved_waiting_dispatch` / `deferred` / `closed` 等最小视角可工作；
- 核心状态转移正确；
- review queue 的实现仍基于 `soul_actions` 语义，而不是平行系统。

---

## PR4｜Reintegration Skeleton

### 阶段目标
把执行结果转成结构化 reintegration summary，为后续更深层对象回流做骨架铺设。

### 当前状态
**已完成最小 skeleton 级闭合。**

这是当前最明确可以按“已落地”口径书写的路线段之一，但必须严格限定口径。
### 已落地内容
当前已可明确锚定：
- terminal worker task 可在真实 terminal worker path 中 best-effort 进入 reintegration hook；
- 已有 supported task type 列表、payload 构造、terminal status 限定；
- 已有 `target` / `strength` / `summary` 的最小 continuity integration 语义；
- 已有对应 tests 锁定 payload/result/fallback summary/observational summary/部分 execution-path 覆盖。

代码锚点：
- `workerTasks.ts:223-230`
- `LifeOS/packages/server/src/workers/feedbackReintegration.ts`
- `LifeOS/packages/server/src/workers/continuityIntegrator.ts`
- `LifeOS/packages/server/test/feedbackReintegration.test.ts`

### In Scope
- terminal outcome packet construction；
- best-effort reintegration hook；
- continuity summary / target / strength skeleton；
- supported terminal status coverage；
- minimal observational / fallback-summary path locking。

### Out of Scope
当前**不能**把以下内容算进 PR4 已完成：
- persona semantic reintegration；
- event promotion；
- continuity promotion；
- productized feedback engine；
- cross-layer productization；
- governance bypass；
- 大规模 outcome-based next-action persistence。

### 完成定义
PR4 当前完成口径应固定为：
- **最小 reintegration skeleton 已闭合；**
- **当前仍属保守、局部、best-effort、无对象层持久化升级的骨架阶段；**
- **不应夸大为高阶回流系统完成。**

### 验证检查点
- succeeded / failed / cancelled 可进入统一最小回流路径；
- summary / target / strength 语义稳定；
- unsupported 类型安全降级；
- reintegration 不破坏当前执行主链。

---

## PR5｜Lightweight Persona / Intervention Reintegration

### 阶段目标
在 PR4 skeleton 之上，只引入最轻量、最可控的人设/治理学习回流。

### 当前状态
**最小落地（保守口径）。**

当前已可确认：
- 已形成以 `update_persona_snapshot` 为中心的最小 `candidate -> gate -> review -> approve -> dispatch -> execute` 闭环；
- 已有 `persona_snapshots` 作为 persona snapshot 持久化宿主；
- 已有 `reintegration_records` 作为轻量 persona/intervention 回流信号层；
- 当前范围仍然很窄，只覆盖保守、可解释、可边界化的最小回流，不应写成通用 persona/intervention learning 系统已完成。

### In Scope
- lightweight persona snapshot 更新依据；
- review / dispatch 历史对 Gate 的有限反馈；
- outcome-based 小范围治理学习输入。

### Out of Scope
- 深层人格建模；
- 自主演化策略系统；
- 高阈值 continuity promotion 自动化；
- 把 PR5 写成“大脑增强”。

### 关键文件 / 模块区
规划目标区：
- `LifeOS/packages/server/src/soul/feedbackReintegration.ts`
- `LifeOS/packages/server/src/soul/interventionGate.ts`
- `LifeOS/packages/server/src/soul/soulActionGenerator.ts`

### 完成定义
只有在以下条件满足时，PR5 才能按“完成”口径书写：
- persona/intervention 回流效果是轻量、可解释、可边界化的；
- 不会导致系统越权自动行为扩张；
- 能对 Gate / Review 形成有限但真实的增益。

### 验证检查点
- outcome-based learning 影响有边界；
- 不改变高阈值治理基本盘；
- 不把单次结果误写成长期原则。

---

## PR6｜High-threshold Event / Continuity Reintegration

### 阶段目标
处理真正高阈值的 event / continuity 晋升与长期结构沉淀。

### 当前状态
**最小落地（保守口径）。**

当前已可确认：
- 已有 `event_nodes` 与 `continuity_records` 两类高阈值对象层；
- 已形成基于 `reintegration_records` 的 review-backed promotion 最小闭环；
- 已有 `promote_event_node` / `promote_continuity_record` 两类高阈值 `soul_actions`；
- 当前仅覆盖有限 promotion sources（Event：`daily_report` / `weekly_report` / `update_persona_snapshot`；Continuity：`weekly_report` / `update_persona_snapshot`），不应写成完整高阈值 continuity/event 产品化系统已完成。

### In Scope
- event / continuity promotion rule；
- 强证据门槛；
- review-backed promotion；
- auditability / traceability。

### Out of Scope
- 提前自动化；
- 跳过 review；
- 把 continuity 当普通产物输出；
- 为了“显得聪明”而提前扩张。

### 关键文件 / 模块区
规划目标区：
- `LifeOS/packages/server/src/soul/continuityIntegrator.ts`
- `LifeOS/packages/server/src/soul/feedbackReintegration.ts`
- `LifeOS/packages/server/src/soul/soulActionGenerator.ts`

### 完成定义
只有在以下条件满足时，PR6 才能按“完成”口径书写：
- continuity promotion 有高门槛、可审计、可解释依据；
- event / continuity 晋升不绕开 review；
- 长期结构沉淀不再只是概念，而是治理支持下的稳定路径。

### 验证检查点
- promotion 证据链可回看；
- review backing 明确存在；
- 高阈值路径不破坏整体治理边界。

---

## 七、当前状态 vs 剩余缺口（正式对齐表）

| 阶段 | 当前状态 | 已落地内容 | 剩余关键缺口 | 建议下一步 |
|---|---|---|---|---|
| PR1 | 部分落地（最小骨架） | `src/soul/` 已存在最小 `SoulAction` 类型/同步模块，`soul_actions` 表与 server-local store 已落地，当前仅保守覆盖 `extract_tasks` | 缺少 generator / gate / dispatcher / review queue，尚未形成完整治理主线 | 冻结保守口径，后续在此基础上推进 PR2 |
| PR2 | 最小落地（保守口径） | 已形成以 `update_persona_snapshot` 为中心的最小 low-risk closed loop | 仍缺多 action kinds 的通用 candidate / gate / dispatcher 闭环 | 冻结保守口径，按最小闭环已落地对齐 |
| PR3 | 最小落地（保守口径） | 已有 `soul_actions` 双状态、review queue、approve / dispatch / defer / discard 最小治理面 | 仍缺完整产品化治理控制面与更广 action coverage | 冻结保守口径，按最小治理桥已落地对齐 |
| PR4 | 已完成最小 skeleton | `workerTasks.ts` 已在真实 terminal path 接线到 `feedbackReintegration.ts` + `continuityIntegrator.ts` + 对应 tests | 尚未进入 persona/event/continuity 深层 reintegration | 冻结口径，不再继续无止境微补强 |
| PR5 | 最小落地（保守口径） | 已有 `persona_snapshots` + `reintegration_records`，并形成以 `update_persona_snapshot` 为中心的最小 persona/intervention reintegration | 仍缺通用、全量、产品化的 persona/intervention learning | 冻结保守口径，避免写大 |
| PR6 | 最小落地（保守口径） | 已有 review-backed `event_nodes` / `continuity_records` promotion 最小闭环 | 仍缺通用、高覆盖、产品化的高阈值 continuity/event 系统 | 冻结保守口径，避免写大 |

---

## 八、关键文件分组（用于后续进度对齐）

### A. 数据 / 持久化宿主
- `LifeOS/packages/server/src/db/schema.ts`
- `LifeOS/packages/server/src/db/client.ts`

### B. API / 治理面入口
- `LifeOS/packages/server/src/api/handlers.ts`
- `LifeOS/packages/server/src/api/routes.ts`

### C. 执行 / 调度宿主
- `LifeOS/packages/server/src/workers/workerTasks.ts`
- `LifeOS/packages/server/src/workers/taskScheduler.ts`

### D. 当前 PR4 skeleton 锚点
- `LifeOS/packages/server/src/workers/feedbackReintegration.ts`
- `LifeOS/packages/server/src/workers/continuityIntegrator.ts`
- `LifeOS/packages/server/test/feedbackReintegration.test.ts`

### E. 当前已存在的 soul 模块锚点
当前已可确认存在：
- `LifeOS/packages/server/src/soul/types.ts`
- `LifeOS/packages/server/src/soul/soulActions.ts`

说明：
- 本组当前是 PR1 的最小已落地骨架；
- 其范围仅限 `extract_tasks` 映射、worker 生命周期镜像、server-local 持久化；
- 不应误写成完整 soul 中枢已经成型。

### F. 规划中的 soul 模块扩展目标区
当前 vision 扩展目标区为：
- `LifeOS/packages/server/src/soul/soulActionGenerator.ts`
- `LifeOS/packages/server/src/soul/interventionGate.ts`
- `LifeOS/packages/server/src/soul/soulActionDispatcher.ts`
- `LifeOS/packages/server/src/soul/feedbackReintegration.ts`
- `LifeOS/packages/server/src/soul/continuityIntegrator.ts`

注意：
- 本组文件中已有一部分按最小范围落地；
- 但整体仍不应误写成“已全部存在”或“已形成完整治理主线”。
---

## 九、阶段验证口径（后续统一采用）

为了避免以后每轮都在“做了很多小事，但不知道是否真前进”中漂移，本文件统一后续 closure 口径。

### PR1 验证口径
- DB 初始化出 SoulAction runtime 结构；
- store / types 能基本 round-trip；
- 无 worker/scheduler 回归。

### PR2 验证口径
- 至少一条 low-risk action 跑通完整闭环；
- Gate 输出显式决策；
- 不绕开执行主宿主。

### PR3 验证口径
- review queue 可查看、可处理；
- `approve` / `dispatch` / `defer` / `discard` 状态转移正确；
- review 仍是治理视图，不是平行系统。

### PR4 验证口径
- terminal outcome 可进入统一最小回流入口；
- summary / target / strength 语义稳定；
- best-effort，不破坏主执行链。

### PR5 验证口径
- lightweight reintegration 边界明确；
- 对 Gate / Review 有有限增益；
- 不引发越权自动化。

### PR6 验证口径
- continuity / event promotion 有证据链；
- 有 review backing；
- 可追踪、可审计、可解释。

---

## 十、当前主线程优先级（正式裁决）

基于“快速落地”要求，本版正式文稿给出如下主线程优先级：

### P0｜冻结保守口径
立即统一口径：
- PR1 只按“最小骨架部分落地”表述，不能再写成“待核实/不存在”；
- PR4 只按“真实接线的最小 reintegration skeleton 已闭合”表述；
- 不再把 PR4 周边测试补强写成更大阶段完成；
- 不把概念路线写成实现完成。

### P1｜同步 PR1–PR6 文档状态并消除前后冲突
当前最需要补的，不再是只盯着 PR5 / PR6 文稿，而是：
- 把正式进度文档与当前代码现实同步到 PR1–PR6 全链路的最小落地（保守口径）；
- 固定“已落地到哪里、仍不能夸大到哪里”的边界；
- 清理不同文稿之间与文稿内部的前后冲突。

### P2｜收口验证与落地审查
在 PR5 / PR6 已有最小落地后，第二优先应是：
- 继续做收口验证、文档同步与保守口径冻结。

### P3｜在保守边界内继续后续演进
后续继续推进时：
- 不应把 PR5 / PR6 写大成完整产品化系统；
- 应继续沿 review-backed、可解释、可审计的边界小步推进。

---

## 十一、T0 当前总判断

截至本版正式文稿，T0 的主线程判断如下：

1. **总体路线已经清楚。**
   `vision/` 对第一阶段路线收束已经足够稳定，不需要再重新发明路线。

2. **当前最明确已落地的是四块最小真实锚点：PR1 最小骨架、PR2 最小低风险闭环、PR3 最小治理桥，以及 PR4 最小 skeleton。**
   PR1 已有最小 `SoulAction` runtime/store 镜像层，PR2 已有保守 low-risk `candidate -> gate -> review/dispatch -> execute` 闭环，PR3 已有最小 review/governance/execution bridge，PR4 已有真实 terminal path 接线的回流骨架；但四者都必须严格限制口径，不能夸大为完整治理系统完成。

3. **当前更真实的主线缺口，已经从“PR2/PR3 是否存在”转向“覆盖面、产品化治理面与后续边界收口”。**
   既然 PR1–PR4 都已有保守、可锚定的最小落地，后续快速落地应优先做状态收口、边界冻结与小步扩展，而不是继续基于过时口径把 PR2/PR3 视作未开始。
4. **这份文稿可作为后续固定对齐底板。**
   后续每次推进，只需回答：
   - 当前推进的是哪一阶段；
   - 是否满足本文件对该阶段的完成定义；
   - 是否越过了本文件明确的 out-of-scope 边界。

---

## 十二、一句话收束

> LifeOnline 第一阶段当前已经具备四块最小真实锚点：一是 `src/soul/` 中以 `extract_tasks` 为中心的 PR1 最小 `SoulAction` 镜像骨架，二是以 `update_persona_snapshot` / `extract_tasks` 为中心的 PR2 最小低风险闭环，三是 review queue + approve / dispatch / defer / discard 的 PR3 最小治理执行桥，四是 `workerTasks -> feedbackReintegration -> continuityIntegrator` 这一侧真实接线的保守 PR4 最小回流骨架；后续主线应继续在保守边界内收口状态、冻结口径，并沿 review-backed、可解释、可审计的路径小步推进 PR5 / PR6 之后的演进。