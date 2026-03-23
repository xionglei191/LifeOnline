# 当前轮：Stats hero fact-source naming 收口

## 进展
- [x] 识别 `LifeOS/packages/web/src/views/StatsView.vue` 顶部 hero copy 仍用 `生命信号` / `Balance` / `panels` 这类泛化表达，但底层真实数据其实是完成趋势、完成率雷达、月度完成对比和标签频率，属于事实源命名漂移。
- [x] 在 `LifeOS/packages/web/src/views/StatsView.vue` 把 hero summary 和 metric 文案改成直接指向完成节律、分析图层和当前焦点完成率，让 Stats 主路径对当前图表实际含义表达更准确。
- [x] 在 `LifeOS/packages/web/src/views/StatsView.test.ts` 增加 focused 回归，锁定 hero 会渲染新的完成率语义文案，并防止 `panels` 这类旧文案回归。
- [x] 跑 focused 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/StatsView.test.ts`。

## 结果
- Stats 页顶部文案现在与实际图表数据类型更一致，不再用抽象“生命信号”掩盖真实完成率/对比事实。
- stats、dashboard、dimension 三条主路径对“完成率”这一共享语义继续收口。

---
