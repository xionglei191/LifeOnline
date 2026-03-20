# 《Soul Constitution》v0.5
## LifeOS 灵魂动作层最小落地骨架草案

这一版不再继续停留在抽象层，而是开始回答一个更直接的问题：

> 如果要在当前 LifeOS 上真正开始做 `SoulAction`，第一版代码骨架应该长什么样？

v0.5 的目标不是一次性设计完整灵魂系统，
而是明确一个**最小可落地骨架**，让后续实现有非常清晰的切入点。

---

# 1. v0.5 的定位

如果说：
- v0.1 是精神宪章
- v0.2 是最小认知对象
- v0.3 是对象与现有架构映射
- v0.4 是动作桥与调度原则

那么 v0.5 解决的就是：

> 第一批真正值得在代码里出现的表、接口、dispatcher 和 actionType，应该是什么？

这一版坚持三个原则：

## 1.1 只做最小闭环
不要一开始就做：
- 复杂自治代理
- 多层状态机
- 过度细化的动作分类
- 大规模 worker 重构

第一阶段只要求：
- 能生成动作
- 能记录动作
- 能 dispatch 少量低风险动作
- 能收到反馈

---

## 1.2 尽量复用现有 LifeOS 骨架
也就是说：
- SQLite 继续做运行态主存
- 现有 worker task 继续被复用
- Vault 继续承接可读产物
- OpenClaw 继续做外部执行器
- R2 继续只做桥接和备份

v0.5 的核心不是重造系统，
而是给当前系统加一层动作骨架。

---

## 1.3 先动作日志，后复杂自治
第一版最重要的不是“让系统很聪明”，
而是让系统的动作链条变得：
- 可观察
- 可审计
- 可调参
- 可渐进扩展

因此：

> `SoulAction` 的第一价值是建立动作可见性，而不是立刻建立完全自治。

---

# 2. 第一版最小链路

v0.5 建议把最小链路收敛成下面这个样子：

```text
输入流 / note / brainstorm / schedule
        ↓
Soul object builder
        ↓
SoulAction candidate generator
        ↓
Intervention gate
        ↓
SoulAction store (SQLite)
        ↓
SoulAction dispatcher
        ↓
SQLite update / worker task / Vault output / R2 sync / user interaction
        ↓
execution feedback
        ↓
InterventionDecision / PersonaState / ContinuityRecord 回写
```

第一阶段真正需要实现的，只有 5 个部件：

1. `SoulAction` 数据结构
2. `soul_actions` 表
3. `generateSoulActions(...)`
4. `dispatchSoulAction(...)`
5. `completeSoulAction(...)`

只要这五个部件出现，灵魂层就已经不是纯概念了。

---

# 3. 第一版建议新增的 SQLite 表

## 3.1 `soul_actions`
这是 v0.5 最核心的一张表。

建议先压成：

```sql
CREATE TABLE soul_actions (
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
);
```

---

## 3.2 为什么第一版只需要这一张核心表
因为当前阶段最重要的是先解决：
- 动作有没有被表达出来
- 动作有没有真正被执行
- 动作最后的结果是什么
- 哪些动作频繁出现
- 哪些动作应该降权或升级

换句话说：

> 在 v0.5 阶段，`soul_actions` 比复杂的对象关系表更关键。

其他对象表（如 `persona_states` / `event_nodes` / `continuity_records`）当然会逐渐出现，
但如果 `SoulAction` 没有记录层，这些对象仍然很难真正驱动系统。

---

# 4. 第一版 TypeScript 接口草案

## 4.1 `SoulAction`

```ts
type SoulActionStatus =
  | 'pending'
  | 'approved'
  | 'dispatched'
  | 'completed'
  | 'failed'
  | 'discarded'


type SoulAction = {
  id: string
  createdAt: string
  updatedAt: string

  sourceType:
    | 'brainstorm_session'
    | 'persona_state'
    | 'event_node'
    | 'intervention_decision'
    | 'continuity_record'
    | 'schedule'
    | 'system'

  sourceId: string

  actionCategory:
    | 'state_update'
    | 'memory_promotion'
    | 'interaction'
    | 'task_launch'
    | 'artifact_output'
    | 'bridge_sync'

  actionType:
    | 'ask_followup_question'
    | 'update_persona_snapshot'
    | 'create_event_node'
    | 'persist_continuity_markdown'
    | 'launch_daily_report'
    | 'launch_weekly_report'
    | 'launch_openclaw_task'
    | 'sync_continuity_to_r2'

  targetType?: 'sqlite' | 'vault' | 'worker_task' | 'openclaw' | 'r2' | 'user'

  priority: 'low' | 'medium' | 'high'
  status: SoulActionStatus

  payload: Record<string, unknown>
  reason?: string

  requiresApproval: boolean
  approvalStatus?: 'pending' | 'approved' | 'rejected'

  dispatchAttempts: number
  dispatchedAt?: string
  completedAt?: string
  failedAt?: string

  feedbackRef?: string
  resultSummary?: string
  errorMessage?: string
}
```

