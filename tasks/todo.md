# 当前轮：Weekly highlights priority/due facts 收口

## 进展
- [x] 识别 `LifeOS/packages/web/src/components/WeeklyHighlights.vue` 虽然 shared `Note` contract 已提供 `priority` / `due`，但 dashboard 主路径的重点卡片只显示维度和状态，导致真正决定跟进紧迫度的事实没有被投射出来，属于真实的 contract-to-UI 缺口。
- [x] 在 `LifeOS/packages/web/src/components/WeeklyHighlights.vue` 补充 priority 与 due 展示，让本周重点卡片直接暴露优先级和截止信息，同时复用现有 shared note 字段，不引入新 contract。
- [x] 在 `LifeOS/packages/web/src/components/WeeklyHighlights.test.ts` 增加 focused 回归，锁定 highlight 卡片会渲染 priority / due / status 事实。
- [x] 跑 focused 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/components/WeeklyHighlights.test.ts`。

## 结果
- Dashboard 的 weekly highlights 现在不再只有标题和状态，用户能直接看到优先级与截止时间，主路径决策信息更完整。
- 当前这一轮 weekly highlight facts 收口完成后，下一轮可继续找新的非 Settings 主路径 contract / fact-source / stale visibility gap。

---
