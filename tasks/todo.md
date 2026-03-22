# 当前轮：client list-response canonical filter 暴露收口

## 进展
- [x] 识别 `web/src/api/client.ts` 中 `fetchWorkerTasks`、`fetchReintegrationRecords`、`fetchSoulActions` 仍只返回数组，吞掉 server/shared 已返回的 canonical `filters`，导致 client helper 层无法承接统一 list-response contract。
- [x] 新增 `fetchWorkerTaskList`、`fetchReintegrationRecordList`、`fetchSoulActionList`，在保留原数组 helper 兼容路径的同时，显式暴露 shared list-response 里的 canonical `filters`；并把 projection list helper 也统一成 `items + filters` 形状。
- [x] 同步更新 `NoteDetail.vue` / `SettingsView.vue` 对 projection list helper 的读取方式，继续按 `response.filters.sourceReintegrationIds` 驱动 UI 过滤；同时补上 NoteDetail 对 canonical-scope artifact websocket 更新的命中判断，避免 `sourceNoteId` 不匹配时漏刷。
- [x] 补 web focused 回归，锁定 worker/reintegration/soul-action/projection list helpers 都会保留 shared response filters，而不是只返回 items。
- [x] 跑 web focused 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/api/client.test.ts src/components/NoteDetail.test.ts`。

## 结果
- web client 现在可以在不破坏现有调用方的前提下承接 server/shared canonical list filters，后续 UI 若要信 response filter scope，不必再绕过 client helper 直接重做解析。
- NoteDetail 的 projection 主路径和 websocket 刷新都已与新的 list-response contract 对齐；下一轮可继续找新的 server/web/shared contract gap，而不是重复补同类 Settings 收敛测试。

---
