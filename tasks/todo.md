# 当前轮：dashboard websocket 主路径刷新收口

## 进展
- [x] 识别 dashboard 主路径只在 index refresh 下重载，`note-worker-tasks-updated` 虽然会改变今日待办/周重点等 dashboard 可见状态，但前端没有刷新，属于新的主路径可见行为缺口。
- [x] 在 `web/src/composables/useDashboard.ts` 抽出 `doesDashboardNeedRefresh`，把 `note-worker-tasks-updated` 纳入 dashboard 数据刷新门禁，避免 dashboard 继续只信旧的 index-only 事实源。
- [x] 在 `web/src/components/DashboardOverview.vue` 复用同一门禁，同步让 schedule health 在这类 dashboard 主路径刷新事件上也一起更新，保持 hero/任务健康横幅与主数据一致。
- [x] 补 focused 回归：锁定 dashboard 会对 `note-worker-tasks-updated` 做刷新，而不会把普通无关 websocket 事件误判成刷新触发器；同时修正 `DashboardOverview.test.ts` 中误拼接的测试块，避免后续继续产生假阴性。
- [x] 跑 web focused 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/composables/useDashboard.test.ts src/components/DashboardOverview.test.ts`。

## 结果
- Dashboard 现在能在 note-scoped worker task 更新后及时反映主路径可见变化，不再要求等 index refresh 才看到今日待办等变化。
- 当前这一轮 dashboard 主路径刷新收口已完成并通过 focused 验证；下一轮可继续找新的 websocket/server-web contract gap。

---
