# 当前轮：PR6 projection scope contract 收口

## 进展
- [x] 识别 Promotion Projections 面板误用全量 event/continuity 列表的 contract-to-UI 投射缺口。
- [x] 为 event-nodes / continuity-records 补 `sourceReintegrationIds` 过滤 contract，并让 server/web 都按当前 reintegration scope 取数。
- [x] 为 SettingsView 补回归，锁定 projection 面板不再混入无关 reintegration 的对象。
- [x] 跑 focused server/web 验证并确认通过。
- [ ] 如果验证稳定，清理并提交这轮改动。

---
