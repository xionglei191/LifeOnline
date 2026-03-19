# LifeOS

LifeOS 是 LifeOnline monorepo 中的控制核心，负责：

- 以 Vault 为事实源进行索引与查询
- 提供 Web 控制台所需 API 与实时推送
- 管理 worker tasks / schedules / AI provider
- 按需调用 OpenClaw 作为外部执行节点
- 将自动化结果统一写回 Vault

当前真实运行基线：
- 正式运行代码路径：`/home/xionglei/LifeOnline/LifeOS`
- 主 Vault：`/home/xionglei/Vault_OS`
- 运行主机：`192.168.31.246`
- 开发机：当前这台新电脑

## 项目结构

```text
LifeOS/
├── packages/
│   ├── shared/          # 协议层：共享类型与任务/调度/AI 配置契约
│   ├── server/          # 控制核心：API、索引、watcher、worker、schedule
│   └── web/             # 控制台：Dashboard / Timeline / Stats / Settings
└── mock-vault/          # 本地开发用示例数据，不是正式主 Vault
```

## 核心架构

```text
LingGuangCatcher / 其他输入端
            ↓
        Vault_OS
            ↓
   LifeOS Backend（控制核心）
            ↓
   ┌───────────────┬───────────────┐
   │               │               │
SQLite 索引层   LifeOS Web      OpenClaw
运行态存储      控制台           外部执行器
```

关键原则：
- Vault 是唯一事实源
- LifeOS backend 是控制核心
- OpenClaw 是按需调用的外部执行器，不是主编排器
- SQLite 是索引与运行态数据库，不是最终业务真相
- 内容类业务数据先落 Vault，再通过索引同步到 SQLite
- 运行控制类数据（worker tasks / schedules / AI 配置）以 SQLite 为准
- Scheduler 只负责触发，不负责实际业务执行
- 新的后台自动化能力优先进入 worker task 模型

## 架构判定（简版）

### 系统角色
- `packages/server`：中央控制器，负责 API、索引、任务编排、调度、AI 能力接入、OpenClaw 调用
- `packages/web`：控制台 UI
- `packages/shared`：共享类型与协议
- `OpenClaw`：外部执行器，只承接被 LifeOS 派发的远程任务

### 数据边界
- Vault 中的 markdown / frontmatter 是内容真相
- SQLite 中的 notes 是查询视图
- SQLite 中的 worker_tasks / task_schedules / ai_provider_settings / ai_prompts 是运行态真相

### 执行边界
- 所有后台自动化统一抽象为 worker task
- schedule 到点后只创建任务并触发执行
- 本地 AI 任务优先留在 LifeOS 内执行
- 开放式委托型任务才交给 OpenClaw

### 同步语义
- 应用内主动写文件的路径，必须主动 enqueue reindex
- watcher 负责捕获外部文件变化和兜底同步

## 本地开发

### 前置要求
- Node.js 18+
- pnpm

### 安装依赖

```bash
pnpm install
```

### 启动开发环境

```bash
pnpm dev
```

默认本地开发端口：
- Server: http://localhost:3000
- Frontend: http://localhost:5173

### 单独启动

```bash
pnpm --filter server dev
pnpm --filter web dev
```

### 本地辅助命令

```bash
pnpm build
pnpm db:init
pnpm index
```

说明：
- `mock-vault/` 仅用于本地开发和演示
- 当前正式运行环境使用远端主 Vault，而不是本地 `mock-vault`

## 运行与部署现实

当前推荐工作模型：

### 开发机（新电脑）
- 改代码
- 构建测试
- 通过 SSH / rsync 同步到远端

### 运行主机（`192.168.31.246`）
- 持有主 Vault：`/home/xionglei/Vault_OS`
- 运行 LifeOS backend / web
- 运行 OpenClaw
- 作为手机同步锚点

## 重要规则

- 不迁移主 Vault 到新电脑
- 不把 `.claude/` 作为跨机器同步内容
- 不再从旧路径 `/home/xionglei/LifeOS` 启动正式服务
- 新自动化能力优先进入 worker task 模型
- 最终业务结果必须回到 Vault

## 主要功能

- Vault 索引与查询
- Dashboard / Timeline / Calendar / Stats / Search
- Worker task 统一任务模型
- Schedules 定时触发
- OpenClaw 外部任务执行
- WebSocket 实时更新
- 笔记创建、更新、追加备注、快捷完成

## API 概览

主要分类如下：

- 数据读取：`/api/dashboard`、`/api/notes`、`/api/timeline`、`/api/calendar`、`/api/search`、`/api/stats/*`
- 配置与索引：`/api/config`、`/api/index`、`/api/index/status`
- Worker tasks：`/api/worker-tasks/*`
- Schedules：`/api/schedules/*`
- AI 配置：`/api/ai/prompts`、`/api/ai/provider`

说明：
- `worker-tasks` 是自动化主路径
- `/api/ai/*` 仅保留 prompt/provider 配置接口，不再承载任务执行入口

