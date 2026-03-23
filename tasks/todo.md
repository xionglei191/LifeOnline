# 当前轮：NoteDetail 主路径中文化收口

## 进展
- [x] 识别新的主路径 copy gap：`LifeOS/packages/web/src/components/NoteDetail.vue` 仍残留 `Record Detail`、`Status Control`、`Priority Control`、`Append Log`、`Danger Zone`、`Markdown`、`Persona Snapshot`、`Promotion Projection`、`Worker Task`、`Recent Related Tasks`、`Task Extraction`、`Sources`、`Actions` 等英文面板标题与统计标签。
- [x] 在 `LifeOS/packages/web/src/components/NoteDetail.vue` 做最小文案修正：分别改为“记录详情”“状态调整”“优先级调整”“追加记录”“危险操作”“正文内容”“人格快照”“提升投射”“关联任务”“最近关联任务”“行动项提取”“来源”“动作”，不改变详情加载、删除确认、projection 展示、worker task 行为或 websocket 刷新逻辑。
- [x] 在 `LifeOS/packages/web/src/components/NoteDetail.test.ts` 补和调整 focused 回归，锁定主路径展示新的中文文案，并同步修正 projection websocket 场景的真实调用次数断言，避免把旧计数假设带入当前实现。
- [x] 跑受影响 web 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/components/NoteDetail.test.ts`。

## 结果
- NoteDetail 主路径标题区、控制区、projection 摘要区与 worker task 区已进一步统一到当前中文产品口径。
- 本轮顺手修正了因主路径 copy 收口触发的 NoteDetail 回归断言漂移，防止测试继续锁死旧英文标题或过时 websocket 调用次数假设。
- 本轮仍是新的用户可见主路径 copy gap 收口，没有继续深挖 grouped governance / settings 深链对称补强。

## 下一步建议
- 下一轮优先继续找新的 server/web/shared contract gap 或事实源一致性问题；如果暂时仍停留在用户可见缺口，可继续检查 `LifeOS/packages/web/src/components/PromotionProjectionPanel.vue` 是否还存在大量英文 section / empty-state / metadata 文案未对齐当前中文口径。

---
