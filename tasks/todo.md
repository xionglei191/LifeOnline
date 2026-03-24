# LifeOnline 开发任务

---

## 第三阶段：Phase 3 — 主动执行引擎 (Active Action Automations)

> 下发人：项目经理 | 启动日期：2026-03-24
> 模式：四组并行（A 认知与调度 / B 客户端与UX / C 基础设施 / D 灵光APP移动端）
> 蓝图来源：`vision/02-权威基线/LifeOnline_Phase3_技术蓝图.md`
> 核心愿景：系统从"被动认知治理面板"进化为"主动的数字代理"

### Phase 3 三大架构演进

| # | 方向 | 说明 |
|---|---|---|
| 1 | SoulAction → PhysicalAction | Planner Agent 可 dispatch 真实世界动作（日历/邮件/webhook） |
| 2 | Protocol Layer 外部网关 | Calendar / Communication / Finance / IoT 四大协议插件 |
| 3 | Execution Engine + 权限熔断 | 审批墙（首次必须用户授权）+ Dry-Run 模拟运行 |

<details>
<summary>📦 Phase 1 + Phase 2 已完成 83 项任务（点击展开）</summary>

**Phase 1** (3组 × 4 Sprint = 36 任务)：认知双循环建立
**Phase 2** (4组 × 4 Sprint = 47+1 任务)：多智能体 + 向量存储 + 主动思考 + 灵光APP进化

</details>

---

### 🔴 C 组 — 基础设施

<details>
<summary>✅ 已完成（Sprint 1: Schema / OAuth / Execution Engine）</summary>

- [x] P0：PhysicalAction 数据模型与 DB Schema
- [x] P1：Google Calendar API OAuth 2.0 对接
- [x] P2：Execution Engine 核心框架

</details>

#### Phase 3 Sprint 2（日常自动化闭环与重试）

- [x] **P1：物理动作异步执行队列（Async Queue）**
  - 目标：将 Execution Engine 调用外部 API 从同步改写为基于 worker 的异步任务
  - 关键文件：`packages/server/src/workers/` (支持 physical_action_task)
  - 完成标准：ExecutionEngine 产生任务入队，worker 消费并在失败时记录错误和重试次数
  - 验证：断网模拟提交，观察重试队列

- [x] **P2：执行错误聚合分析**
  - 目标：抓取 `physical_actions` 失败记录，供终端用户和 Agent 进行错误自愈检查
  - 关键文件：`packages/server/src/integrations/insightEngine.ts`
  - 完成标准：失败记录（如 API 变更/日历满额）暴露到 API
  - 验证：Mock 一个 `403 Forbidden` API，验证系统能够捕获并存储错误类型

---

### 🟢 B 组 — 客户端与 UX

<details>
<summary>✅ 已完成（Sprint 1: 审批UI / Dry-Run / 集成页）</summary>

- [x] P1：PhysicalAction 授权审批 UI 卡片
- [x] P2：Dry-Run 预测效果预览面板
- [x] P3：集成管理设置页（OAuth授权绑定）

</details>

#### Phase 3 Sprint 2（冲突渲染与反馈）

- [x] **P1：日程冲突可视化（Conflict Map）**
  - 目标：在授权批准时，画出目标时间段上下的 Timeline，提醒用户"那天下午你已经有两个会了"
  - 关键文件：`packages/web/src/components/PhysicalActionCard.vue`
  - 完成标准：获取当天日程流与待审批事件，如果冲突呈现橙/红警报 UI
  - 验证：造一组重叠时间的 mock 事件验证渲染

- [x] **P2："自动化审计日志"追溯面板**
  - 目标：提供一个全局的 Automation 审计列表，看到过去一个月系统帮你悄悄做了什么
  - 关键文件：`packages/web/src/views/AutomationAuditView.vue`
  - 完成标准：展示 physical actions 的 Timeline，支持过滤 success/failed
  - 验证：可以溯源任意一条命令是由哪篇笔记产生的

---

### 🟡 D 组 — 灵光APP (LingGuangCatcher)

<details>
<summary>✅ 已完成（Sprint 1: 手机授权推送 / 简版日历 / 自动化开关）</summary>

- [x] P1：手机端推送卡片及向右滑动授权
- [x] P2：移动端简版月视图日历展示
- [x] P3：APP 设置自动化细化开关

