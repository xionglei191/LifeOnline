# 模块三：Worker 异步执行生态 (Execution Engine)

这是系统的**肌肉框架**。前两层（Indexer 和 Soul）只负责“思考能干什么”，但所有的“苦力活”和“外部环境交互”全都在这个模块里进行分流、排队、调度和容错。

```mermaid
graph TD
    %% 样式定义
    classDef External fill:#2a9d8f,stroke:#264653,color:#fff,stroke-width:2px,rx:8px,ry:8px;
    classDef Core fill:#e9c46a,stroke:#e76f51,color:#333,stroke-width:2px,rx:8px,ry:8px;
    classDef Database fill:#6a4c93,stroke:#1982c4,color:#fff,stroke-width:2px,rx:8px,ry:8px;
    classDef Worker fill:#f4a261,stroke:#e76f51,color:#fff,stroke-width:2px,rx:8px,ry:8px;

    A("Module 2 (前台) 传来\n被您点击 Approve 的 SoulAction"):::External
    
    subgraph Worker模块 ["Module 3: Worker 任务池 (packages/server/src/workers)"]
        
        B("Worker Tasks 调度引擎\n(workerTasks.ts)"):::Core
        C[(worker_tasks 本地数据库队列)]:::Database
        
        B -->|"将动作转化为底层实体任务写入队列\n并持续短轮询拉起"| C
        
        %% 策略路由
        D{"任务策略路由器\n(按 actionType 分发)"}:::Core
        B --> D
        
        %% 三大执行器集群
        E("内部 LLM Executor\n(大模型文本级苦力)\n负责：写摘要、扩写、提取日记"):::Worker
        F("OpenClaw Executor\n(外部物理级机器臂)\n负责：突破沙盒、控制手机、爬取网页"):::Worker
        G("系统级 / 本地 Python Script\n负责：跑脚本、清内存、关机等"):::Worker
        
        D -- "summarize, extract..." --> E
        D -- "openclaw_task" --> F
        D -- "run_python" --> G
        
        %% 生命周期隔离
        H("Sync (短耗时同步完成)"):::Core
        I("Async Webhook (长耗时物理剥离)"):::Core
        
        E --> H
        G --> H
        F --> I
        
        I -->|"防止内存泄露：发射后立刻向上游抛出 ASYNC_YIELD 状态\n这正是我们前几天共同重构的安全架构！"| C
        
        %% 唤醒闭环
        J("OpenClaw 物理代理终端\n(独立运作在 192.168.31.xxx 网络中)"):::External
        I -. "以 HTTP POST 塞给它目标指令\n附带：『执行完请务必通过 CURL 汇报』" .-> J
        
        K("生命线 Webhook 接口\n(webhookHandlers.ts)"):::Core
        J -. "代理花了一小时干完活了，爬回 LifeOS 敲门" .-> K
        K -->|"解除挂起，写入 final_result"| B
        
        %% 后遗症包装
        L("Reintegration Record\n(回流日志记录)"):::Database
        H --> L
        B --> L
    end
    
    M(["流向 Module 4:\n审计与重投影投射\n(Promotion Projection)"])
    L -->|"包装成统一的审查报告"| M
```

## 核心代码文件导航 (建议依次阅读)

1. **`workerTasks.ts`** (黑工头包工队)
   - 这是个死循环监听器！只要表 `worker_tasks` 里有没干完的活，它就会根据排队顺序拉起来分配。
   - 重点看里面的 `ASYNC_YIELD` 逻辑（咱们刚修好的异步回调机制）。传统系统中，如果让 Node.js 同步等待 OpenClaw 操作手机一个多小时，服务器内存就会被撑爆或者超时。这里的处理非常优雅：交出任务后，立马将状态挂起休眠（yield）。
2. **`executors/llmExecutor.ts`** (办公室文员)
   - 这个文件负责所有本服大模型擅长的脏活累活。它会把要阅读的文档拼接到一处，然后调用 `callClaude`。
   - 之前在 `PromotionProjectionPanel.vue` 您看到的那些“原始长文日志”，大部分就是这家伙不加修饰吐出来的提取结果。
3. **`executors/openclawExecutor.ts`** (外派特种兵)
   - 专门用于呼叫 OpenClaw 的封装器。
   - **它包含了一个极其精妙的文件转移设计**：由于 OpenClaw 是运行在别处的隔离环境，当它帮您生成了一份文件（比如网页长截图、汇总报表），它是没法放到 LifeOS Vault 里的。我们设计它把资源作为 Payload 传回来后，LifeOS 用底层的权限将那几个文件复制粘贴进 `assets/` 物理文件夹，并自动生成双链（`![[file]]`）挂到回流报告中。
4. **`webhookHandlers.ts`** (传达室保安)
   - 它其实是在 `api` 层，但和 Worker 命脉相连。暴露了一个公网或局域网 HTTP POST 接口 `openclaw-callback`。这就是 OpenClaw 干完活之后“打电话报平安”的热线，它接收到电话后，会把 Worker Task 的悬念给完结掉。
