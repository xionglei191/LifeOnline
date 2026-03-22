# 当前轮：CalendarView 主路径一致性补面

## 进展
- [x] 识别 `CalendarGrid` 已按可见标题稳定排序，但 `CalendarView` 右侧当日详情列表仍直接沿用原始 `day.notes` 顺序，导致同一天格子列表与右侧详情顺序分叉。
- [x] 在 `CalendarView` 的当日详情列表中对齐 `CalendarGrid` 的类型/状态/可见标题排序规则，保证两个主路径顺序一致。
- [x] 补 focused 回归，锁定当日详情列表按可见标题稳定展示。
- [ ] 跑 focused web 验证并视情况直接提交。

---
