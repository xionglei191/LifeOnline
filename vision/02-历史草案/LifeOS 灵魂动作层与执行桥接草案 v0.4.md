# 《Soul Constitution》v0.4
## LifeOS 灵魂动作层与执行桥接草案

这一版的目标，是把 v0.3 中提出但尚未展开的 `SoulAction` 真正压成工程桥梁。

如果说：
- v0.1 是联合体宪章，
- v0.2 是最小认知对象，
- v0.3 是对象到现有架构的主落点映射，

那么 v0.4 要回答的问题就是：

> 灵魂层在完成“理解、提炼、判断”之后，究竟怎样把这些认知结果稳定地传递给现有 LifeOS 执行体系？

---

# 1. 为什么需要单独的动作层

如果没有 `SoulAction`，系统很容易出现两种坏结果：

## 1.1 灵魂层直接碰 worker task
这会导致：
- 认知判断和执行机制强耦合
- 以后新增执行通道时需要回改认知层
- 难以审计“系统为什么做了这件事”
- 难以为主动性设置阈值与治理规则

## 1.2 灵魂对象只停留在“理解完成”
这会导致：
- `PersonaState` 只是被动快照
- `BrainstormSession` 只是分析结果
- `EventNode` 只是记忆档案
- `ContinuityRecord` 只是静态条目

也就是说，缺少从“认知”到“行动”的中间层，灵魂层就无法真正驱动系统。

因此需要明确：

> `SoulAction` 不是新的 worker task，而是灵魂层对外发出的标准动作指令。

它负责把：
- 理解结果
- 提炼结果
- 主动性判断
- 连续性升级决策

转译成现有系统可以执行、记录、审计、反馈的动作。

---

# 2. `SoulAction` 的工程定位

在当前 LifeOS 架构中，更合适的链路应是：

```text
输入流 / 生活流 / 脑暴
        ↓
灵魂层对象生成与更新
(PersonaState / BrainstormSession / EventNode / InterventionDecision / ContinuityRecord)
        ↓
SoulAction
        ↓
Action Dispatcher
        ↓
worker task / SQLite写入 / Vault输出 / R2同步 / 追问回显
        ↓
结果反馈
        ↓
反向更新 PersonaState / EventNode / InterventionDecision / ContinuityRecord
```

这里有一个非常关键的边界：

## 灵魂层负责“决定应当发生什么”
例如：
- 应不应该追问
- 应不应该生成日报
- 应不应该把某个洞察升级为连续性资产
- 应不应该把某个大任务交给 OpenClaw 或后端执行

## 执行层负责“把动作真正落地”
例如：
- 启动 worker task
- 写入 note
- 更新数据库
- 同步 R2
- 把追问显示给用户

所以，`SoulAction` 的本质不是内容，也不是状态，而是：

> 灵魂层对执行层发出的可治理、可落地、可复盘的动作对象。

---

# 3. `SoulAction` 的最小分类

为了让这层足够稳定，又不至于一开始过度复杂，v0.4 先把 `SoulAction` 压成 6 大类。

## 3.1 `state_update`
表示灵魂层判断需要更新某个内部认知状态。

典型用途：
- 更新 `PersonaState`
- 更新 `BrainstormSession.status`
- 补充 `EventNode` 关联
- 调整 `InterventionDecision.feedback`

这一类动作通常不需要 worker task，更多是：
- SQLite 写入
- 局部结构更新
- 轻量级同步

---

## 3.2 `memory_promotion`
表示某段内容、洞察、状态或事件被升级为更高价值的长期资产。

典型用途：
- 从 `BrainstormSession` 晋升 `EventNode`
- 从 `EventNode` 晋升 `ContinuityRecord`
- 把某个长期原则写入 `_Continuity/`

这一类动作体现的是：
- 什么值得留下
- 什么值得继承
- 什么必须跨版本保留

---

## 3.3 `interaction`
表示系统应向用户发出某种低到中风险交互。

