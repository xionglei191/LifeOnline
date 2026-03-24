# LifeOnline 认知管线数据流拓扑图

> 更新日期：2026-03-24
> 状态：**第一阶段 (Sprint 4) 全链路验证跑通**

本文档描述 LifeOnline 从一条笔记触发，到沉淀为结构化认知（SoulActions, BrainstormSessions, ReintegrationRecords, PersonaSnapshots）的**全链路完整数据流转图**。

---

## 🧭 核心拓扑图：端到端认知生命周期

```mermaid
sequenceDiagram
    autonumber
    
    actor User
    participant Note as 笔记 (Vault)
    participant Indexer as 索引服务 (indexQueue)
    participant PersonaCtx as 历史上下文 (personaContext)
    participant Analyzer as 认知分析引擎 (cognitiveAnalyzer)
    participant Generator as 动作生成器 (soulActionGenerator)
    participant Gate as 干预门控 (interventionGate)
    participant Dispatcher as 动作分发塔 (soulActionDispatcher)
    participant Worker as 异步工作机 (Worker Task)
    participant Reintegrate as 认知回流 (reintegrationReview)
    
    %% 触发阶段
    User->>Note: 保存/修改 Markdown 笔记
    Note->>Indexer: 检测到文件变更，进入索引队列
    Indexer->>Indexer: 解析前置 Matter 元数据 (dimension/type...)
    
    %% 分析阶段
    Indexer->>PersonaCtx: postIndexPersonaTrigger 查询历史
    PersonaCtx-->>Indexer: 注入近期 persona 摘要和 reintegration 摘要
    Indexer->>Analyzer: 提交完整 Context 与文本内容
    Analyzer-->>Indexer: 返回 NoteAnalysis (主题/情绪/行动性/连续信号/建议)
    Indexer->>Generator: 生成动作候选 (SoulActionCandidate)
    
    %% 决策阶段
    Generator->>Gate: [P1增强机制] 携带历史置信度提交 Gate
    Gate-->>Generator: 判定决定 (dispatch_now / queue / observe / discard)
    
    %% 分发阶段
    Generator->>Dispatcher: 仅将通过 Gate 的生成的 SoulAction 发送分发
    Dispatcher->>Worker: 转换封装为 WorkerTask 请求并入队
    
    %% 执行与反馈闭环 (P2)
    Worker-->>Worker: 连接大模型异步执行耗时任务 (提炼任务/归类等)
    Worker-->>Dispatcher: 执行完毕 (succeeded)
    Dispatcher->>Analyzer: [P2机制] Append 执行摘要到 BrainstormSession.distilledInsights
    
    %% 认知回流阶段 (P3)
    Worker->>Reintegrate: 产生 ReintegrationRecord 待审阅
    User->>Reintegrate: 用户在 Governance 确认采纳 (Accept)
    Reintegrate->>PersonaCtx: [P1机制] 采纳的结果成为未来的历史上下文基础
```

---

## 💻 真实状态流转示例

以下是一条真实日记触发完整管线的 Payload 记录（脱敏）：

### 1. 触发输入 (Note)
```markdown
# 2026-03-24 日记
今天再次推进 LifeOnline 的底层架构重构。最近一段时间这已经是第三次感到原有的 JSON 持久化方式存在性能瓶颈了。未来或许要引入更好的持久化手段。
```

### 2. 分析引擎截获 (NoteAnalysis)
```json
{
  "themes": ["架构重构", "持久化性能", "技术底层"],
  "emotionalTone": "压力焦虑",
  "actionability": 0.45,
  "continuitySignals": [
    {
      "pattern": "这已经是第三次感到原有的 JSON 持久化方式存在性能瓶颈",
      "type": "recurring_theme",
      "strength": "strong",
      "evidence": "最近一段时间这已经是第三次..."
    }
  ],
  "suggestedActions": [
    {
      "kind": "extract_tasks",
      "confidence": 0.75,
      "reason": "存在针对持久化升级的技术迭代需求"
    }
  ]
}
```

### 3. Generator 与 Gate 判定
Gate 检索历史记录发现，类似 `extract_tasks` 在该项目中被高频通过，**置信度调整**生效：
- 基础 Confidence: `0.75`
- Gate Learning Delta: `+0.15`
- 最终自信度: `0.90` (高于自动阈值 `0.85`)
- 门控结果：`dispatch_now` (不等待用户，直接执行)

### 4. Dispatcher 工作流 (SoulAction)
派生出 `worker_task` (ID: WT-198), 行动: 提取任务。

### 5. 执行回写 (Feedback P2)
Worker 服务获取到模型提炼的任务为：“调研 SQLite 向 Vector DB 迁移的可行性方案”。
执行成功后，Dispatcher 会触发一次 Update，将这段结果直接**追加写入**该笔记对应的 `BrainstormSession.distilledInsights` 数组中。

### 6. 深层回流 (Context P1)
最后，生成一条 `ReintegrationRecord`：
```json
{
  "target": "source_note",
  "summary": "【总结回流】当前笔记体现出强烈的架构演进动机，建议下一步确立持久化重构选型并输出技术方案。",
  "reviewStatus": "pending_review"
}
```
当用户在 **治理面板 (Governance View)** 点击 `Approve` 后：
该 Summary 被写入 `PersonaContext`，**当用户明天日记中再提到任何技术工作时，AI 分析将直接知道“用户近期在筹备技术选型”的历史背景。** 形成真正的**认知自愈闭环**。
