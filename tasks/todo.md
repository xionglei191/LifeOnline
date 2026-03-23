# 当前轮：Dashboard dimension matrix canonical copy 收口

## 进展
- [x] 识别新的 contract-to-UI 投射缺口：`LifeOS/packages/web/src/components/DimensionHealth.vue` 已能展示 canonical `_inbox` 卡片，但面板标题仍固定写成“八维度生命矩阵”，badge 也固定写成 “8 channels”，会在包含 inbox 入口的主路径上误表述当前数据集合。
- [x] 在 `LifeOS/packages/web/src/components/DimensionHealth.vue` 补齐最小文案投射：当 stats 含 `_inbox` 时标题改为“生命矩阵与 Inbox 入口”，badge 改为实际 `stats.length`；无 `_inbox` 时保留“八维度生命矩阵”。
- [x] 在 `LifeOS/packages/web/src/components/DimensionHealth.test.ts` 增加 focused 回归，锁定含 `_inbox` 与不含 `_inbox` 两种 canonical 集合下的 header/badge 文案都与真实数据集合一致。
- [x] 跑受影响 web 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/components/DimensionHealth.test.ts`。

## 结果
- dashboard / dimension matrix 现在不仅把 canonical `_inbox` 路由投到正确主路径，也把标题和 badge 文案投射到真实数据集合，不再用“八维度 / 8 channels”误描述包含 inbox 的卡片集。
- 这补的是新的 canonical fact-to-copy 投射缺口，不是重复做路由或状态清理。

## 下一步建议
- 下一轮继续找 dashboard / stats 上其它 canonical fact-to-copy gap，优先看 hero 文案、badge、panel title 是否还在用固定文案描述已变成动态集合的数据。

---
