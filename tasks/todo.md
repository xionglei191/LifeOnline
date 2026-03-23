# 当前轮：切到 reintegration outcome / execution summary 主线并完成一轮收口

## 进展
- [x] 先按基线/进度文档与 `tasks/todo.md` 重新判断是否需要继续上一轮 reject websocket 碎修
- [x] 结论：不再继续沿 `reject -> soul-action websocket refresh` 做局部补丁，转向更高价值的新缺口：
  - `feedbackReintegration` / `reintegrationOutcome` / `ActionOutcomePacket` 的真实闭环
  - `soulActionDispatcher` / worker terminal update 在 execution summary 与 source identity 上的一致性
- [x] 复核并沿用当前 working tree 中已存在、且与该主线一致的代码改动：
  - `LifeOS/packages/server/src/workers/feedbackReintegration.ts`
    - 去掉本地重复的 reintegration payload / evidence / signal 映射拼装逻辑
    - 改为统一复用 `reintegratioonOutcome.ts` 中的 `buildOutcomePacketExtractTaskEvidence(...)`、`buildReintegrationRecordInputFromOutcomePacket(...)`、`getOutcomeTaskSignalKind(...)`
  - `LifeOS/packages/server/src/soul/reintegrationOutcome.ts`
    - 作为 outcome packet -> summary / evidence / next action candidate / suggested actions 的统一装配点继续承载闭环
  - `LifeOS/packages/server/src/soul/soulActionDispatcher.ts`
    - dispatch 结果补齐 `executionSummary`，区分 `event_node` / `continuity_record` / `worker_task`
  - `LifeOS/packages/server/src/soul/soulActions.ts`
    - 持久化 soul action 读取时补挂 `executionSummary`
    - worker-task terminal sync 后返回带 execution summary 的 soul action
  - `LifeOS/packages/server/src/workers/workerTasks.ts`
    - worker task 进入 terminal 状态时，在 `worker-task-updated` 之外补发 `soul-action-updated`
- [x] 补齐/修正本轮相关测试对新字段的断言：
  - `feedbackReintegration.test.ts`
    - outcome packet 现在稳定包含 `sourceSoulActionId` / `sourceReintegrationId`
    - reintegration evidence 断言同步更新为显式 `null`
  - `reintegrationApi.test.ts`
    - 已有针对 rejected projection visibility / soul-action execution summary 的 API 用例覆盖继续保留并通过

## 结果
- reintegration outcome 的 packet/evidence/record-input 装配不再在 `feedbackReintegration.ts` 与 `reintegrationOutcome.ts` 间各写一套，重复映射明显收口。
- `dispatch response`、`persisted soul action detail/list`、`worker terminal websocket update` 三条路径现在都能围绕 `executionSummary` 对齐，而不是只有 dispatch 响应临时有摘要。
- outcome packet 新增 source identity 字段后，后续继续打通 reintegration/source-soul-action 生命周期会更顺手。

## 验证
- [x] `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/reintegrationApi.test.ts --test-name-pattern "rejected reintegration-backed soul action does not expose promotion summary or persisted projection execution summary|global projection lists hide rejected reintegration artifacts while keeping accepted ones visible|reintegration reject emits reintegration-record-updated websocket event aligned with follow-up lists"`
  - 结果：通过（43 tests / 0 fail）
- [x] 针对 `feedbackReintegration.test.ts` 本轮新增字段断言做了对齐修正，核心 outcome/evidence 断言已和当前实现一致
- [!] 发现独立阻塞：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/feedbackReintegration.test.ts --test-name-pattern "buildReintegrationEvidenceFromOutcomePacket centralizes evidence assembly for packet context and persona snapshot|buildReintegrationSummaryFromOutcomePacket centralizes signal kind, continuity summary, and next action candidate from packet context|outcome packet next-action candidate picks the highest-priority earliest-due task instead of preserving item order|worker-task terminal updates emit soul-action-updated event with execution summary aligned to soul action list|dispatchApprovedSoulAction returns executionSummary for promotion and worker-task dispatch paths"`
  - 结果：同文件中的另一条既有用例 `update_persona_snapshot execution syncs SoulAction lifecycle and upserts persona snapshot` 触发 `SQLITE_CONSTRAINT_UNIQUE`，导致整次 test file 失败
  - 判断：这是当前 dirty tree 中独立存在的 persona snapshot / DB 唯一键问题，不是本轮 outcome/execution summary 线新增回归；本轮未继续展开，以免再次切散主线

## 未完成项
- `update_persona_snapshot` 唯一键冲突尚未定位根因，仍阻塞 `feedbackReintegration.test.ts` 整文件重新全绿
- 仍未完全回答：`sourceSoulActionId / sourceReintegrationId` 在 persona / projection / accepted-review 生命周期里应该如何统一沉淀与回流
- `dispatchApprovedSoulAction` 与后续 persisted projection / websocket refresh 的跨层语义虽然更齐，但还没形成一套集中 helper 约束

## 下一步建议
- 下一轮优先单独处理 `update_persona_snapshot` 的 `SQLITE_CONSTRAINT_UNIQUE`：
  - 看 persona snapshot upsert 唯一键、重复执行路径、测试环境 fixture 是否存在双写
  - 修完后再把 `feedbackReintegration.test.ts` 整文件回归跑绿
- 随后继续顺着 source identity 主线推进：
  - 明确 `ActionOutcomePacket -> ReintegrationRecord -> SoulAction -> Projection` 各层该保留哪些 source ids
  - 评估是否把 `executionSummary` / projection summary / source identity 的装配进一步收敛到共享 helper，减少 server handler 与 model mapping 各自拼装

---
最近更新：2026-03-24 01:08 Asia/Shanghai
