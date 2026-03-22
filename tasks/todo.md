# 当前轮：DimensionView 标题关键词事实源补面

## 进展
- [x] 识别 `useDimensionNotes` 的本地关键词过滤仍只查 `file_name/content`，没有命中共享 `note.title`，导致主维度页可见标题与可搜索标题脱节。
- [x] 在 `useDimensionNotes` 关键词过滤中补入共享 `note.title`，让主路径筛选与当前展示标题保持一致。
- [x] 补 focused 回归，锁定维度主路径可通过共享标题命中过滤结果。
- [ ] 跑 focused web 验证并视情况直接提交。

---
