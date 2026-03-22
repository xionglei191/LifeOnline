# 当前轮：Dimension hero canonical stats 收口

## 进展
- [x] 识别 `DimensionView` / `useDimensionNotes` 之前把 hero stats 完全从当前 `fetchNotes({ dimension })` 结果在前端本地重算，而 dashboard 已经有 canonical `dimensionStats` contract；这会让维度主页和 dashboard 对同一维度讲出不同事实源，属于新的事实源一致性缺口。
- [x] 在 `LifeOS/packages/web/src/composables/useDimensionNotes.ts` 复用现有 `fetchDashboard()` 返回的 `dimensionStats` 作为维度 hero 的 canonical 统计来源，同时继续保留 notes 列表本身走 `fetchNotes({ dimension })`，避免把 hero facts 和当前列表切片绑定在一起。
- [x] 在 `LifeOS/packages/web/src/composables/useDimensionNotes.test.ts` 与 `LifeOS/packages/web/src/views/DimensionView.test.ts` 增加 focused 回归，锁定维度 hero stats 现在取自 dashboard contract，而不是当前列表切片本地重算。
- [x] 跑 focused 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/composables/useDimensionNotes.test.ts src/views/DimensionView.test.ts`。

## 结果
- Dimension hero 现在和 dashboard 共享同一条 canonical 维度统计事实源，不再因为前端局部切片重算而漂移。
- 当前这一轮 dimension canonical stats 收口完成后，下一轮可继续找新的非 Settings 主路径 contract / stale UI gap。

---
