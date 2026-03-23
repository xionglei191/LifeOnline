# 当前轮：Calendar day detail privacy projection 收口

## 进展
- [x] 识别新的主路径隐私缺口：虽然 `NotePreview` 已做正文遮罩，但 `LifeOS/packages/web/src/views/CalendarView.vue` 的 selected-day detail 卡片仍直接截断输出 `note.content`，会在日历主路径上继续泄露 private / sensitive / encrypted 正文。
- [x] 在 `LifeOS/packages/web/src/views/CalendarView.vue` 为 day detail 卡片补齐最小正文遮罩：private / sensitive 内容改为隐私保护提示，encrypted 内容改为加密提示，public 内容保留原有截断预览。
- [x] 在 `LifeOS/packages/web/src/views/CalendarView.test.ts` 增加 focused 回归，锁定 selected-day detail 卡片不会泄露 private / encrypted 正文，同时 public 内容仍可见。
- [x] 跑 focused 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/CalendarView.test.ts`。

## 结果
- 日历主路径现在不再因为 selected-day detail 卡片绕过共享 preview 而泄露受保护正文。
- privacy contract 在 calendar hover preview 与 calendar day detail 两条浏览路径上的行为更一致。

## 下一步建议
- 下一轮优先继续排查其它不经过 `NotePreview` 的浏览型卡片或摘要组件，尤其是 search/list 主路径上是否仍有直接截断正文的局部实现。

---
