# 当前轮：Dashboard hero eyebrow 中文化收口

## 进展
- [x] 识别新的 dashboard 主路径 copy gap：`LifeOS/packages/web/src/components/DashboardOverview.vue` 的 hero eyebrow 仍残留 `Life Signals / Today` 英文文案，与最近几轮 dashboard 主路径中文化收口口径不一致。
- [x] 在 `LifeOS/packages/web/src/components/DashboardOverview.vue` 做最小文案修正：将 eyebrow 改为“生命信号 / 今日聚焦”，不改变 hero 结构与统计逻辑。
- [x] 在 `LifeOS/packages/web/src/components/DashboardOverview.test.ts` 补 focused 回归，锁定 hero 显示新的中文 eyebrow，且不再回退到 `Life Signals / Today`。
- [x] 跑受影响 web 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/components/DashboardOverview.test.ts`。

## 结果
- dashboard hero 标题区已进一步统一为中文口径，不再残留英文 eyebrow 文案。
- 这次补的是新的用户可见主路径 copy gap，仍在 dashboard 主路径，不涉及 settings 深链补强。

## 下一步建议
- 下一轮继续找新的 server/web/shared contract gap 或事实源一致性问题，优先看其它主路径组件是否还存在英文 eyebrow、header、badge、summary 没有对齐当前中文产品口径。

---
