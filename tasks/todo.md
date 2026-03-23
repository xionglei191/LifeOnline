# 当前轮：Note preview privacy projection 收口

## 进展
- [x] 识别新的 contract-to-UI 投射缺口：shared/server 已返回 `Note.privacy` 与 `encrypted`，`NoteDetail` 也已做隐私遮罩，但 `LifeOS/packages/web/src/components/NotePreview.vue` 在 search / calendar / timeline 共用 hover preview 路径上仍直接渲染原始正文，存在主路径敏感内容泄露风险。
- [x] 在 `LifeOS/packages/web/src/components/NotePreview.vue` 对 preview body 做最小遮罩：private / sensitive 内容改为隐私保护提示，encrypted 内容改为加密提示，公开内容仍保留原有截断预览。
- [x] 在 `LifeOS/packages/web/src/components/NotePreview.test.ts` 增加 focused 回归，锁定 single-note private preview 不会泄露正文，multi-note encrypted preview 不会泄露正文，同时 public note 仍可正常显示内容。
- [x] 跑 focused 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/components/NotePreview.test.ts`。

## 结果
- search / calendar / timeline 共用的 hover preview 现在会尊重现有 privacy contract，不再在浏览路径上绕过 detail 页的内容保护。
- 这次修复覆盖多个主路径调用点，但只改一个共享组件，收口清晰且风险小。

## 下一步建议
- 下一轮优先检查是否还存在其它不经过 `NotePreview` 的浏览型内容泄露点，例如 calendar day detail 卡片是否仍直接输出受保护正文。

---
