# 当前轮：TodayTodos header copy 中文化收口

## 进展
- [x] 识别新的 dashboard 主路径 copy gap：`LifeOS/packages/web/src/components/TodayTodos.vue` 的 panel header 仍残留 `Execution Queue` 和 `items` 英文文案，与最近几轮主路径中文化收口口径不一致。
- [x] 在 `LifeOS/packages/web/src/components/TodayTodos.vue` 做最小文案修正：将 kicker 改为“今日执行队列”，badge 改为 `{{ orderedTodos.length }} 项`，不改变组件行为。
- [x] 在 `LifeOS/packages/web/src/components/TodayTodos.test.ts` 补 focused 回归，锁定 dashboard todo header 显示新的中文文案，且不再回退到 `Execution Queue` / `items`。
- [x] 跑受影响 web 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/components/TodayTodos.test.ts`。

## 结果
- dashboard 的今日任务面板标题区已统一为中文口径，不再残留英文 header/badge 文案。
- 这次补的是新的用户可见主路径 copy gap，仍在 dashboard 主路径，不涉及 settings 深链补强。

## 下一步建议
- 下一轮继续找新的 server/web/shared contract gap 或事实源一致性问题，优先看其它主路径组件是否还存在英文 badge、summary、header copy 没有对齐当前中文产品口径。

---
