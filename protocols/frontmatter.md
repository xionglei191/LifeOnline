# Frontmatter 协议规范

*版本: 1.0 | 更新: 2026-03-17*

---

## 协议说明

**所有接入 LifeOnline 系统的组件**（灵光 App、OpenClaw、LifeOS 看板、浏览器剪藏等）在生成和处理 Markdown 文件时，必须遵守本协议。

---

## 标准 Frontmatter

```yaml
---
type: note
dimension: learning
status: pending
priority: medium
privacy: public
date: 2026-03-17
due: 2026-03-20
tags: [标签A, 标签B]
source: lingguang
created: 2026-03-17T11:00
updated: 2026-03-17T15:30
---
```

---

## 字段定义

### 必填字段

| 字段 | 类型 | 可选值 | 说明 |
|------|------|--------|------|
| `type` | enum | `schedule` `task` `note` `record` `milestone` `review` | 内容类型 |
| `dimension` | enum | `health` `career` `finance` `learning` `relationship` `life` `hobby` `growth` `_inbox` | 所属维度 |
| `status` | enum | `pending` `in_progress` `done` `cancelled` | 当前状态 |
| `privacy` | enum | `public` `private` `sensitive` | 隐私级别 |
| `date` | date | `YYYY-MM-DD` | 关联日期 |
| `source` | enum | `lingguang` `desktop` `webclipper` `openclaw` `web` `auto` | 数据来源 |
| `created` | datetime | `YYYY-MM-DDTHH:mm` | 创建时间 |

### 可选字段

| 字段 | 类型 | 可选值 | 说明 |
|------|------|--------|------|
| `priority` | enum | `high` `medium` `low` | 优先级，默认 `medium` |
| `due` | date | `YYYY-MM-DD` | 截止日期，仅 task/schedule |
| `tags` | list | 自由文本 | 自定义标签，**不带 `#` 前缀** |
| `updated` | datetime | `YYYY-MM-DDTHH:mm` | 最后更新时间 |

---

## 字段值详解

### type — 内容类型

| 值 | 中文 | 适用场景 | 示例 |
|----|------|---------|------|
| `schedule` | 日程 | 有明确时间的安排 | 周四下午2点开会 |
| `task` | 任务 | 需要执行的待办事项 | 提交项目报告 |
| `note` | 笔记 | 知识记录、思考、灵感 | 读书笔记、随想 |
| `record` | 记录 | 事实性记录 | 跑步5公里、支出记录 |
| `milestone` | 里程碑 | 重要节点和目标 | 完成年度目标 |
| `review` | 复盘 | 回顾和反思 | 周复盘、项目复盘 |

### dimension — 八维度

| 值 | 中文 | 涵盖内容 |
|----|------|---------|
| `health` | 健康 | 运动、睡眠、饮食、体检、心理 |
| `career` | 事业 | 工作任务、项目进展、职业规划 |
| `finance` | 财务 | 收支、投资、资产、目标 |
| `learning` | 学习 | 阅读、课程、知识积累 |
| `relationship` | 关系 | 家人、朋友、人脉 |
| `life` | 生活 | 家务、购物、出行 |
| `hobby` | 兴趣 | 爱好、创作、娱乐 |
| `growth` | 成长 | 目标复盘、习惯养成、里程碑 |
| `_inbox` | 收件箱 | 待分类（仅灵光等输入端使用） |

### source — 数据来源

| 值 | 说明 |
|----|------|
| `lingguang` | 灵光 App 采集 |
| `desktop` | 电脑端 Obsidian 直写 |
| `webclipper` | 浏览器剪藏工具 |
| `openclaw` | OpenClaw 外部执行结果 |
| `web` | LifeOS 看板创建 |
| `auto` | LifeOS 自动化生成（分类归档、日报、周报等） |

### privacy — 隐私级别

| 值 | 说明 | 同步策略 | 看板展示 |
|----|------|---------|---------|
| `public` | 公开内容 | 正常同步 | 完整展示 |
| `private` | 个人隐私 | 加密同步 | 仅本人可见 |
| `sensitive` | 高度敏感 | 本地存储，不同步 | 脱敏展示 |

---

## 文件命名规范

### 格式

```
{source}_{type}_{YYYY-MM-DD}_{HHmmss}.md
```

### 示例

```
lingguang_note_2026-03-17_110023.md     # 灵光 App 笔记
lingguang_task_2026-03-17_143500.md     # 灵光 App 任务
desktop_note_2026-03-17_200000.md       # 电脑直写笔记
openclaw_review_2026-03-17_000000.md    # OpenClaw 生成的日报
```

### 规则

- 全小写，下划线分隔
- 时间精确到秒，避免文件名冲突
- 灵光 App 覆盖图片保持同名前缀：`lingguang_note_2026-03-17_110023.jpg`

---

## 完整示例

### 灵光 App 语音采集

```markdown
---
type: note
dimension: _inbox
status: pending
priority: medium
privacy: private
date: 2026-03-17
tags: [灵感, 产品]
source: lingguang
created: 2026-03-17T11:00
---

## 💡 灵感闪现

刚才走路的时候想到一个关于 LifeOnline 的功能...
```

### 自动化处理后示例

```markdown
---
type: note
dimension: growth
status: pending
priority: medium
privacy: private
date: 2026-03-17
tags: [灵感, 产品, LifeOnline]
source: lingguang
created: 2026-03-17T11:00
updated: 2026-03-17T11:15
---

## 💡 灵感闪现

刚才走路的时候想到一个关于 LifeOnline 的功能...

---
*[OpenClaw] 已从 _Inbox 归档到 成长 维度 (2026-03-17 11:15)*
```
