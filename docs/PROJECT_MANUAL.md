# LifeOnline 项目说明书（测试用）

> 更新日期：2026-03-25
> 版本：v1.0

本文档对 LifeOnline 项目各条功能线进行详细解说，方便进行系统性测试。

---

## 一、项目总览

LifeOnline 是一个以 **Obsidian Vault 为唯一事实源** 的个人生命操作系统，采用四层架构：

| 层 | 组件 | 职责 |
|----|------|------|
| 输入层 | LingGuangCatcher (Android) | 语音/拍照/链接采集，写入 `_Inbox/` |
| 存储层 | Vault_OS (Obsidian Vault) | 持久化、同步、版本控制 |
| 处理层 | LifeOS Backend (Node.js) | 索引、任务编排、调度、AI、写回 |
| 展示层 | LifeOS Web (Vue 3) | Dashboard、看板、治理控制台 |

**仓库结构：**
```
LifeOnline/
├── LifeOS/              # 控制核心 (pnpm monorepo)
│   ├── packages/server/  # 后端：API + 索引 + Worker + Soul
│   ├── packages/web/     # 前端：Vue 3 控制台
│   └── packages/shared/  # 共享类型与协议
├── LingGuangCatcher/     # Android 输入端
├── architecture/         # 系统架构文档
├── protocols/            # Frontmatter/维度/命名协议
├── vision/               # 愿景文档 + 教育书
└── decisions/            # 架构决策记录
```

---

## 二、功能线 1：输入采集（LingGuangCatcher）

### 2.1 定位
Android 端输入应用，只负责 **采集与落盘**，不承担编排职责。

### 2.2 核心功能

| 功能 | 说明 | 测试要点 |
|------|------|----------|
| 语音闪念 | 录音 → STT → AI 结构化 → Markdown | 录音→识别→生成笔记完整链路 |
| 拍照采集 | CameraX 拍照 → 透视裁切 → AI 多模态提取 | 拍照→裁切→内容提取 |
| 链接采集 | 分享链接 → AI 内容摘要 | 从浏览器分享链接测试 |
| 离线队列 | WorkManager 后台重试 + Room 本地缓存 | 断网采集→恢复后同步 |
| SAF 写入 | 通过 Storage Access Framework 写入 Vault | 验证文件写入 `_Inbox/` 目录 |
| 浮动气泡 | FloatingBubbleService 快速入口 | 任何界面一键唤起录音 |
| 快捷磁贴 | LingGuangTileService 系统快捷方式 | 下拉通知栏快速启动 |

### 2.3 AI 服务集成

| 服务 | 文件 | 用途 |
|------|------|------|
| Gemini STT | `GeminiSTTService.kt` | 语音转文字 |
| OpenAI Whisper | `OpenAIWhisperService.kt` | 语音转文字（备选） |
| DashScope | `DashScopeAIService.kt` | AI 内容结构化 |
| Gemini AI | `GeminiAIService.kt` | AI 内容结构化 |
| OpenAI | `OpenAIAIService.kt` | AI 内容结构化 |
| Cloudflare R2 | `CloudflareR2Service.kt` | 图片上传存储 |

### 2.4 移动端治理功能

| 功能 | 文件 | 说明 |
|------|------|------|
| 治理审批 | `GovernanceActivity.kt` | 移动端审批 SoulAction |
| 脑暴查看 | `BrainstormActivity.kt` | 查看认知提炼结果 |
| 日历集成 | `CalendarActivity.kt` | 日历事件查看 |
| 洞察报告 | `InsightsActivity.kt` | 查看系统洞察 |
| 执行通知 | `ExecutionNotificationReceiver.kt` | 物理动作执行通知 |
| LifeOS 连接 | `LifeOSService.kt` + `LifeOSWsClient.kt` | REST + WebSocket 双通道 |

### 2.5 测试场景

