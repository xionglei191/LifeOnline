# 当前轮：AI suggestions recency visibility 收口

## 进展
- [x] 识别 `LifeOS/packages/web/src/components/AISuggestions.vue` 虽然 shared `AISuggestion` contract 已提供 `createdAt`，但 dashboard 主路径的 insight 卡片完全不展示时间，用户无法判断洞察是刚生成还是旧结果复用，属于真实的 contract-to-UI 可见性缺口。
- [x] 在 `LifeOS/packages/web/src/components/AISuggestions.vue` 补充 `createdAt` 的本地化时间展示，让 insight 卡片直接暴露 recency，同时保留现有 type / dimension 投射不变。
- [x] 在 `LifeOS/packages/web/src/components/AISuggestions.test.ts` 增加 focused 回归，锁定 dashboard insight 卡片会渲染时间信息。
- [x] 跑 focused 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/components/AISuggestions.test.ts`。

## 结果
- Dashboard 上的 AI suggestions 现在能直接显示洞察生成时间，主路径不再只看得到内容却看不到新旧。
- 当前这一轮 recency visibility 收口完成后，下一轮可继续找新的非 Settings 主路径 contract / fact-source / stale visibility gap。

---
