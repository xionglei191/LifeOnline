# 当前轮：projection canonical filter echo 收口

## 进展
- [x] 识别 `event-nodes` / `continuity-records` 已由 shared/server 返回 canonical `filters.sourceReintegrationIds`，但 web client 与 `NoteDetail` 主路径仍只消费数组，继续依赖前端请求假设而不是服务端事实源。
- [x] 改为让 web client 暴露 projection list + canonical filter scope，并让 `NoteDetail` 用服务端确认后的 reintegration source 集收口当前笔记的 projection artifacts。
- [x] 跑 focused web 验证并确认通过：`pnpm --dir /home/xionglei/LifeOnline/LifeOS --filter web test -- src/components/NoteDetail.test.ts src/api/client.test.ts`

## 结果
- `NoteDetail` 的 projection artifact 展示现在不再只信任前端请求 ids，而是优先对齐 server/shared 返回的 canonical source scope。
- 新增边界回归已锁住 projection filter echo contract，可继续扫描新的 contract / fact-source gap。

---
