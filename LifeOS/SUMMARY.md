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

## 一句话总结

> LifeOS 是一个以 Vault 为唯一事实源、以 backend 为中央控制器、以 worker task 为统一自动化模型、以 OpenClaw 为外部执行节点、以 Web 为控制台的个人操作系统。
