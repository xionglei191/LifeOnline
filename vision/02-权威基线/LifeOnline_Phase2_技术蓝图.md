# LifeOnline Phase 2 演进技术蓝图

> 起草日期：2026-03-24
> 聚焦方向：**规模化认知、多智能体协同、主动记忆**

在完成了 Phase 1（认知双循环、治理层产品化、基础设施稳固）之后，LifeOnline 已具备稳定的从文本解析、生成动作、门控治理到回流闭环的核心骨架。

进入 Phase 2（第二阶段），系统的进化目标将从“**能够存储与推导**”转向“**能够主动、深入、多元视角地协同思考**”。这需要我们在底层存储、智能体调度、终端交互三个维度上进行架构升级。

---

## 🚀 核心演进方向

### 1. 认知存储升级 (Vector Database)

**当前痛点：**
第一阶段严重依赖 SQLite 的 `json_each` 或 JSON 字符串匹配来进行主题关联，这限制了系统的“模糊关联”与“深层连接”能力。例如，“架构重构”和“底层升级”在 JSON 字符匹配中可能无法关联。

**演进方案：**
- 引入轻量级向量存储引擎（如 `ChromaDB`, `pgvector` 或直接使用 `sqlite-vss` / `sqlite-vec`）。
- 对 `BrainstormSession.distilledInsights`, `ContinuitySignals`, `PersonaSnapshots` 进行 Embedding 编码。
- **场景**：实现真正的“认知关联漫游”，在笔记侧边栏推荐语义相关的历史灵感，而非简单的标签堆砌。

### 2. 多智能体协作编排 (Multi-Agent System)

**当前痛点：**
目前 `cognitiveAnalyzer` 是单体的统一 Prompt，处理主题、情绪、连续性信号和建议动作的所有任务。随着 prompt 的庞大，分析精度和稳定性将遭遇大模型的 `Attention` 天花板。

**演进方案：**
- 将认知内核拆分为协作的 Agent 群组：
  - **Extractor Agent**: 仅负责事实与主题提取。
  - **Critic Agent**: 负责分析情绪、发现逻辑破绽、标记 ambiguity。
  - **Planner Agent**: 结合 Persona 历史，给出最优行动建议。
- **架构**：引入 `langchain` 或 `autogen` 式的有向无环图 (DAG) 编排工作流，大幅提升认知深度的信噪比。

### 3. 主动思考机制 (Proactive Idling Memory)

**当前痛点：**
系统的计算周期完全由外部驱动：用户写一篇笔记触发一次 Index，产生一次认知过程。系统处于“被动反应”模式。

**演进方案：**
- 引入 **Idle-State Processor (闲时思考机)**。
- 借助 `node-cron` 或现在的 `TaskScheduler`，在服务端闲置时，主动捞取“待发酵”的 `BrainstormSessions` 或久未回顾的 `ContinuityRecords`，交给模型进行自发的发散联想。
- 结果通过 `ReintegrationRecord` 异步展示给用户，实现“睡一觉起来，系统帮你想出了新方案”的真正 Life OS 体验。

### 4. 移动化与跨端支持

**当前痛点：**
当前 Web 客户端（Vue 3）侧重桌面端治理，重度依赖键盘输入与大屏幕的数据可视化，不便于移动态快速记录与碎片化审阅。

**演进方案：**
- 将 Web 控制台升级为标准 PWA，支持离线缓存和移动端自适应。
- 或基于 React Native / Flutter 开发极简的 iOS/Android 客户端卡片流：
  - **专注两种输入**：语音闪念录入 → 自动转写为 Inbox Note。
  - **专注一种交互**：Tinder 风格的治理卡片（左滑 Reject，右滑 Approve Soul Actions）。

---

## 🗓️ 实施路线考量

> 优先级建议：`多智能体拆分 (Agent)` > `向量存储 (Vector DB)` > `主动思考机制`

在正式切入 Phase 2 前，C 组（基础设施组）需先行验证 `sqlite-vec` 或 `pgvector` 的集成可行性；A 组开始评估分析逻辑解耦。B 组则可以开始预研 PWA 方案并梳理移动端视图的缩减版原型。
