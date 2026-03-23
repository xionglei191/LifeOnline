# 当前轮：Soul Action Governance 分组最近活跃事实收口

## 进展
- [x] 识别 `LifeOS/packages/web/src/components/SoulActionGovernancePanel.vue` 已有 grouped governance / quick filter / batch actions，但组级别仍缺少“最近活跃 / 最近动作”事实，用户难以判断哪组刚变化、该优先处理哪组。
- [x] 在 `LifeOS/packages/web/src/utils/soulActionGroups.ts` 为每个分组补充 `latestActivityAt` / `latestActivityLabel`，按 action 级最近活动（finished/started/discarded/deferred/approved/updated/created）计算，并改为按最近活跃排序，而不是仅按 reintegration 创建时间排序。
- [x] 在 `LifeOS/packages/web/src/components/SoulActionGovernancePanel.vue` 的组级 meta 区显式展示“最近创建/最近更新/最近批准/最近完成”等时间事实，帮助用户快速判断优先级。
- [x] 在 `LifeOS/packages/web/src/utils/soulActionGroups.test.ts`、`src/components/SoulActionGovernancePanel.test.ts`、`src/views/SettingsView.test.ts` 增加 focused 回归，锁定最新活跃排序、组级事实渲染，以及父视图向 panel 透传的 grouped props。
- [x] 跑 focused 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/utils/soulActionGroups.test.ts src/components/SoulActionGovernancePanel.test.ts src/views/SettingsView.test.ts`。

## 结果
- grouped governance 现在不只展示“有几条待治理/可派发”，还直接告诉用户这组最近发生了什么、是什么时候发生的。
- settings 页分组顺序会优先把最近刚批准/刚完成/刚更新的治理组放到前面，更贴近实际处理优先级。

## 下一步建议
- 如果这轮测试通过，下一步可继续补一个轻量组级排序提示（例如“按最近活跃排序”）或把最近活跃事实同步投射到 Reintegration Review，减少两块面板的信息落差。

---
