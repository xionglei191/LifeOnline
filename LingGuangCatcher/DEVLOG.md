# 灵光捕手 - 开发日志

> 记录所有版本的开发过程、技术决策、问题与解决方案。

---

## 版本历史总览

| 版本 | 日期 | 主要内容 |
|------|------|---------|
| V1.0 | 2026-03-14 | 基础架构、分享接收、Mock AI、Obsidian 集成、多模态捕获、离线队列 |
| V1.1-V1.3 | 2026-03-15 | 历史记录、内容编辑、标签管理、透视校正 |
| V1.4 | 2026-03-15 | 链接/文本捕获、R2+STT、自动边缘检测 |
| V1.5 | 2026-03-15 | Gemini STT、语音功能完善 |
| V1.6-V1.11 | 2026-03-15 | 语音捕获增强、标签推荐、快速标签 UI、文字清洗、边缘检测优化 |
| V1.12 | 2026-03-15 | 设置页面 |
| V1.13 | 2026-03-15 | 标签管理重构 |
| V1.14-V1.17 | 2026-03-15 | 悬浮气泡、标签详情、快速标签选择 |
| V1.18-V1.19 | 2026-03-15 | 历史记录增强、语音捕获增强 |
| V1.23-V1.27 | 2026-03-15 | Bug 修复、气泡修复、设置页面重构 |
| V1.28-V1.35 | 2026-03-15 | 移除 BuildConfig 回退、Gemini AI、首次引导、统一后台处理、性能优化 |
| V1.36-V1.39 | 2026-03-15 | UX 增强、稳定性提升、搜索功能增强 |
| V1.40 | 2026-03-15 | UI 现代化改造 |
| V1.41-V1.44 | 2026-03-16 | 字体优化、气泡交互重构、语音识别修复、链接抓取优化 |
| V1.45 | 2026-03-16 | 新增生活/工作笔记类型、标签同步修复 |
| V1.46 | 2026-03-17 | Phase 0 协议对齐：Frontmatter 英文化、_Inbox 目录、文件命名规范、VoiceNoteType 映射 + Vault 选择器 |
| V1.47 | 2026-03-17 | Phase 1.5 真机联调：T1 真机写入验证通过、T2 端到端联调通过、T3 Frontmatter 一致性验证通过 |
| V1.48 | 2026-03-17 | Phase 3 采集能力增强：T1 Prompt 统一升级、T2 Frontmatter 修复、T3 YouTube 字幕、T4 长链接增强、T5 TileService |
| V1.49 | 2026-03-17 | 架构简化：移除 CustomTag 系统，标签管理交由 Obsidian/LifeOS 处理 |
| V1.50 | 2026-03-17 | UX 优化：语音捕获后直接显示 12 种笔记类型网格选择（含显示修复） |

---

## V1.50 (2026-03-17) — UX 优化

**背景**: 用户反馈希望在语音识别完成后，直接看到全部 12 种笔记类型进行选择，而不是"常用 3 个 + 更多 Chip"的方式。

### 改进内容

**UI 重构**:
- 移除"常用 3 个大按钮 + 更多 Chip"的两层结构
- 改为 **LinearLayout 嵌套（4 行 x 3 列）**，直接显示全部 12 种类型
- 每个按钮包含 Emoji + 名称（如"💡 灵感"、"📝 任务"）
- 按钮高度 56dp，字体 13sp，适合快速点击

**显示问题修复**:
- 问题：GridLayout 导致按钮宽度计算错误，文字显示为"..."
- 解决：改用 LinearLayout 嵌套 + `layout_weight="1"` 平均分配宽度
- 优化：减小按钮内边距（`paddingStart/End="2dp"`）
- 优化：移除 Material 按钮默认 inset（`insetLeft/Right="0dp"`）

**代码简化**:
- 移除 `setupQuickTypeButtons()` 方法（不再需要动态设置常用类型）
- 移除 `getTypeFromButton()` 方法
- 简化 `setupNoteTypeSelection()`：直接绑定 12 个按钮的点击事件
- 简化 `updateTypeSelection()`：更新 12 个按钮的选中状态

### 用户体验提升

- **一目了然**：所有类型同时可见，无需滚动或展开
- **快速选择**：点击即选，无需两步操作
- **视觉清晰**：Emoji + 文字完整显示，识别度高
- **布局合理**：4x3 网格，符合手机屏幕比例

