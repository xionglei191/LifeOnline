# 当前轮：PR6 projection websocket contract 收口

## 进展
- [x] 识别 projection 刷新依赖 `soul-action-updated` / `reintegration-record-updated` 的 shared/server/web contract 缺口。
- [x] 为 PR6 projection 补显式 websocket 事件，并让 server 在 promotion 落地后直接广播。
- [x] 调整 SettingsView 只在 projection 事件上刷新 projections，避免继续耦合到 soul-action 刷新侧效应。
- [x] 跑 focused server/web 验证并确认通过。
- [ ] 如果验证稳定，清理并提交这轮改动。

---