---

## 4.2 为什么 `actionType` 第一版要刻意收窄
第一版不应该开放成无限字符串宇宙。
建议只先允许少数已经明确、低风险、高价值的动作。

原因是：
- 更容易调试
- 更容易看日志
- 更容易做 dispatcher
- 更容易控制主动性边界

后续稳定后，再从联合类型慢慢扩成 registry 模式更合理。

---

# 5. 第一版最值得落地的 8 个 `actionType`

这是 v0.5 最关键的取舍之一。

## 5.1 `ask_followup_question`
### 分类
- `interaction`

### 作用
把脑暴或模糊输入转成一个结构化追问。

### 为什么优先级高
因为这是最低风险、最高价值的灵魂动作之一。
它直接增强：
- 澄清能力
- 提炼能力
- 抗顺从能力

---

## 5.2 `update_persona_snapshot`
### 分类
- `state_update`

### 作用
根据最近输入或阶段变化更新当前 Persona 快照。

### 为什么优先级高
因为画像不更新，后面所有主动性和长期记忆都会飘。

---

## 5.3 `create_event_node`
### 分类
- `memory_promotion`

### 作用
把高价值事件提炼成结构化事件节点。

### 为什么优先级高
因为它是长期记忆从流水账变骨架的第一步。

---

## 5.4 `persist_continuity_markdown`
### 分类
- `artifact_output`

### 作用
把高优先级 `ContinuityRecord` 落成可读 markdown 条目。

### 为什么优先级高
因为连续性如果只存在数据库里，太隐形；
变成 markdown 以后，才真正进入人机共读、共修订的层。

---

## 5.5 `launch_daily_report`
### 分类
- `task_launch`

### 作用
把低风险周期性认知输出桥接到现有 `daily_report` worker。

### 为什么优先级高
因为它天然适合验证“灵魂层判断 → 现有 worker 执行”链路。

---

## 5.6 `launch_weekly_report`
### 分类
- `task_launch`

### 作用
桥接到 `weekly_report` worker。

### 为什么优先级高
和日报一样，天然适合做低风险 dispatch 验证。

---

## 5.7 `launch_openclaw_task`
### 分类
- `task_launch`

### 作用
把复杂外部执行桥接给 OpenClaw。

### 为什么第一版先放进来但不默认自动执行
因为它代表“算力杠杆”与“执行杠杆”的关键方向，
但风险和成本明显高于日报、周报、追问，因此更适合：
- 先纳入动作体系
- 后期逐步放开

---

## 5.8 `sync_continuity_to_r2`
### 分类
- `bridge_sync`

### 作用
将高价值连续性资产同步到 R2 作为桥接备份。

### 为什么要纳入首批
因为它正好体现了 R2 的真实角色：
- 不是主脑
- 但确实是连续性基础设施的一部分

---

# 6. 第一版 dispatcher 应该长什么样

v0.5 建议 dispatcher 不要做成太聪明的调度器。
第一版只需要一个明确的 `switch` 分发器即可。

```ts
async function dispatchSoulAction(action: SoulAction): Promise<void> {
  switch (action.actionType) {
    case 'ask_followup_question':
      return dispatchFollowupQuestion(action)

    case 'update_persona_snapshot':
      return dispatchPersonaUpdate(action)

    case 'create_event_node':
      return dispatchEventNodeCreation(action)

    case 'persist_continuity_markdown':
      return dispatchContinuityMarkdown(action)

    case 'launch_daily_report':
      return dispatchDailyReportTask(action)

    case 'launch_weekly_report':
      return dispatchWeeklyReportTask(action)

    case 'launch_openclaw_task':
      return dispatchOpenClawTask(action)

    case 'sync_continuity_to_r2':
      return dispatchR2Sync(action)

    default:
      throw new Error(`Unsupported soul action type: ${action.actionType}`)
  }
}
```

---

## 6.1 为什么第一版用 `switch` 反而更好
因为当前阶段最重要的是：
- 简单
- 显式
- 可读
- 方便排查

一开始就抽成插件系统、注册中心、反射式 handler registry，
只会让骨架更花，但不会更稳。

---

# 7. 第一版最小 handler 映射

## 7.1 `ask_followup_question`
### 推荐落点
- 不走 worker
- 直接写入交互输出队列或轻量回显表

### 原因
这是最轻的灵魂动作，不值得为了它起一个 worker。

---

## 7.2 `update_persona_snapshot`
### 推荐落点
- 直接 SQLite 写入
- 必要时附带一条轻量日志

### 原因
这是典型运行态更新。

---

## 7.3 `create_event_node`
### 推荐落点
- 先写 SQLite
- 可选再派生 Vault note

### 原因
结构化主记录应先进运行态层。

---

## 7.4 `persist_continuity_markdown`
### 推荐落点
- 直接生成本地 markdown / Vault note

### 原因
这是标准 `artifact_output`。

---

## 7.5 `launch_daily_report` / `launch_weekly_report`
### 推荐落点
- 转译成现有 worker task input
- 复用现有任务队列和执行器

