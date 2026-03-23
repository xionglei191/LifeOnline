# 当前轮：next-action reintegration evidence 投射到 web 控制面

## 进展
- [x] 重新读取 `README`、`CLAUDE.md`、`vision/00-权威基线`、`vision/01-当前进度`、`vision/02-历史草案` 相关主线文稿，并确认本轮继续沿“反馈回流 → 下一轮动作候选”的第一阶段骨架推进。
- [x] 检查当前 working tree，确认已有 grouped governance 相关 web 改动保持原样，不覆盖它们；本轮改动只落在 `SettingsView` reintegration 控制面和对应测试。
- [x] 在 `LifeOS/packages/web/src/views/SettingsView.vue` 为 `extract_tasks` 型 reintegration record 增加主列表可见的 next-action strip：显示产出任务数量与保守派生的 `nextActionCandidate`，让“这次回流产生了什么下一步行动”不再只藏在 JSON evidence 里。
- [x] 在 `LifeOS/packages/web/src/views/SettingsView.vue` 的 expanded detail 增加 `Next-action evidence` 区块，结构化展示 `extractTaskItems` 的 title / dimension / priority / due / output note id，形成 server/shared contract 到 web 控制面的真实投射。
- [x] 在 `LifeOS/packages/web/src/views/SettingsView.test.ts` 补 focused 回归，锁定 next-action strip 和 expanded evidence 渲染，确保后续不会再退回“只有原始 JSON 可见”的状态。
- [x] 跑受影响 web 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts`。

## 结果
- Settings 的 reintegration review 控制面现在能直接看见 `extract_tasks` 回流产出的下一步行动摘要，而不必先人工展开 JSON 才知道这条回流到底带来了哪些任务候选。
- 这让上一轮 server/shared 里新增的 `extractTaskItems` / `nextActionCandidate` 不再只是“存在于 contract 中”，而真正进入联合认知体运行态的可见控制面。
- 本轮没有新增自动执行或治理越权，只是把已存在的 next-action 事实源投射到 review 面，符合“记录优先于放权”的第一阶段约束。

## 下一步建议
- 下一轮优先检查 accept / plan 之后的 `reintegrations -> soul_actions` 映射里，`extract_tasks` 这类 next-action evidence 是否已经被 `generateSoulActionsFromOutcome(...)` / promotion planner 真正利用；如果还没有，可继续补 server 侧从 accepted reintegration 到 follow-up SoulAction 的真实闭环。

---
