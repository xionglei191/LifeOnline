# 当前轮：TodayTodos 主路径稳定性补面

## 进展
- [x] 识别 `TodayTodos` 当前队列顺序仍直接依赖后端 `created` 顺序；当同优先级/同状态任务并列时，主路径可见顺序会因隐藏字段漂移。
- [x] 在 `TodayTodos` 中保留优先级/状态优先级后，再按当前可见标题（`note.title || file_name`）排序，保证主任务队列顺序稳定。
- [x] 补 focused 回归，锁定同优先级任务按可见标题排序。
- [ ] 跑 focused web 验证并视情况直接提交。

---
