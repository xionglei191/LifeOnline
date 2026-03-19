# 系统架构设计

*版本: 1.0 | 更新: 2026-03-17*

---

## 整体架构

LifeOnline 采用四层架构，以 Obsidian Vault 为 Single Source of Truth：

```mermaid
graph TB
    subgraph 输入层 [输入层 - 采集]
        LG[灵光 App<br/>Android]
        PC[电脑端<br/>Obsidian 直写]
        WC[浏览器剪藏]
    end

    subgraph 存储层 [存储层 - 记忆中枢]
        VAULT[(Vault_OS<br/>Obsidian Vault)]
        INBOX[_Inbox/]
        DIM[维度目录<br/>健康/事业/财务/...]
        DAILY[_Daily/ _Weekly/]
    end

    subgraph 处理层 [处理层 - 编排与外部执行]
        LOS[LifeOS Backend<br/>控制核心]
        WT[Worker Task<br/>统一执行单元]
        OC[OpenClaw<br/>外部执行器]
        IDX[索引服务<br/>chokidar + SQLite]
    end

    subgraph 展示层 [展示层 - 看板]
        WEB[LifeOS Web<br/>Vue 3]
        WS[WebSocket<br/>实时推送]
    end

    LG -->|标准 Frontmatter| INBOX
    PC -->|直接编辑| VAULT
    WC -->|剪藏| INBOX
    INBOX --> VAULT
    DIM --> VAULT
    DAILY --> VAULT

    VAULT -->|文件变更 / 手动触发 / schedule| LOS
    LOS --> WT
    WT -->|内部执行| VAULT
    WT -->|按需调用| OC
    OC -->|结构化结果| LOS
    LOS -->|写回标准笔记 / 更新任务状态| VAULT

    VAULT -->|文件变更| IDX
    IDX --> WEB
    IDX --> WS
    WEB -->|双向操作| VAULT
end
```

---

## 设计原则

### 1. Single Source of Truth
所有数据以 Obsidian Vault 中的 Markdown 文件为唯一真实来源。SQLite 仅作为索引缓存，随时可从 Vault 重建。

### 2. 协议驱动
所有组件通过统一的 Frontmatter 协议通信。任何组件只要能读写符合协议的 Markdown 文件，就能接入系统。

### 3. 离线优先
- 灵光 App: 离线队列 + WorkManager 后台同步
- Vault: 本地文件系统，不依赖网络
- 运行主机与路径等当前基线信息统一见 [LifeOS 当前总结](../LifeOS/SUMMARY.md)

### 4. 职责分离

| 层 | 职责 | 不做 |
|----|------|------|
| 输入层 | 采集、STT、结构化整理 | 不做维度分类 |
| 存储层 | 持久化、同步、版本控制 | 不做数据处理 |
| 处理层 | 由 LifeOS 编排任务，内部执行或调用 OpenClaw | 不做数据展示 |
| 展示层 | 读取展示、轻量操作 | 不做主编排与外部执行决策 |

---

## Vault_OS 目录结构

```
Vault_OS/
├── _Inbox/              # 未分类输入，后续由 LifeOS worker task 统一处理
├── _Daily/              # 每日自动生成的日报
├── _Weekly/             # 每周自动生成的周报
├── _Templates/          # Frontmatter 模板
├── 健康/                # health
├── 事业/                # career
├── 财务/                # finance
├── 学习/                # learning
├── 关系/                # relationship
├── 生活/                # life
├── 兴趣/                # hobby
└── 成长/                # growth
```

### 关键设计：统一 _Inbox

所有输入端（灵光、电脑剪藏、浏览器等）的数据统一写入 `_Inbox/`，通过 `source` 字段区分来源：

```yaml
source: lingguang    # 灵光 App
source: desktop      # 电脑直写
source: webclipper   # 浏览器剪藏
source: openclaw     # OpenClaw 外部执行结果
```

---

## 组件间通信

### 灵光 App → Vault_OS
- 方式: SAF (Storage Access Framework) 直接文件写入
- 目标: `Vault_OS/_Inbox/`
- 格式: 标准 Frontmatter Markdown

### LifeOS ↔ OpenClaw
- 方式: LifeOS worker task 按需调用 OpenClaw
- 输入: 明确的外部执行任务请求
- 输出: 结构化结果返回 LifeOS，再由 LifeOS 写回 Vault

### Vault_OS → LifeOS
- 方式: chokidar 文件监听 → SQLite 索引 → WebSocket 推送
- 延迟: 文件变更后 ~300ms 完成索引和推送

### LifeOS → Vault_OS
- 方式: REST API → 直接修改 Vault 文件
- 操作: 更新状态、追加备注、创建笔记

---

## 多设备同步

```
手机 (灵光App)  ←→  Syncthing  ←→  电脑 (Vault_OS)
                                        ↓
                                   LifeOS + OpenClaw
```

推荐使用 **Syncthing** 进行 Vault_OS 的多设备同步：
- 免费、开源、去中心化
- 实时同步，P2P 不经过云端
- Android + Linux + Windows + macOS 全平台支持
- 冲突文件自动保留，不会丢数据

---

## 技术栈总览

| 组件 | 技术栈 |
|------|--------|
| 灵光 App | Kotlin, CameraX, Room, WorkManager, Material Design 3 |
| Obsidian | Markdown, YAML Frontmatter, 插件生态 |
| OpenClaw | 外部执行器, Python/Node.js, Claude/Gemini API |
| LifeOS 后端 | Node.js, TypeScript, Express, SQLite, WebSocket |
| LifeOS 前端 | Vue 3, TypeScript, Vite, ECharts |
| 同步 | Syncthing（推荐） |
