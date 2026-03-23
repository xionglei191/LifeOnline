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
- [x] 补齐/更新测试：
  - `LifeOS/packages/server/test/feedbackReintegration.test.ts`
    - 更新 shared evidence / record-input 断言，显式覆盖新增 identity 字段
    - 新增 linked worker soul action 场景：验证 outcome packet / reintegration record input 会带上 `sourceSoulActionId`
    - 新增 linked promotion soul action 场景：验证 reintegration source identity 不会在 packet -> record input 过程中丢失

## 结果
- `ActionOutcomePacket -> ReintegrationRecord evidence -> ReintegrationRecordInput` 这条链现在不再只保留 `sourceNoteId`，而是能把真实 linked soul action / reintegration identity 一起带下来。
- 后续无论是继续做 `generateSoulActionsFromOutcome(...)`，还是追查 projection / accepted-review 生命周期里的 source identity，当前 packet/evidence 已经有可用锚点，不需要再回头补一层临时映射。
- 这次改动仍保持在现有 dirty tree 主线上，没有再回到 reject websocket 碎修。

## 验证
- [x] 运行针对本轮 source identity 收口的定向测试：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/feedbackReintegration.test.ts --test-name-pattern "(linked soul action identity|linked reintegration identity|shared reintegration evidence contract shape|record input from outcome packet|centralizes record assembly for terminal tasks|prefers explicit sourceReintegrationId over a non-reintegration sourceNoteId|update_persona_snapshot execution syncs SoulAction lifecycle and upserts persona snapshot)"`
- [x] 结果：本轮新增/更新的 source identity 相关断言通过；同时复核到既有显式 source reintegration 用例也通过
- [!] 仍有独立阻塞：
  - 同一次 `feedbackReintegration.test.ts` 跑测里，既有用例 `update_persona_snapshot execution syncs SoulAction lifecycle and upserts persona snapshot` 仍触发 `SQLITE_CONSTRAINT_UNIQUE`
  - 该失败与本轮新增的 outcome/source identity 断言不同线；当前更像是 persona snapshot / DB 唯一键的既有脏树问题

## 未完成项
- `update_persona_snapshot` 唯一键冲突尚未定位根因，仍阻塞 `feedbackReintegration.test.ts` 整文件回归全绿
- `sourceSoulActionId / sourceReintegrationId` 虽然已进入 packet/evidence，但 persona / accepted review / projection 生命周期的统一落盘规则还没完全收口
- 尚未进一步把 `generateSoulActionsFromOutcome(...)` 与 projection planning 全部改造成直接消费这套 source identity 语义

## 下一步建议
- 下一轮优先单独处理 `update_persona_snapshot` 的 `SQLITE_CONSTRAINT_UNIQUE`：
  - 看 persona snapshot upsert 唯一键、worker task source identity 变更后是否引入双写路径
  - 修完后再把 `feedbackReintegration.test.ts` 整文件回归跑绿
- 随后继续顺着 source identity 主线推进：
  - 明确 `ActionOutcomePacket -> ReintegrationRecord -> SoulAction -> Projection` 各层该保留哪些 source ids
  - 再评估是否把 `generateSoulActionsFromOutcome(...)` / promotion planning 与 source identity 装配进一步集中到共享 helper

---
最近更新：2026-03-24 01:08 Asia/Shanghai
