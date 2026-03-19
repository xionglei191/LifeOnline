# Phase 0 任务书：Frontmatter 协议对齐

> **签发**: LifeOnline 架构组
> **接收**: 灵光 App 开发组
> **日期**: 2026-03-17
> **关联**: [LifeOnline 统一 Frontmatter 协议](/home/xionglei/LifeOnline/protocols/frontmatter.md)

---

## 背景

灵光 App 作为 LifeOnline 系统的输入端，当前输出的 Markdown 文件的 Frontmatter 格式与 LifeOS 看板不兼容。为实现全系统数据互通，需要对灵光 App 的数据输出进行协议对齐。

**核心问题**:
1. Frontmatter 使用中文 key（`时间/来源/标签`），LifeOS 使用英文 key（`type/dimension/status/date/source`）
2. 缺少 `type`、`dimension`、`status`、`priority`、`privacy` 等核心字段
3. 写入目录名为 `00_Inbox`，LifeOS 约定为 `_Inbox`
4. 文件命名无标准化规范
5. 标签带 `#` 前缀，LifeOS 不带

---

## 改造目标

灵光 App 输出的 Markdown 文件必须满足以下格式，使 LifeOS 索引器可直接解析：

```yaml
---
type: note
dimension: _inbox
status: pending
priority: medium
privacy: private
date: 2026-03-17
tags: [灵感, 语音]
source: lingguang
created: 2026-03-17T11:00
---
```

---

## 改造任务

### 任务 1: 修改 MarkdownDocument.kt 🔴 P0

**文件**: `app/src/main/java/com/lingguang/catcher/data/model/MarkdownDocument.kt`

**当前代码** (`create` 方法，第 23-44 行):
```kotlin
fun create(
    timestamp: String,
    source: String,
    tags: List<String>,
    content: String,
    relatedAssets: List<String> = emptyList(),
    imageFilename: String? = null
): MarkdownDocument {
    val frontmatter = buildString {
        appendLine("---")
        appendLine("时间: $timestamp")
        appendLine("来源: $source")
        appendLine("标签: [${tags.joinToString(", ")}]")
        if (relatedAssets.isNotEmpty()) {
            appendLine("涉及标的: [${relatedAssets.joinToString(", ")}]")
        }
        appendLine("---")
    }
```

**改造要求**:

重写 `create` 方法签名和实现：

```kotlin
fun create(
    type: String,           // schedule|task|note|record|milestone|review
    dimension: String = "_inbox",  // 默认 _inbox
    status: String = "pending",
    priority: String = "medium",
    privacy: String = "private",  // 默认 private
    date: String,           // YYYY-MM-DD
    tags: List<String>,     // 不带 # 前缀
    source: String = "lingguang",
    content: String,
    imageFilename: String? = null
): MarkdownDocument {
    val created = SimpleDateFormat("yyyy-MM-dd'T'HH:mm", Locale.getDefault()).format(Date())
    val frontmatter = buildString {
        appendLine("---")
        appendLine("type: $type")
        appendLine("dimension: $dimension")
        appendLine("status: $status")
        appendLine("priority: $priority")
        appendLine("privacy: $privacy")
        appendLine("date: $date")
        appendLine("tags: [${tags.joinToString(", ")}]")
        appendLine("source: $source")
        appendLine("created: $created")
        appendLine("---")
    }
    // ... 后续内容拼接逻辑保持不变
}
```

**注意**:
- `tags` 列表中的元素不要带 `#` 前缀
- `source` 固定为 `"lingguang"`
- `dimension` 默认为 `"_inbox"`（灵光端不做维度分类，交给 OpenClaw）
- `privacy` 默认为 `"private"`

---

### 任务 2: 修改 ObsidianRepository.kt 🔴 P0

**文件**: `app/src/main/java/com/lingguang/catcher/data/repository/ObsidianRepository.kt`

**改造点 1**: 将 `00_Inbox` 改为 `_Inbox`

第 40-41 行：
```kotlin
// 改造前
val inboxDir = vaultDir.findFile("00_Inbox")
    ?: vaultDir.createDirectory("00_Inbox")

// 改造后
val inboxDir = vaultDir.findFile("_Inbox")
    ?: vaultDir.createDirectory("_Inbox")
```

**改造点 2**: `updateFile` 方法中的路径同步更新（第 100-101 行）

```kotlin
// 改造前
val inboxDir = vaultDir.findFile("00_Inbox")

// 改造后
val inboxDir = vaultDir.findFile("_Inbox")
```

**改造点 3**: `fileExists` 方法同步更新（第 122 行）

```kotlin
// 改造前
val inboxDir = vaultDir.findFile("00_Inbox") ?: return false

// 改造后
val inboxDir = vaultDir.findFile("_Inbox") ?: return false
```

---

### 任务 3: 为 VoiceNoteType 添加 LifeOS 类型映射 🔴 P0

**文件**: `app/src/main/java/com/lingguang/catcher/data/model/VoiceNoteType.kt`

在 `VoiceNoteType` 枚举中，新增两个属性 `lifeosType` 和 `lifeosDimension`：

