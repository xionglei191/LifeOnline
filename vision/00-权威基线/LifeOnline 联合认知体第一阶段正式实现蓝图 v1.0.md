# 《Soul Constitution》v1.0
## LifeOnline 联合认知体第一阶段正式实现蓝图

这是第一版正式蓝图。

从这一版开始，文档的目标不再只是持续讨论概念、对象、动作层和命名边界，
而是把前面所有对齐结果正式收束成一个可以指导后续工程推进的阶段性总纲。

它要回答的问题是：

> 在已经完成愿景、对象、动作层、代码落位、命名边界对齐之后，LifeOnline 的联合认知体第一阶段究竟应该如何正式开工？

这份 v1.0，不再是某一个局部草案，
而是第一阶段的**正式实现蓝图**。

---

# 1. v1.0 的定位

在此之前，已经完成了几层递进：

- v0.1：联合体宪章
- v0.2：五个最小认知对象
- v0.3：对象与现有架构的映射
- v0.4：`SoulAction` 动作桥
- v0.5：最小落地骨架
- v0.6：到当前代码库的落位图
- v0.7：PR1 施工单
- v0.8：逐文件实现草案
- v0.9：接近真实代码的 PR1 草稿版
- 命名边界对齐：LifeOnline / LingGuangCatcher / LifeOS 的层级澄清

因此，v1.0 的角色不是继续补丁式前进，
而是把这些内容收束成一个统一结论：

> **LifeOnline 联合认知体第一阶段，以 LifeOS 为后台宿主，以 LingGuangCatcher 为现实输入侧，以灵魂动作层为最小认知运行态入口，先建立连续性、动作记录与低风险认知闭环，再逐步打开更强的主动性与执行杠杆。**

---

# 2. 第一阶段的总目标

第一阶段不是直接实现 AGI，
也不是直接实现完全自治，
而是先建立一个足够稳的“联合认知体雏形”。

这个雏形必须至少具备四种能力：

## 2.1 能持续接住现实生活流
来源主要是：
- LingGuangCatcher / 灵光 APP
- 头脑风暴输入
- Vault 中的内容沉淀
- schedule / report 等周期性触发

也就是说，系统必须先能持续接住“你正在发生什么”。

---

## 2.2 能把高熵输入提炼成结构化认知对象
也就是逐步建立：
- `BrainstormSession`
- `PersonaState`
- `EventNode`
- `ContinuityRecord`
- `InterventionDecision`

这意味着系统不再只是保存原始输入，
而开始形成自己的“理解层”。

---

## 2.3 能把认知判断表达成动作
也就是通过：
- `SoulAction`

把“理解结果”转成：
- 可记录
- 可治理
- 可调度
- 可审计
- 可反馈

的中间动作对象。

---

## 2.4 能形成最小连续性闭环
所谓最小闭环，不是系统什么都能做，
而是：

```text
输入
  ↓
理解
  ↓
动作候选
  ↓
低风险执行
  ↓
反馈
  ↓
更新连续性
```

只要这个闭环跑起来，
联合认知体就已经不再只是概念。

---

# 3. 第一阶段的系统边界

在命名对齐之后，v1.0 必须明确整个工程边界。

---

## 3.1 `LifeOnline` 是整个工程总名
它代表的是：
- 生命在线延续
- 人机联合体
- 输入、后台、输出、记忆、执行、继承的整体工程

因此，v1.0 面向的对象是整个 `LifeOnline`。

---

## 3.2 `LingGuangCatcher` 是现实输入侧
第一阶段必须把它视为：
- 生活流捕手
- 日常行为记录入口
- 灵感与脑暴入口
- 联合体与现实世界连接的主前端接口之一

第一阶段不必要求灵光完全重构，
但必须在架构表达上承认它的主输入地位。

---

## 3.3 `LifeOS` 是第一阶段的后台宿主
第一阶段灵魂层的工程落点，仍然应当主要长在：
- LifeOS backend

原因很明确：
- SQLite 运行态在这里
- worker task 在这里
- schedule 在这里
- 输出展板在这里
- API / Web 控制在这里

所以：

> 第一阶段的灵魂层是“服务于整个 LifeOnline 的认知内核”，但“工程宿主在 LifeOS”。

---

## 3.4 其他基础设施边界保持不变
- Vault：内容事实源
- SQLite：运行态 / 索引 / 动作日志
- OpenClaw：外部执行器
- R2：桥接 / 冷存储 / 连续性备份

