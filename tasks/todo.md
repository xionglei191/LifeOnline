# 当前轮：Calendar hover/detail 一致性补面

## 进展
- [x] 识别 `CalendarGrid` 格子展示与 `CalendarView` 右侧详情已共享同一套类型 / 状态 / 可见标题排序语义，但排序规则仍散落在两个文件里，且 hover preview 仍直接吃原始 `day.notes` 顺序。
- [x] 抽出日历记录排序 helper，并让 `CalendarGrid` 的格子展示、hover preview、`CalendarView` 的当日详情共用同一排序结果，消除主路径分叉。
- [x] 补 focused 回归，锁定 calendar hover preview 与 grid/detail 的排序一致性。
- [x] 跑 focused web 验证并确认通过：`pnpm --dir /home/xionglei/LifeOnline/LifeOS --filter web test -- src/components/CalendarGrid.test.ts src/views/CalendarView.test.ts src/components/TimelineTrack.test.ts src/components/NotePreview.test.ts`

## 结果
- `CalendarGrid` 的格子展示、hover preview 与 `CalendarView` 当日详情现在共用同一套 calendar note 排序 helper；同一天记录会先按类型、再按状态、最后按可见共享标题稳定展示。
- `NotePreview` 新增 preserve-order 入口，允许调用方在已完成上游排序时保持该顺序，避免预览层再次按标题重排而打散主路径语义。
- focused web 验证已通过，可继续扫描新的 contract / 主路径缺口。

---
