# 当前轮：Dashboard metric fact-source naming 收口

## 进展
- [x] 识别 `LifeOS/packages/web/src/components/DashboardOverview.vue` 顶部 metric tiles 仍有事实源命名漂移：`系统健康` 实际展示的是平均完成率，`失衡维度` 实际取的是 open-work 最高维度的对立概念，属于新的事实表达错误。
- [x] 在 `LifeOS/packages/web/src/components/DashboardOverview.vue` 将其改为 `平均完成率` / `八维度平均完成进度`，以及 `最高积压维度` / `当前 open work 最多的维度`，让 tile 文案与底层计算逻辑一致。
- [x] 在 `LifeOS/packages/web/src/components/DashboardOverview.test.ts` 增加 focused 回归，锁定这些 metric tiles 会渲染正确命名和数值，并防止旧的漂移文案回归。
- [x] 跑 focused 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/components/DashboardOverview.test.ts`。

## 结果
- Dashboard hero metrics 现在不再把平均完成率误称为“系统健康”，也不再把最高积压维度误写成抽象“失衡维度”。
- 顶部 summary、metric tiles、signal band、dimension matrix 对同一维度统计的命名进一步收口到一致事实源。

---