1. **语音采集全链路**：打开 App → 录音 → 查看 STT 识别结果 → AI 结构化 → 确认写入
2. **拍照采集全链路**：拍照 → 透视矫正 → AI 提取内容 → 生成 Markdown
3. **离线→在线同步**：断网录入 → 恢复网络 → 验证后台自动同步
4. **Frontmatter 合规性**：检查产出文件的 `type`, `dimension`, `source`, `created` 等必填字段
5. **文件命名规范**：格式 `{source}_{type}_{YYYY-MM-DD}_{HHmmss}.md`

---

## 三、功能线 2：Vault 索引与实时同步

### 3.1 核心模块

| 模块 | 文件 | 职责 |
|------|------|------|
| 文件监听 | `watcher/fileWatcher.ts` | chokidar 监听 Vault 文件变更 |
| 索引器 | `indexer/indexer.ts` | 解析 Markdown + Frontmatter → 写入 SQLite |
| 解析器 | `indexer/parser.ts` | YAML Frontmatter 解析 |
| 扫描器 | `indexer/scanner.ts` | 全量扫描 Vault 目录 |
| 索引队列 | `indexer/indexQueue.ts` | 去抖 + 批量索引任务队列 |

### 3.2 数据流

```
Vault 文件变更 → chokidar 监听 → 去抖(300ms) → 解析 Frontmatter → SQLite 更新 → WebSocket 推送前端
```

### 3.3 测试场景

1. **自动索引**：在 Vault 中新建/修改/删除 `.md` 文件 → 验证 SQLite 数据同步更新
2. **手动触发**：`POST /api/index` → 验证全量重建索引
3. **索引状态**：`GET /api/index/status` → 查看当前索引状态
4. **索引错误**：`GET /api/index/errors` → 查看解析失败的文件列表
5. **WebSocket 推送**：文件变更后前端实时刷新验证

---

## 四、功能线 3：笔记 CRUD 与 Vault 双向写回

### 4.1 API 端点

| 操作 | 端点 | 说明 |
|------|------|------|
| 查询列表 | `GET /api/notes` | 支持维度/状态/类型/日期范围过滤 |
| 查询详情 | `GET /api/notes/:id` | 含完整 Frontmatter + 正文 |
| 创建笔记 | `POST /api/notes` | 从 Web 控制台创建，`source: web` |
| 更新笔记 | `PATCH /api/notes/:id` | 修改 Frontmatter 字段 |
| 追加备注 | `POST /api/notes/:id/append` | 在正文末尾追加内容 |
| 删除笔记 | `DELETE /api/notes/:id` | 删除 Vault 中的文件 |

### 4.2 Frontmatter 协议

**必填字段：**
| 字段 | 类型 | 值域 |
|------|------|------|
| `type` | enum | `schedule` `task` `note` `record` `milestone` `review` |
| `dimension` | enum | `health` `career` `finance` `learning` `relationship` `life` `hobby` `growth` `_inbox` |
| `status` | enum | `pending` `in_progress` `done` `cancelled` |
| `privacy` | enum | `public` `private` `sensitive` |
| `date` | date | `YYYY-MM-DD` |
| `source` | enum | `lingguang` `desktop` `webclipper` `openclaw` `web` `auto` |
| `created` | datetime | `YYYY-MM-DDTHH:mm` |

### 4.3 测试场景

1. **CRUD 全流程**：创建 → 查询 → 修改状态 → 追加备注 → 删除
2. **写回验证**：API 修改后检查 Vault 中实际 `.md` 文件内容
3. **重索引触发**：写回后验证触发了自动重索引
4. **八维度过滤**：逐一切换维度视图确认筛选正确

---

## 五、功能线 4：Worker Task 任务引擎

### 5.1 架构定位

所有后台自动化能力统一抽象为 **Worker Task** 模型。Schedule 只负责触发，不负责执行。

### 5.2 任务类型与执行器

| 任务类型 | 执行器文件 | 功能 |
|----------|-----------|------|
| `classify_inbox` | `classifyInboxExecutor.ts` | AI 自动分类 `_Inbox` 条目到八维度 |
| `summarize_note` | `summarizeNoteExecutor.ts` | AI 生成笔记摘要 |
| `extract_tasks` | `extractTasksExecutor.ts` | AI 从笔记中提取待办任务 |
| `daily_report` | `reportExecutors.ts` | 生成每日报告 |
| `weekly_report` | `reportExecutors.ts` | 生成每周报告 |
| `openclaw_task` | `openclawExecutor.ts` | 调用 OpenClaw 执行外部任务 |
| `persona_snapshot` | `personaSnapshotExecutor.ts` | 生成人格快照分析 |
| `physical_action` | `physicalActionExecutor.ts` | 执行物理动作（真实世界任务）|

