# 灵光 APP 组任务书 — Phase 3 采集能力增强

*签发: 架构组 | 日期: 2026-03-17 | 阶段: Phase 3*

---

## 背景

Phase 4 系统联调已通过，全链路（灵光 → Syncthing → OpenClaw → LifeOS）运行正常。现在进入灵光 App 自身能力迭代阶段，重点提升 AI 整理质量和采集能力。

---

## 当前 Prompt 体系分析

### 现状

灵光 App 有三套 AI 服务实现，Prompt 质量差异较大：

| 服务 | Prompt 质量 | 说明 |
|------|------------|------|
| DashScope | ★★★★ | 12 种 VoiceNoteType 各有专属 Prompt，结构化程度高 |
| Gemini/OpenAI | ★★ | 统一简化 Prompt，仅通过 header 区分类型 |

### 已发现的问题

1. **Gemini/OpenAI Prompt 过于简化** — 只有一句 `请将以下语音内容整理为结构化笔记`，缺乏类型专属指令
2. **标签提取不稳定** — AI 返回的标签格式不统一，有时带 `#` 前缀
3. **部分文件 Frontmatter 异常** — Phase 4 联调中发现 2 个文件 `---` 不在首行
4. **灵光端分类泄漏** — 部分文件 dimension 被设为 `growth` 而非 `_inbox`（违反 ADR-003）

---

## 任务清单

### T1: Prompt 统一升级 [P1]

**目标**: 将 DashScope 的高质量 Prompt 体系同步到 Gemini 和 OpenAI 服务

**当前问题**:
- `GeminiAIService.kt` 和 `OpenAIAIService.kt` 使用统一简化 Prompt
- `DashScopeAIService.kt` 有 12 种类型专属 Prompt，效果明显更好

**改造方案**:

1. 提取 DashScope 的 12 种类型 Prompt 为公共常量（建议新建 `PromptTemplates.kt`）
2. 三套 AI 服务共享同一套 Prompt 模板
3. 保留各服务的 API 调用差异，但 Prompt 内容统一

**Prompt 模板结构建议**:
```kotlin
object PromptTemplates {
    fun getPrompt(type: VoiceNoteType, content: String): String
    fun getVisionPrompt(hasInstruction: Boolean, instruction: String?): String
    fun getLinkPrompt(content: String): String
    fun getBrainstormPrompt(segments: List<String>): String
}
```

**关键要求**:
- 所有 Prompt 输出必须为简体中文
- 输出格式为纯 Markdown，不含 Frontmatter（Frontmatter 由 `MarkdownDocument.create()` 统一生成）
- 标签建议以数组形式返回，不带 `#` 前缀

**验收标准**:
- 切换到 Gemini/OpenAI 后，输出质量与 DashScope 一致
- 12 种 VoiceNoteType 各测试 1 条，输出结构化且完整

**涉及文件**:
- `app/src/main/java/com/lingguang/catcher/data/remote/GeminiAIService.kt`
- `app/src/main/java/com/lingguang/catcher/data/remote/OpenAIAIService.kt`
- `app/src/main/java/com/lingguang/catcher/data/remote/DashScopeAIService.kt`
- 新建: `app/src/main/java/com/lingguang/catcher/data/remote/PromptTemplates.kt`

---

### T2: Frontmatter 生成健壮性修复 [P1]

**目标**: 修复已发现的 Frontmatter 异常问题

**问题 1: `---` 不在文件首行**
- Phase 4 联调中 2 个文件被 OpenClaw 跳过（`missing frontmatter start`）
- 排查 `MarkdownDocument.kt` 的 `toMarkdown()` 方法，确保输出以 `---\n` 开头
- 检查是否有 BOM 头、空行、或 AI 返回内容被错误拼接到文件头部

**问题 2: dimension 泄漏**
- 部分文件 `dimension` 被设为 `growth` 而非 `_inbox`
- 根据 ADR-003，灵光端不做维度分类，dimension 固定为 `_inbox`
- 排查 `CaptureRepository.kt` 中是否有逻辑将 dimension 设为非 `_inbox` 值
- 确保 `VoiceNoteType.lifeosDimension` 全部为 `_inbox`（当前已是，但需确认运行时无覆盖）

**问题 3: 标签格式**
- 确保 `tags` 字段输出为 YAML 数组格式 `[tag1, tag2]`
- 确保不带 `#` 前缀
- 检查 `stripFrontmatter()` 中的 `#` 清理逻辑是否覆盖所有路径

