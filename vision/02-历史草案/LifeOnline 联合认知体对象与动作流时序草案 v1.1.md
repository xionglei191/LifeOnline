# 《Soul Constitution》v1.1
## LifeOnline 联合认知体对象与动作流时序草案

v1.0 已经把第一阶段的正式实现蓝图立起来了。

接下来最自然的一步，不是继续增加名词，
而是把这套系统真正“流动起来”的过程写清楚。

所以 v1.1 的目标是：

> 把 LifeOnline 联合认知体第一阶段中，从现实输入到认知对象、从认知对象到 `SoulAction`、从 `SoulAction` 到执行与反馈，再回流更新连续性的完整动态链路压清楚。

也就是说，v1.1 关注的不是“系统有什么”，而是：

> **系统如何在时间中运转。**

---

# 1. v1.1 的定位

如果说：
- v1.0 是静态蓝图

那么：
- v1.1 就是动态时序图

v1.0 解决的是：
- 有哪些模块
- 有哪些对象
- 有哪些动作
- 有哪些阶段

v1.1 要解决的是：
- 一次输入来了以后，系统先发生什么
- 哪个对象先更新
- 哪个动作后生成
- 哪一步需要 gate
- 哪一步走 worker
- 哪一步回写 Vault
- 哪一步反向更新连续性

没有这一步，系统虽然有架构，但还没有真正的“流”。

---

# 2. 第一阶段的总时序主链

LifeOnline 联合认知体第一阶段，推荐用下面这条总主链来理解：

```text
现实生活流 / LingGuangCatcher / 脑暴输入 / 周期触发
                ↓
输入进入 LifeOS
                ↓
原始内容进入 Vault / SQLite / 临时运行态
                ↓
灵魂层对象生成或更新
                ↓
生成 SoulAction candidates
                ↓
Intervention Gate 做放行判断
                ↓
低风险动作直接 dispatch / 高风险动作等待 review
                ↓
执行层落地（SQLite / Vault / worker / OpenClaw / R2 / 交互）
                ↓
得到结果反馈
                ↓
回写 PersonaState / EventNode / ContinuityRecord / InterventionDecision
                ↓
形成新的连续性状态
```

这条链路，就是第一阶段联合认知体真正的动态骨架。

---

# 3. 时序视角一：来自 LingGuangCatcher 的生活流输入

这是整个系统最重要的一条主链。

---

## 3.1 输入开始
来源：
- 日常行为记录
- 灵感
- 语音转写
- 即时脑暴
- 片段化想法

在总体结构里，这一步发生在：
- `LingGuangCatcher`

它的任务不是做判断，
而是把现实世界中的真实生活流送入系统。

---

## 3.2 输入落入 LifeOS 可处理环境
输入进入 LifeOS 后，第一阶段推荐的形态应是：
- 原始文本先保留在 Vault 或等价可读输入承载层
- 必要结构信息进入 SQLite / 索引层
- 形成可供灵魂层处理的输入记录

这一步的核心不是“先聪明”，而是“先接住”。

也就是说：

> 第一阶段最先被保证的，不是分析质量，而是输入不丢失。

---

## 3.3 生成或更新 `BrainstormSession`
当输入被判定为：
- 高熵
- 模糊
- 有明显思维流特征
- 具有待提炼价值

则应优先进入：
- `BrainstormSession`

在时序上，这往往是第一个正式出现的灵魂对象。

它的作用是：
- 把原始输入纳入结构化提炼过程
- 提取主题、问题、模糊点、矛盾点、洞察、候选任务、追问点

这一步之后，系统才第一次开始拥有“理解的起点”。

---

## 3.4 触发 `SoulAction` 候选生成
一旦 `BrainstormSession` 出现或更新，
系统就可以开始生成第一批动作候选。

典型候选包括：
- `ask_followup_question`
- `update_persona_snapshot`
- `create_event_node`
- `persist_continuity_markdown`

这里要强调：

> 对象更新不等于立即执行动作。

对象层负责产生理解结果，
动作层负责把这些理解结果表达成可调度的候选动作。