### 5.3 API 端点

| 操作 | 端点 |
|------|------|
| 创建任务 | `POST /api/worker-tasks` |
| 任务列表 | `GET /api/worker-tasks` |
| 任务详情 | `GET /api/worker-tasks/:id` |
| 重试任务 | `POST /api/worker-tasks/:id/retry` |
| 取消任务 | `POST /api/worker-tasks/:id/cancel` |
| 清除已完成 | `DELETE /api/worker-tasks/finished` |

### 5.4 测试场景

1. **创建并执行**：创建各类型任务 → 验证执行器启动 → 结果写回 Vault
2. **重试机制**：故意造成失败 → 重试 → 验证恢复执行
3. **取消任务**：执行中取消 → 验证状态变更
4. **Inbox 自动分类**：`_Inbox` 有新笔记 → `classify_inbox` → 验证维度归类
5. **日报/周报生成**：触发报告任务 → 验证报告文件生成到 Vault

---

## 六、功能线 5：Schedule 定时调度

### 6.1 API 端点

| 操作 | 端点 |
|------|------|
| 创建调度 | `POST /api/schedules` |
| 调度列表 | `GET /api/schedules` |
| 调度详情 | `GET /api/schedules/:id` |
| 更新调度 | `PATCH /api/schedules/:id` |
| 删除调度 | `DELETE /api/schedules/:id` |
| 立即运行 | `POST /api/schedules/:id/run` |
| 健康检查 | `GET /api/schedules/health` |

### 6.2 测试场景

1. **创建定时任务**：设置 cron → 验证到点触发 Worker Task
2. **立即运行**：手动 `run` → 验证即时创建并执行任务
3. **调度健康**：检查调度器运行状态
4. **更新/删除**：修改 cron → 验证新调度生效；删除 → 验证停止触发

---

## 七、功能线 6：Soul 认知引擎（核心）

Soul 是 LifeOnline 的认知层，实现了从 "笔记输入" 到 "智能决策" 的全链路。

### 7.1 五大认知对象

| 认知对象 | 模块 | 说明 |
|----------|------|------|
| Brainstorm Sessions | `soul/brainstormSessions.ts` | 认知提炼会话，分析笔记主题/情绪/问题 |
| Soul Actions | `soul/soulActions.ts` | AI 推算的智能任务建议 |
| Reintegration Records | `soul/reintegrationRecords.ts` | 执行结果待确认回流记录 |
| Event Nodes | `soul/eventNodes.ts` | 时间轴事件节点 |
| Continuity Records | `soul/continuityRecords.ts` | 连续性记录（习惯/趋势追踪） |

### 7.2 认知流水线

```
新笔记索引 → postIndexPersonaTrigger → Brainstorm Session 创建
    → 主题/情绪/问题提取 → SoulAction 生成建议
    → 人工治理(approve/reject) → SoulAction Dispatcher 派发执行
    → Worker Task 执行 → Reintegration 结果回流
    → 用户确认 → 写回 Vault
```

### 7.3 SoulAction 治理

| API | 说明 |
|-----|------|
| `GET /api/soul-actions` | 列表（支持 governanceStatus/executionStatus 过滤） |
| `GET /api/soul-actions/:id` | 详情 |
| `POST /api/soul-actions/:id/approve` | 批准执行 |
| `POST /api/soul-actions/:id/dispatch` | 手动派发 |
| `POST /api/soul-actions/:id/defer` | 延期处理 |
| `POST /api/soul-actions/:id/discard` | 丢弃 |
| `POST /api/soul-actions/:id/answer` | 回答追问 |

### 7.4 干预门控 & 学习

