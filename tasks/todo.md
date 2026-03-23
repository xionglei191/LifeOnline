# 当前轮：Calendar month transition detail-state 收口

## 进展
- [x] 识别新的主路径行为缺口：`LifeOS/packages/web/src/views/CalendarView.vue` 在月份窗口切换时会继续保留旧 `selectedNoteId`，导致 calendar 主路径可能在新月份下仍打开上个月详情，出现月视图与详情面板错位。
- [x] 在 `LifeOS/packages/web/src/views/CalendarView.vue` 的月份 watcher 中补齐最小状态收敛：当 `year/month` 变化时先清空当前选中的 note，再加载新的月份数据。
- [x] 在 `LifeOS/packages/web/src/views/CalendarView.test.ts` 增加 focused 回归，锁定月份切换后旧详情会关闭，不再跨月份残留。
- [x] 跑受影响 web 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/CalendarView.test.ts`。

## 结果
- calendar 主路径在月份切换时不再残留旧详情面板，月视图与详情面板重新回到同一时间窗口。
- 这继续补的是 route/window 驱动页面里的真实状态一致性缺口，不是对称补测试。

## 下一步建议
- 下一轮优先继续排查 timeline window refresh / dashboard entry path 等其它窗口驱动页面，尤其看详情面板是否会跨窗口残留旧 selection。

---
