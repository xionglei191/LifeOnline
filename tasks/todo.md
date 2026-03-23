# 当前轮：Timeline hero density fact projection 收口

## 进展
- [x] 识别 `LifeOS/packages/web/src/views/TimelineView.vue` hero 区仍把 busiest dimension 写成“最活跃的轨道”，同时 metric meta 还残留 `days in view` / `tracked notes` / `items` 这类泛化英文文案，无法直接表达当前窗口里真实的记录密度事实。
- [x] 在 `LifeOS/packages/web/src/views/TimelineView.vue` 把 hero summary 改成直接暴露 `{{ busiestCount }} 条记录` 和“记录最密集维度”，并把 metric meta 改成中文事实描述，让 timeline 主路径更准确表达当前窗口统计。
- [x] 在 `LifeOS/packages/web/src/views/TimelineView.test.ts` 增加 focused 回归，锁定 hero 会渲染记录密度事实，并防止旧英文泛化文案回归。
- [x] 跑 focused 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/TimelineView.test.ts`。

## 结果
- Timeline 页主路径现在直接说明哪个维度记录最密集以及具体记录数，不再让“活跃轨道”这种泛化说法承载统计事实。
- timeline / stats / dashboard / dimension 四条主路径对统计语义的表达继续向直接事实收口。

---
