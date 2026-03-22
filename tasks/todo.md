# 当前轮：WorkerTaskDetail note-worker websocket 收口

## 进展
- [x] 识别 `LifeOS/packages/web/src/components/WorkerTaskDetail.vue` 之前只消费 `worker-task-updated`，但 server/shared 已经同时广播 `note-worker-tasks-updated`；当任务结果、输出笔记、source-note 相关 materialization 从 note 侧 websocket 到达时，任务详情弹层会停留 stale，需要手动点“刷新”，属于新的 contract-to-UI 投射缺口。
- [x] 在 `LifeOS/packages/web/src/components/WorkerTaskDetail.vue` 把 websocket 处理改为同时消费 `worker-task-updated` 与命中当前 task id 的 `note-worker-tasks-updated`，让任务详情能在输出笔记就绪等场景下自动重拉最新任务事实源。
- [x] 在 `LifeOS/packages/web/src/components/WorkerTaskDetail.test.ts` 增加 focused 回归，锁定当前弹层会在命中的 `note-worker-tasks-updated` 到达后刷新输出笔记与摘要，同时不会被其他 task 的 note-worker websocket 误触发。
- [x] 跑 focused 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/components/TodayTodos.test.ts src/components/NoteList.test.ts src/components/DashboardOverview.test.ts src/views/DimensionView.test.ts src/components/WorkerTaskDetail.test.ts`。

## 结果
- WorkerTaskDetail 现在能正确投射 shared/server 已有的 note-worker websocket contract，输出笔记与结果摘要不再依赖手动刷新才能出现在详情弹层中。
- 当前这一轮 WorkerTaskDetail websocket 收口已完成并通过 focused 验证；下一轮可继续找新的非 Settings 主路径 stale UI / fact-source gap。

---
