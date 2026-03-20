# 《Soul Constitution》v0.2
## LifeOS 灵魂层最小数据结构草案（初稿）

这一步开始把宪章压成工程对象。
目标不是一次性设计完整系统，而是定义**最小可持续认知内核**。

---

# 1. 总体原则

v0.2 只定义 5 个核心对象：

1. `PersonaState`
2. `BrainstormSession`
3. `EventNode`
4. `InterventionDecision`
5. `ContinuityRecord`

它们分别对应：

- 你当前是谁
- 你刚刚在想什么
- 你人生里发生了什么关键变化
- 系统为什么决定主动或不主动
- 哪些东西必须跨调用与升级延续

---

# 2. 对象一：`PersonaState`

## 2.1 定义
`PersonaState` 是系统在某个时刻对用户的**最小动态画像**。
它不是完整人格档案，也不是历史总表，而是“当前有效状态摘要”。

## 2.2 为什么存在
如果没有 `PersonaState`，每一次交互都只能从零重新理解你。
有了它，系统才能：

- 知道你当前最在意什么
- 知道你最近在哪些地方卡住
- 知道当前应该用什么方式和你互动

## 2.3 最小字段
```ts
type PersonaState = {
  id: string
  userId: string

  currentThemes: string[]           // 当前阶段主题，如“系统构建”“认知升级”“执行力恢复”
  activeGoals: string[]             // 当前最活跃目标
  currentTensions: string[]         // 当前张力/冲突，如“想做大系统，但执行负担高”
  cognitiveStyle: string[]          // 当前认知风格标签
  workStyle: string[]               // 当前做事风格标签
  frictionPatterns: string[]        // 常见阻力模式
  motivationSignals: string[]       // 当前高动机来源
  warningSignals: string[]          // 当前风险信号，如过载、发散、拖延

  confidence: number                // 系统对当前画像的置信度 0-1
  sourceWindow: string              // 画像基于哪个时间窗口提炼，如 “last_14_days”
  updatedAt: string
}
```

## 2.4 存储建议
- **本地存储**：主存
- **R2**：可存归档快照
- **模型上下文**：只注入当前最相关摘要，不全量注入

## 2.5 注意
`PersonaState` 必须是**提炼结果**，不是原始数据集合。

---

# 3. 对象二：`BrainstormSession`

## 3.1 定义
`BrainstormSession` 表示一次高熵输入的结构化转化结果。
它是“灵感 → 认知对象”的入口。

## 3.2 为什么存在
你已经明确说了，头脑风暴是系统最关键的输入之一。
所以系统不能把这类输入当普通聊天，它必须专门建模。

## 3.3 最小字段
```ts
type BrainstormSession = {
  id: string
  createdAt: string

  rawInput: string                  // 原始输入
  inputMode: 'text' | 'voice' | 'mixed'

  extractedTopics: string[]         // 提取出的核心主题
  extractedQuestions: string[]      // 被识别出的关键问题
  implicitAssumptions: string[]     // 隐含前提
  emotionalSignals: string[]        // 情绪/心理状态信号
  ambiguityPoints: string[]         // 模糊点
  contradictionPoints: string[]     // 内在矛盾点

  distilledInsights: string[]       // 提炼出的核心洞察
  candidateTasks: string[]          // 可转任务的候选项
  followupQuestions: string[]       // 下一轮最值得追问的问题

  linkedPersonaStateId?: string
  status: 'raw' | 'parsed' | 'distilled' | 'converted'
}
```

## 3.4 存储建议
- **本地存储**：保留原文 + 提炼结果
- **R2**：可选，适合长语音转写/大文本归档
- **模型上下文**：只放 distilled 部分和必要 raw 片段

## 3.5 注意
不是每次 brainstorm 都要进入长期记忆。
多数只作为短中期输入，少数再转成 `EventNode` 或 `ContinuityRecord`。

---

# 4. 对象三：`EventNode`

## 4.1 定义
`EventNode` 是联合体长期记忆中的关键事件节点。
它记录的不是普通发生过的事，而是**值得影响未来判断的事**。

## 4.2 为什么存在
没有事件节点，长期记忆就会退化成流水账。
有了它，系统才能理解：

- 哪些事情改变了你
- 哪些决策塑造了当前状态
- 哪些反馈应影响未来干预

## 4.3 最小字段
```ts
type EventNode = {
  id: string
  createdAt: string
  eventTime: string

  title: string
  category: 'decision' | 'turning_point' | 'failure' | 'breakthrough' | 'habit' | 'relationship' | 'system'

  summary: string                   // 事件摘要
  whyItMatters: string              // 为什么重要
  impactAreas: string[]             // 影响领域，如“目标”“执行”“关系”“认知”
  lessons: string[]                 // 教训/提炼
  linkedGoals: string[]             // 关联目标
  linkedFiles?: string[]            // 关联本地文件 / vault note
  linkedTasks?: string[]            // 关联任务

  importanceScore: number           // 0-1
  sourceType: 'manual' | 'derived' | 'hybrid'
}
```

