# 当前轮：Settings projection canonical filter echo 收口

## 进展
- [x] 识别 Settings 的 Promotion Projections 虽已补 accepted reintegration fact source，但仍直接吞掉 server/shared 返回的 canonical `sourceReintegrationIds`，与 NoteDetail 的 projection list contract 使用不一致。
- [x] 改为让 SettingsView 通过 projection list helper 读取 `event-nodes` / `continuity-records` 的 canonical filter scope，并仅按 server 确认的 reintegration ids 投射可见 projection。
- [x] 补 web 回归，锁定 Settings projection 面板在 server 返回更窄 canonical scope 时不会误展示请求范围外的 projection 项。
- [x] 顺手补齐 server API 边界的 canonicalization：`sourceReintegrationIds` 查询参数现在会 trim + dedupe，再回写到 `filters.sourceReintegrationIds`，避免只有 web helper 正常、API 自身 canonical filter 仍可带重复值。
- [x] 补 server focused 回归，锁定 `event-nodes` / `continuity-records` 列表在重复 reintegration ids 查询下仍返回去重后的 canonical filter scope。

## 结果
- Settings 的 Promotion Projections 现在和 shared/server 的 canonical projection filter contract 对齐，不再因为前端只信请求 ids 而误投射范围外的 event/continuity 结果。
- `event-nodes` / `continuity-records` API 自身也已经在服务端固定 canonical reintegration filter 语义，避免后续非 web 调用方重新引入重复 filter 事实源。
- 这一轮已完成收口；下一轮应转向新的非 Settings / projection 类高价值缺口。

---
