# 当前轮：search client contract 回归补面

## 进展
- [x] 识别 `searchNotes` 的 web client 回归仍沿用旧版 `SearchResult` shape，没有锁住已落地的 `filters.q` 合同。
- [x] 对齐 `client.test.ts` 中的 search response mock，确保 web client 回归直接校验 shared `SearchResult.filters.q`。
- [ ] 跑 focused web client 验证并视情况直接提交。

---
