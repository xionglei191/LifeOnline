# 组件状态总览

*更新: 2026-03-19*

---

## 组件列表

### 1. 灵光 App (LingGuangCatcher)

| 属性 | 值 |
|------|-----|
| **路径** | `/home/xionglei/LifeOnline/LingGuangCatcher` |
| **版本** | V1.56 |
| **状态** | ✅ 可用（Phase 3 已完成 + UX 优化 + 编辑功能修复 + 原文保留增强） |
| **技术栈** | Kotlin, Android, CameraX, Room, WorkManager |
| **最低 SDK** | 26 (Android 8.0) |
| **测试设备** | 一加 ACE2 (Android 13) |

**已完成能力**:
- ✅ 语音闪念（Gemini STT + AI 整理）
- ✅ 视觉萃取（拍照 + 多模态 Vision API）
- ✅ 信息漏斗（链接分享 + Jina Reader）
- ✅ 离线队列（Room + WorkManager）
- ✅ Obsidian 写入（SAF + _Inbox）
- ✅ 标签系统、悬浮气泡、UI 现代化
- ✅ Frontmatter 对齐 LifeOS 协议（V1.46）
- ✅ `_Inbox` 目录名统一（V1.46）
- ✅ VoiceNoteType → type/dimension 映射（V1.46）
- ✅ 文件命名规范 `{source}_{type}_{date}_{time}.md`（V1.46）
- ✅ Prompt 统一升级 — PromptTemplates.kt，三服务共享（V1.48）
- ✅ YouTube 字幕抓取 — 自动识别 YouTube 链接（V1.48）
- ✅ 长链接深度解析 — LinkContentFetcher 分段 + 元数据（V1.48）
- ✅ TileService 快捷面板 — 下拉通知栏直接语音采集（V1.48）
- ✅ 架构简化 — 移除 CustomTag 系统，标签管理交由 Obsidian/LifeOS（V1.49）
- ✅ UX 优化 — 语音捕获后 12 种笔记类型网格选择（V1.50）
- ✅ 原文保留增强 — 文本 / 网页 / 社交链接 / YouTube 回退内容统一沉淀到 Markdown，编辑页支持多种原文区块只读展示（V1.55）
- ✅ Prompt 收紧 — 降低轻提醒、模糊时间表达被误判为正式截止日期/里程碑的风险（V1.55）
- ✅ 社交链接识别增强 — X/Twitter 等社交链接落为“原始帖文”，YouTube 字幕失败时保留回退上下文（V1.55）

**待改造（协议对齐）** — ✅ V1.46 已完成:
- ✅ Frontmatter 对齐 LifeOS 协议
- ✅ `00_Inbox` → `_Inbox` 目录名统一
- ✅ VoiceNoteType → type/dimension 映射
- ✅ 文件命名规范已完成
- ~~⬜ 文件命名规范~~ ✅ 已完成

**接口**:
- 输出: Markdown 文件 → `Vault_OS/_Inbox/`
- 格式: 标准 LifeOnline Frontmatter 协议 v1.0
- AI: Gemini API / OpenAI API / DashScope API

---

### 2. Obsidian (Vault_OS)

| 属性 | 值 |
|------|-----|
| **路径** | `/home/xionglei/Vault_OS` |
| **状态** | ✅ 已建立（Phase 1 完成） |
| **类型** | 外部工具 |

**已完成**:
- ✅ 创建 Vault_OS 目录结构（八维度 + _Inbox + _Daily + _Weekly + _Templates）
- ✅ 配置 LifeOS 指向 Vault_OS（VAULT_PATH 支持）
- ✅ 种子数据创建（9 个文件覆盖 5 个维度）

**待完成**:
- ✅ 配置 Syncthing 多设备同步（v2.0.15，双端已配对）
- ✅ 安装必要 Obsidian 插件（Dataview、Templater、Calendar、Tasks）

---

### 3. OpenClaw (智能管家)

| 属性 | 值 |
|------|-----|
| **安装** | 本机已安装 |
| **状态** | ✅ 已接入，已升级为通用自然语言任务 worker |

**当前定位**:
- ✅ 由 LifeOS 明确发起任务时才调用
- ✅ 作为通用 AI Agent 执行自然语言任务（网络爬取 / API 调用 / 外部工具）
- ✅ 返回结构化结果给 LifeOS，由 LifeOS 落地笔记
- ✅ 保留外部执行与自动化价值
- ❌ 不再作为 `_Inbox` 常驻自动整理主路径
- ❌ 不再直接承担用户最终笔记的主写入路径

**已完成能力（当前可复用）**:
- ✅ 外部执行与集成能力
- ✅ 通用任务执行端点（`/tasks/execute`）
- ✅ 审批机制（批量移动、删除文件、修改 sensitive）
- ✅ 定时任务与日志体系（`~/.openclaw/logs/lifeonline/`）
- ✅ 连续失败告警（3 次阈值）
- ✅ Phase A/B/B.1 相关任务路由、语义门控、回滚与审计能力

**接口**:
- 输入: LifeOS 创建的明确 worker task（自然语言 instruction + 可选 outputDimension）
- 输出: 结构化执行结果（title / summary / content），由 LifeOS 负责落地笔记与索引收敛

---

### 4. LifeOS Web 看板

| 属性 | 值 |
|------|-----|
| **路径** | `/home/xionglei/LifeOnline/LifeOS` |
| **版本** | Phase 12 + Phase 5 + Phase 5.1 + Phase 6 + Phase 6.1 + OpenClaw 通用任务改造完成 |
| **状态** | ✅ 可用（后端接替 OpenClaw 自动化职责完成） |
| **技术栈** | Node.js, TypeScript, Express, Vue 3, SQLite |
| **前端地址** | http://localhost:5173 |
| **后端地址** | http://localhost:3000 |

