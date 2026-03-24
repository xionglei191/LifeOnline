# 架构决策记录 (ADR)

---

## ADR-001: Obsidian Vault 作为 Single Source of Truth

**日期**: 2026-03-17
**状态**: 已采纳 ✅

### 背景
系统需要一个统一的数据存储方案，多个组件需要读写数据。

### 决策
选择 Obsidian Vault（纯 Markdown 文件系统）作为唯一数据源，SQLite 仅作为索引缓存。

### 理由
- 纯文本格式，不依赖特定软件
- 可用 Git 进行版本控制
- Obsidian 生态丰富，手动编辑体验好
- 文件系统天然支持多工具并行读写
- SQLite 索引可随时从 Vault 重建

### 替代方案
- 数据库为中心（SQLite/PostgreSQL）— 灵活但丢失 Markdown 可读性
- 云端 API（Notion API 等）— 依赖网络，隐私风险

---

## ADR-002: 统一 _Inbox 而非独立 Vault_LingGuang 目录

**日期**: 2026-03-17
**状态**: 已采纳 ✅

### 背景
灵光 App 的数据需要暂存后进入统一处理链路。方案 A 是建立独立的 Vault_LingGuang 子目录，方案 B 是复用 _Inbox 目录。

### 决策
采用方案 B — 所有输入端的数据统一写入 `_Inbox/`，通过 `source` 字段区分来源。

### 理由
- LifeOS 的 `classify_inbox` / worker task 主路径已适配 `_Inbox`
- 统一入口更方便后续由 LifeOS 编排内部处理或外部执行
- 通过 frontmatter `source: lingguang` 即可区分来源
- 独立目录会导致索引和自动化链路额外分叉

### 影响
- 灵光 App 需要从 `00_Inbox` 改为写入 `_Inbox`
- _Inbox 中的"半成品"数据会出现在 LifeOS 看板上（通过 `dimension: _inbox` 标识）

---

## ADR-003: 灵光端不做维度分类

**日期**: 2026-03-17
**状态**: 已采纳 ✅

### 背景
灵光 App 采集的内容需要归类到八维度。有两种方案：在灵光端 AI 分类，或延迟到 OpenClaw/LifeOS 分类。

### 决策
灵光端只确定 `type`（通过 VoiceNoteType 映射），`dimension` 统一填 `_inbox`，后续分类由 LifeOS 主导的 worker task 链路处理。

### 理由
- 手机端 AI 调用慢、成本高
- 灵光端上下文信息少，分类不准
- 分类策略应统一收敛在 LifeOS 编排层，避免输入端承担过多判断
- 减少灵光端的复杂度和 AI 调用量

### 影响
- 灵光端 AI prompt 不需要判断维度
- LifeOS worker task 主路径需要承担后续分类能力

---

## ADR-004: 早期分工方案（已被后续编排模型收敛）

**日期**: 2026-03-17
**状态**: 已废弃 ❌（被 ADR-007 / ADR-009 取代）

### 背景
LifeOS 已内置 AI 分类和行动项提取功能，OpenClaw 也计划做类似的事情，存在职责重叠。

### 决策
明确分工：
- **LifeOS**: 数据展示 + 手动触发的轻量操作（标记完成、追加备注、创建笔记）
- **OpenClaw**: 后台自动化（定时分类、行动项提取、日报生成、自动执行）

### 理由
- LifeOS 的长处是 UI 和实时展示
- OpenClaw 的长处是后台自动化和外部集成
- 避免两个系统做重复的 AI 调用

### 影响
- 当时的 `classify_inbox` 和 `extract_tasks` 仍存在手动触发入口
- OpenClaw 承担定时/自动触发的职责
- 两者通过 Vault 文件系统解耦，不需要直接 API 通信

---

## ADR-005: 文件命名规范

**日期**: 2026-03-17
**状态**: 已采纳 ✅

### 决策
统一文件命名格式: `{source}_{type}_{YYYY-MM-DD}_{HHmmss}.md`

