# 当前轮：AISuggestions websocket refresh 收口

## 进展
- [x] 识别 `DashboardOverview` 内的 `AISuggestions` 仍然只在 mount 或手动点击“刷新洞察”时拉取数据，没有消费已经逐步补齐的 note lifecycle / worker websocket 事实源；这会让 dashboard 上的 AI 洞察在笔记变化或任务回流后继续停留旧状态，属于新的主路径 contract-to-UI 缺口。
- [x] 在 `LifeOS/packages/web/src/components/AISuggestions.vue` 接入 websocket 监听，把 `note-updated` / `note-created` / `note-deleted` / `note-worker-tasks-updated` 以及 index refresh 纳入洞察刷新触发器，让 dashboard 洞察流与主路径数据变化同步。
- [x] 保留并复用现有 `activeRequestId` 防抖 / 抗陈旧响应机制，确保 websocket 连续到达时不会把旧洞察覆盖新洞察。
- [x] 在 `LifeOS/packages/web/src/components/AISuggestions.test.ts` 增加 focused 回归，锁定 AI 洞察会在 note-created 和 worker/index websocket 事件后自动刷新，而不是继续依赖手工刷新。
- [x] 跑 focused 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/components/AISuggestions.test.ts src/components/DashboardOverview.test.ts`。

## 结果
- Dashboard 上的 AI 洞察流现在会跟随 note lifecycle 与 worker websocket 事件自动更新，减少主路径“主数据已变但洞察仍旧”的事实源漂移。
- 当前这一轮 AISuggestions websocket refresh 收口已完成并通过 focused 验证；下一轮可继续找新的非 Settings 主路径事实源缺口。

---
