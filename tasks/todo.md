# 当前轮：Timeline picker 主路径稳定性补面

## 进展
- [x] 识别 Timeline 同桶多笔记 picker 仍直接沿用后端返回顺序，导致主路径展开顺序不稳定，用户每次看到的选择列表顺序可能漂移。
- [x] 在 `TimelineTrack` 的多笔记 picker 入口按当前可见标题（`note.title || file_name`）排序，保证主路径选择顺序稳定且与显示标签一致。
- [x] 补 focused 回归，锁定同桶多笔记 picker 按可见标题排序。
- [ ] 跑 focused web 验证并视情况直接提交。

---