典型用途：
- 发起追问
- 输出结构化总结
- 推送提醒
- 给出下一步建议

这一类动作通常不等于“执行任务”，而是：
- 联合体主动发出一个认知回合
- 是主动性边界治理的关键入口

---

## 3.4 `task_launch`
表示灵魂层决定把某个动作转交给现有 worker task 或外部执行器。

典型用途：
- 启动 `summarize_note`
- 启动 `daily_report`
- 启动 `weekly_report`
- 启动 `openclaw_task`
- 启动未来的 `derive_persona_state`
- 启动未来的 `promote_event_node`

这一类动作是灵魂层与现有执行层最直接的桥。

---

## 3.5 `artifact_output`
表示系统应生成一个人类可读的外部沉淀物。

典型用途：
- 输出脑暴结构化 note
- 输出阶段性 Persona 快照
- 输出关键事件复盘 note
- 输出连续性条目 markdown

这类动作强调：
- 给人看
- 可回顾
- 可编辑
- 可沉淀

它和 `state_update` 的区别是：
- `state_update` 偏运行态
- `artifact_output` 偏可读沉淀

---

## 3.6 `bridge_sync`
表示系统需要与外部桥接/备份层发生同步行为。

典型用途：
- 将高价值连续性资产同步到 R2
- 将大体积分析材料上传到 R2 供远端访问
- 将必要副本用于内网桥接

注意：

> `bridge_sync` 是基础设施动作，不是认知主动作。

它永远不应成为灵魂层的核心本体，只是辅助动作。

---

# 4. 最小结构草案

v0.4 建议先把 `SoulAction` 定义为：

```ts
type SoulAction = {
  id: string
  createdAt: string

  sourceType:
    | 'brainstorm_session'
    | 'persona_state'
    | 'event_node'
    | 'intervention_decision'
    | 'continuity_record'
    | 'system'

  sourceId: string

  actionCategory:
    | 'state_update'
    | 'memory_promotion'
    | 'interaction'
    | 'task_launch'
    | 'artifact_output'
    | 'bridge_sync'

  actionType: string
  priority: 'low' | 'medium' | 'high'

  targetType?:
    | 'sqlite'
    | 'vault'
    | 'worker_task'
    | 'openclaw'
    | 'r2'
    | 'user'

  payload: Record<string, unknown>

  status: 'pending' | 'dispatched' | 'completed' | 'failed' | 'discarded'
  reason?: string
  requiresApproval: boolean
  feedbackRef?: string
}
```

---

# 5. 关键字段解释

## 5.1 `sourceType` / `sourceId`
这两个字段回答：

> 这次动作是从哪个灵魂对象里长出来的？

例如：
- 某次脑暴提炼后形成追问 → 来源是 `brainstorm_session`
- 某个长期目标变化后需要更新画像 → 来源是 `persona_state`
- 某个关键转折应被写入长期记忆 → 来源是 `event_node`

这让系统可以反向复盘：
- 哪类对象最常触发动作
- 哪类动作经常失败
- 哪类动作最有价值

---

## 5.2 `actionCategory`
这是治理层的第一层分类。

它的重要性在于：
- 便于做权限边界
- 便于做主动性阈值
- 便于做统计分析

例如：
- `interaction` 可以默认较容易触发
- `task_launch` 需要看任务风险
- `bridge_sync` 需要看数据敏感度

---

## 5.3 `actionType`
这是具体动作名。

例如：
- `ask_followup_question`
- `update_persona_snapshot`
- `create_event_node`
- `persist_continuity_markdown`
- `launch_daily_report`
- `sync_continuity_to_r2`

建议：
- `actionCategory` 保持稳定
- `actionType` 允许渐进扩展

这样系统不会因为未来动作增多而不断重写主结构。

---

## 5.4 `targetType`
回答：

> 这个动作最终是要交给谁？

例如：
- `sqlite`
- `vault`
- `worker_task`
- `openclaw`
- `r2`
- `user`

