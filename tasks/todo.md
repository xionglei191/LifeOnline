# PR6 daily-report continuity promotion 扩展

## 计划
- [x] 读取 README / vision / tasks / CLAUDE.md 并复核当前 PR1–PR6 边界。
- [x] 复核 PR6 现有 coverage，确认本轮应优先做保守、可验证的小步扩展，而不是新开治理面。
- [x] 在 PR6 promotion planner / executor 中新增 `daily_report_reintegration -> promote_continuity_record` 的 review-backed 最小 coverage。
- [x] 补充对应测试，覆盖 accepted 可晋升，以及 pending/rejected 不得越过最终执行口。
- [x] 运行相关测试与 server build。
- [ ] 记录本轮 review / 验证结果，并直接提交 git commit。
- [x] 复核 Claude 自主推进能力是否恢复可用。
- [x] 若 Claude 恢复正常输出，继续收敛 PR6 中下一处最小真实缺口（优先重复 review predicate / promotion rule 的集中化）；若仍异常，保留当前状态并等待下一轮 token/CLI 状态恢复。
- [x] 将 `workerTasks.ts` 内 taskType -> reintegration signalKind 映射收口到 `feedbackReintegration.ts`，避免规则继续分叉。
- [x] 收紧 reintegration record 的 `signalKind` 类型，并补一条最窄测试锁定统一映射 helper。

## 当前执行
- 已完成文档锚点读取：`README.md`、`CLAUDE.md`、`vision/00-权威基线/`、`vision/01-当前进度/`、`tasks/todo.md`、`tasks/lessons.md`。
- 已确认当前 PR6 已具备 review-backed `event_nodes` / `continuity_records` 最小闭环，上一轮刚补完最终执行口 accepted-review 守卫。
- 上一轮已完成真实实现：
  - `LifeOS/packages/server/src/soul/reintegrationPromotionPlanner.ts` 现在允许 `daily_report_reintegration` 在 accepted review 后同时规划 `promote_event_node` 与 `promote_continuity_record`。
  - `LifeOS/packages/server/src/soul/pr6PromotionExecutor.ts` 为 daily-report continuity promotion 落地 `daily_rhythm` continuity kind，并保持最终执行口的 accepted-review 强约束。
  - `LifeOS/packages/server/src/soul/types.ts`、`LifeOS/packages/server/src/db/schema.ts`、`LifeOS/packages/server/src/db/client.ts` 已同步扩展 `daily_rhythm` 持久化约束与迁移判断，避免现有库 schema 漂移。
  - `LifeOS/packages/server/test/feedbackReintegration.test.ts` 已补 daily report accepted/rejected 两条 continuity promotion 覆盖。
- 本轮继续完成的真实实现：
  - 新增 `LifeOS/packages/server/src/soul/pr6PromotionRules.ts`，把 PR6 promotion 的 accepted-review 守卫、signal -> actionKinds、signal -> eventKind、signal -> continuityKind 统一收口，减少 planner / executor 中重复规则。
  - `LifeOS/packages/server/src/soul/reintegrationPromotionPlanner.ts` 改为复用统一规则模块生成 promotion action，避免 signal 白名单在多个位置散落。
  - `LifeOS/packages/server/src/soul/pr6PromotionExecutor.ts` 改为复用统一规则模块解析 promotion kind，并保留 dispatch 侧更明确的错误信息 `PR6 promotion requires accepted reintegration review`。
  - `LifeOS/packages/server/test/feedbackReintegration.test.ts` 增加对统一规则模块的断言，确认 accepted daily-report promotion 仍稳定产出 event + continuity 两类 action。
  - `LifeOS/packages/server/src/workers/feedbackReintegration.ts` 新增 `getReintegrationSignalKind()` 与 `ReintegrationSignalKind`，把 worker task -> reintegration signal 的映射集中到 feedback/reintegration 边界。
  - `LifeOS/packages/server/src/workers/workerTasks.ts` 改为复用 `getReintegrationSignalKind()` 写入 reintegration record，去掉 terminal hook 内联的多层三元表达式。
  - `LifeOS/packages/server/src/soul/reintegrationRecords.ts` 将 `signalKind` 收紧为 `ReintegrationSignalKind`，减少后续 planner/review/executor 侧接受任意字符串的漂移。
  - `LifeOS/packages/server/test/feedbackReintegration.test.ts` 补充统一 signal helper 断言，锁定支持 taskType 的稳定映射。
- Claude Code 可用性状态：这轮没有继续调用 Claude 代做，因为当前已经能在本地安全完成一处更小、更确定的规则集中化；上轮记录的 Claude 静默退出问题仍未单独复测关闭。

## Review
- 本轮选择依据：`vision/01-当前进度/LifeOnline 第一阶段项目开发任务书（进度对齐正式版）.md` 明确要求后续在保守边界内继续 review-backed、可解释、可审计的小步推进，而不是夸大成完整产品化系统。
- 当前代码现实：PR6 中 `accepted review` 判定与 signal 映射此前同时散落在 planner / executor；这轮做的是局部收束，不改变治理边界，不扩新对象面。
- 约束保持不变：不得绕过 review；不得把 continuity 当普通输出；不得扩成通用化大改。
- 已完成验证：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/feedbackReintegration.test.ts` 通过，42/42。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过。
  - 本轮新增的 signal helper 收口完成后，已再次运行同一条 reintegration 定向测试与 server build，确认无回归。
- 当前未完成项：
  - 还没有把这轮变更直接提交 git commit。
  - Claude/token 状态是否已经恢复到能稳定产出可消费结果，仍未重新确认。
- 下一步建议：
  - 若继续沿 PR6 保守推进，优先把 `workerTasks.ts` terminal reintegration hook 中剩余的 payload/result/record 拼装逻辑继续压回更窄 helper，但不要跨出当前 worker-local 边界。
  - 做完后再补最窄测试，避免 reintegration 规则继续在 terminal hook / planner / executor 三处分叉。
