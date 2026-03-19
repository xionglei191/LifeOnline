# Issue: 编辑笔记时丢失 Frontmatter

**发现日期**: 2026-03-17
**优先级**: P0（严重 Bug）
**状态**: ✅ 已修复

---

## 问题描述

在灵光 App 的历史记录页面编辑笔记后保存，会导致文件的 Frontmatter 完全丢失。

### 错误行为

**编辑前的文件**：
```markdown
---
type: task
dimension: _inbox
status: pending
priority: medium
privacy: private
date: 2026-03-17
tags: [任务, 语音]
source: lingguang
created: 2026-03-17T22:39
---

## 📝 任务清单

**待办事项**
- [ ] 小熊同学设置每日早上7:00闹钟
```

**编辑后的文件**：
```markdown
## 📝 任务清单

**待办事项**
- [ ] 小熊同学设置每日早上7:00闹钟
```

**结果**：Frontmatter 完全丢失！

---

## 影响范围

**严重性**：P0 - 数据破坏性 Bug

**影响**：
1. 文件失去所有元数据（type、dimension、status、priority、date 等）
2. OpenClaw 无法解析文件，报错 `missing frontmatter start`
3. LifeOS 看板无法正确索引和显示文件
4. 文件无法被正确分类和处理

**受影响功能**：
- 历史记录编辑功能
- 所有通过 EditActivity 编辑的笔记

---

## 根本原因

### 代码分析

**文件**：`app/src/main/java/com/lingguang/catcher/ui/EditActivity.kt`

**问题代码**（第 113-121 行）：
```kotlin
private fun saveChanges() {
    // ...
    val markdown = buildString {
        appendLine("## $title")      // ❌ 标题在最前面
        appendLine()
        appendLine(content)
        if (tags.isNotEmpty()) {
            appendLine()
            appendLine(tags)
        }
    }
    // ❌ 没有包含 Frontmatter！

    // 直接用没有 Frontmatter 的内容覆盖原文件
    val result = obsidianRepo.updateFile(filename, markdown)
}
```

**问题链**：
1. `loadCapture()` 加载原文件内容，但只提取了标题、标签和正文
2. `saveChanges()` 重新组装 Markdown 时，只包含标题和正文
3. **完全忽略了原文件的 Frontmatter**
4. `updateFile()` 用新内容覆盖原文件，导致 Frontmatter 丢失

---

## 修复方案

### 1. 添加 Frontmatter 提取函数

新增 `extractFrontmatter()` 函数：
```kotlin
/**
 * 从 Markdown 内容中提取 Frontmatter
 * 返回完整的 Frontmatter 块（包括 --- 分隔符）
 */
private fun extractFrontmatter(content: String): String {
    val lines = content.lines()
    if (lines.isEmpty()) return ""

    // 在前 40 行内查找 Frontmatter
    val searchLimit = minOf(lines.size, 40)
    var start = -1
    var end = -1

    for (i in 0 until searchLimit) {
        if (lines[i].trim() == "---") {
            start = i
            break
        }
    }

    if (start == -1) return ""

    for (j in (start + 1) until searchLimit) {
        if (lines[j].trim() == "---") {
            end = j
            break
        }
    }

    if (end == -1) return ""

    // 返回完整的 Frontmatter 块（包括 --- 分隔符）
    return lines.subList(start, end + 1).joinToString("\n")
}
```

### 2. 修改 saveChanges() 函数

保留原文件的 Frontmatter：
```kotlin
private fun saveChanges() {
    // ...

    // 提取原文件的 Frontmatter
    val originalContent = capture?.markdownContent ?: ""
    val frontmatter = extractFrontmatter(originalContent)

    // 重新组装 Markdown（保留 Frontmatter）
    val markdown = buildString {
        if (frontmatter.isNotEmpty()) {
            append(frontmatter)
            appendLine()
            appendLine()
        }
        appendLine("## $title")
        appendLine()
        appendLine(content)
        if (tags.isNotEmpty()) {
            appendLine()
            appendLine(tags)
        }
    }

    // 更新文件
    val result = obsidianRepo.updateFile(filename, markdown)
}
```

---

## 验证结果

### 修复前
```bash
# 编辑前
head -15 lingguang_task_2026-03-17_223939.md
```
输出：
```markdown
---
type: task
dimension: _inbox
...
---

## 📝 任务清单
```

```bash
# 编辑后
head -15 lingguang_task_2026-03-17_223939.md
```
输出：
```markdown
## 📝 任务清单

内容...
```
❌ Frontmatter 丢失！

### 修复后
```bash
# 编辑后
head -15 lingguang_task_2026-03-17_223939.md
```
输出：
```markdown
---
type: task
dimension: _inbox
...
---

## 📝 任务清单

内容...
```
✅ Frontmatter 保留！

---

## 后续建议

### 1. 单元测试（推荐）

为 `extractFrontmatter()` 添加单元测试：
- 测试标准格式（Frontmatter 在开头）
- 测试异常格式（Frontmatter 在标题后）
- 测试无 Frontmatter 的情况

### 2. 编辑界面优化（可选）

考虑在编辑界面显示 Frontmatter 字段：
- 显示 type、dimension、status、priority 等关键字段
- 允许用户修改这些字段
- 提供下拉选择而非手动输入

### 3. 数据完整性检查（可选）

在保存前检查：
- Frontmatter 是否存在
- 必需字段是否完整
- 格式是否正确

---

## 协议规范

根据 LifeOnline Frontmatter 协议 v1.0：

**所有 Markdown 文件必须包含 Frontmatter**：
```markdown
---
type: [必需]
dimension: [必需]
status: [必需]
priority: [可选]
privacy: [可选]
date: [必需]
tags: [可选]
source: [必需]
created: [必需]
---

[Markdown 正文]
```

**编辑操作不得破坏 Frontmatter**。

**参考文档**: `../protocols/frontmatter.md`

---

## 完成状态

- ✅ 代码修复完成
- ✅ extractFrontmatter() 函数已添加
- ✅ saveChanges() 函数已修改
- ⬜ 单元测试（建议添加）
- ⬜ 编辑界面优化（可选）
- ⬜ 数据完整性检查（可选）

---

## 相关问题

- ISSUE_MILESTONE_FORMAT.md - Frontmatter 格式错误问题
- 两个问题都与 Frontmatter 处理有关，需要确保整个应用对 Frontmatter 的处理一致性