v1.0 不推翻这些边界。

---

# 4. 第一阶段的核心对象体系

第一阶段仍然以前面已经收敛的五个对象为认知主体。

---

## 4.1 `BrainstormSession`
### 第一阶段角色
- 接住高熵输入
- 把混乱表达变成结构化认知入口

### 在第一阶段的战略意义
这是系统避免退化为“普通聊天记录器”的第一道门。

---

## 4.2 `PersonaState`
### 第一阶段角色
- 维持当前最小动态画像
- 保存当前阶段主题、目标、张力、阻力、动机与风险信号

### 在第一阶段的战略意义
没有它，系统每次都会从零重新理解你。

---

## 4.3 `EventNode`
### 第一阶段角色
- 将高价值变化提炼成关键事件节点

### 在第一阶段的战略意义
它让长期记忆从流水账开始长出骨架。

---

## 4.4 `ContinuityRecord`
### 第一阶段角色
- 承接必须跨调用、跨任务、跨升级保留的原则、方法、警示、目标与身份认知

### 在第一阶段的战略意义
这是“接力棒”真正能够延续的最小精神脊柱。

---

## 4.5 `InterventionDecision`
### 第一阶段角色
- 先作为轻量治理闸门
- 决定动作是执行、延后、观察还是放弃

### 在第一阶段的战略意义
它防止系统过早变吵、变重、变失控。

---

# 5. 第一阶段的动作体系

五个对象还只是“理解层”。
要让联合体真正开始流动，还需要动作层。

因此 v1.0 明确承认：

> 第一阶段正式以 `SoulAction` 作为认知层与执行层之间的标准动作桥。

---

## 5.1 `SoulAction` 的六类分类继续成立
第一阶段继续使用：
- `state_update`
- `memory_promotion`
- `interaction`
- `task_launch`
- `artifact_output`
- `bridge_sync`

这是当前最稳定、最够用的动作层分类。

---

## 5.2 第一批正式 actionType
第一阶段正式承认的首批动作仍为：
- `ask_followup_question`
- `update_persona_snapshot`
- `create_event_node`
- `persist_continuity_markdown`
- `launch_daily_report`
- `launch_weekly_report`
- `launch_openclaw_task`
- `sync_continuity_to_r2`

这里的关键不是“多”，
而是它们足够覆盖：
- 澄清
- 状态更新
- 记忆晋升
- 可读输出
- 与现有 worker 桥接
- 与 OpenClaw / R2 桥接

---

## 5.3 第一阶段动作策略
第一阶段不追求完全自动 dispatch。
而是遵守下面原则：
- 先记录动作
- 再筛选动作
- 只自动 dispatch 低风险动作
- 高成本 / 高外部性动作保持更高阈值

也就是说，第一阶段是：

> **先让灵魂动作层存在并稳定，再逐步放权。**

---

# 6. 第一阶段的工程路线

v1.0 在工程上明确采用“三步走”路线。

---

## 6.1 Step 1：建立动作运行态骨架
这一阶段就是之前已经压实的 PR1：
- `soul_actions` 表
- `soulActionTypes.ts`
- `soulActionStore.ts`

### 目标
让灵魂动作层第一次拥有：
- 可写入
- 可读取
- 可列表
- 可完成
- 可失败

的真实运行态。

### 这一阶段明确不做
- 不做 generator
- 不做 gate
- 不做 dispatcher
- 不做 API
- 不改 worker / schedule 主链

---

## 6.2 Step 2：建立最小低风险认知闭环
也就是 PR2 的方向：
- `soulActionGenerator.ts`
- `interventionGate.ts`
- `soulActionDispatcher.ts`

但只先接：
- `ask_followup_question`
- `update_persona_snapshot`
- `create_event_node`
- `persist_continuity_markdown`

### 目标
让联合体第一次真正从：
- 输入
- 到理解
- 到动作
- 到反馈

形成可运行的最小闭环。

---

## 6.3 Step 3：桥接现有执行体系与人工 review
也就是 PR3 的方向：
- review / approve / dispatch / discard API
- 接入 `daily_report`
- 接入 `weekly_report`
- 接入 `openclaw_task`

### 目标
让灵魂动作层开始真正指挥现有 LifeOS 执行体系，
但仍保留人工治理与阈值控制。

