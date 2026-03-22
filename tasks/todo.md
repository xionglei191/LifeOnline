# 当前轮：notes query contract 补面

## 进展
- [x] 识别 `fetchNotes` 仍直接把可选 filters 丢给 `URLSearchParams`，会把 `undefined` 漏进 `/api/notes?...` 查询串，形成不必要的 client-to-server contract 噪音。
- [x] 改为只序列化实际存在的 `dimension/status/type`，让 notes 列表请求与 server handler 的可选过滤语义保持一致。
- [x] 补 focused 回归，锁定未传过滤项时不会生成 `undefined` 查询参数。
- [x] 跑 focused web 验证并确认通过：`pnpm --dir /home/xionglei/LifeOnline/LifeOS --filter web test -- src/api/client.test.ts`

## 结果
- `fetchNotes` 现在只会把真实存在的 filters 编进 query string，避免 `/api/notes?status=undefined` 这类伪参数继续向 server 漏出。
- web client boundary test 已锁住有过滤和无过滤两条路径的 query shape，可继续扫描新的 response metadata / fact-source 缺口。

---
