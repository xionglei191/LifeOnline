# 当前轮：Timeline / Calendar 主路径中文化收口

## 进展
- [x] 识别新的主路径 copy gap：`LifeOS/packages/web/src/views/TimelineView.vue` 的 hero / controls eyebrow 仍残留 `Life Tracks` / `Time Window`，`LifeOS/packages/web/src/views/CalendarView.vue` 的 hero / selected-day 标题区仍残留 `Calendar Surface` / `Daily Records` / `entries`。
- [x] 在 `LifeOS/packages/web/src/views/TimelineView.vue` 与 `LifeOS/packages/web/src/views/CalendarView.vue` 做最小文案修正：分别改为“生命轨迹”“观测窗口”“月历视图”“当日记录”“条”，不改变时间窗口、月切换、详情选择或数据加载逻辑。
- [x] 在 `LifeOS/packages/web/src/views/TimelineView.test.ts` 与 `LifeOS/packages/web/src/views/CalendarView.test.ts` 补 focused 回归，锁定一级视图主路径展示新的中文文案，且不再回退到 `Life Tracks` / `Time Window` / `Calendar Surface` / `Daily Records` / `entries`。
- [x] 跑受影响 web 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/TimelineView.test.ts src/views/CalendarView.test.ts`。

## 结果
- Timeline 与 Calendar 两个一级视图的 hero / controls / selected-day 主路径 copy 已进一步统一到当前中文产品口径。
- 本轮仍是新的用户可见主路径 copy gap 收口，没有继续深挖 grouped governance / settings 深链对称补强。

## 下一步建议
- 下一轮优先继续找新的 server/web/shared contract gap 或事实源一致性问题；如果暂时仍停留在主路径用户可见缺口，可继续检查 `LifeOS/packages/web/src/views/SearchView.vue`、`LifeOS/packages/web/src/components/NoteDetail.vue` 是否还存在英文 eyebrow、badge、status 文案未对齐当前中文口径。

---
