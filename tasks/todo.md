# 当前轮：worker task list contract 回归补面

## 进展
- [x] 识别 `fetchWorkerTasks` 的 web client 回归没有锁住 server/shared 已稳定返回的 `WorkerTaskListResponse.filters` shape，存在边界静默漂移风险。
- [x] 对齐 `client.test.ts` 中的 worker task list response mock，确保 web API boundary 回归覆盖 `tasks + filters` 的 shared 合同。
- [ ] 跑 focused web client 验证并视情况直接提交。

---
