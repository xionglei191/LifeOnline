# 当前轮：Dimension route transition main-path 收口

## 进展
- [x] 识别新的主路径行为缺口：`LifeOS/packages/web/src/views/DimensionView.vue` 在维度路由切换时会继续保留上一个列表结果里的 `selectedNoteId`，导致 dimension 主路径可能在新维度下仍打开旧详情，出现列表与详情跨维度错位。
- [x] 在 `LifeOS/packages/web/src/views/DimensionView.vue` 增加最小状态收敛：当规范化后的 `dimension` 发生变化时清空当前选中的 note，避免旧详情穿透到新维度页面。
- [x] 在 `LifeOS/packages/web/src/views/DimensionView.test.ts` 增加 focused 回归，锁定维度切换后旧详情会关闭，而新的维度列表继续按最新路由渲染。
- [x] 跑受影响 web 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/DimensionView.test.ts`。

## 结果
- dimension 主路径在路由维度切换时不再残留旧详情面板，列表与详情重新保持同一维度语义。
- 这延续的是上一轮 search 修复所指向的真实状态一致性问题，而不是对称补测试。

## 下一步建议
- 下一轮优先继续排查其它 route-driven detail/list 组合，尤其 calendar / dashboard 进入 detail 时是否还存在 selection、filter、route 不同步的可见错位。

---
