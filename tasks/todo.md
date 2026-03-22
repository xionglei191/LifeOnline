# 当前轮：projection query contract 补面

## 进展
- [x] 识别 `fetchEventNodes` / `fetchContinuityRecords` 仍直接 `join(',')` 序列化 reintegration ids，重复值和空白值会被原样带进 query string，与 server 端 `trim + filter(Boolean)` 的实际过滤语义不完全对齐。
- [x] 改为在 web client 侧先做 `trim`、去空、去重，再拼接 projection 查询参数，避免把噪音 id 继续漏进 server/web contract 边界。
- [x] 补 focused 回归，锁定 projection query 只发送规范化后的 reintegration ids。
- [x] 跑 focused web 验证并确认通过：`pnpm --dir /home/xionglei/LifeOnline/LifeOS --filter web test -- src/api/client.test.ts`

## 结果
- `fetchEventNodes` 与 `fetchContinuityRecords` 现在会先规范化 reintegration ids，再生成 query string，避免重复值、空白值把 projection 请求形状污染到 server 边界。
- web client boundary test 已锁住 event / continuity 两条 projection query 的规范化行为，可继续扫描下一处 response metadata gap。

---
