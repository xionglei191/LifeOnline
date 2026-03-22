# 当前轮：Dashboard/Preview 标题事实源一致性补面

## 进展
- [x] 识别 Dashboard `TodayTodos` 与 `NotePreview` 单条预览分支仍直接展示 `file_name`，与共享 `note.title` 脱节，导致主路径和悬浮预览继续暴露文件名而不是索引标题。
- [x] 在 `TodayTodos` 与 `NotePreview` 单条分支统一优先展示共享 `note.title`，仅在缺失时回退 `file_name`。
- [x] 补 focused 回归，锁定 dashboard todo 路径与 single-note preview 路径的标题事实源。
- [ ] 跑 focused web 验证并视情况直接提交。

---
