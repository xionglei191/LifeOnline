# 当前轮：Dashboard hero attention fact-source 收口

## 进展
- [x] 识别 `LifeOS/packages/web/src/components/DashboardOverview.vue` 的 hero summary 之前把“最高关注度”直接绑定到 `health_score` 最高维度，但文案表达的是“当前最需要投入”，真实语义应来自 open work（`pending + in_progress`）而不是健康分；这是新的事实源一致性缺口。
- [x] 在 `LifeOS/packages/web/src/components/DashboardOverview.vue` 新增基于 open work 的 `attentionRankedStats` / `topAttentionDimensionLabel`，让 hero summary 的“最需要投入维度”与当前活跃事项负载一致，同时保留 signal band 继续按 `health_score` 展示生命信号。
- [x] 在 `LifeOS/packages/web/src/components/DashboardOverview.test.ts` 增加 focused 回归，锁定高健康分但低 open work 的维度不会再被误说成当前最该投入的维度。
- [x] 跑 focused 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/components/DashboardOverview.test.ts`。

## 结果
- Dashboard hero summary 现在不再把“健康高”误说成“最需要投入”，主页事实表述与实际负载来源分离且一致。
- 当前这一轮 dashboard attention fact-source 收口完成后，下一轮可继续找新的非 Settings 主路径 contract / fact-source / stale visibility gap。

---
