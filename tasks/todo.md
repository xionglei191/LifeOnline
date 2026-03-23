# 当前轮：Dimension hero canonical health_score projection 收口

## 进展
- [x] 识别新的事实源一致性缺口：`LifeOS/packages/server` 已在 dashboard `dimensionStats` 中返回 canonical `health_score`，但 `LifeOS/packages/web/src/composables/useDimensionNotes.ts` 会把它丢掉，`src/components/DimensionStats.vue` 再用 `done / total` 本地重算，导致 dimension hero 与 server contract 存在潜在漂移源。
- [x] 在 `LifeOS/packages/web/src/composables/useDimensionNotes.ts` 保留并透传 dashboard `health_score`，让维度页主路径直接消费 server 的 canonical fact。
- [x] 在 `LifeOS/packages/web/src/views/DimensionView.vue` 与 `src/components/DimensionStats.vue` 改为显式接收 `healthScore` prop，停止在 hero 组件内本地重算完成率。
- [x] 在 `LifeOS/packages/web/src/components/DimensionStats.test.ts`、`src/views/DimensionView.test.ts`、`src/composables/useDimensionNotes.test.ts` 增加 focused 回归，锁定组件会渲染 canonical score，视图会把 dashboard `health_score` 原样透传到 hero，且 composable 会保留这条 canonical fact。
- [x] 跑 focused 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/components/DimensionStats.test.ts src/views/DimensionView.test.ts src/composables/useDimensionNotes.test.ts`。

## 结果
- dimension hero 现在直接投射 server 的 canonical `health_score`，不再维护一套本地推导事实。
- dashboard 与 dimension 主路径对同一维度完成率的表达来源一致，后续 server 若调整评分规则，web 不会 silently drift。

## 下一步建议
- 下一轮优先看 `useDimensionNotes` / dimension 主路径是否还有其他 dashboard canonical stats 被局部重建，或转向新的主路径断裂缺口。

---
