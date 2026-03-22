# 当前轮：NotePreview 主路径一致性补面

## 进展
- [x] 识别 `NotePreview` 多笔记 hover 预览仍沿用原始数组顺序，和 `TimelineTrack` 点击后的 picker 排序已不一致，造成同一组记录 hover/click 两条主路径顺序分叉。
- [x] 在 `NotePreview` 的多笔记预览中按当前可见标题（`note.title || file_name`）排序，保证 hover 预览与 picker 一致。
- [x] 补 focused 回归，锁定多笔记预览按可见标题排序。
- [ ] 跑 focused web 验证并视情况直接提交。

---
