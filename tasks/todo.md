# 当前轮：WeeklyHighlights header copy 中文化收口

## 进展
- [x] 识别新的 dashboard 主路径 copy gap：`LifeOS/packages/web/src/components/WeeklyHighlights.vue` 的 panel kicker / badge 仍残留 `Priority Watch` 和 `Week Pulse` 英文文案，与最近几轮 dashboard 主路径中文化收口口径不一致。
- [x] 在 `LifeOS/packages/web/src/components/WeeklyHighlights.vue` 做最小文案修正：将 kicker 改为“本周重点”，badge 改为“周节律”，不改变组件结构和行为。
- [x] 在 `LifeOS/packages/web/src/components/WeeklyHighlights.test.ts` 补 focused 回归，锁定 weekly highlights header 显示新的中文文案，且不再回退到 `Priority Watch` / `Week Pulse`。
- [x] 跑受影响 web 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/components/WeeklyHighlights.test.ts`。

## 结果
- dashboard 的 weekly highlights 面板标题区已统一为中文口径，不再残留英文 kicker / badge 文案。
- 这次补的是新的用户可见主路径 copy gap，仍在 dashboard 主路径，不涉及 settings 深链补强。

## 下一步建议
- 下一轮继续找新的 server/web/shared contract gap 或事实源一致性问题，优先看其它主路径组件是否还存在英文 header、badge、summary 没有对齐当前中文产品口径。

---
