# 模块一：Indexer 解析与建库机制 (Information Ingestion)

这个模块是整个 LifeOS 的**信息中枢大门**。它的核心职责是：**实时发现新文件 -> 拆解内容结构 -> 存储进双核数据库（关系型 + 向量） -> 触发下游灵魂（AI）响应**。

```mermaid
graph TD
    %% 样式定义
    classDef External fill:#2a9d8f,stroke:#264653,color:#fff,stroke-width:2px,rx:8px,ry:8px;
    classDef Core fill:#e9c46a,stroke:#e76f51,color:#333,stroke-width:2px,rx:8px,ry:8px;
    classDef Database fill:#6a4c93,stroke:#1982c4,color:#fff,stroke-width:2px,rx:8px,ry:8px;
    classDef Trigger fill:#e76f51,stroke:#d62828,color:#fff,stroke-width:2px,rx:8px,ry:8px;

    A1("Vault 本地文件系统\n(如 Obsidian 文件夹)"):::External
    A2("手机端灵光捕捉\n通过 Webdav/S3 写入"):::External
    
    A2 -->|物理落地| A1

    subgraph Indexer模块 ["Module 1: Indexer 中心 (packages/server/src/indexer)"]
        
        %% 扫描与监听层
        B("FileWatcher (Chokidar)\n24小时增量监听变更"):::Core
        C("Scanner (全量扫描)\n每次 LifeOS 启动时进行对账"):::Core
        
        %% 调度层
        D("Indexer (总调控)\n负责判断：这是新建、修改还是物理删除？"):::Core
        
        B --> D
        C --> D
        
        %% 解析层
        E("Parser (结构化解析器)\n- 读取 Markdown YAML Frontmatter\n- 提取标签、类型、双链\n- (关键) 智能分块切片"):::Core
        
        D -->|派发文件流| E
        
        %% 存储层
        F("SQLite 关系数据库\n(保存标题、标签、时间、FTS全文索引)"):::Database
        G("Vector Store 向量库\n(将切片转化为 1536 维数据，用于 AI 相似度检索)"):::Database
        
        E -->|元数据入库| F
        E -->|特征词嵌入(Embedding)| G
        
        %% 后置关卡
        H{"Post Index Trigger\n(AI 免疫门控拦截器)"}:::Trigger
    end
    
    F --> H
    G --> H
    
    H -- "检测到系统/大模型产物\n(如 assets/ 目录下)" --> Z([免打扰拦截\n系统静默运行])
    H -- "检测到有效信息\n(如 Inbox/ 人工笔记)" --> I([放行交接给 Module 2:\nAI Soul 认知引擎])
```

## 核心代码文件导航 (建议依次阅读)

1. **`scanner.ts` & `fileWatcher.ts` (快递员)**：
   - 负责把文件的绝对路径（物理地址）找出来，通过队列机制喂给 `indexer.ts`。其中 watcher 是基于操作系统底层事件（比如 inotify）实现的秒级响应。
2. **`parser.ts` (海关验钞机)**：
   - **这非常关键**！它读取 Markdown 的顶部属性（`---` 包裹的内容），把诸如 `type: note`、`dimension: task` 等属性标准化为机器能懂的 TypeScript 类型。如果它遇到不认识的乱码，它会赋予降级默认值。（咱们之前修复的“白名单类型”就在这里）。
3. **`indexer.ts` (入库主管)**：
   - 它拿到验钞机（Parser）分解好的数据结构，分两条路走：
     - 左手塞入传统的 SQLite 数据库（这样前端展示时极快，且能实现关键字 FTS 搜索）。
     - 右手扔给 `vectorStore.ts` 去生成高维向量数组（为了实现后面的“跨维度联想”以及语义搜索 `RAG`）。
4. **`postIndexPersonaTrigger.ts` (守门大将)**：
   - 当入库主管完成它的工作后，调用此钩子。该文件执行**免打扰逻辑（Immunity Gate）**：如果这是机器自己写的运行日志或是普通的代码记录，就不准拿去烦 AI 引擎。如果是从 `inbox` 刚进来的新鲜灵感，则一脚踹进 `Module 2: Soul (灵魂引擎)`，去提取任务。
