# 当前轮：Dashboard websocket 刷新收口

## 进展
- [x] 收窄 Dashboard websocket 刷新范围，避免非首页相关事件触发整页重拉。
- [x] 为 Dashboard 补回归，锁定 `schedule-updated` 只刷新 schedule health，`soul-action-updated` 不触发首页重拉。
- [x] 跑 focused web 验证并确认通过。
- [ ] 如果验证稳定，清理并提交这轮改动。

---
