# 当前轮：promotion dispatch response 事实源继续收口

## 进展
- [x] 补齐本轮必读主线文件：`README.md`、`CLAUDE.md`、`vision/00-权威基线`、`vision/01-当前进度`、相关 `vision/02-历史草案`、`tasks/todo.md`。
- [x] 复查当前 dirty working tree，并继续沿用与联合认知体主线直接相关的 server/reintegration/shared 文件：
  - 继续沿用：`LifeOS/packages/server/src/api/handlers.ts`、`LifeOS/packages/shared/src/types.ts`、相关 `LifeOS/packages/server/test/*`
  - 本轮不碰：`lifeonline-claude-worker-v2.sh`、新增 vision 文稿、`vision/book/assets/images/`、以及 grouped governance / web 侧上一轮未收束区域
- [x] 在 promotion dispatch response / websocket / follow-up list 三条可见性路径中确认新的 contract gap：
  - 上轮已把 websocket 与 list 的 projection summary 收口到同一路径
  - 但 dispatch API 自身仍只返回 `executionSummary`，没有把已创建的 `eventNode / continuityRecord` projection 对象直接回给调用方
  - 这让 promotion dispatch 成功后依然存在第三条“只给摘要不给对象”的响应路径，前端若想拿到 projection 详情仍需额外等 websocket 或再查 list
- [x] 在 `LifeOS/packages/shared/src/types.ts` 与 `LifeOS/packages/server/src/api/handlers.ts` 收口该缺口：
  - 扩展 `DispatchSoulActionResponse`，显式返回 `eventNode` / `continuityRecord`
  - dispatch handler 直接复用与 websocket/list 相同的 projection summary helper，保证 response 返回的是同一 read-model 对象
  - worker-host 路径仍保持 `eventNode = null`、`continuityRecord = null`，不改变既有行为边界
- [x] 在 `LifeOS/packages/server/test/reintegrationApi.test.ts` 与 `LifeOS/packages/web/src/api/client.test.ts` 补强 focused 断言，锁定：
  - continuity promotion dispatch response 必须直接携带投射后的 continuity record，并与 websocket/list 保持一致
  - event-node promotion dispatch response 必须直接携带投射后的 event node，并与 websocket/list 保持一致
  - web client 对扩展后的 shared dispatch contract 继续按原样透传

## 结果
- promotion dispatch response / websocket / follow-up list 现在共用同一套 projection 对象事实源，避免 promotion 成功后调用方只能先拿摘要、再靠第二次读取补对象详情。
- 这次推进的是 PR6 promotion projection 的 contract 收口，直接增强联合认知体对象层 API 可见性，而不是表层 UI polish。

## 验证
- [x] `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/reintegrationApi.test.ts --test-name-pattern "promotion dispatch response stays aligned with local-only execution results and follow-up soul-action list|event-node promotion dispatch response stays aligned with local-only execution results and follow-up soul-action list|continuity promotion websocket event stays aligned with follow-up continuity-record list projection summaries|event-node promotion websocket event stays aligned with follow-up event-node list projection summaries"`
  - 结果：通过（promotion dispatch response 与 websocket/list 对齐用例通过）
- [x] `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/web" exec vitest run src/api/client.test.ts`
  - 结果：通过（40 tests passed）

## 下一步建议
- 继续检查 accept / reject / plan / dispatch 四条 response 是否都已统一走单一 projection helper；若 reintegration record、soul action、promotion object 仍有分散装配点，可继续下沉。
- 或转向 rejected review 与 promotion projection 的边界，确认被拒绝回流不会经由 response/list/websocket 任一路径泄漏已存在的 event/continuity 投射对象。

---
最近更新：2026-03-23 23:31 Asia/Shanghai
