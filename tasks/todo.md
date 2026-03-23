# 当前轮：Dashboard hero canonical dimensions 收口

## 进展
- [x] 识别新的主路径事实断裂：server 现在会把 `_inbox` 一并放进 dashboard `dimensionStats`，但 `LifeOS/packages/web/src/components/DashboardOverview.vue` 仍直接拿整组 stats 计算“八维度平均完成率 / 最高积压维度 / signal chips”，导致首页 hero 文案写的是八维度，实际却会被 `_inbox` 污染。
- [x] 在 `LifeOS/packages/web/src/components/DashboardOverview.vue` 增加 canonical dashboard-dimension 过滤层，把 `_inbox` 从 hero summary、平均完成率、积压维度和 signal chips 中排除，但保留 inbox banner 自身继续使用 `inboxCount`。
- [x] 在 `LifeOS/packages/web/src/components/DashboardOverview.test.ts` 增加 focused 回归，锁定即使 dashboard contract 带 `_inbox`，首页 hero 仍只按八维度计算，不会把 `_inbox` 误显示成最需要投入的维度或 signal card。
- [x] 跑 focused 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/components/DashboardOverview.test.ts`。

## 结果
- dashboard 首页 hero 现在与自己的“八维度”文案保持一致，不会因为 inbox contract 扩展而 silently 把 `_inbox` 混进主信号层。
- `_inbox` 仍通过独立 inbox banner 暴露，不会丢失提醒价值，但也不再污染 dimension 级主路径排序与平均值。

## 下一步建议
- 下一轮优先检查 dashboard / search / timeline 等主路径上是否还有类似“contract 扩展后被错误混入 canonical 主集合”的地方，继续找新的用户可见断裂。

---
