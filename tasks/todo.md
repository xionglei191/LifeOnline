# 当前轮：schedule action contract 补面

## 进展
- [x] 识别 `deleteTaskSchedule` / `runTaskScheduleNow` 仍只返回 `void`，但 server/shared 已明确给出 `DeleteTaskScheduleResponse` / `TaskScheduleResponse` 包装；当前 web client 丢弃了这层 contract 信息。
- [x] 改为让 schedule 删除返回 shared `success: true`，立即执行返回 `TaskScheduleResponse.schedule`，并保持现有 UI 调用点兼容。
- [x] 补 focused web client 回归，锁定 schedule action 写回按 shared contract 解包。
- [x] 跑 focused web 验证并确认通过：`pnpm --dir /home/xionglei/LifeOnline/LifeOS --filter web test -- src/api/client.test.ts`

## 结果
- `deleteTaskSchedule` 现在显式返回 shared `DeleteTaskScheduleResponse`，`runTaskScheduleNow` 返回 shared `TaskScheduleResponse.schedule`，避免 schedule 写回边界继续静默丢弃 server/shared 包装信息。
- web client boundary test 已锁住这两条 schedule action 的解包形状，可继续扫描下一处 contract gap。

---
