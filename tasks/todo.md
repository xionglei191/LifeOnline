# 当前轮：CalendarView 主路径一致性补面

## 进展
- [x] 识别 `CalendarGrid` 已按可见标题稳定排序，但 `CalendarView` 右侧当日详情列表仍直接沿用原始 `day.notes` 顺序，导致同一天格子列表与右侧详情顺序分叉。
- [x] 在 `CalendarView` 的当日详情列表中对齐 `CalendarGrid` 的类型/状态/可见标题排序规则，保证两个主路径顺序一致。
- [x] 补 focused 回归，锁定当日详情列表按可见标题稳定展示。
- [x] 跑 focused web 验证并确认通过：`pnpm --dir /home/xionglei/LifeOnline/LifeOS --filter web test -- src/views/CalendarView.test.ts`

## 结果
- `CalendarView` 当日详情列表已与 `CalendarGrid` 保持一致的类型 / 状态 / 可见标题排序规则，避免同一天在主日历格子与右侧详情面板里出现顺序分叉。
- focused web 测试已通过，可进入下一轮新的高价值缺口收敛。

---
