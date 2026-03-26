# 模块二：Soul AI认知与灵魂引擎 (Cognitive Engine)

该模块是 LifeOS 真正的“大脑”。从 Indexer 收到的结构化文本将在这里**被大模型阅读、理解、产生联想、最后转化为能够行动的真实任务派发单**。

```mermaid
graph TD
    %% 样式定义
    classDef External fill:#2a9d8f,stroke:#264653,color:#fff,stroke-width:2px,rx:8px,ry:8px;
    classDef Core fill:#e9c46a,stroke:#e76f51,color:#333,stroke-width:2px,rx:8px,ry:8px;
    classDef Database fill:#6a4c93,stroke:#1982c4,color:#fff,stroke-width:2px,rx:8px,ry:8px;
    classDef Trigger fill:#e76f51,stroke:#d62828,color:#fff,stroke-width:4px,rx:8px,ry:8px;
    classDef Worker fill:#f4a261,stroke:#e76f51,color:#fff,stroke-width:2px,rx:8px,ry:8px;

    %% 输入起点
    A("Module 1 传来的\n合法笔记输入 (Immunity Gate 通过)"):::External
    
    subgraph Soul模块 ["Module 2: AI 认知与灵魂引擎 (packages/server/src/soul)"]
        
        %% 第一级触发
        B{"Persona Trigger\n(性格触发器)\n判定内容是否值得大模型耗费 Token 阅读？"}:::Trigger
        
        %% 初步阅读
        C("Brainstorm Session\n(思绪风暴进程)\nAI 快速浏览笔记，寻找:\n1. 待办事项\n2. 可深挖的情绪/观点"):::Core
        
        %% 动作生成
        D("生成 SoulAction (灵魂动作)\n如：extract_tasks (提取任务)\nsummarize_note (摘要归档)"):::Core
        
        %% 数据库暂存
        E[(Soul_Actions 队列表)]:::Database
        
        B -- "判定值得分析" --> C
        C -->|"意图识别"| D
        D -->|"状态设为 pending_review"| E

        %% 第二级深度分析 (闲时流)
        F("Idle Processor\n(闲时处理循环)"):::Worker
        G("Long Term Memory\n(大模型交叉对比向量数据库中的旧笔记)"):::Core
        H[(Distilled Insights 洞察表\n只读的潜意识快照)]:::Database

        C -. "残余的模糊灵感\n没有生成明确待办" .-> F
        F -->|"触发深度提炼"| G
        G -->|"生成跨维度感悟"| H
    end
    
    A --> B
    
    %% 出口
    I("Web 治理面板\n(Human Governance)"):::External
    J(["流入 Module 3\nWorker 派发执行体系"])
    
    E -->|"人类在前端点击 Approve 批准"| I
    I -->|"转化为真实派发单 (Worker Task)"| J
    H -. "作为静态卡片展示在「闲时洞察页」" .-> I
```

## 核心代码文件导航 (建议依次阅读)

1. **`postIndexPersonaTrigger.ts`** (神经反射弧)
   - 当上一模块 Indexer 保存好笔记后，此函数会被调用。它会快速通过一套正则或轻量级规则（比如判断文档长度、关键词），决定要不要拉起昂贵的 LLM（大语言模型）进行进一步分析。
2. **`brainstormSessions.ts`** (头脑风暴室)
   - 它是机器第一次真正“阅读”您笔记的地方。大模型会通读这篇新进来的文章，提取出“建议动作”。比如 AI 觉得这篇文章里有几件未办事宜，它就会立刻创建一张类型为 `extract_tasks` 的 **SoulAction** 审批卡，等待您发落（Approve）。
3. **`soulActionTypes.ts` / `soulActionGovernance.ts`** (动作议会)
   - 定义了 AI 可以对您的知识库施加的指令类型（比如总结文档、提取知识点、发散联想、或者直接交给 OpenClaw 去做外部操作）。
   - 这是机器认知向现实物理世界投射前，最后也是**最重要的“人类把关”环节**。
4. **`idleProcessor.ts` & `longTermMemory.ts`** (潜意识织梦者)
   - 不是所有的笔记都有明确的待办事宜。那些零碎的随想、情绪、或者长篇大论，会被暂时休眠。当系统处于闲置状态没被高频访问时，`idleProcessor` 会悄悄爬起来，利用 1536 维的向量数据库找出相似的历史笔记，喂给大模型做深度对比，最终凝结成一条神不知鬼不觉的**“闲时洞察 (Distilled Insights)”**。