</details>

#### Phase 3 Sprint 2（底层探测与 Widget 关停）

- [x] **P1：底层静默日历探测 (Silent Sync)**
  - 目标：即使用户在主系统添加了工作日历安排，灵光 APP 需要将其探测拉回，避免规划冲突
  - 关键文件：`LingGuangCatcher/app/src/.../CalendarSyncWorker.kt`
  - 完成标准：后台周期性抓取手机本地日历变更，并写入 Vault 成为环境上下文
  - 验证：在系统日历新建事件，稍后会在 Vault `dimension: environment` 里查看到快照

- [x] **P2：桌面一键急停 (Emergency Stop Widget)**
  - 目标：怕 AI 发疯暴走？手机桌面提供一个大红色的中止组件，干掉一切审批流并设为 observe_only
  - 关键文件：`LingGuangCatcher/app/src/widget/`
  - 完成标准：点击后向 `LifeOS` 发送停止一切物理动作指令，并锁死 `auto_approve`
  - 验证：测试发送急停信令，验证所有的策略回落为强人工审核

---

### 🔵 A 组 — 认知与调度

<details>
<summary>✅ 已完成（Sprint 1: 动作转换引擎 / 审批网关 / 完整闭环 E2E）</summary>

- [x] P1：PhysicalAction 类型体系与转换引擎（mapSoulActionToPhysicalAction）
- [x] P2：Approval Gate 审批网关流
- [x] P3：Calendar Protocol 首个完整单向闭环
- [x] **联调里程碑**：E2E 集成测试成功（审批/免审批双向验证）

</details>

#### Phase 3 Sprint 2（高级 Planner 能力演进）

- [x] **P1：Planner Agent 结合日历的排期决策 (Cognitive Scheduling)**
  - 目标：Planner 生成建议前，**主动读取日历快照**，如果发现那天太满，主动调整建议或向用户抛出警告 (Dry-Run Preview 附加上下文)
  - 关键文件：`packages/server/src/soul/agents/plannerAgent.ts`
  - 完成标准：输入"周三去牙医" + 虚拟周三日程满额，Planner 生成 `alert` 或改期建议
  - 验证：跑一次 mock AI 判断

- [x] **P2：双生子计划生成（Fallback Option）**
  - 目标：对有风险的操作，Agent 提供 A/B 两个 PhysicalAction 候选（Plan A: 自动订场地，Plan B: 仅提醒我订）。让用户在授权时做二选一。
  - 关键文件：`packages/server/src/soul/agents/plannerAgent.ts`
  - 完成标准：Governance 收到类型为 `multiple_choices` 的 SoulAction
  - 验证：测试发散型规划，生成双动作可选路径。

---

## Phase 3 Sprint 3 — 高级串联与熔断

> 蓝图来源：`vision/02-权威基线/LifeOnline_Phase3_技术蓝图.md` Sprint 3 行
> 分工规则：`vision/01-当前进度/LifeOnline 三开发组并行方案.md`

### 🔴 C 组 — 基础设施

- [x] **P1：R2 物理执行日志持久化**
  - 目标：所有 PhysicalAction 到达终态后，完整执行记录序列化到 R2 冷存储，实现不可变审计日志
  - 关键文件：`packages/server/src/integrations/executionArchiver.ts` [NEW]
  - 集成点：`packages/server/src/workers/executors/physicalActionExecutor.ts`（执行完成回调中触发归档）
  - R2 Key 格式：`execution-logs/{YYYY-MM}/{action.id}.json`
  - 完成标准：执行成功/失败后自动 uploadToR2；R2 未配置时静默跳过（best-effort）
  - 验证：模拟一条 completed action，检查 R2 key 格式正确

- [x] **P2：安全熔断器 (Circuit Breaker)**
  - 目标：连续 N 次同类型 PhysicalAction 执行失败时，自动熔断该类型的自动审批
  - 关键文件：`packages/server/src/integrations/circuitBreaker.ts` [NEW]
  - 集成点：`physicalActionExecutor.ts`（recordFailure/recordSuccess）、`executionEngine.ts`（approveAction 前检查 isBreakerOpen）
  - 配置：阈值=3 次、滑动窗口=1h、冷却=30min 自动恢复（半开探测）
  - API：`GET /insight/breaker-states` → `insightHandlers.ts` 新增 `getBreakerStatesHandler`
  - 完成标准：3 次连续失败 → 熔断 → 30min 后半开 → 首次成功 → 恢复
  - 验证：`circuitBreaker.test.ts` 模拟 3 次失败 → 验证熔断 → 验证半开恢复

