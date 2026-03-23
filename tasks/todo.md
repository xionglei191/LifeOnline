# 当前轮：Dashboard inbox dimension route projection 收口

## 进展
- [x] 识别新的 contract-to-UI 投射缺口：`LifeOS/packages/web/src/components/DimensionHealth.vue` 对所有维度都统一跳 `/dimension/${stat.dimension}`，当 shared canonical 维度是 `_inbox` 时会落到 `/dimension/_inbox`，没有投射到产品里已经存在的专用 `/inbox` 路由。
- [x] 在 `LifeOS/packages/web/src/components/DimensionHealth.vue` 补齐最小路由投射：`_inbox` 卡片改走 `/inbox`，其它维度继续走 `/dimension/:dimension`。
- [x] 在 `LifeOS/packages/web/src/components/DimensionHealth.test.ts` 增加 focused 回归，锁定 canonical `_inbox` 卡片点击会进入专用 inbox 主路径。
- [x] 跑受影响 web 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/components/DimensionHealth.test.ts`。

## 结果
- dashboard / dimension matrix 现在把 shared canonical `_inbox` 事实正确投射到真实 inbox 主路径，而不是落到不一致的 dimension 参数路径。
- 这补上的是新的 canonical contract-to-route projection gap，不是同类状态清理的模式平移。

## 下一步建议
- 下一轮继续找 canonical fact 到 route / UI 的漏投射，优先看其它 `_inbox`、shared dimension、或 dedicated route 场景是否仍被通用字符串拼接覆盖掉。

---