---

## 3.5 进入 `Intervention Gate`
这一步是联合体避免变吵、变蠢、变失控的关键。

Gate 要回答的不是“能不能做”，
而是：
- 这条动作现在该不该放行
- 该自动执行，还是先观察
- 该直接问用户，还是先记录

例如：
- `ask_followup_question` → 通常可低风险放行
- `update_persona_snapshot` → 通常可内部放行
- `create_event_node` → 可放行但可能仅内部写入
- `persist_continuity_markdown` → 可能需要更高阈值或人工 review

---

## 3.6 执行落地
根据动作不同，落地目标不同：

- `interaction` → 回到用户交互层
- `state_update` → SQLite
- `memory_promotion` → SQLite / Continuity 层
- `artifact_output` → Vault / markdown
- `task_launch` → worker task
- `bridge_sync` → R2

也就是说，时序上会在这里发生真正分叉。

---

## 3.7 反馈回流
动作执行后，系统必须回收结果：
- 成功还是失败
- 用户接受还是忽略
- 是否真的有价值

然后回写：
- `InterventionDecision.feedback`
- `PersonaState` 局部更新
- `EventNode` 是否晋升
- `ContinuityRecord` 是否增强或降权

这样一来，一次输入才真正完成闭环。

---

# 4. 时序视角二：来自周期触发的主动认知链

除了生活流输入，还有另一条关键链路：
- 周期触发

例如：
- 日报
- 周报
- 定时 review
- 周期性反思

---

## 4.1 schedule 到点
这一步目前仍然发生在：
- LifeOS 的现有 scheduler

它本身不负责认知，
只是发出一个时间触发信号。

---

## 4.2 时间触发进入灵魂层
第一阶段更合理的理解方式不是：
- schedule 直接等于任务执行

而是：
- schedule 触发一个“该不该做认知动作”的时机

也就是说，时序上更适合是：

```text
schedule tick
   ↓
生成 review 类 SoulAction candidate
   ↓
Intervention Gate
   ↓
决定是否 launch report / summary / followup
```

这会让系统的主动性变得可治理，而不是纯 cron 驱动。

---

## 4.3 典型动作链
例如一条日报链可以表述为：

```text
每日定时触发
   ↓
系统检查最近输入密度 / 当日上下文
   ↓
生成 `launch_daily_report` candidate
   ↓
Gate 判断为低风险例行动作
   ↓
Dispatcher 调用现有 `daily_report` worker
   ↓
日报写回 Vault
   ↓
Index / Web 更新
   ↓
结果反馈反向更新 PersonaState / ContinuityRecord
```

这条链的意义在于：

> 即便看起来只是“日报生成”，但在联合体内部，它已经是一条正式的认知到执行闭环。

---

# 5. 时序视角三：长期记忆晋升链

这条链路决定系统会不会只是堆积，而不会真正形成精神连续性。

---

## 5.1 原始来源
长期记忆晋升可能来自：
- 脑暴中的稳定洞察
- 重大任务完成或失败
- 明显重复出现的阻力模式
- 被多次验证有效的方法
- 用户明确强调的重要原则

---

## 5.2 初级结构化
这些原始来源首先不会直接进入 `ContinuityRecord`，
而更适合先经过：
- `BrainstormSession`
- `PersonaState`
- `EventNode`

也就是说第一阶段的长期记忆不是“看见一句好话就存”，
而是必须经过结构化提炼。

---

## 5.3 动作候选产生
当系统判断某个内容足够重要时，会产生：
- `persist_continuity_markdown`
- 或未来更细的 continuity promotion 动作

这里的关键不是保存原文，
而是保存：
- 原则
- 方法
- 警示
- 目标
- 方向

---

## 5.4 Gate 与晋升阈值
长期记忆晋升必须比普通交互更保守。

因为一旦进入连续性层，
它会影响：
- 未来解释
- 未来动作
- 未来继承

所以这里的 gate 更适合偏严格：
- 要求证据更多
- 要求稳定性更高
- 要求可解释性更强

---

