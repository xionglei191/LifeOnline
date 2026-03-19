# LifeOS 当前总结

## 项目定位

LifeOS 是 LifeOnline monorepo 中的控制核心：

- Vault 是内容事实源
- LifeOS backend 负责索引、任务编排、调度与写回
- LifeOS web 是控制台
- OpenClaw 是按需调用的外部执行器
- LingGuangCatcher 等输入端负责把内容送入 Vault

## 当前基线

### 架构边界
- LifeOS backend = 控制核心
- OpenClaw = 外部执行器，不承担主编排
- Vault = 内容真相
- worker task = 统一自动化执行单元
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
Watcher / Indexer
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

## 当前稳定能力

- Vault 索引与查询
- Dashboard / Timeline / Calendar / Search / Stats / Settings
- Worker task 统一任务模型
- 当前 task types：`openclaw_task`、`summarize_note`、`classify_inbox`、`extract_tasks`、`daily_report`、`weekly_report`
- Schedules 定时触发
- 笔记创建、更新、追加备注、快捷完成
- 自动化结果统一写回 Vault

## 当前运行规则

- 主 Vault 固定为 `/home/xionglei/Vault_OS`
- 正式运行只认 `/home/xionglei/LifeOnline/LifeOS`
- `.claude/` 不跨机器同步
- 新电脑负责开发、构建与同步，不接管主数据与主运行职责

## 当前数据与执行语义

### 数据边界
- Vault markdown / frontmatter 是内容真相
- SQLite `notes` 是查询视图
- SQLite `worker_tasks` / `task_schedules` / `ai_provider_settings` / `ai_prompts` 是运行态真相

### 执行边界
- 新的后台自动化默认进入 worker task 模型
- schedule 只负责触发，不直接承担业务执行
- 依赖 Vault 结构或系统内部语义的任务优先在 LifeOS 内执行
- 开放式委托型任务才交给 OpenClaw

### 同步语义
- 应用代码主动写 Vault 文件后，必须显式 enqueue reindex
- watcher 负责外部改动捕获与兜底同步

## 当前运维入口

- SSH 别名：`lifeos-server`
- 本地检查脚本：`check-lifeos`
- 本地同步脚本：`sync-lifeos`
- 远端 `/api/config` 可作为第一检查点