这能帮助调度层快速决定：
- 是直接写库
- 还是发 worker
- 还是生成 note
- 还是同步远端
- 还是回显给用户

---

## 5.5 `requiresApproval`
这是主动性边界进入工程化的第一根安全阀。

建议原则：
- 写 SQLite 运行态：通常不需要
- 生成低风险总结：通常不需要
- 启动高成本外部任务：视情况需要
- 外部可见/不可逆动作：应需要
- 涉及删除、发送、发布、资金、权限：必须需要

这与 v0.1 的主动性边界是严格一致的。

---

# 6. `SoulAction` 与五个灵魂对象的关系

## 6.1 `BrainstormSession` 最常产生动作
它是高熵输入进入结构化系统的第一入口，因此最可能生成：
- `interaction`：追问、澄清
- `task_launch`：启动分析/研究/总结 worker
- `memory_promotion`：晋升事件节点
- `artifact_output`：输出结构化脑暴结果

可以把它理解为：

> `BrainstormSession` 是 `SoulAction` 的高频源头。

---

## 6.2 `PersonaState` 最常触发状态与策略动作
它更适合产生：
- `state_update`
- `interaction`
- `task_launch`

例如：
- 当前主题明显切换 → 更新 Persona 快照
- 检测到持续拖滞 → 发起低风险提醒
- 某阶段需要周期性复盘 → 启动日报/周报 worker

---

## 6.3 `EventNode` 最常触发长期沉淀
它更适合产生：
- `memory_promotion`
- `artifact_output`
- 少量 `interaction`

例如：
- 某个事件被判定为关键转折 → 生成复盘 note
- 某个事件足够重要 → 晋升为 `ContinuityRecord`

---

## 6.4 `InterventionDecision` 最常作为动作闸门
它本身不是高频生产内容的对象，而更像：
- 动作放行器
- 主动性记录器
- 反馈回收器

它常见的关系是：
- 其他对象提出动作候选
- `InterventionDecision` 决定执行、延迟、观察还是放弃

也就是说：

> `InterventionDecision` 更像 `SoulAction` 的治理开关，而不是内容源头。

---

## 6.5 `ContinuityRecord` 最常触发继承与镜像动作
它更适合产生：
- `artifact_output`
- `bridge_sync`
- 少量 `interaction`

例如：
- 某条核心原则需要落成 markdown 镜像
- 某条高优先级连续性资产需要同步 R2 备份
- 某个长期 warning 需要在关键时机回流到交互上下文

---

# 7. `SoulAction` 到现有 LifeOS 执行体系的映射

## 7.1 到 SQLite
适合承接：
- `state_update`
- `memory_promotion` 的结构化主记录
- `InterventionDecision` 的结果记录
- `SoulAction` 自身的状态日志

建议新增或预留概念表：
```text
soul_actions
```

它的价值不是为了“多一张表”，而是为了：
- 审计
- 重试
- 统计
- 主动性调参

---

## 7.2 到现有 worker task
最适合承接：
- `task_launch`
- 一部分 `artifact_output`

当前可复用的 worker task 包括：
- `summarize_note`
- `extract_tasks`
- `daily_report`
- `weekly_report`
- `classify_inbox`
- `openclaw_task`

未来灵魂型 worker 可以补上：
- `derive_persona_state`
- `parse_brainstorm_session`
- `promote_event_node`
- `promote_continuity_record`
- `generate_intervention_candidates`

所以，v0.4 的判断不是“废掉现有 worker”，而是：

> 现有 worker task 将被降级为 `SoulAction` 的可执行后端之一。

---

## 7.3 到 Vault
最适合承接：
- `artifact_output`
- 一部分 `memory_promotion` 的可读镜像

例如：
- 结构化脑暴 note
- 阶段性画像 note
- 关键事件复盘 note
- `_Continuity/` 下的原则与长期目标条目

Vault 继续承担：
- 人可读
- 可编辑
- 可复盘
- 可纳入日后分析