---

## V1.49 (2026-03-17) — 架构简化

**背景**: 根据 LifeOnline 整体架构，灵光 App 定位为"快速采集"输入层，标签的真正管理应该在 Obsidian 或 LifeOS 中进行。

### 移除内容

**删除文件**:
- `ui/TagsActivity.kt`
- `ui/TagsActivityNew.kt`
- `ui/TagDetailActivity.kt`
- `data/local/CustomTag.kt`
- `data/local/CustomTagDao.kt`
- `util/SmartTagRecommender.kt`
- `res/layout/activity_tags.xml`
- `res/layout/activity_tags_new.xml`
- `res/layout/activity_tag_detail.xml`
- `res/layout/dialog_edit_tag.xml`
- `res/layout/item_tag.xml`

**数据库变更**:
- 版本升级：v4 → v5
- 移除 `custom_tags` 表
- 移除 `customTagDao()` 方法
- 新增 MIGRATION_4_5（DROP TABLE custom_tags）

**UI 调整**:
- MainActivity：移除标签管理按钮
- EditActivity：移除快速标签选择功能，保留手动输入
- ExportActivity：移除标签导出选项
- VoiceCaptureActivity：移除智能标签推荐，使用最常用类型作为默认

**AndroidManifest**:
- 移除 TagsActivity、TagsActivityNew、TagDetailActivity 注册

### 保留功能

- VoiceNoteType 的 12 种固定类型（灵感、任务、日程等）
- 编辑页面可以手动输入标签（直接写入 Frontmatter）
- 历史记录可以按 VoiceNoteType 筛选

### 设计理念

**标签的三个层次**:
1. **VoiceNoteType 标签**（灵光端）- 语义提示，给 OpenClaw 分类提供线索
2. **Frontmatter tags 字段**（协议层）- 跨组件的标准化标签存储
3. ~~CustomTag 自定义标签~~（已移除）- 本地数据库，不会同步到 Vault

**职责边界**:
- 灵光 App：快速采集 + 基础分类（VoiceNoteType）
- OpenClaw：自动分类 + 标签补充
- Obsidian/LifeOS：标签管理 + 可视化

---

## V1.46 (2026-03-17) — Phase 0 协议对齐

**背景**: 并入 LifeOnline 大组，架构组下发 Phase 0 任务书，要求灵光 App 输出格式与 LifeOS 协议对齐。

### 改造内容

**任务1: MarkdownDocument.kt — Frontmatter 重写**
- 废弃中文 key（时间/来源/标签），改用英文 key（type/dimension/status/priority/privacy/date/tags/source/created）
- `source` 固定为 `lingguang`，`dimension` 默认 `_inbox`，`privacy` 默认 `private`
- 新增 `import java.text.SimpleDateFormat` / `java.util.Date`

**任务2: ObsidianRepository.kt — 目录名统一**
- `writeToInbox`、`updateFile`、`fileExists` 三处 `00_Inbox` 全部改为 `_Inbox`

**任务3: VoiceNoteType.kt — 新增 LifeOS 映射**
- 枚举新增 `lifeosType` 和 `lifeosDimension` 两个属性
- 映射表：TASK→task、SCHEDULE→schedule、GOAL→milestone、CONTACT→record/relationship、LIFE→record/life、WORK→record/career、LEARNING→note/learning、THOUGHT→note/growth，其余→note/_inbox

**任务4: CaptureRepository.kt — 传入新字段**
- `processCaptureRecord`：使用 `noteType.lifeosType`/`lifeosDimension`，tags 去掉 `#` 前缀
- `processCaptureRecordByType`：同上，使用 `VoiceNoteType` 映射属性
- 新增 `getCurrentDate()` 返回 `YYYY-MM-DD`

**任务5: 文件命名规范**
- 新格式：`{source}_{type}_{date}_{HHmmss}.md`（如 `lingguang_note_2026-03-17_110023.md`）
- 图片同名前缀：`lingguang_note_2026-03-17_110023.jpg`

**任务6: AI 服务标签去 # 前缀**
- GeminiAIService、OpenAIAIService、DashScopeAIService 所有 `callTextAPI`/`callChatAPI` 调用中的 tags 去掉 `#` 前缀

