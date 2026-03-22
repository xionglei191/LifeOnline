# 当前轮：Inbox canonical dimension 与 Stats worker refresh 收口

## 进展
- [x] 识别 `/inbox` 主路径与 shared canonical dimension contract 不一致：shared 使用 `_inbox`，但 web 路由把 `/inbox` 复用到 `DimensionView` 时没有 `:dimension` 参数，实际会把 dimension 读成空值并退化到 `fetchNotes` 的无过滤查询，存在 Inbox 页面误读成全量笔记的主路径断裂风险。
- [x] 在 `LifeOS/packages/web/src/views/DimensionView.vue` 抽出 `normalizeRouteDimension`，把 `/inbox` 这类无参数 inbox 路由统一映射到 canonical `_inbox`，避免 web 与 shared contract 再次漂移。
- [x] 补 `LifeOS/packages/web/src/views/DimensionView.test.ts` focused 回归，锁定 inbox route 会以 `{ dimension: '_inbox' }` 调用 `fetchNotes`，而不是退化成空过滤。
- [x] 收完当前手上的 `StatsView note-worker websocket refresh`：`LifeOS/packages/web/src/views/StatsView.vue` 已把 `note-worker-tasks-updated` 纳入统计页刷新门禁；同时修复 `StatsView.test.ts` 中重复拼接的测试块，恢复 focused 验证可运行状态并保留 worker refresh 回归。
- [x] 跑 focused 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/DimensionView.test.ts src/views/StatsView.test.ts src/components/DashboardOverview.test.ts`。

## 结果
- Dashboard 的 inbox banner 现在会落到 canonical `_inbox` 维度，不再存在 `/inbox` 主路径把 inbox 页面误拉成全量笔记列表的 contract break。
- StatsView 也已经完成 note-worker websocket refresh 收口并恢复 focused test 通过；当前这一轮两项 main-path 修复都已完成并通过验证。

---