**验收标准**:
- 连续采集 10 条笔记（混合语音/拍照/链接），全部通过 Frontmatter 协议校验
- 所有文件 dimension 为 `_inbox`
- 所有文件 `---` 在首行

**涉及文件**:
- `app/src/main/java/com/lingguang/catcher/data/model/MarkdownDocument.kt`
- `app/src/main/java/com/lingguang/catcher/data/repository/CaptureRepository.kt`

---

### T3: YouTube 字幕抓取 [P2]

**目标**: 支持从 YouTube 链接提取字幕并生成结构化笔记

**实现方案**:

1. **链接识别**: 在信息漏斗流程中识别 YouTube URL（`youtube.com/watch?v=` 或 `youtu.be/`）
2. **字幕获取**:
   - 优先使用 YouTube 官方字幕 API（无需认证的自动字幕）
   - 备选: 通过 Jina Reader 获取页面内容（已有能力）
   - 备选: 使用第三方字幕提取服务
3. **AI 整理**: 将字幕文本交给 AI 生成结构化摘要
   - 提取视频主题、关键观点、时间戳标记
   - 输出格式与 LEARNING 类型一致
4. **Frontmatter**:
   ```yaml
   type: note
   dimension: _inbox
   tags: [YouTube, 视频笔记, {视频主题}]
   source: lingguang
   ```

**验收标准**:
- 分享 YouTube 链接到灵光，能生成包含字幕摘要的笔记
- 中英文字幕均支持

**涉及文件**:
- `app/src/main/java/com/lingguang/catcher/data/repository/CaptureRepository.kt`（链接处理流程）
- 新建: YouTube 字幕提取工具类

---

### T4: 长链接深度解析增强 [P2]

**目标**: 提升信息漏斗对复杂网页的解析能力

**当前问题**:
- Jina Reader 对部分网站解析不完整（SPA、需要登录的页面）
- 长文章截断，关键信息丢失

**改造方案**:

1. **分段处理**: 长文章（>5000 字）分段发送给 AI，最后合并摘要
2. **元数据提取增强**:
   - 提取文章标题、作者、发布日期
   - 提取文章内的图片描述
   - 识别文章类型（新闻/教程/论文/产品页）
3. **Fallback 链路优化**:
   - Jina Reader 失败 → 直接 HTTP 获取 HTML → 正则提取正文
   - 增加超时重试（当前 max_retry=3 已有）

**验收标准**:
- 测试 5 个不同类型的长链接（新闻、技术博客、论文、产品页、社交媒体）
- 摘要完整度 ≥ 80%，关键信息无遗漏

**涉及文件**:
- `app/src/main/java/com/lingguang/catcher/data/repository/CaptureRepository.kt`
- `app/src/main/java/com/lingguang/catcher/data/remote/JinaReaderService.kt`（如有）

---

### T5: TileService 快捷面板 [P2]

**目标**: 在 Android 快捷设置面板中添加灵光快捷入口

**实现方案**:

1. 创建 `LingGuangTileService` 继承 `TileService`
2. 点击 Tile 直接打开灵光 App 的语音采集界面
3. 长按 Tile 打开灵光 App 主界面
4. Tile 图标使用灵光 App 的 logo

**Android 配置**:
```xml
<service
    android:name=".service.LingGuangTileService"
    android:icon="@drawable/ic_tile"
    android:label="灵光"
    android:permission="android.permission.BIND_QUICK_SETTINGS_TILE"
    android:exported="true">
    <intent-filter>
        <action android:name="android.service.quicksettings.action.QS_TILE" />
    </intent-filter>
</service>
```

**验收标准**:
- 下拉通知栏，能看到灵光 Tile
- 点击直接进入语音采集
- 不影响现有悬浮气泡功能

---

## 优先级与执行顺序

```
T1 (Prompt 统一升级) + T2 (Frontmatter 修复)  ← 先做，P1
         ↓
T3 (YouTube) / T4 (长链接) / T5 (TileService)  ← 后做，P2，可并行
```

T1 和 T2 直接影响数据质量，建议优先完成。T3/T4/T5 是功能增强，可根据需求灵活安排。

---

## 协议参考

- Frontmatter 协议: `LifeOnline/protocols/frontmatter.md`
- 八维度定义: `LifeOnline/protocols/dimensions.md`
- 文件命名规范: `LifeOnline/protocols/naming.md`
- ADR-003（灵光端不做维度分类）: `LifeOnline/decisions/adr.md`

## 完成后

- 更新 `LifeOnline/components/status.md` 中灵光 App 的版本和状态
- 通知架构组验收
