# PR6 高阈值 Event / Continuity Reintegration 最小落地

## 计划
- [x] 新增 `event_nodes` 与 `continuity_records` 两类高阈值对象层及 schema。
- [x] 扩展 `soul_actions`，支持 `promote_event_node` / `promote_continuity_record` 两类 promotion action。
- [x] 新增 reintegration review / promotion planner / promotion executor，形成 review-backed promotion 闭环。
- [x] 让 Dispatcher 成为唯一 promotion 执行入口，禁止 terminal hook 直写最终对象。
- [x] 新增最小 API：reintegration accept/reject/plan-promotions + event/continuity list。
- [x] 覆盖方案 B：
  - Event：`daily_report` + `weekly_report` + `update_persona_snapshot`
  - Continuity：`weekly_report` + `update_persona_snapshot`
- [x] 补数据库与 PR6 promotion 测试。
- [x] 运行 `pnpm --filter server test`。
- [x] 运行 `pnpm --filter server build`。

## Review
- 已在 `LifeOS/packages/server/src/db/schema.ts` 新增 `event_nodes` 与 `continuity_records` 两张表，并在 `LifeOS/packages/server/src/db/client.ts` 接入建表/迁移。
- 已在 `LifeOS/packages/server/src/soul/types.ts` 扩展 `SUPPORTED_SOUL_ACTION_KINDS`，新增 `promote_event_node` / `promote_continuity_record`。
- 已新增：
  - `LifeOS/packages/server/src/soul/eventNodes.ts`
  - `LifeOS/packages/server/src/soul/continuityRecords.ts`
  - `LifeOS/packages/server/src/soul/reintegrationReview.ts`
  - `LifeOS/packages/server/src/soul/reintegrationPromotionPlanner.ts`
  - `LifeOS/packages/server/src/soul/pr6PromotionExecutor.ts`
- 已在 `LifeOS/packages/server/src/soul/soulActionDispatcher.ts` 支持 PR6 promotion action 分流：普通 action 仍走 worker task，PR6 promotion action 走本地 executor，但仍必须先 approve 再 dispatch。
- 已在 `LifeOS/packages/server/src/api/handlers.ts` / `LifeOS/packages/server/src/api/routes.ts` 新增：
  - `GET /api/reintegration-records`
  - `POST /api/reintegration-records/:id/accept`
  - `POST /api/reintegration-records/:id/reject`
  - `POST /api/reintegration-records/:id/plan-promotions`
  - `GET /api/event-nodes`
  - `GET /api/continuity-records`
- 已在 `LifeOS/packages/server/test/db.test.ts` 补 schema 断言；已在 `LifeOS/packages/server/test/feedbackReintegration.test.ts` 补 PR6 最小 promotion 闭环测试，包括：
  - accepted persona reintegration -> event + continuity promotion
  - accepted daily report -> event only
  - 未 accept 不得 plan promotions
  - terminal hook 不得直写最终对象
- `pnpm --filter server test` 全量通过，55/55。
- `pnpm --filter server build` 通过。
- 已补正式任务书文稿对齐：PR2 / PR3 不再按“未开始”表述，而按“最小落地（保守口径）”冻结当前代码现实，消除文稿内部前后冲突。
