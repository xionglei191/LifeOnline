# 当前轮：Worker task detail result facts 收口

## 进展
- [x] 识别 `LifeOS/packages/web/src/components/WorkerTaskDetail.vue` 虽然已经能显示结构化 `result` JSON，但详情弹层仍缺少基于 shared contract 的关键结果 facts，用户必须自己读原始 JSON 才知道任务产出重点，属于新的 contract-to-UI 可见性缺口。
- [x] 将 `workerTaskResultFacts` 从 `WorkerTaskCard` 提升到 `LifeOS/packages/web/src/utils/workerTaskLabels.ts` 复用，并让 `LifeOS/packages/web/src/components/WorkerTaskDetail.vue` 在结构化 JSON 前补充“关键结果” facts，保持卡片与详情对同一 worker contract 的投射一致。
- [x] 在 `LifeOS/packages/web/src/components/WorkerTaskDetail.test.ts` 增加 focused 回归，锁定 extract tasks 成功态会先展示关键结果 facts，再保留原始结构化结果 JSON。
- [x] 跑 focused 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/components/WorkerTaskCard.test.ts src/components/WorkerTaskDetail.test.ts src/utils/workerTaskLabels.test.ts`。

## 结果
- Worker task 的列表卡片与详情弹层现在复用同一套 result facts 投射规则，用户不需要先读 JSON 才能看懂成功任务产出。
- 当前这一轮 detail result facts 收口完成后，下一轮可继续找新的非 Settings 主路径 contract / fact-source / stale visibility gap。

---
