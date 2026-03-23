# 当前轮：AISuggestions header copy 中文化收口

## 进展
- [x] 识别新的 dashboard 主路径 copy gap：`LifeOS/packages/web/src/components/AISuggestions.vue` 的 panel kicker 仍残留 `AI Insight Stream` 英文文案，与最近几轮 dashboard 主路径中文化收口口径不一致。
- [x] 在 `LifeOS/packages/web/src/components/AISuggestions.vue` 做最小文案修正：将 kicker 改为“AI 洞察流”，不改变组件行为与刷新链路。
- [x] 在 `LifeOS/packages/web/src/components/AISuggestions.test.ts` 补 focused 回归，锁定 dashboard AI 洞察面板显示新的中文文案，且不再回退到 `AI Insight Stream`。
- [x] 修正新增测试时引入的一处测试结构问题，并重新跑通受影响验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/components/AISuggestions.test.ts`。

## 结果
- dashboard 的 AI 洞察面板标题区已统一为中文口径，不再残留英文 kicker 文案。
- 这次补的是新的用户可见主路径 copy gap，仍在 dashboard 主路径，不涉及 settings 深链补强。

## 下一步建议
- 下一轮继续找新的 server/web/shared contract gap 或事实源一致性问题，优先看其它主路径组件是否还存在英文 header、badge、summary、kicker 没有对齐当前中文产品口径。

---
