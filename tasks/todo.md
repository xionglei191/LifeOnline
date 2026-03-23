# 当前轮：reintegration review metadata 持久性缺口收口

## 进展
- [x] 补齐本轮必读主线文件：`README.md`、`CLAUDE.md`、`vision/00-权威基线`、`vision/01-当前进度`、相关 `vision/02-历史草案`、`tasks/todo.md`。
- [x] 复查当前 dirty working tree，并区分本轮继续沿用的主线文件与不碰区域：
  - 继续沿用：`LifeOS/packages/server/src/soul/reintegrationRecords.ts`、相关 `LifeOS/packages/server/test/feedbackReintegration.test.ts`
  - 本轮不碰：`lifeonline-claude-worker-v2.sh`、新增 vision 文稿、`vision/book/assets/images/`、以及 grouped governance / web 侧未收束区域
- [x] 在 reintegration persistence 链路中确认新的高价值缺口：
  - `upsertReintegrationRecord(...)` 会在已有 record 刷新时把缺省 `reviewStatus` 重置为 `pending_review`
  - 同时也会把缺省 `reviewReason` 清空，而 `reviewedAt` 只盲目沿用旧值
  - 这意味着一条已经 accepted / rejected 的 reintegration 只要后续发生 outcome refresh，就可能丢失治理结论，破坏“review 决策不可被后续写回冲掉”的主线约束
- [x] 在 `LifeOS/packages/server/src/soul/reintegrationRecords.ts` 收口该缺口：
  - 让 upsert 在未显式提供 review 字段时默认继承现有 `reviewStatus / reviewReason / reviewedAt`
  - 仅当调用方明确传入这些字段时才覆盖
  - 对新建且显式非 pending_review 的记录，允许用 `reviewedAt` 参数或合理默认值初始化 review 时间
- [x] 在 `LifeOS/packages/server/test/feedbackReintegration.test.ts` 补强 focused 断言，锁定：
  - accepted reintegration 在 outcome refresh 后必须保留 reviewStatus / reviewReason / reviewedAt
  - rejected reintegration 在 outcome refresh 后也必须保留同样的治理元数据
  - 同时允许 summary / evidence 等 outcome 事实继续更新，不把治理冻结误扩到结果层

## 结果
- reintegration outcome refresh 现在不会再把已做出的 accepted / rejected 决策冲回 `pending_review`，治理结论与 outcome 写回边界更清晰。
- 这次推进的是 review immutability 与 reintegration 持久层事实源修复，直接增强联合认知体第一阶段治理骨架，而不是测试对称补强。

## 验证
- [x] `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/feedbackReintegration.test.ts --test-name-pattern "upsertReintegrationRecord preserves accepted review metadata across outcome refreshes|upsertReintegrationRecord preserves rejected review metadata across outcome refreshes|acceptReintegrationRecordAndPlanPromotions auto-plans PR6 actions on acceptance|rejectReintegrationRecord rejects repeated review state changes once a reintegration is already rejected"`
  - 结果：通过（94 tests passed；目标 reintegration 持久性与 review finality 用例通过）

## 下一步建议
- 继续检查真实 worker-side reintegration refresh 路径是否已全部走 `upsertReintegrationRecord(...)`；若有旁路 SQL 写入，可继续收口到同一持久层 helper。
- 或转向 rejected review 与 promotion projection 边界，确认被拒绝的 reintegration 不会因旧 projection 持久物残留而继续暴露 event/continuity 对象。

---
最近更新：2026-03-23 23:49 Asia/Shanghai
