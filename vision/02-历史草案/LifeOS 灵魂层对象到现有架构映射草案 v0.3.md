# 《Soul Constitution》v0.3
## 灵魂层对象到现有 LifeOS 架构的映射草案

这一版的目标，不是重新发明系统，而是把前一版定义的 5 个灵魂层对象，明确挂接到当前已经存在的 LifeOS 骨架上。

换句话说，要回答的问题是：

> 这 5 个灵魂对象，应该具体落在你现在系统的哪里？

---

# 1. 当前 LifeOS 已有骨架

LifeOS 当前已经具备：

- **Vault**：内容事实源
- **SQLite**：索引与运行态存储
- **LifeOS backend**：控制核心
- **worker tasks**：统一执行单元
- **schedules**：定时触发器
- **OpenClaw**：外部执行器 / 手脚
- **Web 控制台**：可视化界面
- **输入端**：灵光 App、Obsidian 等

因此，v0.3 的目标不是推翻这些，而是明确：

```text
输入流
  ↓
灵魂层对象（理解层）
  ↓
SoulAction（决策桥）
  ↓
worker task / 本地写入 / R2 bridge / Vault输出
  ↓
索引 / 回显 / 反馈
```

这意味着：
- 灵魂层不替代 worker task
- 灵魂层位于输入流和执行层之间
- 灵魂层负责“理解、提炼、判断、选择路径”
- worker task 负责“执行具体动作”

---

# 2. 五个对象分别落在哪里

---

## 2.1 `PersonaState`

### 定义
系统当前对“你此刻处于什么状态”的最小动态理解。

### 主落点
- **SQLite**

### 原因
它是高频更新的运行态对象，适合：
- 查询
- 更新
- 快照化
- 被灵魂层与 worker task 读取

### 不适合作为主落点
- Vault

因为 Vault 更适合沉淀可读结果，不适合高频状态更新。

### 可输出为
- 周报中的“当前人格状态摘要”
- 阶段性画像快照 note
- 联合体状态快照

### 建议表
```text
persona_states
```

---

## 2.2 `BrainstormSession`

### 定义
一次脑暴输入从“原始表达”到“结构化认知对象”的全过程记录。

### 主落点
- **SQLite**
- 原始文本继续写入 **Vault**

### 原因
当前灵光 App 的链路已经是：
- 语音
- 转文字
- 输出到 Vault

因此最合理的升级方式是：

```text
灵光 App 语音
  ↓
转写文本
  ↓
写入 Vault（原始脑暴 note）
  ↓
LifeOS indexer 入 SQLite
  ↓
灵魂层生成 BrainstormSession
```

### 意义
- Vault 保存原始脑暴内容
- SQLite 保存结构化脑暴分析结果

### 建议表
```text
brainstorm_sessions
```

### 关于语音原始文件
在本版本讨论中形成的结论是：
- 不建议默认永久保存所有原始录音
- 默认保存转写文本 + 轻量语音衍生信号
- 原始录音可作为短期缓冲材料
- 只有高价值录音才升级为长期保留

---

## 2.3 `EventNode`

### 定义
值得长期影响未来判断的关键事件节点。

### 主落点
- **SQLite**

### 可选镜像
- **Vault**

### 原因
事件节点本质上是结构化长期记忆，适合放 SQLite；
但其中一部分高价值事件很适合写成可复盘 note。

### 推荐模式
- SQLite 存完整结构化 event graph
- Vault 只存精选后的关键事件复盘

### 来源
- 脑暴 session 提炼
- 日报/周报分析
- 重大任务完成/失败
- 用户手动标记的重要节点

### 建议表
```text
event_nodes
```

### 注意
`EventNode` 不等于 note，而是：
- 可以由 note 派生
- 可以链接 note
- 也可以反向生成 note

---

## 2.4 `InterventionDecision`

### 定义
系统对“要不要主动介入”的一次判断记录。

### 主落点
- **SQLite only**

### 不建议主写入
- Vault

### 原因
它本质上是：
- 策略日志
- 反馈日志
- 调参日志

这类运行态判断不适合大量以 markdown 形式沉淀。

### 来源
- PersonaState
- BrainstormSession
- EventNode
- schedule
- 外部事件

### 建议表
```text
intervention_decisions
```

---

## 2.5 `ContinuityRecord`

### 定义
必须跨调用、跨任务、跨升级保留的核心认知资产。