## 4.4 存储建议
- **本地存储**：主存
- **R2**：归档与远端分析时同步
- **模型上下文**：检索后按需注入，不常驻

## 4.5 注意
`EventNode` 是联合体“人生骨架”。
数量不应太大，质量比数量重要。

---

# 5. 对象四：`InterventionDecision`

## 5.1 定义
`InterventionDecision` 是系统对“要不要主动介入”的一次判断记录。

## 5.2 为什么存在
主动性如果不被记录和复盘，就无法调优。
系统必须知道：
- 为什么这次要提醒
- 为什么这次不打扰
- 后来用户有没有接受

## 5.3 最小字段
```ts
type InterventionDecision = {
  id: string
  createdAt: string

  triggerType: 'schedule' | 'event' | 'brainstorm' | 'pattern' | 'manual_review'
  triggerSummary: string

  decision: 'intervene' | 'defer' | 'observe' | 'discard'
  interventionType?: 'question' | 'summary' | 'task' | 'report' | 'research' | 'reminder'

  reasoning: string[]               // 为什么这样判断
  expectedValue: string             // 预期价值
  riskLevel: 'low' | 'medium' | 'high'
  confidence: number                // 0-1

  feedback?: 'accepted' | 'ignored' | 'rejected' | 'unknown'
  feedbackAt?: string
}
```

## 5.4 存储建议
- **本地存储**：主存
- **R2**：可选同步
- **模型上下文**：通常不直接注入，只用于统计与策略调整

## 5.5 注意
这个对象是未来“主动性调参器”的基础。

---

# 6. 对象五：`ContinuityRecord`

## 6.1 定义
`ContinuityRecord` 是必须跨调用、跨任务、跨版本保留的核心认知资产。
它是“灵魂延续”的最小单元。

## 6.2 为什么存在
不是所有记忆都值得升级继承。
真正要跨版本保留的，是那些定义联合体精神连续性的东西。

## 6.3 最小字段
```ts
type ContinuityRecord = {
  id: string
  createdAt: string
  updatedAt: string

  kind: 'principle' | 'method' | 'identity' | 'goal' | 'preference' | 'warning'
  title: string
  statement: string                 // 核心表述
  rationale: string                 // 为什么重要
  evidence: string[]                // 来自哪些事件/交互/文件
  stability: 'temporary' | 'stable' | 'core'
  inheritancePriority: number       // 跨升级继承优先级 0-1

  localRef?: string                 // 本地路径/引用
  r2Ref?: string                    // R2 对象引用
}
```

## 6.4 存储建议
- **本地存储**：必须主存
- **R2**：建议同步备份
- **模型上下文**：按优先级选少量核心条目注入

## 6.5 注意
如果说 `EventNode` 是骨架，
那 `ContinuityRecord` 就是精神脊柱。

---

# 7. 5 个对象之间的关系

```text
原始生活流 / 脑暴输入
        ↓
BrainstormSession
        ↓
PersonaState 更新
        ↓
识别关键变化
        ↓
EventNode
        ↓
决定是否主动介入
        ↓
InterventionDecision
        ↓
高价值长期沉淀
        ↓
ContinuityRecord
```

更直白一点：

- `BrainstormSession` 负责接住混乱输入
- `PersonaState` 负责理解“你现在是谁”
- `EventNode` 负责记录“什么改变了你”
- `InterventionDecision` 负责判断“系统要不要动”
- `ContinuityRecord` 负责保留“什么必须延续下去”

---

# 8. 本地 / R2 / 模型上下文的最小边界

## 8.1 本地
适合放：
- 主画像状态
- 原始 brainstorm
- 事件节点
- 干预记录
- 连续性核心资产

因为本地是主记忆体。

## 8.2 R2
适合放：
- 大体积归档材料
- 远端分析需要的中转内容
- 关键连续性备份
- 内网无法直接访问的数据桥接副本

因为 R2 是桥接和冷存储，不是主脑。

## 8.3 模型上下文
适合放：
- 当前 PersonaState 摘要
- 当前 brainstorm 提炼结果
- 少量最相关 EventNode
- 极少量高优先级 ContinuityRecord

因为上下文应该是**工作台**，不是仓库。

---

# 9. 第一版实现顺序建议

## Phase 1：先活起来
先实现：
- `BrainstormSession`
- `PersonaState`
- `ContinuityRecord`

原因：
- 这三者已经足够形成“理解你 + 提炼你 + 延续你”的最小闭环

## Phase 2：再开始长期化
再实现：
- `EventNode`

原因：
- 让系统开始有“人生轨迹骨架”

## Phase 3：最后调主动性
再实现：
- `InterventionDecision`

原因：
- 主动性必须建立在已有画像和事件基础上，否则会很吵、很蠢

---

# 10. 一句话总结 v0.2
如果 v0.1 是“联合体宪章”，
那么 v0.2 就是：

> **把灵魂拆成 5 个最小可保存、可传递、可迭代的认知对象。**