### 验收
- ✅ 编译通过（BUILD SUCCESSFUL）
- ✅ Frontmatter 包含所有必填字段
- ✅ 标签不含 `#` 前缀
- ✅ 文件写入 `_Inbox` 目录
- ✅ 文件名符合 `{source}_{type}_{date}_{time}.md` 格式
- ✅ VoiceNoteType 映射正确

---

## V1.0 (2026-03-14)

**开发周期**: 约 8 小时，结对编程（开发者 + Claude Opus 4.6）

### Phase 1: 基础架构

- 创建 Android Kotlin 项目，配置 Gradle、Material Design 3 主题
- 实现 `ShareReceiverActivity`，支持 `text/plain` 和 `text/*` 分享
- 数据模型：`CaptureRecord`、`CaptureType`、`MarkdownDocument`、`AIProcessResult`
- `AIService` 接口 + `MockAIService` 模拟实现
- `CaptureRepository` 统一处理逻辑
- MainActivity：4 个操作按钮 + 结果显示区域

**问题记录**
- `Theme.Translucent.NoTitleBar` 与 `AppCompatActivity` 不兼容 → 创建自定义透明主题
- `lifecycleScope` 在 `finish()` 后被取消 → 改用独立 `CoroutineScope(Dispatchers.Main + SupervisorJob())`

### Phase 2: Obsidian 集成

- `ObsidianRepository`：SAF 选择目录、持久化 URI 权限
- 自动创建 `00_Inbox` 目录，Markdown 文件写入，文件名去重
- MainActivity 集成 Vault 选择和状态显示

### Phase 3: 多模态捕获

- CameraX 集成：Preview + ImageCapture，EXIF 旋转纠正
- DashScope API：qwen-vl-max Vision、qwen-plus 文本、Jina Reader 网页抓取
- 图片文件名与 Markdown 一致，`![[image.jpg]]` 引用
- 相机对焦（点击 FocusMeteringAction）、双指缩放

### Phase 4: 离线队列

- Room 数据库：`CaptureEntity`、`CaptureDao`、状态枚举 PENDING/PROCESSING/SUCCESS/FAILED
- `SyncWorker`：WorkManager 后台任务，最多重试 3 次，自动清理 7 天前成功记录
- 网络恢复自动触发同步，`enqueueUniqueWork` 防重复

---

## V1.1-V1.3 (2026-03-15)

- **历史记录**：`HistoryActivity` + `HistoryAdapter`，按类型/标签筛选，编辑/删除
- **内容编辑**：`EditActivity`，编辑标题/标签/正文，同步 Obsidian
- **标签管理**：`TagsActivity`，显示使用次数，重命名/删除，点击查看相关记录
- **透视校正**：`PerspectiveCropActivity`，四角点拖动，`Matrix.setPolyToPoly` 透视变换
- **数据库迁移**：Room v1→v2，添加 `markdownContent`、`filename`、`title` 字段

---

## V1.4 (2026-03-15)

- 验证链接/文本捕获处理流程
- `CloudflareR2Service`：OkHttp + AWS Signature V4，上传音频生成公网 URL
- `EdgeDetector`：灰度转换 + Sobel 边缘检测 + Douglas-Peucker 简化，查找最大四边形

---

## V1.5 (2026-03-15)

- `GeminiSTTService`：gemini-2.5-flash，支持 base64 音频，免费额度高
- STT 降级策略：Gemini → OpenAI Whisper → DashScope+R2
- 语音识别结果显示 2 秒，强制简体中文输出

---

## V1.6-V1.11 (2026-03-15)

- V1.6：语音捕获增强（时长显示、暂停恢复）
- V1.7：笔记类型选择（10 种 VoiceNoteType）
- V1.8：SmartTagRecommender 智能推荐
- V1.9：快速标签 UI
- V1.10：语音文字清洗
- V1.11：边缘检测优化

---

## V1.12-V1.17 (2026-03-15)

- V1.12：设置页面（API Key、STT、AI、Obsidian 配置）
- V1.13：标签管理重构（`TagsActivityNew`，CRUD + 分组 + 收藏 + 统计）
- V1.14：悬浮气泡（`FloatingBubbleService`，FrameLayout，不能用 MaterialCardView）
- V1.15：标签详情页（`TagDetailActivity`）
- V1.16-V1.17：气泡优化、快速标签选择

