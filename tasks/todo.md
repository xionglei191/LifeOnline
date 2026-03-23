# 当前轮：promotion projection websocket 事实源继续收口

## 进展
- [x] 补齐本轮必读主线文件：`README.md`、`CLAUDE.md`、`vision/00-权威基线`、`vision/01-当前进度`、相关 `vision/02-历史草案`、`tasks/todo.md`。
- [x] 复查当前 dirty working tree，并继续沿用与联合认知体主线直接相关的 server/reintegration 文件：
  - 继续沿用：`LifeOS/packages/server/src/api/handlers.ts`、`LifeOS/packages/server/src/soul/*`、相关 `LifeOS/packages/server/test/*`
  - 本轮不碰：`lifeonline-claude-worker-v2.sh`、新增 vision 文稿、`vision/book/assets/images/`、以及 grouped governance / web 侧上一轮未收束区域
- [x] 在 promotion dispatch / projection read-model 链路中确认新的事实源缺口：
  - `/api/event-nodes` 与 `/api/continuity-records` list handler 会补齐 `explanationSummary / continuitySummary`
  - 但 dispatch 成功后的 websocket `event-node-updated` / `continuity-record-updated` 仍直接广播底层对象，缺少同一层 projection summary 装配
  - 这让“刚 dispatch 完收到的 websocket 对象”和“随后 list API 读到的对象”存在字段面不一致，仍是 read-model 双轨
- [x] 在 `LifeOS/packages/server/src/api/handlers.ts` 收口该分叉：
  - 新增 `attachEventNodeProjectionSummary(...)` 与 `attachContinuityRecordProjectionSummary(...)`
  - 让 websocket 广播与 list API 共同复用同一套 projection summary 装配逻辑
  - 保持 event/continuity 持久化与 dispatch 执行逻辑不变，只统一 server-side read-model 输出
- [x] 在 `LifeOS/packages/server/test/reintegrationApi.test.ts` 补强 focused websocket 断言，锁定：
  - continuity promotion dispatch 的 `continuity-record-updated` websocket 必须与 follow-up continuity list 返回对象完全对齐
  - event-node promotion dispatch 的 `event-node-updated` websocket 必须与 follow-up event-node list 返回对象完全对齐
  - websocket payload 内新增的 `explanationSummary / continuitySummary` 必须来自同一 read-model 投射层，而不是另一路手拼

## 结果
- promotion dispatch 之后的 websocket 与 follow-up list 现在共享同一 projection summary 装配点，避免 event/continuity 对象在“刚广播”和“稍后读取”之间出现字段漂移。
- 这次推进的是 PR6 promotion projection 的 server/web/shared 可见性一致性，属于联合认知体对象层 read-model 收口，而不是表层 UI polish。

## 验证
- [x] `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/reintegrationApi.test.ts --test-name-pattern "continuity promotion websocket event stays aligned with follow-up continuity-record list projection summaries|event-node promotion websocket event stays aligned with follow-up event-node list projection summaries|continuity promotion dispatch writes follow-up continuity-record list aligned with soul-action source record|event-node promotion dispatch writes follow-up event-node list aligned with soul-action source record"`
  - 结果：通过（新增 websocket 对齐用例通过；目标相关 continuity/event projection 用例通过）

## 下一步建议
- 检查 promotion dispatch response 本身是否也应直接携带 event-node / continuity-record projection 对象，而不只返回 `executionSummary`；若存在 response 与 websocket/list 的第三套可见性路径，可继续收口。
- 或转向 `feedbackReintegration` / `continuityIntegrator` 与 rejected review 交界处，检查被拒绝回流是否仍能通过残余 sourceReintegrationId 读取到不应暴露的 promotion projection。

---
最近更新：2026-03-23 23:20 Asia/Shanghai
