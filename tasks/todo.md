# 当前轮：note write-back contract 补面

## 进展
- [x] 识别 `createNote` / `updateNote` 已对齐 shared `CreateNoteResponse` / `UpdateNoteResponse`，但 `client.test.ts` 还没有锁住这两条写回接口的 response shape，存在 future drift 风险。
- [x] 补 web client boundary 回归，锁定 note 创建返回 `success + filePath`，更新返回 shared `success: true` contract。
- [ ] 跑 focused web 验证并确认通过。

## 结果
- 进行中

---