### 原因
这是现有系统最成熟、最安全的执行后端。

---

## 7.6 `launch_openclaw_task`
### 推荐落点
- 转译成现有 `openclaw_task`
- 默认高阈值或需要审批

### 原因
符合当前架构边界，且保留执行杠杆。

---

## 7.7 `sync_continuity_to_r2`
### 推荐落点
- 单独同步函数
- 一般异步执行

### 原因
它是桥接动作，不应阻塞主认知链路。

---

# 8. 第一版 `generateSoulActions(...)` 应如何设计

这一层非常重要。
它不负责真正执行，
而负责把灵魂对象转成动作候选。

建议接口先长这样：

```ts
function generateSoulActions(input: {
  brainstormSession?: BrainstormSession
  personaState?: PersonaState
  eventNode?: EventNode
  continuityRecord?: ContinuityRecord
  trigger?: 'brainstorm' | 'schedule' | 'review' | 'system'
}): SoulAction[]
```

它的第一版职责应该非常保守：
- 不做复杂评分模型
- 不做大规模推理编排
- 只做规则型生成

例如：
- 如果 `BrainstormSession.ambiguityPoints` 非空 → 生成 `ask_followup_question`
- 如果提炼出高价值阶段变化 → 生成 `update_persona_snapshot`
- 如果某个 insight 被判定为长期原则 → 生成 `persist_continuity_markdown`
- 如果今天到达某个周期阈值 → 生成 `launch_daily_report`

也就是说：

> v0.5 的动作生成器，首先应是“可解释规则机”，而不是“黑盒智能体”。

---

# 9. `InterventionDecision` 在 v0.5 中如何落位

v0.5 建议不要把 `InterventionDecision` 设计成非常复杂的独立引擎。
第一版只要把它当成一个轻量 gating 过程即可。

例如：

```ts
function shouldDispatchSoulAction(action: SoulAction): {
  allowed: boolean
  decision: 'intervene' | 'defer' | 'observe' | 'discard'
  reason: string
  requiresApproval: boolean
}
```

这一步只需要看：
- 动作类别
- 风险等级
- 是否外部执行
- 是否涉及 R2 / OpenClaw
- 是否是低风险例行动作

这样就已经足够把 v0.1 的主动性边界压进工程骨架了。

---

# 10. 第一版反馈回路怎么做

任何灵魂动作如果没有反馈，系统就无法真正进化。

因此 v0.5 建议所有 dispatcher 最后都要回写：
- `status`
- `resultSummary`
- `errorMessage`
- `feedbackRef`（如果有）

并在必要时触发：
- `InterventionDecision.feedback` 更新
- `PersonaState` 小幅调整
- `ContinuityRecord` 晋升或降权

这意味着：

> `SoulAction` 不是一次性消息，而是有生命周期的运行对象。

---

# 11. 与当前 LifeOS 代码结构的最小接入建议

这一版先不写具体代码，但可以先把未来接入位置压出来。

## 11.1 建议新增模块
在 server 里增加一组很小的 soul 相关文件即可：

```text
packages/server/src/soul/
  soulActionTypes.ts
  soulActionStore.ts
  soulActionGenerator.ts
  soulActionDispatcher.ts
  interventionGate.ts
```

---

## 11.2 与现有 worker 体系的边界
推荐方式不是改造所有 worker，
而是让 dispatcher 在需要时调用现有 worker 创建逻辑。

也就是说：
- 现有 worker 基本不动
- 新增的是其上方的一层动作调度

这是最符合当前“保守、渐进、低风险”路径的。

---

## 11.3 与 Vault / R2 的边界
- Vault 写入：由 artifact handler 负责
- R2 同步：由 bridge handler 负责
- 两者都不应直接耦合到 `generateSoulActions(...)`

也就是：
- 生成器只负责说“应该做什么”
- handler 才负责说“怎么做”

---

# 12. 第一阶段真正值得做的实现顺序

## Step 1
先建：
- `SoulAction` 类型
- SQLite `soul_actions` 表
- store 的增删改查

## Step 2
再建：
- `generateSoulActions(...)`
- `shouldDispatchSoulAction(...)`
- `dispatchSoulAction(...)`

## Step 3
接入第一批低风险动作：
- `ask_followup_question`
- `update_persona_snapshot`
- `create_event_node`
- `persist_continuity_markdown`

## Step 4
再接：
- `launch_daily_report`
- `launch_weekly_report`

## Step 5
最后再接：
- `launch_openclaw_task`
- `sync_continuity_to_r2`

这个顺序的本质是：

> 先把灵魂动作层做成“可记录、可观察、可解释”，再逐步把它做成“可执行、可扩展、可主动”。

---

# 13. 一句话总结 v0.5

> v0.5 的意义，是把 `SoulAction` 从架构桥梁进一步压成当前 LifeOS 可以真正开始实现的最小代码骨架：先有表、先有类型、先有 generator、先有 gate、先有 dispatcher，再用少量低风险 actionType 把灵魂层第一次接进现实系统。