# 当前轮：Timeline window transition detail-state 收口

## 进展
- [x] 识别新的主路径行为缺口：`LifeOS/packages/web/src/views/TimelineView.vue` 在时间窗口切换时会继续保留旧 `selectedNoteId`，导致 timeline 主路径可能在新窗口下仍打开旧详情，出现轨道窗口与详情面板错位。
- [x] 在 `LifeOS/packages/web/src/views/TimelineView.vue` 的窗口 watcher 中补齐最小状态收敛：当 `startDate/endDate` 变化时先清空当前选中的 note，再加载新的窗口数据。
- [x] 在 `LifeOS/packages/web/src/views/TimelineView.test.ts` 增加 focused 回归，锁定时间窗口变化后旧详情会关闭，不再跨窗口残留。
- [x] 跑受影响 web 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/TimelineView.test.ts`。

## 结果
- timeline 主路径在时间窗口切换时不再残留旧详情面板，轨道窗口与详情面板重新保持同一时间范围。
- 这继续补的是窗口驱动页面里的真实状态一致性缺口，不是同类测试平移。

## 下一步建议
- 下一轮优先换到新的 contract/UI 投射缺口，优先看 dashboard 或 stats 主路径上是否还有 shared/server canonical facts 被局部重算、漏投射或跨面板错位的地方。

---
