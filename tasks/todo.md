# 当前轮：Dashboard backlog hero copy 中文化收口

## 进展
- [x] 识别新的 dashboard 主路径 copy gap：`LifeOS/packages/web/src/components/DashboardOverview.vue` 的最高积压维度说明仍写成中英混用的“当前 open work 最多的维度”，与最近几轮 dashboard / stats 的中文化收口口径不一致。
- [x] 在 `LifeOS/packages/web/src/components/DashboardOverview.vue` 做最小文案修正：将该说明改为“当前待处理工作最多的维度”，保持语义不变但直接表达真实指标含义。
- [x] 在 `LifeOS/packages/web/src/components/DashboardOverview.test.ts` 补 focused 回归，锁定 hero 使用新的中文 backlog 说明，且不再回退到 `open work` 英文文案。
- [x] 跑受影响 web 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/components/DashboardOverview.test.ts`。

## 结果
- dashboard hero 现在不再混用英文 backlog 占位词，最高积压维度指标已用中文直接表达。
- 这次补的是新的用户可见主路径 copy gap，仍然是 dashboard 主路径收口，不涉及 settings 深链对称补强。

## 下一步建议
- 下一轮继续找新的 server/web/shared contract gap 或事实源一致性问题，优先看其它主路径是否还存在中英混用或固定 copy 没有准确表达真实指标含义的地方。

---