### 理由
- 文件名即包含元信息（来源、类型、时间）
- 在 Obsidian 文件列表中可直观识别
- 时间精确到秒，极低冲突概率
- 全小写 + 下划线，跨平台兼容

---

## ADR-006: OpenClaw 与 LifeOS AI 职责边界与纠偏机制

**日期**: 2026-03-17
**状态**: 已废弃 ❌（被 ADR-007 取代）

### 背景
OpenClaw 与 LifeOS 均具备 AI 分类和行动项提取能力，若同时自动执行会导致重复处理与状态冲突。

### 原决策
- **OpenClaw** 作为自动化主流程，负责 `_Inbox` 自动分类、行动项提取、日报/周报生成。
- **LifeOS AI** 保留为手动触发的备用纠偏能力，仅用于人工复核和修正。

### 废弃原因
该模式导致 OpenClaw 自动处理范围过大，容易在 `_Inbox`、行动项提取和自动执行环节制造噪声。现已改为由 LifeOS 掌握任务编排权，OpenClaw 仅作为按需调用的外部 worker。

---

## ADR-007: LifeOS 负责编排，OpenClaw 退为按需 worker

**日期**: 2026-03-18
**状态**: 已采纳 ✅

### 背景
LifeOS 后端已经掌握 Vault 写入、索引、WebSocket、前端刷新与审批状态写回能力，继续让 OpenClaw 作为持续自治主流程会造成过度自动整理与难以追责的噪声。

### 决策
- **LifeOS** 成为控制核心 / orchestration layer，负责判断是否需要外部执行、创建任务请求、跟踪状态、校验结果、落地笔记并触发既有索引闭环。
- **OpenClaw** 只负责执行明确、有限、可描述的任务，并返回结构化结果。
- 没有 LifeOS 持有的任务记录，不允许系统凭空生成最终结果笔记。
- `classify_inbox`、`extract_tasks` 等旧 `/api/ai/*` 能力已退出主入口，当前统一走 worker task 触发。

### 首个试点
- 新增 `worker_tasks` 表与 `/api/worker-tasks*` API。
- 首版先用早期专用 OpenClaw 任务验证链路，后续已升级为通用 `openclaw_task`。
- 所有由 OpenClaw 结果生成的笔记统一写 `source: openclaw`，并复用 LifeOS 既有 `Vault → index queue → SQLite → WebSocket` 闭环。

### 影响
- OpenClaw 不再承担 `_Inbox` 常驻自动整理主路径。
- LifeOS 设置页主入口从“AI 智能整理”改为“外部执行任务”。
- 历史 `source: auto` 数据保留原状，不做批量迁移。

---

## ADR-008: 定时任务调度器设计 — 仅支持无状态任务类型

**日期**: 2026-03-18
**状态**: 已采纳 ✅

### 背景
定时任务调度器当时支持早期专用 OpenClaw 任务（现已升级为 `openclaw_task`）和 `summarize_note` 两种任务类型。但 `summarize_note` 需要指定 `noteId`，而定时任务无法预知要摘要哪篇笔记，创建后必定失败。

### 决策
定时任务创建表单中隐藏 `summarize_note` 选项，仅保留当时的早期专用 OpenClaw 任务（当前已演进为通用 `openclaw_task`）。`summarize_note` 保留为手动触发（通过外部执行任务入口）。

### 理由
- 定时任务适合无状态、可重复执行的任务类型
- `summarize_note` 需要用户指定具体笔记，属于有状态操作
- 隐藏选项比添加笔记选择器更简单，且符合实际使用场景

### 附加增强
- 新增"立即执行"按钮，方便调试定时任务
- 新增失败追踪机制（`consecutive_failures` + `last_error`），连续失败在 Dashboard 显示红色警告
- Dashboard 新增定时任务健康状态卡片

---

## ADR-009: LifeOS 后端直接承担自动化职责，OpenClaw 仅保留外部集成

**日期**: 2026-03-18
**状态**: 已采纳 ✅

