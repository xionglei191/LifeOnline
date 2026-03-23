# 当前轮：App / FilterBar / Stats 主路径中文化收口

## 进展
- [x] 判断本轮是否需要继续：仓库中已存在一组未提交的同类主路径中文化改动，且都属于用户可见的 web shell / stats / dimension 主路径 copy gap，继续本轮有价值，不属于重复空转。
- [x] 收口 `LifeOS/packages/web/src/App.vue` 顶层 shell 文案：将品牌 kicker `Personal Mission Control` 改为“个人任务中枢”，并把导航 hint 从 `Today / Tracks / Calendar / Signals / Config` 统一改为“今日聚焦 / 轨迹回看 / 月历视图 / 信号分析 / 系统配置”。
- [x] 收口 `LifeOS/packages/web/src/components/FilterBar.vue` 与 `LifeOS/packages/web/src/views/StatsView.vue` 的残留英文 kicker：分别改为“信号筛选”“完成趋势”。
- [x] 补回归测试：
  - `LifeOS/packages/web/src/App.test.ts`
  - `LifeOS/packages/web/src/views/DimensionView.test.ts`
  - `LifeOS/packages/web/src/views/StatsView.test.ts`
  锁定中文主路径文案，并确认不再回退到 `Personal Mission Control / Today / Tracks / Calendar / Signals / Config / Signal Filters / Completion Flow`。
- [x] 跑 web 验证：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/DimensionView.test.ts src/views/StatsView.test.ts`
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/App.test.ts`

## 结果
- LifeOS 顶层 shell、维度筛选区与 stats 趋势区的主路径 copy 进一步统一到当前中文产品口径。
- 本轮仍是用户可见主路径文案收口，不涉及 grouped governance / settings 深链逻辑，也没有碰 server/shared contract。
- 扫描后仍可见一些英文残留，但主要集中在 `NoteDetail`、`PromotionProjectionPanel`、`SoulActionGovernancePanel`、`CalendarView`、`TimelineView`、`SearchView`、`SettingsView` 等次级页面或治理面，不是本轮最小收口范围。

## 下一步建议
- 下一轮优先从“新高价值缺口”出发，而不是继续零散 copy 打磨：先看 server/web/shared contract gap、事实源一致性、websocket 刷新一致性，或治理面/设置页主路径是否存在真正断裂。
- 如果暂时仍做文案收口，优先检查 `LifeOS/packages/web/src/views/StatsView.vue` 的 eyebrow `Signal Analytics`，以及 `TimelineView` / `CalendarView` / `SearchView` 这些一级视图的英文 eyebrow 是否应统一中文化。

---