| 模块 | 文件 | 说明 |
|------|------|------|
| 干预门控 | `interventionGate.ts` | 高风险动作自动拦截 |
| 门控学习 | `gateLearning.ts` | 从用户审批历史学习偏好 |
| 审批门 | `integrations/approvalGate.ts` | 物理动作审批控制 |
| 熔断器 | `integrations/circuitBreaker.ts` | 异常频率自动熔断 |

### 7.5 物理动作系统

| API | 说明 |
|-----|------|
| `GET /api/physical-actions` | 物理动作列表 |
| `GET /api/physical-actions/:id` | 动作详情 |
| `GET /api/physical-actions/:id/conflicts` | 日历冲突检测 |
| `POST /api/physical-actions/:id/approve` | 批准执行 |
| `POST /api/physical-actions/:id/reject` | 拒绝执行 |

### 7.6 DAG 执行器

`soul/dagExecutor.ts` — 支持多步骤物理动作的有向无环图(DAG)执行：
- 拓扑排序确定执行顺序
- 支持依赖链、并行执行
- 部分失败追踪与恢复

### 7.7 Reintegration（结果回流）

| API | 说明 |
|-----|------|
| `GET /api/reintegration-records` | 待确认记录列表 |
| `POST /api/reintegration-records/:id/accept` | 接受回流 |
| `POST /api/reintegration-records/:id/reject` | 拒绝回流 |
| `POST /api/reintegration-records/:id/plan-promotions` | 规划晋升 |

### 7.8 测试场景

1. **认知提炼**：新建笔记 → 验证自动创建 Brainstorm Session → 检查主题/情绪/问题提取
2. **SoulAction 生成**：Brainstorm 完成后 → 验证生成建议动作
3. **治理流程**：SoulAction pending → approve → dispatch → 验证 Worker Task 创建
4. **拒绝流程**：SoulAction → reject → 验证不执行
5. **延期与追问**：defer → 验证延期；answer 回答追问后继续
6. **物理动作审批**：生成物理动作 → 日历冲突检测 → 审批/拒绝
7. **DAG 执行**：多步骤任务 → 验证拓扑排序 → 逐步执行 → 部分失败处理
8. **回流确认**：执行完成 → Reintegration 记录 → accept/reject → 验证 Vault 写回
9. **熔断器**：连续失败 → 验证自动熔断 → 恢复后解除
10. **门控学习**：多次审批同类 → 验证学习到偏好

---

## 八、功能线 7：AI 能力层

### 8.1 模块

| 模块 | 文件 | 说明 |
|------|------|------|
| AI 客户端 | `ai/aiClient.ts` | 统一 AI API 调用 |
| 分类器 | `ai/classifier.ts` | 笔记维度分类 |
| 嵌入向量 | `ai/embedding.ts` | 文本向量化 |
| Prompt 管理 | `ai/promptService.ts` + `prompts.ts` | 可配置提示词模板 |
| Provider 配置 | `ai/providerConfigService.ts` | AI 提供商配置管理 |
| 建议引擎 | `ai/suggestions.ts` | AI 智能建议 |
| 任务提取 | `ai/taskExtractor.ts` | 从文本提取任务 |
| 用量追踪 | `ai/usageTracker.ts` | Token/成本追踪 |

### 8.2 API 端点

| 端点 | 说明 |
|------|------|
| `GET /api/ai/prompts` | 列出所有 Prompt 模板 |
| `PATCH /api/ai/prompts/:key` | 更新指定 Prompt |
| `DELETE /api/ai/prompts/:key` | 重置为默认 Prompt |
| `GET /api/ai/provider` | 获取当前 AI 提供商配置 |
| `PATCH /api/ai/provider` | 修改 AI 提供商 |
| `POST /api/ai/provider/test` | 测试 AI 连通性 |
| `GET /api/ai/suggestions` | 获取 AI 建议 |
| `GET /api/ai-usage` | 获取 AI 用量统计 |
| `GET /api/long-term-memory` | 获取长期记忆 |
| `GET /api/insights-report` | 获取洞察报告 |

### 8.3 搜索能力

