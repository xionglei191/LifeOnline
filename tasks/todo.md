# 当前轮：PR6 projection scope contract 收口

## 进展
- [x] 识别 Promotion Projections 面板误用全量 event/continuity 列表的 contract-to-UI 投射缺口。
- [x] 为 event-nodes / continuity-records 补 `sourceReintegrationIds` 过滤 contract，并让 server/web 都按当前 reintegration scope 取数。
- [x] 为 SettingsView 补回归，锁定 projection 面板不再混入无关 reintegration 的对象。
- [x] 跑 focused server/web 验证并确认通过。
- [x] 已提交 `5396902 Scope PR6 projection views to active reintegration records.`，本轮主线收口完成。

## 备注
- focused 验证命令应使用：
  - `cd LifeOS/packages/server && node --import tsx --test test/reintegrationApi.test.ts`
  - `cd LifeOS/packages/web && pnpm test src/views/SettingsView.test.ts src/api/client.test.ts`
- 避免使用 `pnpm --filter server test -- --runInBand reintegrationApi.test.ts` 这类写法；当前 package script 会把整套 server tests 拉起，并可能留下 `packages/server/config.json` 测试副作用。
- 下轮应从新的高价值缺口继续，不再重复围绕这一组 projection scope 问题打转。

---
