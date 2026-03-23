# 当前轮：Stats card kicker 中文化收口

## 进展
- [x] 识别新的 stats 主路径 copy gap：`LifeOS/packages/web/src/views/StatsView.vue` 的雷达 / 月度 / 标签卡片 kicker 仍残留 `Balance Radar`、`Monthly Shift`、`Tag Heat` 英文文案，与最近几轮同页中文化收口不一致。
- [x] 在 `LifeOS/packages/web/src/views/StatsView.vue` 做最小文案修正：将三个 kicker 分别改为“维度雷达”“月度对比”“标签热度”，保持信息结构不变。
- [x] 在 `LifeOS/packages/web/src/views/StatsView.test.ts` 补 focused 回归，锁定 stats 主路径显示新的中文 kicker，且不再回退到上述英文文案。
- [x] 跑受影响 web 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/StatsView.test.ts`。

## 结果
- stats 主路径卡片标题区已统一为中文口径，不再残留英文 kicker。
- 这次补的是新的用户可见主路径 copy gap，仍在 stats 主路径，不涉及 settings 深链补强。

## 下一步建议
- 下一轮继续找新的 server/web/shared contract gap 或事实源一致性问题，优先看其它主路径是否还存在英文 kicker、badge 或 summary 没有准确对齐当前中文产品口径。

---