| 端点 | 说明 |
|------|------|
| `GET /api/search` | 传统全文搜索 |
| `GET /api/semantic-search` | 语义向量搜索 |
| `GET /api/vector-search` | 向量搜索（兼容别名） |
| `GET /api/hybrid-search` | 混合搜索（全文 + 语义） |

### 8.4 测试场景

1. **AI Provider 配置**：配置 → 测试连通 → 验证 AI 调用
2. **Prompt 管理**：修改 Prompt → 验证 AI 输出变化 → 重置默认
3. **语义搜索**：同一主题不同措辞 → 验证语义匹配
4. **混合搜索**：对比全文/语义/混合结果差异
5. **用量统计**：执行多次 AI 调用 → 验证用量记录

---

## 九、功能线 8：Web 控制台

### 9.1 页面路由

| 路由 | 视图 | 说明 |
|------|------|------|
| `/` | DashboardView | 首页仪表盘 |
| `/timeline` | TimelineView | 时间线视图 |
| `/calendar` | CalendarView | 日历视图 |
| `/inbox` | DimensionView | 收件箱(Inbox)视图 |
| `/dimension/:dimension` | DimensionView | 八维度视图 |
| `/search` | SearchView | 搜索页面 |
| `/stats` | StatsView | 统计分析 |
| `/governance` | GovernanceView | 治理控制台 |
| `/governance/soul-action/:id` | SoulActionDetailView | SoulAction 详情 |
| `/ops` | OpsView | 运维面板 |
| `/events` | EventsView | 事件管理 |
| `/settings` | SettingsView | 系统设置 |
| `/insights` | InsightsFeedView | 洞察 Feed |
| `/automation-audit` | AutomationAuditView | 自动化审计 |

### 9.2 核心组件

| 组件 | 说明 |
|------|------|
| `DashboardOverview.vue` | 仪表盘概览（维度健康、待办、认知雷达） |
| `CognitiveRadar.vue` | 认知雷达图 |
| `TodayTodos.vue` | 今日待办列表 |
| `WeeklyHighlights.vue` | 本周亮点 |
| `NoteList.vue` / `NoteDetail.vue` / `NotePreview.vue` | 笔记列表/详情/预览 |
| `CreateNoteFab.vue` | 快速创建笔记按钮 |
| `TimelineTrack.vue` | 时间线轨道 |
| `CalendarGrid.vue` | 日历网格 |
| `FilterBar.vue` | 通用筛选栏 |
| `SearchBar.vue` | 搜索栏 |
| `DimensionHealth.vue` / `DimensionCharts.vue` / `DimensionStats.vue` | 维度健康/图表/统计 |
| `GovernanceCard.vue` | 治理审批卡片 |
| `SoulActionGovernancePanel.vue` | SoulAction 治理面板 |
| `PhysicalActionCard.vue` | 物理动作卡片 |
| `ReintegrationReviewPanel.vue` | 回流审核面板 |
| `BrainstormSessionPanel.vue` | 脑暴会话面板 |
| `WorkerTaskPanel.vue` / `WorkerTaskCard.vue` / `WorkerTaskDetail.vue` | 任务面板/卡片/详情 |
| `SchedulePanel.vue` | 调度管理面板 |
| `AISuggestions.vue` / `AICostPanel.vue` | AI 建议 / AI 成本面板 |
| `RelatedInsights.vue` | 关联洞察 |
| `PromotionProjectionPanel.vue` | 晋升投影面板 |
| `VoiceCapture.vue` | 语音录入 |
| `SwipeStack.vue` | 滑动卡片堆栈 |
| `CommandPalette.vue` | 命令面板（快捷操作） |
| `LockScreen.vue` | 锁屏 |
| `OnboardingGuide.vue` | 新手引导 |
| `NotificationToast.vue` | 通知提示 |
| `AutomationLivePanel.vue` | 自动化实时面板 |
| `DryRunPreview.vue` | 干跑预览 |

### 9.3 测试场景

