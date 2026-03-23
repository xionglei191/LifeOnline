# 当前轮：Dashboard signal band fact projection 收口

## 进展
- [x] 识别 `LifeOS/packages/web/src/components/DashboardOverview.vue` 的 hero signal band 仍只展示维度名和裸 `health_score` 数字，和刚收口的 `DimensionHealth` 一样，主路径无法直接判断分数语义，也看不到该维度的 open-work / 完成进度，属于新的 contract-to-UI 投射缺口。
- [x] 在 `LifeOS/packages/web/src/components/DashboardOverview.vue` 把 signal chip 改成明确展示 `完成率 xx%`，并补上 `活跃 x 项 · 完成 done/total`，让 hero summary、signal band、dimension matrix 三处对同一维度事实表达保持一致。
- [x] 在 `LifeOS/packages/web/src/components/DashboardOverview.test.ts` 增加 focused 回归，锁定 signal band 会渲染 completion-rate 标签和 progress facts。
- [x] 跑 focused 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/components/DashboardOverview.test.ts src/components/DimensionHealth.test.ts`。

## 结果
- Dashboard 顶部 signal band 现在不再只暴露语义不明的分数，而是直接解释为完成率并附带 open-work / completion facts。
- hero、signal band、dimension matrix 对 `DimensionStat` 的主路径表达进一步对齐，降低了用户对同一指标的误读风险。

---
