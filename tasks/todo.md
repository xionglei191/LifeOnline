# PR6 review-backed promotion 守卫补强

## 计划
- [x] 读取 README / vision / tasks / CLAUDE.md 并复核当前 PR1–PR6 边界。
- [x] 审查 PR6 promotion 当前实现，确认下一步应优先补 review-backed 边界守卫。
- [x] 在 `pr6PromotionExecutor.ts` 为 promotion 执行补充 accepted-review 强约束，避免已创建 action 被越过 review 直接落对象层。
- [x] 补充对应测试，覆盖 pending/rejected reintegration record 不得执行 promotion。
- [x] 运行相关测试与 server build。
- [ ] 记录本轮 review / 验证结果，并直接提交 git commit。

## 当前执行
- 已将 accepted-review 守卫下沉到 `LifeOS/packages/server/src/soul/pr6PromotionExecutor.ts`：promotion executor 现在在 source reintegration record 存在后，继续强校验 `reviewStatus === 'accepted'`，否则直接拒绝执行。
- 已补两条针对 dispatcher 最终执行口的回归测试：即便 promotion soul action 被手动置为 `approved`，若 source reintegration record 仍是 `pending_review` 或 `rejected`，也不得生成 `event_nodes` / `continuity_records`。
- 为避免误报，已把新增用例切到独立 `createTestEnv(...)`，并在切换前显式 `closeDb()`，避免沿用上一个测试的 DB 连接导致唯一键冲突。

## Review
- 已完成文档锚点读取：`README.md`、`CLAUDE.md`、`vision/00-权威基线/`、`vision/01-当前进度/`、`tasks/todo.md`、`tasks/lessons.md`。
- 已确认本轮更高价值的下一步不是继续扩范围，而是修补 PR6 promotion 最终执行口的 review-backed 守卫缺口。
- 首轮 `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server test -- --test-name-pattern "PR6|promotion|reintegration review"` 未能作为精准验证命令使用：Node test runner 仍跑了全量测试，其中若干既有 `configLifecycle` 用例因固定读取 `/home/xionglei/Project/LifeOnline/LifeOS/packages/server/config.json` 而在当前机器路径下失败；这属于现存环境/路径问题，不是本轮改动回归。
- 已完成可落地验证：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/feedbackReintegration.test.ts` 通过，41/41。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过。
- 本轮结果表明：PR6 promotion 即使被手动推进到 `approved`，dispatcher 最终执行口仍不能绕过 accepted review 直接落高阈值对象层。
