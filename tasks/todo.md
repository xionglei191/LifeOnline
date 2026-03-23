# 当前轮：PromotionProjectionPanel 主路径中文化收口

## 进展
- [x] 识别新的主路径 copy gap：`LifeOS/packages/web/src/components/PromotionProjectionPanel.vue` 仍残留 `Promotion Projections`、`Event Nodes`、`Continuity Records`、`Reintegration`、`Promotion:`、`Threshold:`、`Status:`、`Target:`、`Strength:`、`Source Note`、`Source Reintegration`、`Source Action`、`Explanation`、`Evidence`、`Continuity` 以及空状态 `当前还没有 promotion projections / 暂无 event nodes / 暂无 continuity records` 等英文文案。
- [x] 在 `LifeOS/packages/web/src/components/PromotionProjectionPanel.vue` 做最小文案修正：分别改为“提升投射”“事件节点”“连续性记录”“回流”“提升动作：”“阈值：”“状态：”“目标：”“强度：”“来源笔记”“来源回流”“来源动作”“判定说明”“证据”“连续性内容”“当前还没有提升投射”“暂无事件节点”“暂无连续性记录”，不改变 projection 数据加载、refresh 事件、列表渲染或 JSON 内容展示逻辑。
- [x] 在 `LifeOS/packages/web/src/views/SettingsView.test.ts` 与 `LifeOS/packages/web/src/components/NoteDetail.test.ts` 补和调整 focused 回归，锁定主路径消费方展示新的中文文案，并修正 NoteDetail 里被旧英文断言覆盖回去的 projection 断言与真实 websocket 调用次数。
- [x] 跑受影响 web 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/components/NoteDetail.test.ts src/views/SettingsView.test.ts`。

## 结果
- PromotionProjectionPanel 及其在 NoteDetail / SettingsView 主路径上的投射文案已进一步统一到当前中文产品口径。
- 本轮顺手修正了消费方测试里残留的旧英文断言与过时 websocket 调用次数假设，防止面板本体中文化后测试继续回推英文 copy。
- 本轮仍是新的用户可见主路径 copy gap 收口，没有继续深挖 grouped governance / settings 深链对称补强。

## 下一步建议
- 下一轮优先继续找新的 server/web/shared contract gap 或事实源一致性问题；如果暂时仍停留在用户可见缺口，可继续检查 `LifeOS/packages/web/src/components/WorkerTaskDetail.vue` 或 `LifeOS/packages/web/src/components/WorkerTaskCard.vue` 是否还存在英文状态区、badge、section 标题未对齐当前中文口径。

---