## 5.5 落地形态
晋升后的内容一般应同时存在于：
- SQLite 结构化主记录
- Vault / markdown 可读镜像
- 必要时 R2 备份

这一步才真正体现出“接力棒”的物质载体。

---

# 6. 时序视角四：外部执行桥接链

这条链路对应的是未来最强的“算力杠杆”和“执行杠杆”。

但在第一阶段，它应被保守处理。

---

## 6.1 触发来源
外部执行桥接一般来自：
- 用户明确要求
- 高价值复杂任务
- 现有本地链路难以承接的分析任务

---

## 6.2 灵魂层判断
系统先不直接跑 OpenClaw，
而是先生成：
- `launch_openclaw_task`

它必须先被认知层表达成动作对象。

这一步很重要，因为它让系统保留：
- 为什么发起这条外部执行
- 它来自哪个对象
- 它是否值得
- 它风险如何

---

## 6.3 Gate 审查
相对于追问、Persona 更新、日报生成，
`launch_openclaw_task` 应默认更高阈值。

它更适合：
- 需要明确授权
- 或至少需要更强条件才能放行

因为它：
- 成本更高
- 外部性更强
- 执行不可控性更高

---

## 6.4 Bridge 执行
被放行后：
- Dispatcher 转译成现有 `openclaw_task`
- 交由 LifeOS → OpenClaw 执行
- 结果回写 LifeOS / Vault
- 再回流联合体连续性层

这样就不会出现“灵魂层直接裸碰执行器”的耦合问题。

---

# 7. 第一阶段最关键的四条正式时序链

综合前面所有内容，v1.1 认为第一阶段最重要的四条链应是：

---

## 7.1 脑暴追问链
```text
LingGuangCatcher / 脑暴输入
  ↓
BrainstormSession
  ↓
ask_followup_question candidate
  ↓
Gate
  ↓
交互回显
  ↓
反馈更新 PersonaState
```

---

## 7.2 Persona 更新链
```text
生活流 / 输入聚合
  ↓
BrainstormSession / 最近状态分析
  ↓
update_persona_snapshot candidate
  ↓
Gate
  ↓
SQLite PersonaState 更新
  ↓
后续动作阈值调整
```

---

## 7.3 连续性晋升链
```text
洞察 / 模式 / 关键事件
  ↓
EventNode / 提炼结果
  ↓
persist_continuity_markdown candidate
  ↓
Gate
  ↓
SQLite + Vault (+ R2)
  ↓
ContinuityRecord 增强
```

---

## 7.4 Report 桥接链
```text
schedule / 周期触发
  ↓
launch_daily_report or launch_weekly_report candidate
  ↓
Gate
  ↓
worker task
  ↓
Vault 输出
  ↓
Index / Web 更新
  ↓
反馈更新 PersonaState / ContinuityRecord
```

这四条链跑通，第一阶段就已经不是空架构了。

---

# 8. v1.1 对后续实现的直接启发

v1.1 最大的工程价值在于，它让后续实现顺序更清晰了。

---

## 8.1 PR1 只是地基
PR1 建的是动作存储层。
它本身还不构成流。

---

## 8.2 PR2 必须优先围绕四条关键链来做
PR2 最好不要平均展开所有动作。
而是优先围绕：
- 脑暴追问链
- Persona 更新链
- 连续性晋升链
- Report 桥接链

这样做，最能体现第一阶段价值。

---

## 8.3 Gate 的重要性远高于表面看起来的程度
如果没有 gate，系统会很快退化为：
- 乱发动作
- 乱写记忆
- 乱触发执行

v1.1 明确说明：

> Gate 不是辅助组件，而是联合认知体第一阶段能否保持克制与连续性的关键稳定器。

---

# 9. 一句话总结 v1.1

> v1.1 的意义，是把 LifeOnline 联合认知体第一阶段从静态蓝图推进到动态时序：输入如何进入、对象如何生成、`SoulAction` 如何被提出、Gate 如何放行、执行如何落地、反馈如何回流，终于被压成了一套真正能在时间中运转的对象与动作流骨架。