# PR6 daily-report continuity promotion 扩展

## 计划
- [x] 读取 README / vision / tasks / CLAUDE.md 并复核当前 PR1–PR6 边界。
- [x] 复核 PR6 现有 coverage，确认本轮应优先做保守、可验证的小步扩展，而不是新开治理面。
- [x] 在 PR6 promotion planner / executor 中新增 `daily_report_reintegration -> promote_continuity_record` 的 review-backed 最小 coverage。
- [x] 补充对应测试，覆盖 accepted 可晋升，以及 pending/rejected 不得越过最终执行口。
- [x] 运行相关测试与 server build。
- [ ] 记录本轮 review / 验证结果，并直接提交 git commit。

## 当前执行
- 已完成文档锚点读取：`README.md`、`CLAUDE.md`、`vision/00-权威基线/`、`vision/01-当前进度/`、`tasks/todo.md`、`tasks/lessons.md`。
- 已确认当前 PR6 已具备 review-backed `event_nodes` / `continuity_records` 最小闭环，上一轮刚补完最终执行口 accepted-review 守卫。
- 本轮已完成真实实现：
  - `LifeOS/packages/server/src/soul/reintegrationPromotionPlanner.ts` 现在允许 `daily_report_reintegration` 在 accepted review 后同时规划 `promote_event_node` 与 `promote_continuity_record`。
  - `LifeOS/packages/server/src/soul/pr6PromotionExecutor.ts` 为 daily-report continuity promotion 落地 `daily_rhythm` continuity kind，并保持最终执行口的 accepted-review 强约束。
  - `LifeOS/packages/server/src/soul/types.ts`、`LifeOS/packages/server/src/db/schema.ts`、`LifeOS/packages/server/src/db/client.ts` 已同步扩展 `daily_rhythm` 持久化约束与迁移判断，避免现有库 schema 漂移。
  - `LifeOS/packages/server/test/feedbackReintegration.test.ts` 已补 daily report accepted/rejected 两条 continuity promotion 覆盖。

## Review
- 本轮选择依据：`vision/01-当前进度/LifeOnline 第一阶段项目开发任务书（进度对齐正式版）.md` 明确要求后续在保守边界内继续 review-backed、可解释、可审计的小步推进，而不是夸大成完整产品化系统。
- 当前代码现实：原先 `daily_report_reintegration` 只能晋升 event，不能晋升 continuity；本轮补的是局部 coverage，而不是新开治理面。
- 约束保持不变：不得绕过 review；不得把 continuity 当普通输出；不得扩成通用化大改。
- 已完成验证：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/feedbackReintegration.test.ts` 通过，42/42。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过。
- 本轮结果表明：daily report 现在也能在 accepted reintegration review backing 下进入 PR6 continuity promotion，但 rejected/pending 记录仍不能绕过 dispatcher 最终执行口落长期对象层。
