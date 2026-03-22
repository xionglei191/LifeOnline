# 当前轮：WeeklyHighlights 主路径稳定性补面

## 进展
- [x] 识别 `WeeklyHighlights` 当前列表顺序仍依赖后端 `created` 顺序；当同一天重点事项并列时，用户看到的主路径顺序会因不可见字段漂移。
- [x] 在 `WeeklyHighlights` 中保留日期优先后，再按当前可见标题（`note.title || file_name`）排序，保证主路径重点事项列表顺序稳定。
- [x] 补 focused 回归，锁定同日重点事项按可见标题排序。
- [ ] 跑 focused web 验证并视情况直接提交。

---