---

## V1.18-V1.22 (2026-03-15)

- V1.18：历史记录增强（搜索/排序/批量删除）
- V1.19：语音捕获增强（时长/暂停恢复）
- V1.20：拍照增强（闪光灯/切换/网格）
- V1.21：离线队列优化
- V1.22：数据导出

---

## V1.23-V1.27 (2026-03-15)

- V1.23：Bug 修复（气泡崩溃/多选/导出入口）
- V1.24：气泡布局修复 + STT Mock 回退
- V1.25-V1.26：设置页面状态提示、BuildConfig 状态修复
- V1.27：设置页面重构（API Key 独立分块，移除 Mock）

---

## V1.28-V1.35 (2026-03-15)

- V1.28：彻底移除 BuildConfig 回退，未配置 API Key 直接抛异常
- V1.29：Gemini AI 处理服务实现
- V1.30：首次使用引导
- V1.31：语音捕获队列化（STT/AI 失败时保留音频入离线队列）
- V1.32：头脑风暴会话模式 + 统一后台处理（语音/拍照/头脑风暴提交后立即入队列）
- V1.33：修复队列写入竞态条件（finish 在 IO 完成后）+ WorkPolicy.REPLACE
- V1.34：OpenAI AI 服务 + 文本/链接捕获 + 处理完成通知
- V1.35：SyncWorker 批量并发处理（每批最多 3 条）+ 图片自动压缩（1920x1920, 85%）+ STT 结果持久化缓存（SHA-256）

---

## V1.36-V1.39 (2026-03-15)

- V1.36：队列进度实时显示 + 录音波形可视化（`WaveformView`）+ 快捷摄像头选择
- V1.37：本地崩溃日志（`CrashLogger`，最多 10 个文件）+ 存储空间检查（最小 100MB）+ 网络状态监听（`NetworkMonitor`）
- V1.38：修复头脑风暴转录阻塞主线程，支持转录中直接提交
- V1.39：高级筛选 + 全文搜索 + 搜索历史（`SearchHistoryManager`）

---

## V1.40 (2026-03-15) — UI 现代化改造

- 建立设计系统：`dimens.xml`（8dp 网格）、`typography.xml`、`styles.xml`
- 深色模式色彩：`res/values-night/colors.xml`
- 9 个 Material Design 矢量图标
- 6 个页面过渡动画
- 全面布局重构、无障碍加固

---

## V1.41-V1.44 (2026-03-16)

- V1.41-V1.43：按钮文字和字体优化
- V1.44：
  - 气泡交互重构：点击展开滑动选择，长按 2 秒进入移动模式
  - 气泡视觉升级：多层渐变玻璃质感，暖色系色彩体系
  - 语音识别修复：时长检查（≥1 秒）+ 音量检测（过滤白噪音）
  - 首页显示修复：从数据库读取最新成功记录
  - 编辑同步增强：检测 Obsidian 文件是否存在，用户选择推送或清理
  - 链接抓取优化：Jina AI + 备用直接抓取（Jsoup）

---

## V1.45 (2026-03-16)

- 新增 🏠 生活（LIFE）和 💼 工作（WORK）两种笔记类型
- 修复编辑页面标签未同步到 `custom_tags` 表的问题（保存时自动插入/更新）

---

## 架构说明

### 捕获流程
语音/拍照/头脑风暴确认后立即入离线队列 → `finish()`，`SyncWorker` 后台完成 STT + AI + Obsidian。Activity 不做 AI 处理，只做录音/拍照/STT 预览。

### API 配置
唯一入口为设置页面，BuildConfig 回退已彻底移除（V1.28）。未配置 API Key 直接抛出异常。

### 已知注意事项
- `FloatingBubbleService` 中不能使用 `MaterialCardView`（Service Context 无法加载 Material 主题）
- DashScope STT 需要额外配置 R2（用于上传音频文件）
- 通知需要用户授权（Android 13+），未授权时静默忽略

---

## 开发环境

- 操作系统：Linux 6.17.0
- 测试设备：一加 ACE2（Android 13），设备 ID: 48e821a9
- 构建工具：Gradle 8.2，JDK 17
- 调试：adb, logcat