### 背景
ADR-007 确立了 LifeOS 编排 + OpenClaw 按需 worker 的架构。但实际运行中发现，OpenClaw 的早期 4 个 cron 任务已关闭，而 LifeOS 后端已具备完整的 AI 基础设施（`callClaude()`、`classifyNote()`、`extractTasks()`），完全可以直接完成这些自动化任务，无需绕道 OpenClaw。

### 决策
LifeOS 后端新增 3 种 worker task 类型，全部由 LifeOS 直接调用 Claude AI 完成：
- `classify_inbox` — 扫描 `_Inbox/` 并自动分类归档（承接早期 inbox 分类职责）
- `daily_report` — 生成每日回顾（承接早期日报职责）
- `weekly_report` — 生成每周回顾（承接早期周报职责）

新增 `WorkerName: 'lifeos'`，新任务自动分配 `worker: 'lifeos'`。

### 理由
- LifeOS 已有 `callClaude()`、`classifyNote()`、`extractTasks()` 等完整 AI 基础设施
- 直接调用避免了 LifeOS → OpenClaw → Vault 的间接路径，减少延迟和故障点
- OpenClaw 的核心价值在于外部集成（早期先以专用任务形态验证，当前已统一为 `openclaw_task`），而非 Vault 内部操作
- 统一在 LifeOS 内完成，便于调试、监控和前端展示

### 影响
- OpenClaw 仅保留 `openclaw_task`、`summarize_note` 等需要外部 API / 外部工具的任务
- `classify_inbox`、`daily_report`、`weekly_report` 的定时任务可直接在 LifeOS 设置页创建
- 所有生成的笔记标记 `source: auto`、`worker: lifeos`，通过既有索引闭环进入 SQLite

---

## ADR-010: SoulAction 覆盖面扩展至 worker-backed 动作

**日期**: 2026-03-24
**状态**: 已采纳 ✅

### 背景
蓝图 v1.0 定义了 8 个首批 actionType，其中 `launch_daily_report`、`launch_weekly_report`、`launch_openclaw_task` 属于 worker-backed 动作。此前 SoulAction 仅覆盖 `extract_tasks` 和 `update_persona_snapshot` 两种。

### 决策
将 3 种 worker-backed 动作正式纳入 SoulAction 治理体系：
- 在 `SUPPORTED_SOUL_ACTION_KINDS` 中新增 `launch_daily_report` / `launch_weekly_report` / `launch_openclaw_task`
- 扩展 `deriveSoulActionKindFromWorkerTask` 和 `buildWorkerTaskRequestFromSoulAction` 双向映射
- 在 `shared/soulActionTypes.ts` 中添加中文标签

### 理由
- 蓝图 v1.0 明确要求这 3 种动作进入治理体系
- worker 执行链路已完整支持这 3 种任务类型
- 纳入后可在 Web 治理面板中统一管理所有动作

### 影响
- SoulAction 覆盖面从 5 种扩展到 8 种 actionKind
- Web 治理面板新增 actionKind 筛选器和 worker-backed badge
- `cognitiveAnalyzer.ts` 中的 `VALID_ACTION_KINDS` 仍为硬编码的 2 种，未自动跟随扩展（有意限制 AI 可建议的范围）

---

## ADR-011: 采用 systemd user services 管理 LifeOS 部署

**日期**: 2026-03-24
**状态**: 已采纳 ✅

### 背景
此前部署使用 `nohup` + `pkill` 方式管理进程，存在进程丢失、日志散落、无自动重启等问题。

### 决策
采用 systemd user services 管理 LifeOS 服务：
- `lifeos-server.service` — 后端（`pnpm dev`，端口 3000）
- `lifeos-web.service` — 前端（`pnpm dev --host`，端口 5173）

### 理由
- systemd 提供进程崩溃自动重启（`Restart=on-failure`）
- `journalctl` 提供集中式日志管理
- `loginctl enable-linger` 确保服务在用户登出后持续运行
- `deploy.sh` 自动检测 systemd 服务，提供 nohup 降级兜底

### 影响
- 首次部署需执行 `./scripts/install-services.sh`
- 后续部署使用 `./scripts/deploy.sh --build --restart`
- 日志通过 `journalctl --user -u lifeos-server -f` 查看

