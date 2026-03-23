# 当前轮：Timeline picker note facts projection 收口

## 进展
- [x] 识别 `LifeOS/packages/web/src/components/TimelineTrack.vue` 的多笔记 picker 仍只展示 type 和 date，虽然 shared `Note` 已提供 `priority` / `updated`，但 timeline 主路径里无法判断同一天多条记录里哪条更紧急、哪条最近刚更新，属于新的 contract-to-UI 投射缺口。
- [x] 在 `LifeOS/packages/web/src/components/TimelineTrack.vue` 给 picker meta 补上 `priority` 和 `updated` 的直接展示，让 timeline 多笔记选择面板也能直接暴露决策相关 note facts。
- [x] 在 `LifeOS/packages/web/src/components/TimelineTrack.test.ts` 增加 focused 回归，锁定 picker 会渲染 shared priority 和 updated facts。
- [x] 跑 focused 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/components/TimelineTrack.test.ts src/views/TimelineView.test.ts`。

## 结果
- Timeline 主路径在同日多记录场景下，现在能直接区分更高优先级和最近更新的记录。
- note facts 在 dashboard / timeline 两条主路径的投射一致性进一步提升。

---
