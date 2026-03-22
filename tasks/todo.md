# 当前轮：Dashboard schedule-health 收口

## 进展
- [x] 让 Dashboard 在 `schedule-updated` websocket 到达后主动重拉 schedule health，避免首页状态滞后。
- [x] 将 `_Inbox` 主入口从复用维度路由改为专用 `/inbox` 路由，避免特殊桶继续冒充可选维度视图。
- [x] 为 Dashboard 补回归，锁定 schedule websocket 事件会触发健康状态刷新。
- [x] 跑 focused web 验证并确认 build 通过。
- [ ] 如果验证稳定，清理并提交这轮改动。

---