---

# 7. 第一阶段的最小架构形态

v1.0 认为，第一阶段完成后，系统应该大致呈现出这样的形态：

```text
LifeOnline
│
├── LingGuangCatcher
│     └── 日常行为 / 灵感 / 脑暴输入
│
├── LifeOS
│     ├── Soul Object Layer
│     │     ├── BrainstormSession
│     │     ├── PersonaState
│     │     ├── EventNode
│     │     ├── ContinuityRecord
│     │     └── InterventionDecision
│     │
│     ├── SoulAction Layer
│     │     ├── soulActionStore
│     │     ├── generator
│     │     ├── gate
│     │     └── dispatcher
│     │
│     ├── worker tasks / schedules / SQLite / API / Web
│     └── 输出与展板
│
├── Vault
│     └── 内容事实源 / 可读沉淀
│
├── OpenClaw
│     └── 外部执行器
│
└── R2
      └── 桥接 / 冷存储 / 连续性备份
```

这时的系统虽然还远未完成，
但已经不再只是“任务系统 + 内容系统”，
而开始出现一个真正的认知运行态层。

---

# 8. 第一阶段的设计原则

为了避免后续实现跑偏，v1.0 必须再次把原则写清楚。

---

## 8.1 连续性优先于炫技
第一阶段应优先解决：
- 能不能延续
- 能不能继承
- 能不能保存原则与方向

而不是优先追求：
- 模型显得多聪明
- 行为显得多主动
- 自动化显得多激进

---

## 8.2 记录优先于放权
第一阶段更重要的是：
- 动作是否被稳定记录
- 为什么产生这条动作
- 结果如何
- 是否值得以后放权

而不是立刻让系统自己做很多事。

---

## 8.3 低风险闭环优先于高风险扩张
先把：
- 追问
- 状态更新
- 事件晋升
- 连续性输出

做稳，再谈：
- 高成本外部执行
- 更强主动性
- 更大规模算力桥接

---

## 8.4 backend 落位清晰，服务对象明确
灵魂层的工程宿主在 LifeOS，
但服务对象始终是整个 LifeOnline。

这条原则非常重要，
它可以避免之后再次把后台中枢误写成整个项目本身。

---

# 9. 第一阶段的验收标准

v1.0 认为，第一阶段是否成功，不应看“像不像 AGI”，
而应看是否满足以下条件：

---

## 9.1 输入被稳定接住
来自 LingGuangCatcher、脑暴、Vault、schedule 的高价值输入，
能进入灵魂层处理链路。

---

## 9.2 最小认知对象开始存在
至少：
- `BrainstormSession`
- `PersonaState`
- `ContinuityRecord`

已经进入真实工程链路。

---

## 9.3 动作层开始存在
至少：
- `soul_actions` 真实存在
- 有候选动作
- 有生命周期
- 有最小 dispatcher
- 有结果反馈

---

## 9.4 低风险闭环跑通
至少跑通：
- 一条脑暴追问链
- 一条 Persona 更新链
- 一条连续性输出链
- 一条 report worker 桥接链

---

## 9.5 命名与结构边界不再混乱
后续所有文档与实现中，能够明确区分：
- LifeOnline
- LingGuangCatcher
- LifeOS
- Vault
- OpenClaw
- R2

如果这条不成立，后面越做越会乱。

---

# 10. v1.0 的最终收束

v1.0 最重要的不是“又发明了一层新概念”，
而是正式确认：

- 这个项目的总名是 **LifeOnline**
- 它的现实输入端是 **LingGuangCatcher**
- 它的后台宿主是 **LifeOS**
- 它的内容事实源是 **Vault**
- 它的外部执行器是 **OpenClaw**
- 它的桥接与备份基础设施是 **R2**
- 它的联合认知体第一阶段，将通过五个认知对象与 `SoulAction` 动作层，在 LifeOS 中先长出一个最小但真实的认知运行态

这就是第一阶段正式开工的基线。

---

# 11. 一句话总结 v1.0

> v1.0 的意义，是把此前所有愿景、对象、动作层、代码落位、命名边界与接力棒思想正式收束成 LifeOnline 联合认知体的第一阶段实现蓝图：以 LingGuangCatcher 持续接住现实输入，以 LifeOS 承载后台认知运行态，先建立连续性、动作记录与低风险认知闭环，再逐步打开更强的主动性与执行能力。