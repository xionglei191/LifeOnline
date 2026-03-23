# 当前轮：Dashboard hero average completion copy 收口

## 进展
- [x] 识别新的 dashboard contract-to-copy 投射缺口：`LifeOS/packages/web/src/components/DashboardOverview.vue` 的平均完成率 metric 实际基于 `dashboardDimensionStats` 这个动态可见维度集合计算，但文案仍固定写成“八维度平均完成进度”，会误表述当前真实统计口径。
- [x] 在 `LifeOS/packages/web/src/components/DashboardOverview.vue` 补齐最小动态文案投射：平均完成率说明改为 `当前 {{ dashboardDimensionStats.length }} 个维度的平均完成进度`，与真实统计集合一致，并继续保持 `_inbox` 不进入 dashboard hero metrics 的既有边界。
- [x] 在 `LifeOS/packages/web/src/components/DashboardOverview.test.ts` 增加 focused 回归，锁定普通维度集合与包含 `_inbox` 原始 stats 的场景下，hero 平均完成率文案都只反映可见维度集合，不再回退到“八维度平均完成进度”。
- [x] 跑受影响 web 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/components/DashboardOverview.test.ts`。

## 结果
- dashboard hero 的平均完成率说明现在会准确投到当前可见维度集合，不再把动态统计口径误写成固定“八维度”。
- 这次补的是新的 contract-to-UI copy gap，且直接锁住 `_inbox` 被过滤后的真实统计边界，不是重复做 settings websocket/filter/retention 同型补强。

## 下一步建议
- 下一轮继续找新的 server/web/shared contract gap 或用户可见主路径缺口，优先看 stats / dashboard 之外是否还有动态事实集合被固定 copy 误描述的地方。

---
