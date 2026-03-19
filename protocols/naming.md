# 文件命名规范

*版本: 1.0 | 更新: 2026-03-17*

---

## 格式

```
{source}_{type}_{YYYY-MM-DD}_{HHmmss}.md
```

## 示例

| 场景 | 文件名 |
|------|--------|
| 灵光语音笔记 | `lingguang_note_2026-03-17_110023.md` |
| 灵光拍照任务 | `lingguang_task_2026-03-17_143500.md` |
| 灵光链接摘录 | `lingguang_note_2026-03-17_200015.md` |
| 电脑直写日程 | `desktop_schedule_2026-03-17_090000.md` |
| OpenClaw 日报 | `openclaw_review_2026-03-17_235959.md` |
| 看板创建任务 | `web_task_2026-03-17_160000.md` |
| 浏览器剪藏 | `webclipper_note_2026-03-17_120000.md` |

## 规则

1. 全小写，下划线分隔
2. 时间精确到秒，避免文件名冲突
3. 关联图片使用同名前缀：`lingguang_note_2026-03-17_110023.jpg`
4. `source` 和 `type` 的可选值见 [Frontmatter 协议](frontmatter.md)
