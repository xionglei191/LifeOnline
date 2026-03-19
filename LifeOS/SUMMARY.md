# LifeOS 当前总结

## 项目定位

LifeOS 是 LifeOnline monorepo 中的控制核心：

- Vault 是唯一事实源
- LifeOS backend 负责索引、编排、任务、调度与写回
- LifeOS web 是控制台
- OpenClaw 是按需调用的外部执行节点
- LingGuangCatcher 是输入端

## 当前基线

### 架构边界
- LifeOS backend = 控制核心
- OpenClaw = 按需外部执行器
- Vault = 唯一事实源
- worker task = 自动化统一执行单元
- SQLite = 索引与运行态存储，不是最终业务真相

### 主机与路径
- 开发机：当前这台新电脑
- 运行/数据主机：`192.168.31.246`
- 正式运行代码路径：`/home/xionglei/LifeOnline/LifeOS`
- 主 Vault：`/home/xionglei/Vault_OS`
- OpenClaw 目录：`/home/xionglei/.openclaw`

### 当前端口
- backend：`3000`
- web：`5173`

## 当前主链路

### 输入链路
```text
LingGuangCatcher / 其他输入端
            ↓
        Vault_OS
```

### 索引链路
```text
Vault 文件变化
    ↓
LifeOS Watcher / Indexer
    ↓
SQLite
```

### 自动化链路
```text
手动触发 / schedule
        ↓
    Worker Task
        ↓
LifeOS 内部执行或调用 OpenClaw
        ↓
      写回 Vault
        ↓
 Reindex / WebSocket
        ↓
      Web 可见
```

## 当前重点能力

- Vault 索引与查询
- Dashboard / Timeline / Calendar / Search / Stats / Settings
- Worker task 统一任务模型
- `classify_inbox` / `summarize_note` / `daily_report` / `weekly_report` / `openclaw_task`
- 笔记更新、追加备注、创建新笔记、快捷完成
- 结果统一写回 Vault

## 当前运行规则

- 主 Vault 固定为 `/home/xionglei/Vault_OS`
- 正式运行只认 `/home/xionglei/LifeOnline/LifeOS`
- `.claude/` 不跨机器同步
- 新电脑只负责开发，不接管主数据与主运行职责

## 当前运维入口

- SSH 别名：`lifeos-server`
- 本地检查脚本：`check-lifeos`
- 本地同步脚本：`sync-lifeos`
- 远端 `/api/config` 可作为第一检查点

## 当前待收口边界

### 1. 本地 AI 与 OpenClaw 的任务分界
已确定原则：
- 直接依赖 Vault 结构、笔记语义、系统内部 schema 的任务，优先在 LifeOS 本地执行
- 偏开放式委托、远程外包处理、非核心领域特化任务，才交给 OpenClaw

当前已符合：
- 本地：`classify_inbox`、`extract_tasks`、`summarize_note`、`daily_report`、`weekly_report`
- 外部：`openclaw_task`

### 2. 文件写入后的同步语义
正式规则：
- 应用代码主动写 Vault 文件后，必须显式 `enqueue` 索引
- watcher 仅负责外部改动捕获与兜底

### 3. API handler 的职责上限
当前允许：
- 简单笔记写操作继续留在 handler

后续升级条件：
- 一旦流程涉及多个资源协调、任务触发、复杂分支或跨模块写入，应上提到独立 service/module

## 轻量重构清单

### P1：只做边界收口，不改主流程
1. 在 `workerTasks.ts` 顶部补一段模块职责注释，明确它是“任务执行内核的集中实现”
2. 在 `handlers.ts` 相关写文件入口旁补一句注释，明确“主动写文件必须主动 enqueue，watcher 仅兜底”
3. 在 `openclawClient.ts` 或 worker task 创建入口旁补一句注释，明确 OpenClaw 是外部执行器，不承担编排主权

### P2：低风险整理
4. 把 `workerTasks.ts` 内的“结果落盘函数”按任务类别聚合整理，至少在文件内形成更清晰的 section 边界
5. 把 `createNote / updateNote / appendNote / deleteNote` 的共享文件写入逻辑收束到更明确的 vault 模块接口中，但暂不强行做全量 service 化
6. 给 worker task 新增一条开发约定：新增 taskType 时，必须同时明确 `执行宿主`、`输出位置`、`是否写回 Vault`

### P3：等任务类型继续增长后再做
7. 当 worker task 超过当前规模时，再把 `workerTasks.ts` 拆成：
   - task repository / state
   - task executors
   - task result persistence
8. 当 API 写操作继续膨胀时，再引入独立 application service

## 当前建议
- 现在不要做大规模重构
- 优先把边界规则固定下来
- 后续新功能按这些规则进入系统，避免继续扩散模糊地带

## 一句话判定

> 当前系统不需要“重做架构”，只需要把已经存在的正确边界正式写死，并在新增功能时持续遵守。
