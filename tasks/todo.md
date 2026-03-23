# 当前轮：Search query transition main-path 收口

## 进展
- [x] 识别新的主路径行为缺口：`LifeOS/packages/web/src/views/SearchView.vue` 在查询词切换时会继续保留上一个结果的 `selectedNoteId`，导致 search 主路径可能在新查询下仍打开旧详情，出现结果集与详情面板错位。
- [x] 在 `LifeOS/packages/web/src/views/SearchView.vue` 的 query watcher 中补齐最小状态收敛：当 `route.query.q` 发生变化时先清空当前选中的 note，再按新查询执行搜索。
- [x] 在 `LifeOS/packages/web/src/views/SearchView.test.ts` 增加 focused 回归，锁定 query 切换后旧详情会被关闭，新的结果摘要继续按最新查询渲染。
- [x] 跑受影响 web 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SearchView.test.ts`。

## 结果
- search 主路径在 query 切换时不再残留旧详情面板，结果列表与详情面板重新回到同一条语义线索。
- 这补上的是用户可见的状态一致性缺口，而不是同类测试平移。

## 下一步建议
- 下一轮优先继续找新的主路径状态错位或 contract-to-UI 投射缺口，优先看 detail / list / modal 之间是否还有 query、filter、selection 三者不同步的地方。

---