```kotlin
enum class VoiceNoteType(
    val label: String,
    val icon: String,
    val tag: String,
    val description: String,
    val lifeosType: String,      // 新增: 映射到 LifeOS type
    val lifeosDimension: String  // 新增: 映射到 LifeOS dimension
) {
    INSPIRATION("灵感", "💡", "灵感", "突然的想法、创意火花",        "note", "_inbox"),
    TASK(       "任务", "📝", "任务", "需要执行的事项",              "task", "_inbox"),
    SCHEDULE(   "日程", "📅", "日程", "时间相关的安排",              "schedule", "_inbox"),
    LEARNING(   "学习", "📚", "学习", "知识点、概念、笔记",          "note", "learning"),
    THOUGHT(    "随想", "💭", "随想", "日常思考、感悟",              "note", "growth"),
    EXCERPT(    "摘录", "🔖", "摘录", "书籍、文章的精彩片段",        "note", "learning"),
    GOAL(       "目标", "🎯", "目标", "长期目标、计划",              "milestone", "_inbox"),
    QUESTION(   "问题", "❓", "问题", "待解决的疑问",                "note", "_inbox"),
    CONTACT(    "人脉", "🤝", "人脉", "人际交往、联系人信息",        "record", "relationship"),
    LIFE(       "生活", "🏠", "生活", "日常生活、家庭琐事",          "record", "life"),
    WORK(       "工作", "💼", "工作", "工作相关、职场记录",          "record", "career"),
    BRAINSTORM( "头脑风暴","🧠","头脑风暴","多段录音，汇总为结构化笔记","note", "_inbox");
```

---

### 任务 4: 更新 CaptureRepository.kt 🔴 P0

**文件**: `app/src/main/java/com/lingguang/catcher/data/repository/CaptureRepository.kt`

`processCaptureRecord` 和 `processCaptureRecordByType` 方法中，需要将新的 frontmatter 字段传给 `MarkdownDocument.create()`。

**主要改造**:
- 使用 `VoiceNoteType.lifeosType` 作为 `type` 参数
- 使用 `VoiceNoteType.lifeosDimension` 作为 `dimension` 参数
- `tags` 列表去掉 `#` 前缀
- 从 `timestamp` 中提取 `date`（`YYYY-MM-DD` 部分）

---

### 任务 5: 文件命名规范 🟡 P1

**文件**: `MarkdownDocument.kt` 的 `create` 方法

**当前命名**: `capture_2026-03-17_1100.md`

**新命名格式**: `{source}_{type}_{YYYY-MM-DD}_{HHmmss}.md`

```kotlin
// 改造后
val filename = "${source}_${type}_${date}_${
    SimpleDateFormat("HHmmss", Locale.getDefault()).format(Date())
}.md"
```

**示例**:
- `lingguang_note_2026-03-17_110023.md`
- `lingguang_task_2026-03-17_143500.md`

---

### 任务 6: AI Prompt 中的标签格式 🟡 P1

**文件**: `GeminiAIService.kt`, `OpenAIAIService.kt`, `DashScopeAIService.kt`

**改造**:
- `callTextAPI` 方法中返回的 `yamlFrontmatter` tags 不带 `#` 前缀

```kotlin
// 改造前
val tags = listOf("#${noteType.tag}", "#语音")

// 改造后
val tags = listOf(noteType.tag, "语音")
```

---

## 验收标准

1. ✅ 灵光 App 输出的 Markdown 文件可被 LifeOS 索引器正确解析
2. ✅ Frontmatter 包含所有必填字段: `type`, `dimension`, `status`, `privacy`, `date`, `source`, `created`
3. ✅ 标签不含 `#` 前缀
4. ✅ 文件写入 `_Inbox` 目录（非 `00_Inbox`）
5. ✅ 文件名符合 `{source}_{type}_{date}_{time}.md` 格式
6. ✅ 不同 VoiceNoteType 映射到正确的 `type` 和 `dimension`
7. ✅ 现有功能无回归（语音、拍照、链接、离线队列等）

---

## 注意事项

- **不要在灵光端做维度分类**: `dimension` 除了映射表中明确的（如 LEARNING→learning），其余统一填 `_inbox`
- **不要改动 AI prompt 的结构化整理逻辑**: AI 仍然负责将语音/图片/链接内容整理成结构化 Markdown, 只是 frontmatter 的生成逻辑变了
- **兼容性**: 如果 Obsidian Vault 中已有 `00_Inbox` 目录的数据，需在迁移时手动移到 `_Inbox`

---

## 预估工作量

| 任务 | 预估 |
|------|------|
| 任务 1-2: 核心改造 | 0.5 小时 |
| 任务 3-4: 映射和适配 | 0.5 小时 |
| 任务 5-6: 命名和标签 | 0.5 小时 |
| 测试验证 | 0.5 小时 |
| **总计** | **~2 小时** |

---

## 完成后反馈

完成后请更新以下文件并通知架构组：
1. 更新 `DEVLOG.md` 记录改造过程
2. 更新 `README.md`（如有必要）
3. 反馈到 `/home/xionglei/LifeOnline/components/status.md` 更新灵光组件状态
