# 当前轮：WorkerTaskDetail 主路径中文化收口

## 进展
- [x] 识别新的主路径 copy gap：`LifeOS/packages/web/src/components/WorkerTaskDetail.vue` 顶部 kicker 仍为 `Worker Task`，来源跳转 pill 前缀仍为 `source`，与最近几轮任务主路径中文化口径不一致。
- [x] 在 `LifeOS/packages/web/src/components/WorkerTaskDetail.vue` 做最小文案修正：分别改为“任务详情”“来源”，不改变任务详情加载、源笔记跳转、输出笔记跳转、重试/取消或 websocket 刷新逻辑。
- [x] 在 `LifeOS/packages/web/src/components/WorkerTaskDetail.test.ts` 补 focused 回归，锁定详情壳显示新的中文文案，并同步更新来源跳转 pill 的断言。
- [x] 跑受影响 web 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/components/WorkerTaskDetail.test.ts`。

## 结果
- WorkerTaskDetail 主路径标题区与来源跳转 pill 已进一步统一到当前中文产品口径。
- 本轮仍是新的用户可见主路径 copy gap 收口，没有继续深挖 grouped governance / settings 深链对称补强。

## 下一步建议
- 下一轮优先继续找新的 server/web/shared contract gap 或事实源一致性问题；如果暂时仍停留在用户可见缺口，可继续检查 `LifeOS/packages/web/src/components/WorkerTaskCard.vue` 是否还存在英文状态区、badge、section 标题未对齐当前中文口径。

---