### 🔵 A 组 — 认知与调度

- [x] **P1：复合式任务流 DAG (DAG Of Physical Actions)**
  - 目标：支持「链式物理动作」— 一个 SoulAction 触发多个 PhysicalAction，有依赖顺序（如：查询空闲 → 创建日历 → 发送邮件）
  - 关键文件：
    - `packages/server/src/soul/dagExecutor.ts` [NEW] — DAG 拓扑排序执行引擎
    - `packages/server/src/soul/soulActionDispatcher.ts` — `dispatch_physical_action` payload 含多步时构造 DAG
  - ⚠️ 类型定义需求：需要 C 组在 `packages/shared/src/dagTypes.ts` 新增 `PhysicalActionDag`、`DagNode`、`DagEdge` 类型
  - 执行策略：按拓扑排序依次提交 worker tasks，上一步成功才触发下一步；失败则标记 `partial_failure` 并记录断点
  - 完成标准：3-node DAG 中间节点失败 → 后续节点不执行 → 断点可查
  - 验证：`dagExecution.test.ts` 正常/中断双路径测试

### 🟢 B 组 — 客户端与 UX

- [x] **P1：实时执行状态 Dashboard（执行大屏）**
  - 目标：在 Web Dashboard 中新增「自动化实时面板」，展示进行中的 PhysicalAction、DAG 进度、熔断器状态
  - 关键文件：
    - `packages/web/src/components/AutomationLivePanel.vue` [NEW]
    - `packages/web/src/views/DashboardView.vue`（嵌入 AutomationLivePanel）
    - `packages/web/src/api/client.ts`（新增 `fetchBreakerStates()`）
  - 功能点：
    - 轮询 `/physical-actions?status=executing` 展示执行中动作
    - 熔断器指示灯：调用 `GET /insight/breaker-states`（🟢正常/🟡半开/🔴熔断）
    - DAG 进度条（可在 A 组交付 DAG 后接入，先预留插槽）
  - 完成标准：Dashboard 页面可看到实时执行状态 + 熔断器红绿灯
  - 验证：Mock 一个 executing 状态的 action，面板正确渲染

### 🟡 D 组 — 灵光 APP

- [x] **P1：实时执行推送通知**
  - 目标：PhysicalAction 执行完成时，向灵光 APP 推送结果通知
  - 关键文件：
    - `LingGuangCatcher/app/src/.../ExecutionNotificationReceiver.kt` [NEW]
    - Server 端可选：在 `physicalActionExecutor.ts` 完成后触发推送 webhook
  - 三级推送策略：
    - 成功 → 普通通知（可收起）
    - 失败 → 高优先级通知（前台弹出 + 震动）
    - 熔断触发 → 特殊警报「⚠️ 系统已熔断 {type} 自动化」
  - 完成标准：灵光 APP 收到三种级别的推送通知
  - 验证：分别触发三种场景，验证通知级别与震动策略

---

## Phase 3 Backlog — 代码质量优化

### 🔵 A 组

- [ ] **消除 soulActionDispatcher payload `as any` 断言**
  - 位置：`packages/server/src/soul/soulActionDispatcher.ts` L437
  - 当前：`(mapperResult.payload as any).title` 不安全访问
  - 建议：在 `PhysicalActionPayload` 联合类型上增加 `title?: string` 基础字段，或按 `mapperResult.type` 做类型守卫分支访问
  - 优先级：P3

### 🔴 C 组

- [ ] **DAG 持久化（内存 → DB）**
  - 位置：`packages/server/src/soul/dagExecutor.ts` L25-28
  - 当前：`const dagStore = new Map<string, PhysicalActionDag>()` 进程重启丢数据
  - 建议：`db/schema.ts` 新增 `physical_action_dags` 表，将 DAG 进度和断点信息持久化，支持审计面板溯源
  - 优先级：P2
