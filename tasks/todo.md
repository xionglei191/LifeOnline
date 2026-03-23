# 当前轮：rejected review 下 projection 可见性边界收口

## 进展
- [x] 补齐本轮必读主线文件：`README.md`、`CLAUDE.md`、`vision/00-权威基线`、`vision/01-当前进度`、相关 `vision/02-历史草案`、`tasks/todo.md`。
- [x] 复查当前 dirty working tree，并区分本轮继续沿用的主线文件与不碰区域：
  - 继续沿用：`LifeOS/packages/server/src/api/handlers.ts`、相关 `LifeOS/packages/server/test/reintegrationApi.test.ts`
  - 本轮不碰：`lifeonline-claude-worker-v2.sh`、新增 vision 文稿、`vision/book/assets/images/`、以及 grouped governance / web 侧未收束区域
- [x] 在 rejected review 与 projection read-model 链路中确认新的高价值缺口：
  - PR6 dispatch 已在执行面阻止 pending/rejected reintegration 继续生成新 projection 对象
  - 但 `/api/event-nodes` 与 `/api/continuity-records` 只按 `sourceReintegrationIds` 过滤底层表，没有再检查 source reintegration 的当前 reviewStatus
  - 这意味着如果历史上已存在 event/continuity projection，而其 source reintegration 后来被 reject，follow-up list 仍可能继续把这些对象暴露给控制面
- [x] 在 `LifeOS/packages/server/src/api/handlers.ts` 收口该边界：
  - 新增 `filterVisibleProjectionReintegrationIds(...)`
  - 对 event/continuity list API 在显式按 `sourceReintegrationIds` 查询时，只放行当前仍为 `accepted` 的 reintegration id
  - 保持 response filter 回显原始查询参数，但实际 projection 读取面不再向 rejected source 暴露对象
- [x] 在 `LifeOS/packages/server/test/reintegrationApi.test.ts` 补强 focused 断言，锁定：
  - rejected reintegration 即使底层已存在 stale event/continuity projection，也不能通过 follow-up list 查出
  - accepted reintegration 仍可正常查到其 event/continuity projection，避免过度封禁主路径

## 结果
- rejected review 现在不只是“不能继续 dispatch promotion”，而是连 follow-up projection read-model 也会收口到 accepted 边界内，避免历史残留对象继续泄漏。
- 这次推进的是治理结论对对象层可见性的真实约束，直接增强联合认知体第一阶段 review / projection 边界，而不是表层 UI 补强。

## 验证
- [x] `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/reintegrationApi.test.ts --test-name-pattern "rejected reintegration record does not leak persisted event or continuity projections through follow-up lists|accepted reintegration record still exposes persisted event and continuity projections through follow-up lists|continuity promotion dispatch writes follow-up continuity-record list aligned with soul-action source record|event-node promotion dispatch writes follow-up event-node list aligned with soul-action source record"`
  - 结果：通过（rejected/accepted projection 可见性边界与既有 promotion follow-up 用例通过）

## 下一步建议
- 继续检查 websocket 与 dispatch response 是否也需要在读取历史 projection 时显式尊重 rejected review，确保 response / websocket / list 三条路径边界完全一致。
- 或继续下沉 projection 可见性规则，把“只有 accepted reintegration 可暴露 projection”集中到独立 helper，避免 API handler 内再出现第二套边界逻辑。

---
最近更新：2026-03-23 23:58 Asia/Shanghai
