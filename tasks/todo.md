# 当前轮：Inbox dashboard dimension stats contract 收口

## 进展
- [x] 识别新的 server/web contract gap：`LifeOS/packages/web/src/views/DimensionView.vue` 与 `src/composables/useDimensionNotes.ts` 已将 inbox 主路径映射到 canonical `_inbox` 维度，但 `LifeOS/packages/server/src/api/handlers.ts` 的 dashboard `dimensionStats` 仍漏掉 `_inbox`，导致 inbox hero stats 在真实接口下只能退回零值。
- [x] 在 `LifeOS/packages/server/src/api/handlers.ts` 把 `_inbox` 纳入 dashboard `dimensionStats` 生成列表，让 inbox 路由读取 dashboard 时能拿到 canonical 维度统计，而不是只靠 `inboxCount` 单独兜底。
- [x] 在 `LifeOS/packages/server/test/configLifecycle.test.ts` 增加 focused API 合约回归，锁定 `/api/dashboard` 会返回 `_inbox` 维度统计，且与 `inboxCount` 一致。
- [x] 复核 `LifeOS/packages/web/src/views/DimensionView.test.ts` 已有 inbox 路由断言，会直接消费 `_inbox` dashboard stat，因此本轮不重复平移同类 web 测试。
- [x] 跑 focused 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/DimensionView.test.ts` 通过；server 侧新增断言 `dashboard dimension stats include the canonical _inbox dimension for the inbox view` 已通过，但 `test/configLifecycle.test.ts` 整文件仍被一条既有失败 `updating config treats equivalent vault paths as unchanged after normalization` 拉红。

## 结果
- inbox 主路径现在能从 canonical dashboard contract 直接拿到 `_inbox` hero stats，不再出现 web 已支持、server 却漏发该维度的事实断裂。
- `inboxCount` 与 `dimensionStats[_inbox]` 现在来自同一事实源视角，减少了 inbox 页面与 dashboard 数据表达不一致的风险。

## 下一步建议
- 下一轮优先看 dashboard today todos 的 priority 排序是否仍按字符串排序，若是，则修成与 shared priority 语义一致的 server 排序，避免首页主路径把 medium/low 排到 high 前面。

---
