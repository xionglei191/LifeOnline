# PR6 晋升框架与信息流转架构图 (PR6 Information Flow)

这是 LifeOS 系统的核心数据运转架构，展示了信息从入库、被大模型认知分析（Soul）、被分配给后台任务（Worker Task）、一直到投射落地（Promotion & Execution）的全生命周期。

```mermaid
graph TD
    %% 样式定义
    classDef External fill:#2a9d8f,stroke:#264653,color:#fff,stroke-width:2px,rx:8px,ry:8px;
    classDef System fill:#e9c46a,stroke:#e76f51,color:#333,stroke-width:2px,rx:8px,ry:8px;
    classDef AIWorker fill:#f4a261,stroke:#e76f51,color:#fff,stroke-width:2px,rx:8px,ry:8px;
    classDef Governance fill:#e76f51,stroke:#d62828,color:#fff,stroke-width:4px,rx:8px,ry:8px;
    classDef Artifact fill:#a8dadc,stroke:#457b9d,color:#1d3557,stroke-width:2px,rx:8px,ry:8px;

    %% -------------------- 第一阶段：信息捕获与触发 --------------------
    subgraph S1 [第一阶段：信息入库与认知门控]
        A1("手机端 (LingGuang)\n来源: Inbox"):::External
        A2("网页剪存\n来源: WebClipper"):::External
        A3("OpenClaw 等\n系统级脚本产出"):::External
        
        B(Vault 文件解析入库)
        
        A1 --> B
        A2 --> B
        A3 --> B
        
        C{"认知免疫网关\n(Immunity Gate)"}:::System
        B --> C
        
        C -- "白名单通过\n(Inbox特权, note, record等)" --> D
        C -- "机器免打扰拦截\n(system, 脚本等)" --> Z(静默归档, 无AI分析)
    end

    %% -------------------- 第二阶段：AI 魂之分析 --------------------
    subgraph S2 [第二阶段：AI阅读提取与治理]
        D("灵魂触发器\n(LLM 初读笔记)"):::AIWorker
        E("提炼生成候选动作卡片\n(SoulAction)"):::Artifact
        
        D -->|脑暴：提取任务 / 总结笔记| E
        
        F{"第一道人类门控\n(Soul Action Governance)"}:::Governance
        E --> F
        
        F -- "Approve & Dispatch" --> G
        F -- "Discard / Defer" --> Z2(推迟 / 丢弃)
    end

    %% -------------------- 第三阶段：专业 Worker 执行动作 --------------------
    subgraph S3 [第三阶段：大模型专业处理与回流]
        G("分配给特定的执行器\n(Worker Task)"):::System
        H("大模型深度阅读执行\n(如：精细抽取代办事项)"):::AIWorker
        
        G --> H
        
        I("机器生成回流记录报告\n(Reintegration Record)"):::Artifact
        H --> I
        
        J{"第二道人类门控\n(Reintegration Review)"}:::Governance
        I --> J
        
        J -- "Accept" --> K
        J -- "Reject" --> Z3(丢弃本次报告)
    end

    %% -------------------- 第四阶段：成果投射与落地执行 --------------------
    subgraph S4 [第四阶段：成果投射生成闭环 (Promotion)]
        K("信号矩阵规则引擎\n(PR6 Promotion Rules)"):::System
        
        J -. "（如果是总结/分类等不衍生任务的回流）" .-> N("没有下游行动\n自动结束流转\n(点击“手动补规划”无效)")
        
        K -- "如果包含强任务行动项" --> L("衍生新的下游行动卡片\n(如: create_event_node)"):::Artifact
        L --> M("投射为真正的落地执行体代码\n(Event Node / Physical Action)"):::System
        M --> O("交给 OpenClaw 实际行动！")
    end

    Z -.->|结束| End([流转结束])
    Z2 -.->|结束| End
    Z3 -.->|结束| End
    
    K -.->|补充执行| J
```

## 各节点核心状态与数据说明

1. **Immunity Gate (免疫网关)**: 防止大模型读取不必要的文件（如代码脚本或大模型自己的汇报），导致递归自激振荡（Self-exciting feature loop）。
2. **Soul Action 卡片**: AI 的意图展示，需要人类干预批准。
3. **Reintegration Record (回流记录)**: 执行器完成具体任务（如翻译、总结、提取任务）后形成的数据载体。
4. **Promotion (晋升)**: 根据回流数据，决定是否继续生成下游实体事件（如将抽象文字变成“下午3点开会”这个具象节点）。