1. **Dashboard**：访问首页 → 验证维度健康度、待办列表、认知雷达加载正确
2. **笔记浏览**：列表 → 详情 → 编辑 → 追加备注 → 完整 CRUD 流程
3. **维度切换**：逐一访问八维度 + Inbox → 验证数据筛选
4. **时间线**：查看 Timeline → 验证按时间排列的事件流
5. **日历**：查看月历 → 验证日期笔记映射
6. **搜索**：关键词搜索 → 验证结果准确
7. **统计**：趋势/雷达/月度/标签 四个维度统计验证
8. **设置**：AI Provider / Prompt / Schedule 配置测试
9. **治理页面**：SoulAction 列表 → 审批/拒绝/延期 → 状态变更验证
10. **实时推送**：后台变更 → 验证 WebSocket 推送前端刷新
11. **命令面板**：快捷键唤起 → 执行常用操作

---

## 十、功能线 9：外部集成

### 10.1 集成模块

| 模块 | 文件 | 说明 |
|------|------|------|
| OpenClaw 客户端 | `integrations/openclawClient.ts` | 外部执行器调用 |
| 执行引擎 | `integrations/executionEngine.ts` | 统一执行调度 |
| 执行归档 | `integrations/executionArchiver.ts` | 执行记录存档 |
| 日历协议 | `integrations/calendarProtocol.ts` | 日历事件协议转换 |
| Google OAuth | 集成 Google 认证 + 日历 | 外部日历同步 |
| 凭证存储 | `integrations/credentialStore.ts` | 安全凭证管理 |
| 熔断器 | `integrations/circuitBreaker.ts` | 调用失败熔断保护 |
| 洞察引擎 | `integrations/insightEngine.ts` | 集成洞察分析 |
| R2 云存储 | `infra/r2Client.ts` | Cloudflare R2 存储 |

