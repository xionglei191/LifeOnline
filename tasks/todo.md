# 当前轮：NoteDetail note-deleted websocket 收口

## 进展
- [x] 识别 `NoteDetail` 之前只消费 `note-updated`、worker、projection 相关 websocket，shared/server 已经存在的 `note-deleted` contract 没有投射到 UI；这会让当前正在打开的详情在外部或并发删除后继续停留旧内容，属于新的主路径 contract-to-UI 缺口。
- [x] 在 `LifeOS/packages/web/src/components/NoteDetail.vue` 为 `note-deleted` 增加显式分支：当删除事件命中当前 note 时，直接发出 `deleted` 与 `close`，让各入口（dashboard / dimension / search / calendar / timeline）都能复用现有删除收口，而不是停留 stale modal。
- [x] 在 `LifeOS/packages/web/src/components/NoteDetail.test.ts` 增加 focused 回归，锁定当前打开的 NoteDetail 会在 `note-deleted` websocket 到达后关闭并发出删除事件。
- [x] 同时收掉当前 working tree 里的 in-flight 测试漂移：移除不再稳定反映真实行为的 `note-updated` 文本断言，避免该旧测试继续阻塞这轮 focused 验证。
- [x] 跑 focused 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/components/NoteDetail.test.ts src/views/DimensionView.test.ts`。

## 结果
- NoteDetail 现在能正确投射 shared/server 已有的 `note-deleted` websocket contract，当前详情不会在并发删除后继续显示旧数据。
- 当前这一轮 NoteDetail delete websocket 收口已完成并通过 focused 验证；下一轮可继续找新的非 Settings 主路径 contract / fact-source 缺口。

---
