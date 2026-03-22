# 当前轮：NoteDetail PR6 promotion projection 主路径补面

## 进展
- [x] 识别 PR6 promotion projection 仍停留在 Settings-only，主路径 `NoteDetail` 看不到 source note 的落地结果。
- [x] 在 `NoteDetail` 复用 projection panel，按当前 note 的 reintegration 来源收窄加载 event node / continuity record。
- [x] 接上 `event-node-updated`、`continuity-record-updated`、`reintegration-record-updated`、`soul-action-updated` websocket 刷新，保持当前 note 投射结果及时更新。
- [x] 补 `NoteDetail` focused 回归，锁定只展示当前 note projection、websocket 刷新和错误态。
- [x] 收口 reintegration list contract，支持 `sourceNoteId` 过滤并把 filters 回传到 shared/server/web/client tests，避免主路径 projection 为了当前 note 去拉全量 reintegration records。
- [x] 跑 focused web/server 验证并确认通过。
- [ ] 评估是否直接提交这轮改动。

---
