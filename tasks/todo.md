# 当前轮：Today todos recency visibility 收口

## 进展
- [x] 识别 `LifeOS/packages/web/src/components/TodayTodos.vue` 虽然 shared `Note` contract 已提供 `updated`，但 dashboard 主路径的今日任务卡片仍看不到最近更新时间，导致用户无法分辨当前队列里哪些任务刚被更新过，属于真实的 contract-to-UI 可见性缺口。
- [x] 在 `LifeOS/packages/web/src/components/TodayTodos.vue` 补充 `updated` 的本地化时间展示，让今日任务卡片直接暴露 recency，同时保留现有 priority / due / status 投射不变。
- [x] 在 `LifeOS/packages/web/src/components/TodayTodos.test.ts` 增加 focused 回归，锁定 dashboard todo 会渲染最近更新时间。
- [x] 跑 focused 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/components/TodayTodos.test.ts`。

## 结果
- Dashboard 的 today todos 现在能直接显示最近更新时间，主路径更容易判断哪些任务是最新回流或刚刚被处理过。
- 当前这一轮 todo recency 收口完成后，下一轮可继续找新的非 Settings 主路径 contract / fact-source / stale visibility gap。

---
