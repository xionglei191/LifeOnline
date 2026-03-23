# 当前轮：extract_tasks 回流改成真实 next-action reintegration

## 进展
- [x] 重新对齐 `README`、`CLAUDE.md`、`vision/00-权威基线`、`vision/01-当前进度`、`vision/02-历史草案` 直接相关文稿，并据此避开 grouped governance / copy polish，转向 outcome → reintegration → next action 主线缺口。
- [x] 检查当前 working tree 后确认不覆盖既有 web 未提交改动，改动集中落在 server/shared 主线：`extract_tasks` 之前虽然真实创建了 task note，但 reintegration 仍默认落到 `source_note`/弱 evidence，导致“已产生下一步行动”这一事实没有被一等保存。
- [x] 在 `LifeOS/packages/server/src/workers/continuityIntegrator.ts` 修正 `extract_tasks` 的 continuity target 为 `task_record`，不再因为有 `sourceNoteId` 就被压回 `source_note`。
- [x] 在 `LifeOS/packages/server/src/workers/feedbackReintegration.ts` 扩充回流 payload/evidence：保留 `extractTaskCreated`、结构化 `extractTaskItems`，并派生 `nextActionCandidate`，让 reintegration record 成为真实的“下一步行动结果包”，而不只是 summary/path 字符串。
- [x] 在 `LifeOS/packages/shared/src/types.ts` 增补 `ExtractTaskReintegrationEvidenceItem` 共享类型，给 server/web 后续消费结构化 next-action evidence 留出稳定 contract 落点。
- [x] 更新 focused server 回归：`LifeOS/packages/server/test/feedbackReintegration.test.ts` 锁定新的 `task_record` target、结构化 extract-task evidence 与推荐 next action；`LifeOS/packages/server/test/reintegrationApi.test.ts` 同步修复过时 `candidate_task` signalKind 漂移。
- [x] 跑受影响 server 验证：`cd "/home/xionglei/LifeOnline/LifeOS/packages/server" && node --import tsx --test test/feedbackReintegration.test.ts test/reintegrationApi.test.ts`。

## 结果
- `extract_tasks` 现在不再被回流层错误降格为“源笔记变化”，而是被记录为真实的 `task_record` 型 next-action 结果。
- reintegration record 现在能携带创建出的任务条目、对应 output note id，以及一个保守派生的 `nextActionCandidate`，为后续 review、web 控制面、甚至下一轮 SoulAction 生成提供结构化事实源。
- 本轮仍未新增自动派发或额外放权，只是把 outcome → reintegration 的事实记录修正到更接近第一阶段 vision 的主线状态。

## 下一步建议
- 下一轮优先检查 `packages/server/src/soul/reintegrationPromotionPlanner.ts` / `pr6PromotionRules.ts` / web reintegration 控制面，是否已把新的 `task_record` / `nextActionCandidate` evidence 真正投射出来；如果没有，可继续补“review 后如何看见和利用这条下一步行动事实”的 contract-to-UI 缺口。

---
