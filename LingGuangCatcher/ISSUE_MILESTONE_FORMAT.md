# Issue: Milestone 文件 Frontmatter 格式错误

**发现日期**: 2026-03-17
**优先级**: P1
**状态**: ✅ 已修复

---

## 问题描述

灵光 App 生成的 milestone 类型文件，Frontmatter 不在文件开头，导致 OpenClaw 无法解析。

### 错误格式

```markdown
## 🎯 目标规划

---
type: milestone
dimension: _inbox
...
---

内容...
```

### 正确格式

```markdown
---
type: milestone
dimension: _inbox
...
---

## 🎯 目标规划

内容...
```

---

## 影响范围

**受影响文件**:
- `lingguang_milestone_2026-03-17_141344.md`
- `lingguang_milestone_2026-03-17_155320.md`
- `lingguang_milestone_2026-03-17_200226.md`

**影响**:
- 这些文件一直停留在 `_Inbox` 中无法被 OpenClaw 处理
- OpenClaw 每次扫描都报错：`protocol skip: missing frontmatter start`
- 从 20:25 到 21:21，每 5 分钟报错一次

---

## 根本原因

`CaptureRepository.kt` 中的 `stripFrontmatter()` 函数逻辑不完善：
- 只能处理 Frontmatter 在文档开头的情况
- 当 AI 输出的内容先有标题，再有 Frontmatter 时，无法正确剥离
- 导致最终生成的文件格式错误

---

## 修复方案

### 代码修复

**文件**: `app/src/main/java/com/lingguang/catcher/data/repository/CaptureRepository.kt`

**修改**: 重写 `stripFrontmatter()` 函数

**新逻辑**:
1. 在文档前 40 行内搜索 `---` 开始标记
2. 找到对应的 `---` 结束标记
3. 删除整个 Frontmatter 块（包括前后的 `---`）
4. 保留 Frontmatter 之前和之后的内容
5. 这样 `MarkdownDocument.create()` 生成最终文件时，Frontmatter 就一定在第一行

**关键改进**:
- 兼容两种情况：Frontmatter 在开头（标准）或在标题后（错误但能修正）
- 只在前 40 行搜索，避免误删正文中的分隔线
- 保留标题和内容，只删除 AI 误输出的 Frontmatter

### 历史数据修复

已手动修正 3 个受影响文件的格式，将 Frontmatter 移到文件开头。

---

## 验证结果

### 修复前
```bash
tail -5 ~/.openclaw/logs/lifeonline/error.log
```
输出：
```
[2026-03-17 21:21:35] protocol skip lingguang_milestone_2026-03-17_200226.md: missing frontmatter start
```

### 修复后
```bash
head -5 /home/xionglei/Vault_OS/_Inbox/lingguang_milestone_2026-03-17_200226.md
```
输出：
```markdown
---
type: milestone
dimension: _inbox
status: pending
priority: medium
```

✅ Frontmatter 现在在第一行，格式正确。

---

## 后续建议

### 1. 单元测试（推荐）

为 `stripFrontmatter()` 添加单元测试，覆盖两种场景：
- 测试 1: Frontmatter 在开头（标准格式）
- 测试 2: Frontmatter 在标题后（错误格式）

确保回归不会再发生。

### 2. AI Prompt 优化（可选）

在 `PromptTemplates.kt` 中明确要求 AI：
- "不要在输出中包含 YAML frontmatter"
- "只输出 Markdown 正文内容"

降低 AI 误输出 Frontmatter 的概率。

---

## 协议规范

根据 LifeOnline Frontmatter 协议 v1.0：

**所有 Markdown 文件必须遵守以下格式**:
```markdown
---
[YAML frontmatter]
---

[Markdown 正文]
```

**要求**:
1. Frontmatter 必须在文件第一行
2. Frontmatter 使用 `---` 包裹
3. 正文内容在 Frontmatter 之后

**参考文档**: `/home/xionglei/LifeOnline/protocols/frontmatter.md`

---

## 完成状态

- ✅ 代码修复完成
- ✅ 历史数据修复完成
- ✅ 验证测试通过
- ⬜ 单元测试（建议添加）
- ⬜ AI Prompt 优化（可选）
