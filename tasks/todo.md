# 当前轮：Stats hero window copy 中文化收口

## 进展
- [x] 识别新的 stats 主路径 copy gap：`LifeOS/packages/web/src/views/StatsView.vue` 的 hero metric 仍把趋势窗口说明写成英文 `days`，与同页已收口的中文文案口径不一致，也不直接表达这个数字代表的事实。
- [x] 在 `LifeOS/packages/web/src/views/StatsView.vue` 做最小文案修正：把趋势窗口的 meta 改为“当前趋势窗口天数”，让 hero 直接表达该指标含义。
- [x] 在 `LifeOS/packages/web/src/views/StatsView.test.ts` 补 focused 回归，锁定 stats hero 显示中文窗口说明，且不再回退到英文 `days`。
- [x] 跑受影响 web 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/StatsView.test.ts`。

## 结果
- stats hero 现在把趋势窗口指标明确表述为中文事实说明，不再残留英文占位词。
- 这次补的是新的用户可见主路径 copy gap，仍落在 stats 主路径，不涉及 settings 那条已深挖链路。

## 下一步建议
- 下一轮继续找新的 server/web/shared contract gap 或事实源一致性问题，优先看其它主路径是否还存在英文占位或固定 copy 没有准确表达真实指标含义。

---
