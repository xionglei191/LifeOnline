# 当前轮：PR6 projection websocket membership 收口

## 进展
- [x] 识别 websocket 只刷新 reintegration/soul actions、不刷新 projections，导致 projection source 集合变化后面板暂时陈旧的主路径缺口。
- [x] 当 `reintegration-record-updated` / `soul-action-updated` 影响 projection membership 时，同步刷新 projection 面板。
- [x] 补回归，锁定多 tab / 多 session 场景下 ws 驱动的 projection membership 刷新。
- [x] 跑 focused web 验证并确认通过。
- [ ] 如果验证稳定，清理并提交这轮改动。

---
