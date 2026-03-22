# 当前轮：persona snapshot contract 补面

## 进展
- [x] 识别 `fetchPersonaSnapshot` 已按 shared `PersonaSnapshotResponse` 返回 `snapshot ?? null`，但 `client.test.ts` 还没有锁住服务端返回 `snapshot: null` 的分支，future drift 时容易退化成异常或假对象。
- [x] 补 web client boundary 回归，锁定 persona snapshot 空响应会稳定解包为 `null`。
- [ ] 跑 focused web 验证并确认通过。

## 结果
- 进行中

---
