# 当前轮：Dimension stats completion-rate semantics 收口

## 进展
- [x] 识别 `LifeOS/packages/web/src/components/DimensionStats.vue` 仍把 `done / total` 计算出的分数环标成英文 `health`，并且 summary 没有直接暴露完成率，和 dashboard 主路径刚收口的命名不一致，属于真实的事实表达漂移。
- [x] 在 `LifeOS/packages/web/src/components/DimensionStats.vue` 把圆环标签改成 `完成率`，数值改为带 `%` 的完成率，并在 summary 中直接补上 `完成率 xx%`，让维度页 hero 与 dashboard 对同一 `DimensionStat` 语义保持一致。
- [x] 新增 `LifeOS/packages/web/src/components/DimensionStats.test.ts` focused 回归，锁定 hero ring 和 summary 都会渲染 completion-rate facts，并防止旧 `health` 文案回归。
- [x] 跑 focused 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/components/DimensionStats.test.ts src/views/DimensionView.test.ts`。

## 结果
- 维度页主路径现在不再把完成率伪装成抽象 `health` 概念。
- dashboard 与 dimension 页面对同一统计值的命名进一步统一，减少跨页面理解切换成本。

---
