# 当前轮：search canonical query 收口

## 进展
- [x] 识别 search 主路径仍把原始 `q` 直接回写到 `SearchResult.query/filters.q`，导致 server 已知的查询事实源可以带前后空白返回给 UI。
- [x] 改为让 server 在 search 边界统一 trim 查询词，并补 web client 与 SearchView 回归，锁定 UI 使用 canonical query 展示。
- [x] 跑 focused 验证并确认通过：`pnpm --dir /home/xionglei/LifeOnline/LifeOS --filter web test -- src/api/client.test.ts src/views/SearchView.test.ts`；`pnpm --dir /home/xionglei/LifeOnline/LifeOS/packages/server exec node --test-name-pattern "search API trims query whitespace before returning shared search filters" --import tsx --test test/configLifecycle.test.ts`

## 结果
- search 主路径现在会把共享响应里的 canonical query 当作唯一展示事实源，不再把带空白的原始输入泄漏到结果文案。
- 新增回归已锁住 search query contract 与 UI 投射，可继续扫描新的 contract / fact-source gap。

---
