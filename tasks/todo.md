# 当前轮：NoteDetail 标题事实源一致性补面

## 进展
- [x] 识别 `NoteDetail` 主阅读路径的 hero 标题与删除确认文案仍直接展示 `file_name`，和前几轮已收敛的 list/dashboard/preview 标题事实源不一致。
- [x] 在 `NoteDetail` 主标题与删除确认路径统一优先展示共享 `note.title`，仅在缺失时回退 `file_name`。
- [x] 补 focused 回归，锁定 detail 主路径与 delete confirm 路径的标题事实源。
- [ ] 跑 focused web 验证并视情况直接提交。

---
