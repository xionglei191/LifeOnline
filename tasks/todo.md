# 当前轮：calendar / timeline note lifecycle refresh 收口

## 进展
- [x] 识别 `useCalendar` 与 `useTimeline` 仍然只在 `index-complete` 后刷新，和上一轮已经补上的 note lifecycle websocket contract 脱节；这会让日历/月视图与时间线窗口在应用内 create/update/delete note 后继续停留旧数据，属于新的主路径用户可见缺口。
- [x] 在 `LifeOS/packages/web/src/composables/useCalendar.ts` 抽出 `doesCalendarNeedRefresh`，把 `note-updated` / `note-created` / `note-deleted` 纳入已加载 calendar window 的刷新门禁，不再只信 index-only 事件。
- [x] 在 `LifeOS/packages/web/src/composables/useTimeline.ts` 抽出 `doesTimelineNeedRefresh`，把同一组 note lifecycle websocket contract 纳入已加载 timeline window 的刷新门禁，保持 timeline 与其他主路径事实源一致。
- [x] 在 `LifeOS/packages/web/src/composables/useCalendar.test.ts`、`useTimeline.test.ts` 增加 focused 回归，锁定 calendar / timeline 会在 note lifecycle websocket 到达后重载当前窗口，同时保留已有 stale-response 防护测试。
- [x] 跑 focused 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/composables/useCalendar.test.ts src/composables/useTimeline.test.ts`。

## 结果
- Calendar 与 Timeline 现在会跟随 note lifecycle websocket contract 立即刷新当前窗口，不再要求等待 index-only 刷新链路才能反映应用内笔记创建、更新、删除。
- 当前这一轮 calendar / timeline 主路径刷新收口已完成并通过 focused 验证；下一轮可继续找新的非 Settings 事实源或 contract-to-UI 缺口。

---