**已完成能力**:
- ✅ 仪表盘（今日待办、本周重点、八维度健康）
- ✅ 时间线（生命轨道视图 + 悬停预览）
- ✅ 日历（月视图 + 热力图 + 格子内任务显示）
- ✅ 维度详情页（筛选 + 统计）
- ✅ 全文搜索（FTS5 + 快捷键）
- ✅ 实时索引（chokidar + WebSocket）
- ✅ 外部执行任务（LifeOS 编排 + OpenClaw 按需 worker）
- ✅ OpenClaw 通用任务（`openclaw_task`，自然语言指令 + 可选归档维度）
- ✅ worker task 状态机（创建、查询、重试、取消）
- ✅ worker 结果笔记可点击打开
- ✅ AI 整理（分类 + 行动项提取，手动触发备用）
- ✅ 双向操作（状态更新、追加备注、创建笔记）
- ✅ 快捷操作（一键完成、浮动创建）
- ✅ Mission Control 视觉重构
- ✅ 隐私管理（隐私模式 + PIN 锁 + sensitive 加密）
- ✅ `_inbox` 维度支持（索引 + Dashboard 提醒横幅）
- ✅ 移动端适配（平板断点、触摸目标44px、全屏详情页）
- ✅ 动效系统（列表动画、呼吸灯、prefers-reduced-motion）
- ✅ 审批功能（审批界面、状态持久化、新旧格式兼容）
- ✅ 预览增强（时间线/日历悬停预览、智能定位）

**Phase 5 完成项（2026-03-17）**:
- ✅ T1: 移动端适配完善（768-1024px 断点，触摸目标≥44px，NoteDetail 全屏）
- ✅ T2: sensitive 加密（AES-256-GCM 后端 + Web Crypto 前端解密）
- ✅ T3: 动效打磨（列表 stagger 入场、_Inbox 呼吸灯效果）

**Phase 5.1 完成项（2026-03-17）**:
- ✅ 问题 1: 审批功能不可见（审批界面、状态持久化、新旧格式兼容）
- ✅ 问题 2: 本周重点显示优化（显示标题而非文件名）
- ✅ 问题 3: 时间线预览窗口位置（智能定位、悬停预览）
- ✅ 预览功能增强（时间线/日历悬停预览、内容摘要）
- ✅ 日历视图优化（格子内显示任务摘要）

**Phase 6 完成项（2026-03-18）**:
- ✅ 定时任务 summarize_note Bug 修复（隐藏不适用选项）
- ✅ 定时任务"立即执行"按钮（调试便利）
- ✅ 调度失败追踪（consecutive_failures + last_error 列）
- ✅ Dashboard 定时任务健康状态卡片（活跃/异常计数 + 红色警告）
- ✅ 设置页 schedule 列表显示连续失败次数与错误信息

**Phase 6.1 完成项（2026-03-18）**:
- ✅ 新增 3 种 worker task 类型：classify_inbox / daily_report / weekly_report
- ✅ LifeOS 后端直接调用 Claude AI，不再依赖 OpenClaw
- ✅ classify_inbox：读取 _Inbox → AI 分类 → 移动到维度目录 → 提取任务 → 生成分类报告
- ✅ daily_report：SQLite 统计当日数据 → Claude 生成中文日报 → 写入 _Daily/
- ✅ weekly_report：SQLite 统计本周数据 → Claude 生成中文周报 → 写入 _Weekly/
- ✅ frontmatterBuilder 参数化（source / worker / workerTaskType）
- ✅ 数据库 CHECK 约束迁移（自动检测旧约束 → 重建表）
- ✅ 前端定时任务表单支持 4 种任务类型
- ✅ WorkerName 新增 'lifeos'，新任务自动分配 worker

**Phase 6.2 完成项（2026-03-19）**:
- ✅ OpenClaw worker task 从早期的 `collect_trending_news` 升级为通用 `openclaw_task`
- ✅ 输入模型改为自然语言 `instruction` + 可选 `outputDimension`
- ✅ OpenClaw Client 改为调用通用端点 `/tasks/execute`
- ✅ 结果模型统一为 `title / summary / content`
- ✅ LifeOS 负责将通用结果落地为 Markdown 笔记并按维度归档
- ✅ 设置页“外部执行任务”改为通用指令输入框 + 维度选择
- ✅ 定时任务表单支持配置 OpenClaw 通用任务
- ✅ 历史数据库记录自动迁移：早期 `collect_trending_news` → 当前 `openclaw_task`

- ✅ 双向操作（状态更新、追加备注、创建笔记）
- ✅ 快捷操作（一键完成、浮动创建）
- ✅ Mission Control 视觉重构
- ✅ 隐私管理（隐私模式 + PIN 锁）
- ✅ `_inbox` 维度支持（索引 + Dashboard 提醒横幅）
- ✅ configManager 支持 `~/Vault_OS` 路径

**Phase 0 完成项（2026-03-17）**:
- ✅ Vault_OS 目录结构建立
- ✅ 索引器适配 `_inbox` 维度
- ✅ `VAULT_PATH=~/Vault_OS` 环境变量支持
- ✅ 种子数据创建
- ✅ Dashboard _Inbox 提醒横幅
- ✅ AI 职责边界记录（LifeOS 编排主导，OpenClaw 按需 worker）

**待调整**:
- ⬜ 移动端适配

**API**:
- 详见 [LifeOS API 列表](../LifeOS/STATUS.md)