### 主落点
- **SQLite**
- **本地 markdown / Vault 镜像**
- **必要时同步 R2**

### 原因
它既不是普通运行态，也不是普通内容：
- 只放 SQLite：过于内部化
- 只放 Vault：查询与结构化管理太弱
- 只放 R2：失去本地可控性

### 推荐分层
#### SQLite
- 结构化主记录
- 做查询、优先级、继承判断

#### 本地 markdown / Vault
- 可读版本
- 便于人工回顾与编辑
- 成为联合体精神资产

#### R2
- 备份
- 远端可达副本
- 升级恢复辅助来源

### 建议表
```text
continuity_records
```

### 建议目录
```text
_Continuity/
```

建议存放：
- 原则
- 方法
- 长期目标
- 核心警示
- 联合体宪章版本

---

# 3. 五个对象与现有层的对应关系

| 灵魂对象 | 主存储 | 可读镜像 | 是否适合 worker task 直接生成 | 是否适合 R2 |
|---|---|---|---|---|
| PersonaState | SQLite | 阶段性摘要 note | 适合 | 可选快照 |
| BrainstormSession | SQLite | 原始脑暴 note 在 Vault | 很适合 | 原始大素材/桥接 |
| EventNode | SQLite | 精选复盘 note | 适合 | 可选归档 |
| InterventionDecision | SQLite | 一般不写 | 适合内部生成 | 通常不需要 |
| ContinuityRecord | SQLite | 强烈建议写本地/Vault | 适合，但需人工审查机制 | 适合桥接备份 |

---

# 4. worker task 在 v0.3 中的角色

## 当前状态
现有 worker task 更偏执行型：
- summarize_note
- extract_tasks
- daily_report
- weekly_report
- classify_inbox
- openclaw_task

## v0.3 之后的定位
worker task 不再是最高层抽象，
而应成为**灵魂层的执行器**。

### 后续可能的两类 worker
#### 内容型 worker
- summarize_note
- extract_tasks
- classify_inbox
- report generation

#### 灵魂型 worker
- derive_persona_state
- parse_brainstorm_session
- promote_event_node
- generate_intervention
- promote_continuity_record

也就是说：

> worker task 负责执行“做什么”，灵魂层负责判断“为什么做”。

---

# 5. R2 在 v0.3 中的明确角色

### R2 不是主存储层
R2 只承担三类职责：

1. **桥接**
   - 当后端需要访问内网不方便直读的数据时，提供中转副本

2. **冷存储**
   - 大文件、原始材料、历史归档

3. **连续性备份**
   - 对关键 ContinuityRecord 或分析材料提供辅助恢复来源

### 不建议的角色
- 不以 R2 作为 PersonaState 主存
- 不以 R2 作为 InterventionDecision 主存
- 不以 R2 作为 EventNode 主存

因此：
- R2 主要服务于大素材和桥接场景
- 不承担灵魂层的主运行态职责

---

# 6. 建议新增的中间抽象：`SoulAction`

如果没有这层，灵魂层对象会直接碰 worker task，耦合太重。

## 定义
`SoulAction` 是灵魂层决策后的中间动作对象。

例如：
- 更新 PersonaState
- 生成追问
- 创建 EventNode
- 触发报告
- 发起研究任务
- 同步 R2
- 晋升 ContinuityRecord

## 示例结构
```ts
type SoulAction = {
  id: string
  sourceType: 'brainstorm' | 'persona' | 'event' | 'continuity' | 'intervention'
  sourceId: string

  actionType:
    | 'update_persona'
    | 'create_event_node'
    | 'ask_followup'
    | 'generate_report'
    | 'launch_worker_task'
    | 'persist_continuity'
    | 'sync_r2'

  payload: Record<string, unknown>
  priority: 'low' | 'medium' | 'high'
  createdAt: string
}
```

## 系统位置
```text
生活流 / 头脑风暴
      ↓
灵魂层对象
      ↓
SoulAction
      ↓
Worker Task / 本地写入 / R2 同步 / Vault 输出
```

这层的意义是：
- 避免灵魂层直接和执行层强耦合
- 为未来治理和审计保留中间桥

---

# 7. v0.3 的一句话结论

> 在现有 LifeOS 架构里，灵魂层应作为 SQLite 主导的认知运行态层存在；Vault 负责人类可读沉淀，worker task 负责执行，R2 仅承担桥接、冷存储和连续性备份。