---

## 7.4 到 R2
最适合承接：
- `bridge_sync`
- 少量 `artifact_output` 的桥接副本

例如：
- 大型分析中间材料
- 连续性条目备份
- 内网难以直连数据的桥接副本

再次强调：

> R2 是 `SoulAction` 的目标之一，但不是灵魂层主存。

---

## 7.5 到用户交互层
最适合承接：
- `interaction`

例如：
- 追问
- 提醒
- 建议
- 小结
- 一次主动干预

这类动作不一定需要 worker，也不一定需要写文件。
它更像联合体向用户发出的一个“认知脉冲”。

---

# 8. 第一版调度原则

为了不把 v0.4 一开始做得过重，第一版建议采用非常保守的调度原则。

## 8.1 先同步、后异步
优先级建议：
- 轻量 `state_update`：直接同步写 SQLite
- 低风险 `interaction`：可直接生成
- 中重型 `task_launch`：交给 worker task
- `bridge_sync`：通常异步执行

---

## 8.2 先低风险、后高自主
第一阶段优先让 `SoulAction` 承接：
- 追问
- 总结
- 画像更新
- 脑暴结构化
- 长期条目晋升建议

而不要一开始就让它承接：
- 高成本批量任务
- 外部发布
- 强执行类自动化
- 不可逆动作

---

## 8.3 先记录全部候选，再逐步放宽自动执行
一开始更合理的形态是：
- 灵魂层可以产生很多 `SoulAction` candidate
- 但只有一部分自动 dispatch
- 其余先记录下来

这样你可以逐步观察：
- 哪些动作最常出现
- 哪些动作最有价值
- 哪些动作太吵
- 哪些动作应被永久降权

---

# 9. v0.4 对现阶段实现的直接启发

基于当前 LifeOS 架构，真正适合先落地的，不是完整自治，而是：

## 9.1 先建立 `SoulAction` 记录层
即使暂时不全自动 dispatch，也应能记录：
- 来源对象
- 候选动作
- 是否执行
- 执行给谁
- 最终反馈

这会让后续所有主动性优化都有数据基础。

---

## 9.2 先把几个高频动作标准化
第一批最值得标准化的动作大概率是：
- `ask_followup_question`
- `update_persona_snapshot`
- `create_event_node`
- `persist_continuity_markdown`
- `launch_daily_report`
- `launch_weekly_report`

因为这些动作：
- 风险较低
- 解释性较强
- 对联合体连续性价值高

---

## 9.3 先把“灵魂层判断”和“执行层落地”彻底分开
也就是说未来系统里更合适的接口不是：
- 某段逻辑直接 `runWorkerTask(...)`

而是：
- 先生成 `SoulAction`
- 再由 dispatcher 决定怎么执行

这一步一旦建立，后面的主动性、审计、策略调优就会清晰很多。

---

# 10. 第一阶段实现顺序建议

## Phase 1：记录，不急着自治
先做：
- `SoulAction` 数据结构
- 候选动作生成
- SQLite 记录层
- 基础 dispatcher

目标：
- 系统先学会“把认知判断表达成动作”

---

## Phase 2：接上低风险动作
再做：
- Persona 更新
- 脑暴追问
- 事件晋升
- 连续性 markdown 输出
- 日报/周报触发

目标：
- 形成最小认知到执行闭环

---

## Phase 3：接上更强执行桥
最后再做：
- OpenClaw / 后端高算力桥接
- R2 同步策略
- 主动性阈值调参
- 更复杂的执行编排

目标：
- 让联合体具备真正稳定的算力杠杆与主动性调度能力

---

# 11. 一句话总结 v0.4

> 如果说 v0.3 解决的是“灵魂对象存在哪里”，那么 v0.4 解决的就是“灵魂对象如何真正驱动现有系统行动起来”——答案不是让灵魂层直接操纵 worker，而是在二者之间建立一层可治理、可审计、可扩展的 `SoulAction` 动作桥。
