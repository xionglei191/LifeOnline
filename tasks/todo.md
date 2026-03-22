# 当前轮：Calendar day item 主路径稳定性补面

## 进展
- [x] 识别 `CalendarGrid` 同日条目在类型/状态相同的情况下仍沿用后端顺序，导致主路径日历格内可见顺序不稳定。
- [x] 在 `CalendarGrid` 的同日展示排序中保留类型/状态优先级后，再按可见标题（`note.title || file_name`）排序，保证主路径日历条目顺序稳定。
- [x] 补 focused 回归，锁定同日同优先级条目按可见标题排序。
- [ ] 跑 focused web 验证并视情况直接提交。

---
