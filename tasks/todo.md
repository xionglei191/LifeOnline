# 当前轮：note-created / note-deleted websocket contract 收口

## 进展
- [x] 识别 create / delete 仍然缺失 first-class websocket contract：server 只创建/删除文件并依赖 index 或 watcher 兜底，web 主路径列表与统计面板会继续等待 index-only 事件，属于新的 shared/server/web contract gap。
- [x] 在 `LifeOS/packages/shared/src/types.ts` 增加 `note-created` / `note-deleted` 事件定义；同时把 note id 计算统一收口到 `LifeOS/packages/server/src/indexer/parser.ts` 导出的 `buildNoteId`，避免继续在 server 侧重复散落同一规则。
- [x] 在 `LifeOS/packages/server/src/api/handlers.ts` 的 `createNote` / `deleteNote` 成功路径广播 `note-created` / `note-deleted`，让应用内主动创建/删除笔记时立即提供 websocket 事实源，而不是只信后续索引波动。
- [x] 在 `LifeOS/packages/web/src/composables/useDimensionNotes.ts`、`web/src/composables/useDashboard.ts`、`web/src/views/SearchView.vue`、`web/src/views/StatsView.vue` 把 `note-created` / `note-deleted` 纳入主路径刷新门禁，覆盖维度列表、dashboard、搜索、统计等直接用户可见界面。
- [x] 补 focused 回归：`useDimensionNotes.test.ts`、`useDashboard.test.ts`、`DashboardOverview.test.ts`、`SearchView.test.ts`、`StatsView.test.ts`，锁定这些主路径会在新 note create/delete contract 到达后刷新，而不是继续只依赖 index-only 路径。
- [x] 跑 focused 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/composables/useDimensionNotes.test.ts src/composables/useDashboard.test.ts src/components/DashboardOverview.test.ts src/views/SearchView.test.ts src/views/StatsView.test.ts`。

## 结果
- LifeOS 现在对应用内创建/删除笔记具备 shared/server/web 一致的 websocket contract，主路径列表、dashboard、搜索、统计可以立刻跟进刷新，不再被迫等待 index-only 链路落稳。
- 当前这一轮 create/delete websocket contract 收口已完成并通过 focused 验证；下一轮可继续找新的非 Settings 主路径事实源或 contract-to-UI 缺口。

---
