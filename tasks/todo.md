# 当前轮：切到 reintegration outcome / source identity 主线并完成一轮收口

## 进展
- [x] 先按基线/进度文档与 `tasks/todo.md` 重新判断是否需要继续上一轮 reject websocket 碎修
- [x] 结论：不再继续沿 `reject -> soul-action websocket refresh` 做局部补丁，转向更高价值的新缺口：
  - `feedbackReintegration` / `reintegrationOutcome` / `ActionOutcomePacket` 的真实闭环
  - worker terminal outcome 到 reintegration record 的 `source identity` 贯通
- [x] 沿当前 dirty tree 主线继续收口 outcome/source identity：
  - `LifeOS/packages/shared/src/types.ts`
    - 给 `ActionOutcomePacket` 补齐 `sourceSoulActionId` / `sourceReintegrationId`
    - 让 shared reintegration evidence contract 显式承载这两个 source identity 字段
  - `LifeOS/packages/server/src/workers/feedbackReintegration.ts`
    - `createFeedbackReintegrationPayload(...)` 现在会从 `getSoulActionByWorkerTaskId(...)` 带出 linked soul action / reintegration identity
    - `createReintegrationRecordInput(...)` 继续统一走 `buildReintegrationRecordInputFromOutcomePacket(...)`
  - `LifeOS/packages/server/src/soul/reintegrationOutcome.ts`
    - outcome evidence / record input 装配现在统一保留 `sourceSoulActionId` / `sourceReintegrationId`
    - record input 默认优先继承 packet 自带的 source soul action id，并允许通过 options 覆盖 reintegration id
  - `LifeOS/packages/server/src/workers/workerTasks.ts`
    - terminal reintegration upsert 现在把 linked soul action 的 `sourceReintegrationId` 一并传进 record-input builder
    - `bindSoulActionToWorkerTask(...)` 与 `runUpdatePersonaSnapshot(...)` 现在统一按 `getSoulActionByIdentityAndKind(...)` 解析 soul action，避免 note-only 绑定在 reintegration-backed 路径上错绑/重复命中
- [x] 补齐/更新测试：
  - `LifeOS/packages/server/test/feedbackReintegration.test.ts`
    - 更新 shared evidence / record-input 断言，显式覆盖新增 identity 字段
    - 新增 linked worker soul action 场景：验证 outcome packet / reintegration record input 会带上 `sourceSoulActionId`
    - 新增 linked promotion soul action 场景：验证 reintegration source identity 不会在 packet -> record input 过程中丢失
    - 收口 generator / gate 既有断言漂移，适配当前候选与 gate decision 新增的 `confidence` / `analysisReason`

## 结果
- `ActionOutcomePacket -> ReintegrationRecord evidence -> ReintegrationRecordInput` 这条链现在不再只保留 `sourceNoteId`，而是能把真实 linked soul action / reintegration identity 一起带下来。
- worker task 创建、绑定、执行成功后的 persona snapshot upsert 现在统一走同一套 identity-aware soul action 解析，不再一处按 reintegration identity、一处按 note-only 查找。
- 后续无论是继续做 `generateSoulActionsFromOutcome(...)`，还是追查 projection / accepted-review 生命周期里的 source identity，当前 packet/evidence 已经有可用锚点，不需要再回头补一层临时映射。
- 这次改动仍保持在现有 dirty tree 主线上，没有再回到 reject websocket 碎修。

## 验证
- [x] 运行针对本轮 source identity 收口的定向测试：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/feedbackReintegration.test.ts --test-name-pattern "update_persona_snapshot execution syncs SoulAction lifecycle and upserts persona snapshot"`
- [x] 结果：persona snapshot 成功路径之前仍报 `SQLITE_CONSTRAINT_UNIQUE`，最终定位为测试文件内共享全局 DB handle 与 `process.env.DB_PATH` 切换叠加导致的串扰，而不是 persona snapshot 主路径本身
- [x] 修复：
  - `workerTasks.ts` 里 worker-task 绑定与 persona snapshot 执行统一改为按 `getSoulActionByIdentityAndKind(...)` 查找 soul action
  - `feedbackReintegration.test.ts` 的 persona snapshot 成功用例在创建临时 env 前显式 `closeDb()`，避免沿用上一个测试打开的数据库连接
  - 收口 generator / gate 断言漂移到当前返回 shape
- [x] 回放验证：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test --test-concurrency=1 test/feedbackReintegration.test.ts --test-name-pattern "update_persona_snapshot execution syncs SoulAction lifecycle and upserts persona snapshot"`
  - 结果：通过

## 未完成项
- 还没重新跑修复后的 persona snapshot 成功路径与整组 reintegration 相关测试
- `sourceSoulActionId / sourceReintegrationId` 虽然已进入 packet/evidence，但 persona / accepted review / projection 生命周期的统一落盘规则还没完全收口
- 尚未进一步把 `generateSoulActionsFromOutcome(...)` 与 projection planning 全部改造成直接消费这套 source identity 语义

## 下一步建议
- 先回放 persona snapshot 成功路径与 `feedbackReintegration.test.ts` 里受影响断言，确认 `SQLITE_CONSTRAINT_UNIQUE` 已消失
- 若通过，再决定是否继续整文件回归，或进一步收口 `ActionOutcomePacket -> ReintegrationRecord -> SoulAction -> Projection` 的 source identity 规则

---
最近更新：2026-03-24 01:08 Asia/Shanghai
