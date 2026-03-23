# 当前轮：Note preview priority/recency facts 收口

## 进展
- [x] 识别 `LifeOS/packages/web/src/components/NotePreview.vue` 虽然已经展示 due / priority 的一部分事实，但 single-note preview 缺少 `priority`，multi-note preview 缺少 `updated`，导致 timeline hover / picker 两条主路径对同一 shared `Note` facts 投射仍不一致。
- [x] 在 `LifeOS/packages/web/src/components/NotePreview.vue` 补上 single-note preview 的 priority 与 updated，以及 multi-note preview 的 updated，让 hover preview 也能直接暴露紧急度和最近更新时间。
- [x] 在 `LifeOS/packages/web/src/components/NotePreview.test.ts` 增加 focused 回归，锁定 preview 会渲染 priority / due / updated facts。
- [x] 跑 focused 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/components/NotePreview.test.ts src/components/TimelineTrack.test.ts`。

## 结果
- 时间线主路径的 hover preview 和 picker 现在对 note priority / recency 的事实表达更一致。
- 用户在 timeline 上无需进入 detail，也能更快判断哪条记录更紧急、哪条最近刚更新。

---
