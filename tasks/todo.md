# 当前轮：Stats radar title dynamic copy 收口

## 进展
- [x] 识别新的 stats contract-to-copy 投射缺口：`LifeOS/packages/web/src/views/StatsView.vue` 的雷达卡标题仍固定写成“八维度完成率”，但图表实际由 `fetchStatsRadar()` 返回的实时维度集合驱动，会误表述当前真实统计口径。
- [x] 在 `LifeOS/packages/web/src/views/StatsView.vue` 补齐最小动态文案投射：新增 `radarDimensionCount` / `radarTitle`，在 `loadRadar()` 中按真实 radar 数据条数更新标题，改为 `当前 N 个维度完成率`。
- [x] 在 `LifeOS/packages/web/src/views/StatsView.test.ts` 增加 focused 回归，锁定 radar 只返回 2 个维度时页面文案显示 `当前 2 个维度完成率`，且不再回退到固定“八维度完成率”。
- [x] 跑受影响 web 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/StatsView.test.ts`。

## 结果
- stats 页的 radar panel 标题现在会准确投到真实 radar 维度集合，不再把动态事实源误写成固定“八维度”。
- 这次补的是新的用户可见 contract-to-UI 投射缺口，且落点在 stats 主路径，不是继续深挖 settings 那条已收敛链路。

## 下一步建议
- 下一轮继续找新的 server/web/shared contract gap 或主路径事实源一致性问题，优先看 stats / dashboard 之外还有没有图表标题、badge、summary 仍把动态集合写死成固定口径。

---
