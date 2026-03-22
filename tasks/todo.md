# 当前轮：StatsView total metric 语义收口

## 进展
- [x] 识别 `LifeOS/packages/web/src/views/StatsView.vue` 把 stats contract 里的 `total` 直接标成“新增”，但 shared/server 实际返回的是时间桶内的记录总量（`COUNT(*)`），不是严格意义上的“新创建数量”；这会让主路径统计页对用户输出错误事实，属于新的事实源语义漂移。
- [x] 在 `LifeOS/packages/web/src/views/StatsView.vue` 把 trend / monthly 两个图层的 legend 与 series 名称从“新增”改成“记录总量”，让 UI 文案与当前 shared/server contract 保持一致，而不是继续暗示不存在的 creation metric。
- [x] 在 `LifeOS/packages/web/src/views/StatsView.test.ts` 增加 focused 回归，锁定 trend / monthly 图表配置使用“记录总量”标签，防止后续再把 `COUNT(*)` contract 错标回“新增”。
- [x] 跑 focused 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/StatsView.test.ts`。

## 结果
- StatsView 现在对 `total` 指标的文案语义与 shared/server 当前事实源一致，用户不会再把 bucketed total 误读成新增创建量。
- 当前这一轮 StatsView 语义收口已完成并通过 focused 验证；下一轮可继续找新的非 Settings 主路径 fact-source / contract-to-UI gap。

---
