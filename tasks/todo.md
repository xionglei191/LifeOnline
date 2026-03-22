# 当前轮：clear-finished worker task contract 补面

## 进展
- [x] 识别 `clearFinishedWorkerTasks` 虽已消费 shared `ClearFinishedWorkerTasksResponse.deleted`，但 `client.test.ts` 还没有显式锁住该接口的 `success + deleted` response shape。
- [x] 补 web client boundary 回归，锁定 clear-finished 接口按 shared contract 解包 `deleted`。
- [ ] 跑 focused web 验证并确认通过。

## 结果
- 进行中

---