### 10.5 关键外部基建依赖
* **OpenClaw (AI Agent 智能体)**
  * **主页**: [https://openclaw.ai/](https://openclaw.ai/)
  * **源码**: [https://github.com/openclaw/openclaw](https://github.com/openclaw/openclaw)
  * **职责**: 为 LifeOS 代理执行长耗时、需物理环境或浏览器控制权限的复杂外部任务。

### 10.2 API 端点

| 端点 | 说明 |
|------|------|
| `GET /api/integrations/status` | 集成状态概览 |
| `GET /api/integrations/insights` | 集成洞察 |
| `GET /api/integrations/google/auth` | Google OAuth 认证 |
| `GET /api/integrations/google/callback` | OAuth 回调 |
| `GET /api/integrations/google/calendar/events` | Google 日历事件 |

### 10.3 洞察引擎

| 端点 | 说明 |
|------|------|
| `GET /api/insight/stats` | 洞察统计 |
| `GET /api/insight/failed-actions` | 失败动作分析 |
| `GET /api/insight/top-failing-types` | 高频失败类型 |
| `GET /api/insight/breaker-states` | 熔断器状态 |

### 10.4 测试场景

1. **集成状态检查**：`GET /api/integrations/status` → 验证各集成健康度
2. **Google 日历**：OAuth 认证 → 拉取日历 → 冲突检测
3. **OpenClaw 调用**：创建 openclaw_task → 验证调用与结果回收
4. **熔断器**：模拟 OpenClaw 连续失败 → 验证自动熔断 → 恢复验证

---

## 十一、功能线 10：数据库与持久化

### 11.1 SQLite 数据库

| 文件 | 说明 |
|------|------|
| `db/schema.ts` | 表结构定义 |
| `db/migrations.ts` | 数据库迁移脚本 |
| `db/client.ts` | 数据库连接客户端 |
| `db/vectorStore.ts` | 向量存储（嵌入索引） |
| `db/hybridSearch.ts` | 混合搜索引擎 |

### 11.2 数据边界

| 表 | 语义 |
|----|------|
| `notes` | Vault 索引视图（可重建） |
| `worker_tasks` | 运行态真相 |
| `task_schedules` | 运行态真相 |
| `ai_provider_settings` | 运行态真相 |
| `ai_prompts` | 运行态真相 |
| 认知对象表 | Soul 认知对象持久化 |

### 11.3 测试场景

1. **索引重建**：删除 SQLite 后 `POST /api/index` → 验证从 Vault 完整重建
2. **迁移完整性**：从空数据库启动 → 验证所有迁移执行
3. **向量搜索准确性**：插入已知文档 → 语义搜索 → 验证相似度排序

---

## 十二、功能线 11：WebSocket 实时通信

### 12.1 机制

- 路径: `/ws`
- Vault 文件变更 → 索引更新 → WebSocket 推送
- Web 前端接收推送自动刷新

### 12.2 测试场景

1. **连接建立**：打开 Web → 验证 WebSocket 连接成功
2. **实时推送**：修改 Vault 文件 → 验证前端即时刷新
3. **断线重连**：断开网络 → 恢复 → 验证自动重连

---

## 十三、功能线 12：Persona 人格快照

### 13.1 机制

- 笔记索引后触发 `postIndexPersonaTrigger`
- 分析用户行为模式、关注点、情绪倾向
- 生成 Persona Snapshot

### 13.2 API

| 端点 | 说明 |
|------|------|
| `GET /api/persona-snapshots/:sourceNoteId` | 获取某篇笔记关联的人格快照 |
| `GET /api/cognitive-health` | 认知健康总览（含所有认知对象统计） |

### 13.3 测试场景

1. 创建多篇具有相同主题的笔记 → 查看 Persona Snapshot 是否正确归纳

---

## 十四、功能线 13：八维度体系

### 14.1 维度列表

| 维度 | Key | 色相 | 语义 |
|------|-----|------|------|
| 🏃 健康 | `health` | 绿 | 运动、睡眠、饮食 |
| 💼 事业 | `career` | 蓝 | 工作、项目、职业规划 |
| 💰 财务 | `finance` | 金 | 收支、投资、资产 |
| 📚 学习 | `learning` | 紫 | 阅读、课程、知识 |
| 🤝 关系 | `relationship` | 红 | 家人、朋友、人脉 |
| 🏠 生活 | `life` | 青 | 家务、购物、出行 |
| 🎨 兴趣 | `hobby` | 橙 | 爱好、创作、娱乐 |
| 🌱 成长 | `growth` | 亮绿 | 目标、习惯、里程碑 |

### 14.2 健康度公式

```
健康度 = (done / total) × 100%
```

### 14.3 测试场景

1. **统计 API**：`GET /api/stats/radar` → 验证八维度雷达图数据
2. **趋势**：`GET /api/stats/trend` → 验证时间趋势
3. **月度**：`GET /api/stats/monthly` → 验证月度统计
4. **标签**：`GET /api/stats/tags` → 验证标签云数据

---

## 十五、运行与部署

### 15.1 开发环境启动

```bash
cd LifeOS
nvm use          # Node.js 20.x
pnpm install --frozen-lockfile
pnpm check       # build → test → smoke 全链路验证
pnpm dev         # 启动 server(3000) + web(5173)
```

### 15.2 关键端口

| 服务 | 端口 |
|------|------|
| Backend API | `3000` |
| Web 控制台 | `5173` |
| WebSocket | `3000/ws` |

### 15.3 运行主机

| 角色 | 地址 | 职责 |
|------|------|------|
| 运行主机 | `192.168.31.246` | 主 Vault + LifeOS 运行 + OpenClaw |
| 开发机 | 当前电脑 | 开发、构建、同步 |

### 15.4 健康检查

| 端点 | 说明 |
|------|------|
| `GET /api/health` | 系统健康检查 |
| `GET /api/config` | 配置信息 |

### 15.5 当前本机运行方式（2026-03-28 更新）

当前 246 就是本机，LifeOS 采用 `systemd --user` 常驻运行：

| 服务 | systemd unit | 工作目录 | 启动命令 | 默认端口 |
|------|--------------|----------|----------|----------|
| LifeOS Backend | `lifeos-server.service` | `LifeOS/packages/server` | `pnpm start` | `3000` |
| LifeOS Web | `lifeos-web.service` | `LifeOS/packages/web` | `pnpm dev --host` | `5173` |

后端通过 `services/lifeos-server.service` 加载 `LifeOS/packages/server/.env.production`，当前主要用于注入 `VAULT_PATH=/home/xionglei/Vault_OS`。

### 15.6 Web 访问、代理与 Tunnel 说明

#### Web 入口
- 本机/LAN 入口：`http://192.168.31.246:5173`
- Tunnel 域名入口：`https://os.xionglei.online`

#### Web → Backend 代理
Web 前端代码使用相对路径：
- API：`/api`
- WebSocket：`/ws`

这些请求由 Vite dev server 代理到后端。当前默认策略是：
- 默认代理目标：`localhost:3000`
- 可通过 `LifeOS/packages/web/.env.production` 覆盖：
  - `LIFEOS_API_HOST`
  - `LIFEOS_API_PORT`

这意味着：
- 浏览器可以通过域名或 IP 打开前端页面
- 但前端代理到后端时，默认走本机 `localhost:3000`
- 不再依赖历史上的默认 IP `192.168.31.246:3000`

#### Web systemd 环境文件
`services/lifeos-web.service` 现已支持加载：
- `LifeOS/packages/web/.env.production`

示例见：
- `LifeOS/packages/web/.env.example`

本机模式示例：
```env
LIFEOS_API_HOST=localhost
LIFEOS_API_PORT=3000
```

如需切换到显式 LAN/Tunnel 目标，再通过该文件覆盖即可。

### 15.7 Cloudflare Tunnel 访问注意事项

- `os.xionglei.online` 用于暴露 Web 前端。
- 如果要给后端单独配域名，手机端必须使用 `https://...`，不能用 `http://...` 访问 Cloudflare Tunnel 提供的 HTTPS 入口。
- 域名应使用标准主机名，优先使用 `lifeos-server.xionglei.online` 这种连字符形式，不要使用带下划线 `_` 的主机名。
- 如果手机端目标是稳定优先、且处于局域网内，直接使用 `http://192.168.31.246:3000` 仍然是最稳妥的方案。

### 15.8 运维速查

#### 常见入口
- Web（Tunnel）：`https://os.xionglei.online`
- Web（LAN）：`http://192.168.31.246:5173`
- Backend（LAN）：`http://192.168.31.246:3000`
- 健康检查：`http://127.0.0.1:3000/api/health`

#### systemd 服务
```bash
systemctl --user status lifeos-server lifeos-web --no-pager
journalctl --user -u lifeos-server -f
journalctl --user -u lifeos-web -f
systemctl --user restart lifeos-server lifeos-web
```

#### 当前默认代理规则
- 浏览器访问前端页面时，可使用域名或 IP。
- Vite 代理后端时，默认走 `localhost:3000`。
- 如需改为显式 IP / 域名，在 `LifeOS/packages/web/.env.production` 中覆盖：
  - `LIFEOS_API_HOST`
  - `LIFEOS_API_PORT`

#### 手机端建议
- 局域网稳定优先：`http://192.168.31.246:3000`
- 若走 Cloudflare Tunnel：使用 `https://...` 域名，不要使用 `http://...`

---

## 十六、完整 API 端点汇总

共计 **63 个 API 端点**，按功能域分组：

| 域 | 端点数 | 说明 |
|----|--------|------|
| 笔记 CRUD | 6 | 创建/查询/修改/追加/删除 |
| Dashboard & Views | 4 | dashboard/timeline/calendar |
| 索引 & 配置 | 5 | index/config |
| Worker Tasks | 6 | CRUD + 重试/取消/清除 |
| Schedules | 7 | CRUD + 运行/健康 |
| Soul Actions | 7 | 列表/详情/审批/派发/延期/丢弃/追问 |
| Brainstorm | 3 | 列表/详情/关联 |
| Reintegration | 4 | 列表/接受/拒绝/晋升规划 |
| Physical Actions | 5 | 列表/详情/冲突/审批/拒绝 |
| AI | 9 | prompts/provider/suggestions/usage/memory/insights |
| 搜索 | 4 | 全文/语义/向量/混合 |
| 集成 | 5 | status/insights/google-auth/callback/calendar |
| 洞察引擎 | 4 | stats/failed/top-failing/breaker |
| 认知对象 | 3 | cognitive-health/event-nodes/continuity-records |
| 系统 | 1 | health |
