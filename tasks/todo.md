# update_persona_snapshot web delivery gap 闭环

## 计划
- [x] 在不覆盖并行 dirty 文件的前提下，继续沿新的 server/web/shared contract gap 主线推进。
- [x] 把 `update_persona_snapshot` 从“shared/server 已支持、web 仍半隐形”的状态补到真正可触发、可筛选、可理解。
- [x] 补最小 web 回归并跑定向验证。

## 当前执行
- 已确认当前工作树并行改动仍为：`CLAUDE.md`、`LifeOS/packages/server/config.json`、`lifeonline-claude-worker-v2.sh`，以及上轮已完成但未提交的 worker-task structured result 相关文件。本轮未覆盖这些无关文件。
- 本轮完成的真实实现：
  - `LifeOS/packages/web/src/components/NoteDetail.vue`
    - 在笔记详情的 worker task 入口中新增“更新人格快照”按钮。
    - 新增 `handleCreatePersonaSnapshotTask()`，直接创建 `update_persona_snapshot` worker task，并复用现有成功/失败消息与关联任务刷新链路。
  - `LifeOS/packages/web/src/components/WorkerTaskCard.vue`
    - 为 `update_persona_snapshot` 增加专门的输入投射，显示 `人格源笔记`，不再退化成“无额外参数”。
  - `LifeOS/packages/web/src/views/SettingsView.vue`
    - 最近任务筛选中补入 `update_persona_snapshot`。
    - 定时任务类型下拉中显式补入 `summarize_note` / `update_persona_snapshot`，并在创建时对这两类需要具体 `noteId` 的任务给出阻断性错误，避免 settings 页构造出无 note context 的无效 schedule。
  - `LifeOS/packages/web/src/components/NoteDetail.test.ts`
    - 新增 persona snapshot 创建回归，锁定按钮行为、API 请求 shape 与本地化反馈文案。
  - `LifeOS/packages/web/src/components/WorkerTaskCard.test.ts`
    - 新增 persona snapshot 输入投射回归，锁定卡片不再回退到 generic fallback。
  - `LifeOS/packages/web/src/views/SettingsView.test.ts`
    - 新增回归，锁定 worker task filter 可见 `人格快照更新`，并验证 settings 页不会为缺少笔记上下文的 persona snapshot schedule 发请求。
- 这次修的不是再补一条 grouped governance 同类稳定性测试，而是把 shared/server 已支持的 `update_persona_snapshot` 真正交付到 web 入口、筛选与参数展示层，补上真实的 contract gap 和主路径可见性缺口。

## 本轮选择依据
- 这是新的 server/web/shared contract gap：`update_persona_snapshot` 已在 shared 类型、server 执行、soul action dispatch 中具备真实语义，但 web 之前没有完整交付入口和过滤/展示支持。
- 上轮刚补完 worker-task structured result 后，这条线自然成为更高价值的下一步，因为它决定用户能不能真正创建、发现并理解这类任务，而不是只在后端存在。
- 同时顺手修正了 schedule 配置面上的任务类型事实源漂移，避免 UI 暴露出实际上缺失必需 `noteId` 上下文的无效入口。

## 本轮验证
- `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/components/NoteDetail.test.ts src/components/WorkerTaskCard.test.ts src/views/SettingsView.test.ts` 通过；受 vitest 配置影响，同时跑过现有 web 测试集，9 files / 140 tests 全通过。
- 当前环境仍有既有 Node engine warning（声明 `>=20 <21`，实际 `v25.8.1`），但未影响本轮验证。

## 当前未完成项
- 本轮改动尚未提交 git commit。
- 如果继续沿 worker task contract/UI 主线推进，最合理的下一步仍是把上轮 structured result 闭环 + 本轮 persona snapshot web delivery 一起提交，形成一组完整交付提交。


# worker-task structured result contract gap 闭环

## 计划
- [x] 在不覆盖并行 dirty 文件的前提下，继续沿新的 server/web/shared contract gap 主线推进。
- [x] 完成 `worker_tasks` 的 `result_json` 持久化链路，让 shared `WorkerTask.result` 真正由 server DB / API 承载，而不再只是类型层定义。
- [x] 让 `WorkerTaskDetail` 展示结构化结果，补上 contract-to-UI 的真实投射缺口。
- [x] 补最小 server/web 回归并跑定向验证。

## 当前执行
- 已确认当前工作树并行改动仍为：`CLAUDE.md`、`LifeOS/packages/server/config.json`、`lifeonline-claude-worker-v2.sh`。本轮未覆盖这些文件，也没有回到 grouped governance / SettingsView 的同类补强。
- 本轮完成的真实实现：
  - `LifeOS/packages/shared/src/types.ts`
    - `WorkerTask` contract 正式承载 `result?: WorkerTaskResultMap[T] | null`，不再只靠 `resultSummary` 表示执行结果。
  - `LifeOS/packages/server/src/db/schema.ts`
    - `worker_tasks` schema 新增 `result_json` 列。
  - `LifeOS/packages/server/src/db/client.ts`
    - `worker_tasks` rebuild/migration 选择列同步纳入 `result_json`，避免旧表重建时丢失 structured result。
  - `LifeOS/packages/server/src/workers/workerTasks.ts`
    - `WorkerTaskRow`/`rowToWorkerTask()` 接入 `result_json`。
    - `createWorkerTask()` 初始化 `result: null` 并写入 DB。
    - `updateTaskStatus()` 持久化 `result_json`。
    - `retryWorkerTask()`、running/failed 分支清空 `result`。
    - `executeWorkerTask()` 成功完成时把 typed `result` 与 `resultSummary` 一起落库并通过 API 返回。
  - `LifeOS/packages/web/src/components/WorkerTaskDetail.vue`
    - 新增“结构化结果”区块，直接显示 `task.result` JSON，而不是只能看摘要。
  - `LifeOS/packages/server/test/workerTasks.test.ts`
    - 新增成功态 structured result 落库回归，并补失败/重试时 `result` 清空断言。
  - `LifeOS/packages/web/src/components/WorkerTaskDetail.test.ts`
    - 新增 structured result UI 展示回归。
- 这次修的不是再补一条同类 UI 稳定性测试，而是把 shared 已声明但未真正交付的 `WorkerTaskResultMap` 从类型层打通到 DB、API 和详情 UI，补上真实 contract gap。

## 本轮选择依据
- 这条线正中用户当前优先级第一项：新的 `server/web/shared contract gap`。
- shared 里原本已有 `WorkerTaskResultMap`，但 server 不持久化、web detail 不展示，属于“定义了 contract 但没有真正 deliver”的主路径缺口。
- 相比继续做 grouped governance / SettingsView 同类对称补强，这条线更直接改善 worker task 详情的可见信息密度和跨端一致性。

## 本轮验证
- `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/workerTasks.test.ts` 通过，6/6。
- `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/components/WorkerTaskDetail.test.ts src/api/client.test.ts` 通过；受 vitest 配置影响，同时跑过现有 web 测试集，9 files / 137 tests 全通过。
- 当前环境仍有既有 Node engine warning（声明 `>=20 <21`，实际 `v25.8.1`），但未影响本轮验证。

## 当前未完成项
- 本轮改动尚未提交 git commit。
- `WorkerTaskDetail` 现阶段先以 JSON 形式展示 structured result；如果后续继续沿 contract-to-UI 投射推进，可再按 task type 做更细的结果卡片，但不属于本轮闭环所必需。


# parser file-date boundary 单一事实源收口

## 计划
- [x] 在不覆盖并行 dirty 文件的前提下，继续沿日期边界主线推进剩余真实风险点。
- [x] 复核 server 代码中残留的 UTC `toISOString().split('T')[0]` 使用，确认 indexer parser 仍会把文件 mtime 直接投影为 UTC 日期，可能导致晚间修改文件在缺省 frontmatter date 时被错误归到次日。
- [x] 让 parser 默认文件日期复用 `formatLocalDate()`，并补最小回归锁定缺省 date 口径。
- [x] 跑定向验证并视结果决定是否直接提交。

## 当前执行
- 已确认当前工作树并行改动仍为：`CLAUDE.md`、`LifeOS/packages/server/config.json`、`lifeonline-claude-worker-v2.sh`。本轮未覆盖这些文件，也没有回到 grouped governance / SettingsView 的同类补强。
- 本轮完成的真实实现：
  - `LifeOS/packages/server/src/indexer/parser.ts`
    - 缺省 frontmatter `date` 改为复用 `formatLocalDate(stat.mtime)`，移除 UTC 日期投影。
  - `LifeOS/packages/server/test/parserDate.test.ts`
    - 新增 parser 回归，锁定缺省 `date` 必须采用本地文件修改日，而不是 UTC rollover 后的日期。
- 这次修的不是同类测试平移，而是把索引主路径里仍残留的 UTC 日期口径收回到与 dashboard / weekly_report / calendar 相同的本地日期事实源，避免新建/修改笔记在夜间被错误落到第二天。

## 本轮选择依据
- 上轮已收口 dashboard / calendar / weekly_report 的日期边界，当前 grep 显示剩余最直接的业务口径分叉点就在 `indexer/parser.ts`。
- parser 缺省 `date` 会直接影响索引后的 note 归档、统计和后续 timeline/calendar 展示，属于真实主路径，而不是低边际对称补强。
- 这条线继续减少“同一个本地修改时间在不同链路被解释成不同日期”的用户可见风险。

## 本轮验证
- `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/parserDate.test.ts test/dateUtils.test.ts` 通过，4/4。
- 当前环境仍有既有 Node engine warning（声明 `>=20 <21`，实际 `v25.8.1`），但未影响本轮验证。

## 当前未完成项
- 本轮改动尚未提交 git commit。
- parser file-date 收口完成后，可继续检查 web 侧是否仍有直接依赖浏览器/UTC 日期推导而未复用 server 返回 contract 的位置。


# date/week boundary 单一事实源收口

## 计划
- [x] 在不覆盖并行 dirty 文件的前提下，继续沿新的高价值主路径缺口推进。
- [x] 复核 dashboard / calendar / weekly_report 的日期边界逻辑，确认 server 侧同时存在 UTC `toISOString().split('T')[0]` 与本地周起始计算，且 dashboard 与 weekly_report 的周起始定义不一致。
- [x] 把本地日期格式、Monday 起始周、月范围/日期列表统一提升到 `server/src/utils/date.ts` 单点 helper，并让 dashboard / calendar / weekly_report 复用。
- [x] 跑定向验证并视结果决定是否直接提交。

## 当前执行
- 已确认当前工作树并行改动仍为：`CLAUDE.md`、`LifeOS/packages/server/config.json`、`LifeOS/packages/web/src/views/SettingsView.vue`、`LifeOS/packages/web/src/views/SettingsView.test.ts`、`lifeonline-claude-worker-v2.sh`。本轮未覆盖这些文件，也没有回到 grouped governance / SettingsView 的同类补强。
- 本轮完成的真实实现：
  - `LifeOS/packages/server/src/utils/date.ts`
    - 新增 `formatLocalDate()`、`getWeekStartDateString()`、`getWeekEndDateString()`、`getMonthDateRange()`、`getMonthDateStrings()`，集中本地日期与周/月边界规则。
  - `LifeOS/packages/server/src/api/handlers.ts`
    - `getDashboard()` 改为复用 Monday 起始周边界 helper，避免继续使用 Sunday 起始与 UTC 字符串混算。
    - `getCalendar()` 改为复用 month range/day helpers，移除按 `toISOString().split('T')[0]` 生成月起止与日列表的 UTC 口径。
  - `LifeOS/packages/server/src/workers/workerTasks.ts`
    - `weekly_report` 默认 `weekStart` 与 `weekEnd` 改为复用同一组 date helpers，消除与 dashboard 的周定义分叉。
  - `LifeOS/packages/server/test/dateUtils.test.ts`
    - 新增 date helper 回归，锁定本地日期格式、Monday 起始周、月范围/日期列表语义。
- 这次修的不是同类稳定性测试平移，而是修复 dashboard / calendar / weekly_report 三条真实主路径共享的日期事实源分叉，避免周边界、月边界、晚间时区下的可见统计不一致。

## 本轮选择依据
- 新一轮优先级中，date/week boundary 属于新的主路径断裂 / 事实源一致性问题，比继续补 grouped governance 对称测试更高价值。
- explore 结果显示 dashboard 使用 Sunday 起始周，而 weekly_report 使用 Monday 起始周；同时多个 API 仍用 `toISOString().split('T')[0]` 生成本地业务日期，存在真实的用户可见错位风险。
- 这条线直接降低 dashboard、calendar、weekly report 之间“今天 / 本周 / 本月”口径不一致的风险。

## 本轮验证
- `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/dateUtils.test.ts` 通过，3/3。
- `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test --test-name-pattern "worker task APIs respond with shared worker task contracts|dashboard, timeline, and calendar APIs respond with shared view contracts" test/configLifecycle.test.ts` 通过，2/2。
- 当前环境仍有既有 Node engine warning（声明 `>=20 <21`，实际 `v25.8.1`），但未影响本轮验证。

## 当前未完成项
- 本轮改动尚未提交 git commit。
- date/week 边界收口完成后，可继续检查 server 其它仍使用 UTC `toISOString().split('T')[0]` 的业务路径，优先判断是否会影响用户可见统计或任务默认参数。


# SettingsView reintegration reject 文案中文化收口

## 计划
- [x] 先判断仓库中现有未提交改动是否属于正在进行中的同类推进，避免重复劳动。
- [x] 复核 SettingsView 在 reject reintegration 成功态上的用户文案与测试断言，确认当前改动是统一把夹杂英文的 success message 收口为中文表述。
- [x] 跑定向 web 验证，确认现有改动在不触碰其它并行 dirty 文件的前提下可稳定通过。
- [x] 在项目记录中补记本轮判断与验证结果，并只提交本轮相关文件。

## 当前执行
- 已确认当前工作树除本轮相关改动外，还存在并行脏文件：`CLAUDE.md`、`LifeOS/packages/server/config.json`、`lifeonline-claude-worker-v2.sh`。这些文件未纳入本轮提交。
- 本轮承接的在途实现为：
  - `LifeOS/packages/web/src/views/SettingsView.vue`
    - 将 reject reintegration 成功提示从 `已拒绝该 reintegration record` 统一为更自然的中文文案 `已拒绝该回流记录`。
  - `LifeOS/packages/web/src/views/SettingsView.test.ts`
    - 同步更新所有相关断言，锁定 reject success message 在多类 websocket refresh / reload 场景下都保持上述中文文案。
- 这次没有回到 grouped governance / websocket/filter/retention 的深挖补强，而是优先把当前工作树里已经做到一半、且确实影响 UI 一致性的在途改动收尾并验证，避免形成“仓库长期悬挂的小脏改”。

## 本轮选择依据
- 当前仓库存在明确在途改动，且直接落在近期一直推进的 SettingsView governance 主路径上；继续另开新题会增加重复劳动和上下文分叉。
- 改动虽小，但属于真实的 UI 词汇一致性修正：成功态提示不应把英文数据模型名直接暴露给用户。
- 相关测试已随改动成组存在，因此最合理的下一步是验证并收尾，而不是跳过这组改动去新开一轮 server/shared 收口。

## 本轮验证
- `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过；受 vitest 配置影响，同时跑过现有 web 测试集，9 files / 136 tests 全通过。
- 当前环境仍有既有 Node engine warning（声明 `>=20 <21`，实际 `v25.8.1`），但未影响本轮验证。

## 当前未完成项
- 若后续继续沿“面向用户文案一致性”推进，可再系统检查 SettingsView / governance panel 中是否仍有类似把 internal term 直接暴露到 success/error message 的位置。
- 并行脏文件 `CLAUDE.md`、`LifeOS/packages/server/config.json`、`lifeonline-claude-worker-v2.sh` 仍待各自独立判断，不应在本轮顺手混提。


# PR6 promotion message helper 单一事实源收口

## 计划
- [x] 在不覆盖并行 dirty 文件的前提下，继续沿新的事实源一致性问题主线推进。
- [x] 复核 PR6 promotion planner / executor，确认 governanceReason 与 execution summary 文案仍以内联字符串散落在不同层。
- [x] 把 promotion action 文案提升到 `pr6PromotionRules.ts` 单点 helper，并补测试锁定 summary / governance reason 语义。
- [x] 跑定向验证并视结果决定是否直接提交。

## 当前执行
- 已确认当前工作树并行改动仍为：`CLAUDE.md`、`LifeOS/packages/server/config.json`、`LifeOS/packages/web/src/views/SettingsView.vue`、`LifeOS/packages/web/src/views/SettingsView.test.ts`、`lifeonline-claude-worker-v2.sh`。本轮未覆盖这些文件，也没有回到 grouped governance / SettingsView 的同类补强。
- 本轮完成的真实实现：
  - `LifeOS/packages/server/src/soul/pr6PromotionRules.ts`
    - 新增 `getPromotionGovernanceReason()` 与 `getPromotionExecutionSummary()`，集中 PR6 promotion 的 planner / executor 文案规则。
  - `LifeOS/packages/server/src/soul/reintegrationPromotionPlanner.ts`
    - 改为复用 `getPromotionGovernanceReason()`，移除 planner 内联 governance reason 字符串。
  - `LifeOS/packages/server/src/soul/pr6PromotionExecutor.ts`
    - 改为复用 `getPromotionExecutionSummary()`，移除 executor 内联 result summary 字符串。
  - `LifeOS/packages/server/test/feedbackReintegration.test.ts`
    - 新增 message helper 回归，锁定 governance reason 与 execution summary 必须由 PR6 rules 单点派生。
- 这次修的不是再补一条同类稳定性测试，而是把 PR6 promotion planner / executor 仍然散落的 action 文案规则继续收回 rules 单点，减少 action-kind specific message 在多层重复维护。

## 本轮选择依据
- 用户优先级允许在 contract gap 之后继续处理新的事实源一致性问题。
- payload helper 收口后，planner 与 executor 里仍然各自持有 PR6 promotion 文案字符串，这些文案同样属于 promotion rules，而不是实现层职责。
- 这条线继续降低 PR6 promotion 规则在 planner / executor 之间的重复维护风险，并让后续 contract-to-UI 投射读取更稳定的语义来源。

## 本轮验证
- `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test --test-name-pattern "build PR6 promotion governance and execution summaries from centralized rules|build PR6 promotion payloads from reintegration review context|build PR6 promotion explanations from reintegration review context|getPromotionSourceForReintegration falls back to reintegration id when source note is missing|getContinuityScopeForKind maps PR6 continuity kinds to stable scopes" test/feedbackReintegration.test.ts` 通过，5/5。
- 当前环境仍有既有 Node engine warning（声明 `>=20 <21`，实际 `v25.8.1`），但未影响本轮定向验证。

## 当前未完成项
- 本轮改动尚未提交 git commit。
- promotion message helper 收口完成后，可继续检查 PR6 promotion rules / planner / executor 是否还有剩余的 action-kind specific mapping 或 error 文案分叉。


# PR6 promotion payload helper 单一事实源收口

## 计划
- [x] 在不覆盖并行 dirty 文件的前提下，继续沿新的事实源一致性问题主线推进。
- [x] 复核 `pr6PromotionExecutor.ts`，确认 event/continuity promotion payload 组装仍以内联对象散落在执行层。
- [x] 把 event node / continuity record promotion payload 组装提升到 `pr6PromotionRules.ts` 单点 helper，并补测试锁定 review-backed projection payload。
- [x] 跑定向验证并视结果决定是否直接提交。

## 当前执行
- 已确认当前工作树并行改动仍为：`CLAUDE.md`、`LifeOS/packages/server/config.json`、`LifeOS/packages/web/src/views/SettingsView.vue`、`LifeOS/packages/web/src/views/SettingsView.test.ts`、`lifeonline-claude-worker-v2.sh`。本轮未覆盖这些文件，也没有回到 grouped governance / SettingsView 的同类补强。
- 本轮完成的真实实现：
  - `LifeOS/packages/server/src/soul/pr6PromotionRules.ts`
    - 新增 `buildEventNodePromotionInput()` 与 `buildContinuityPromotionInput()`，集中 event/continuity projection payload 组装。
  - `LifeOS/packages/server/src/soul/pr6PromotionExecutor.ts`
    - event / continuity promotion 执行改为复用上述 helpers，移除 executor 内联 projection payload 对象。
  - `LifeOS/packages/server/test/feedbackReintegration.test.ts`
    - 新增 payload helper 回归，锁定 PR6 projection payload 必须由 reintegration review 上下文派生。
- 这次修的不是再补一条同类稳定性测试，而是把 PR6 promotion projection 的 event/continuity payload 组装从执行层继续收回 rules 单点，减少 executor 对 event title、threshold、summary、continuity scope、explanation 等字段的散落维护。

## 本轮选择依据
- 用户优先级允许在 contract gap 之后继续处理新的事实源一致性问题。
- 上轮刚完成 explanation helper 收口后，executor 里仍保留大块 event/continuity payload 组装内联对象；这些字段本质上仍属于 PR6 promotion rules，而不是执行层职责。
- 这条线继续降低 PR6 projection semantics 在 rules / executor 之间的重复维护风险，并为后续 contract-to-UI 投射保持稳定 payload 语义。

## 本轮验证
- `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test --test-name-pattern "build PR6 promotion payloads from reintegration review context|build PR6 promotion explanations from reintegration review context|getPromotionSourceForReintegration falls back to reintegration id when source note is missing|getContinuityScopeForKind maps PR6 continuity kinds to stable scopes" test/feedbackReintegration.test.ts` 通过，4/4。
- 当前环境仍有既有 Node engine warning（声明 `>=20 <21`，实际 `v25.8.1`），但未影响本轮定向验证。

## 当前未完成项
- 本轮改动尚未提交 git commit。
- promotion payload helper 收口完成后，可继续检查 PR6 promotion rules / executor 是否还有剩余的 action-kind specific projection assembly 分叉。


# soul action source filter shared 单一事实源收口

## 计划
- [x] 在不覆盖并行 dirty 文件的前提下，继续沿新的事实源一致性问题主线推进。
- [x] 复核 soul action legacy reintegration source filter 归一逻辑，确认 web client 仍保留一份独立内联实现，与 server/domain helper 分叉。
- [x] 把 source filter 归一规则提升到 `packages/shared` 单点，并让 server/web 同时复用。
- [x] 跑定向验证并视结果决定是否直接提交。

## 当前执行
- 已确认当前工作树并行改动仍为：`CLAUDE.md`、`LifeOS/packages/server/config.json`、`LifeOS/packages/web/src/views/SettingsView.vue`、`LifeOS/packages/web/src/views/SettingsView.test.ts`、`lifeonline-claude-worker-v2.sh`。本轮未覆盖这些文件，也没有回到 grouped governance / SettingsView 的同类补强。
- 本轮完成的真实实现：
  - `LifeOS/packages/shared/src/types.ts`
    - 新增 shared `normalizeSoulActionSourceFilters()`，把 legacy `sourceNoteId=reint:*` → `sourceReintegrationId` 的归一规则收回 shared 单点。
  - `LifeOS/packages/server/src/soul/types.ts`
    - 改为转调 shared helper，保留 server domain seam，不再自持一份重复实现。
  - `LifeOS/packages/web/src/api/client.ts`
    - `fetchSoulActions()` 改为复用 shared helper，移除 web client 内联 legacy reintegration filter 归一逻辑。
- 这次修的不是再补一条同类稳定性测试，而是把已经在 server/domain 收口过的 legacy reintegration filter 规则继续收回真正的 shared 单点，避免 web / server 对同一查询归一语义再次分叉。

## 本轮选择依据
- 用户优先级允许在 contract gap 之后继续处理新的事实源一致性问题。
- 上轮刚完成 server-side source identity/helper 收口后，web client 仍保留同一 legacy reintegration filter 的内联实现，已经形成新的 server/web 事实源分叉。
- 这条线同时降低 web query 归一漂移风险，并让 shared contract 层真正承载跨端共用规则。

## 本轮验证
- `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/api/client.test.ts` 通过；受 vitest 配置影响，同时跑过现有 web 测试集，9 files / 136 tests 全通过。
- `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test --test-name-pattern "normalizeSoulActionSourceFilters collapses legacy reintegration note filters into sourceReintegrationId|getPromotionSourceForReintegration falls back to reintegration id when source note is missing|build PR6 promotion explanations from reintegration review context" test/feedbackReintegration.test.ts` 通过，3/3。
- 当前环境仍有既有 Node engine warning（声明 `>=20 <21`，实际 `v25.8.1`），但未影响本轮验证。

## 当前未完成项
- 本轮改动尚未提交 git commit。
- source filter shared 收口完成后，可继续检查是否还有其它仅在 web 或 server 一侧保留、但应进入 `packages/shared` 的跨端归一规则。


# PR6 promotion explanation helper 单一事实源收口

## 计划
- [x] 在不覆盖并行 dirty 文件的前提下，继续沿新的事实源一致性问题主线推进。
- [x] 复核 PR6 promotion executor，确认 event/continuity explanation 组装仍以内联对象散落在执行层。
- [x] 把 promotion explanation 组装提升到 `pr6PromotionRules.ts` 单点 helper，并补测试锁定 review-backed explanation 语义。
- [ ] 跑定向验证并视结果决定是否直接提交。

## 当前执行
- 已确认当前工作树并行改动仍为：`CLAUDE.md`、`LifeOS/packages/server/config.json`、`LifeOS/packages/web/src/views/SettingsView.vue`、`LifeOS/packages/web/src/views/SettingsView.test.ts`、`lifeonline-claude-worker-v2.sh`。本轮未覆盖这些文件，也没有回到 grouped governance / SettingsView 的同类补强。
- 本轮完成的真实实现：
  - `LifeOS/packages/server/src/soul/pr6PromotionRules.ts`
    - 新增 `buildEventPromotionExplanation()` 与 `buildContinuityPromotionExplanation()`，集中 review-backed explanation 组装规则。
  - `LifeOS/packages/server/src/soul/pr6PromotionExecutor.ts`
    - event / continuity promotion 执行改为复用上述 helpers，移除 executor 内联 explanation 对象。
  - `LifeOS/packages/server/test/feedbackReintegration.test.ts`
    - 新增 helper 回归，锁定 PR6 promotion explanation 必须由 reintegration review 上下文派生。
- 这次修的不是继续补同类 UI 稳定性测试，而是把 PR6 promotion explanation 的规则从执行层收回到 rules 单点，避免 event/continuity explanation 语义将来在多个执行分支里再次分叉。

## 本轮选择依据
- 用户优先级允许在 contract gap 之后继续处理新的事实源一致性问题。
- continuity scope 收口后，下一条仍明显散落在 executor 中的规则就是 explanation 组装；它同样属于 PR6 promotion rules，而不是执行层职责。
- 这条线可以继续减少 PR6 promotion 语义在 rules / executor 之间的重复维护。

## 本轮验证
- `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test --test-name-pattern "build PR6 promotion explanations from reintegration review context|getPromotionSourceForReintegration falls back to reintegration id when source note is missing|getContinuityScopeForKind maps PR6 continuity kinds to stable scopes|normalizeSoulActionSourceFilters collapses legacy reintegration note filters into sourceReintegrationId" test/feedbackReintegration.test.ts` 通过，4/4。
- 当前环境仍有既有 Node engine warning（声明 `>=20 <21`，实际 `v25.8.1`），但未影响本轮定向验证。

## 当前未完成项
- 本轮改动尚未提交 git commit。
- PR6 promotion explanation helper 收口完成后，可继续检查 PR6 promotion rules / executor 中是否还存在其它重复 explanation、title、threshold 或 source 组装逻辑。


# PR6 continuity scope helper 单一事实源收口

## 计划
- [x] 在不覆盖并行 dirty 文件的前提下，继续沿新的事实源一致性问题主线推进。
- [x] 复核 PR6 promotion executor，确认 continuity scope 的 persona/daily/weekly 派生仍以内联三元表达式散落在执行层。
- [x] 把 continuity scope 派生提升到 `pr6PromotionRules.ts` 单点 helper，并补测试锁定映射关系。
- [ ] 跑定向验证并视结果决定是否直接提交。

## 当前执行
- 已确认当前工作树并行改动仍为：`CLAUDE.md`、`LifeOS/packages/server/config.json`、`LifeOS/packages/web/src/views/SettingsView.vue`、`LifeOS/packages/web/src/views/SettingsView.test.ts`、`lifeonline-claude-worker-v2.sh`。本轮未覆盖这些文件，也没有回到 grouped governance / SettingsView 的同类补强。
- 本轮完成的真实实现：
  - `LifeOS/packages/server/src/soul/pr6PromotionRules.ts`
    - 新增 `getContinuityScopeForKind()`，集中 PR6 continuity kind → scope 的映射规则。
  - `LifeOS/packages/server/src/soul/pr6PromotionExecutor.ts`
    - 改为复用 `getContinuityScopeForKind()`，移除 executor 内联 scope 三元逻辑。
  - `LifeOS/packages/server/test/feedbackReintegration.test.ts`
    - 新增 helper 回归，锁定 `persona_direction` / `daily_rhythm` / `weekly_theme` 的稳定 scope 映射。
- 这次修的不是再补一条低边际稳定性测试，而是把 PR6 continuity promotion 的 scope 派生规则从执行层收回到 rules 单点，避免 planner/rules/executor 对同一语义各自维护不同分支。

## 本轮选择依据
- 用户优先级允许在 contract gap 之后继续处理新的事实源一致性问题。
- promotion source helper 收口后，下一条仍明显内联在 executor 中的规则就是 continuity scope 派生；它本质上是 PR6 promotion rule，不应继续散落在执行层。
- 这条线可以继续减少 PR6 continuity 语义在执行与规则层之间的分叉。

## 本轮验证
- 待执行。

## 当前未完成项
- 跑定向验证。
- 若验证通过，直接提交本轮 PR6 continuity scope helper 收口。


# PR6 promotion source helper 单一事实源收口

## 计划
- [x] 在不覆盖并行 dirty 文件的前提下，继续沿新的事实源一致性问题主线推进。
- [x] 复核 PR6 promotion planner，确认 `record.sourceNoteId ?? record.id` / `record.id` 这组 source identity 规则仍以内联形式散落在 planner 中。
- [x] 把 promotion source identity 提升为 `pr6PromotionRules.ts` 单点 helper，并补测试锁定 sourceNote fallback 语义。
- [ ] 跑定向验证并视结果决定是否直接提交。

## 当前执行
- 已确认当前工作树并行改动仍为：`CLAUDE.md`、`LifeOS/packages/server/config.json`、`LifeOS/packages/web/src/views/SettingsView.vue`、`LifeOS/packages/web/src/views/SettingsView.test.ts`、`lifeonline-claude-worker-v2.sh`。本轮未覆盖这些文件，也没有回到 grouped governance / SettingsView 的同类补强。
- 本轮完成的真实实现：
  - `LifeOS/packages/server/src/soul/pr6PromotionRules.ts`
    - 新增 `getPromotionSourceForReintegration()`，集中 PR6 promotion 的 source note / reintegration identity 规则。
  - `LifeOS/packages/server/src/soul/reintegrationPromotionPlanner.ts`
    - 改为复用 `getPromotionSourceForReintegration()`，移除 planner 内联 fallback 规则。
  - `LifeOS/packages/server/test/feedbackReintegration.test.ts`
    - 新增 helper 回归，锁定 `sourceNoteId` 缺失时必须回退到 reintegration id 的语义。
- 这次修的不是再补一条同类 contract 测试，而是把 PR6 promotion planner 自己的 source identity fallback 从内联逻辑收回到 rules 单点，减少 planner / executor / legacy identity 未来再次分叉的风险。

## 本轮选择依据
- 用户优先级允许在 contract gap 之后继续处理新的事实源一致性问题。
- source filter 收口后，下一条仍明显重复的规则是 PR6 promotion planner 对 `sourceNoteId ?? record.id` 的 fallback，它本质上也是 source identity 规则，应该与 PR6 rules 放在同一事实源层。
- 这条线可以继续减少 PR6 promotion source 语义在 planner 与其它模块之间的分叉。

## 本轮验证
- 待执行。

## 当前未完成项
- 跑定向验证。
- 若验证通过，直接提交本轮 PR6 promotion source helper 收口。


# soul action source identity 单一事实源收口

## 计划
- [x] 在不覆盖并行 dirty 文件的前提下，继续沿新的事实源一致性问题主线推进。
- [x] 复核 soul action legacy reintegration source 归一逻辑，确认同一规则同时散落在 `soul/types.ts` 与 API handler 中。
- [x] 把 source filter 归一规则提升为单点 helper，并补测试锁定 legacy `reint:*` filter 语义。
- [ ] 跑定向验证并视结果决定是否直接提交。

## 当前执行
- 已确认当前工作树并行改动仍为：`CLAUDE.md`、`LifeOS/packages/server/config.json`、`LifeOS/packages/web/src/views/SettingsView.vue`、`LifeOS/packages/web/src/views/SettingsView.test.ts`、`lifeonline-claude-worker-v2.sh`。本轮未覆盖这些文件，也没有回到 grouped governance / SettingsView 的同类补强。
- 本轮完成的真实实现：
  - `LifeOS/packages/server/src/soul/types.ts`
    - 新增 `normalizeSoulActionSourceFilters()`，把 legacy `sourceNoteId=reint:*` → `sourceReintegrationId` 的归一规则集中到单点。
  - `LifeOS/packages/server/src/api/handlers.ts`
    - `listSoulActionsHandler()` 改为复用 `normalizeSoulActionSourceFilters()`，移除 handler 内联重复规则。
  - `LifeOS/packages/server/test/feedbackReintegration.test.ts`
    - 新增 source filter helper 回归，锁定 legacy reintegration note filter 的归一语义。
- 这次修的不是继续做同类 contract 对称补强，而是把已经在 identity 解析层存在的 legacy reintegration 规则，从 handler 重复实现收回到单一事实源，降低后续 PR6 / governance 查询口径再次分叉的风险。

## 本轮选择依据
- 用户优先级允许在 server/web/shared contract gap 之后继续处理新的事实源一致性问题。
- event/continuity 收口后，最直接的新风险点是 soul action legacy reintegration identity 规则同时存在于 `resolveSoulActionSourceReintegrationId()` 与 `listSoulActionsHandler()` 的手写分支里。
- 这条线可以减少 handler 与 domain 规则分叉，属于真实一致性收口，而不是低边际测试平移。

## 本轮验证
- 待执行。

## 当前未完成项
- 跑定向验证。
- 若验证通过，直接提交本轮 source identity 收口。


# event/continuity shared projection contract 闭环

## 计划
- [x] 在不覆盖并行 dirty 文件的前提下，继续沿新的 `server/web/shared contract gap` 主线推进。
- [x] 复核 event node / continuity 主路径，确认 web client 已消费 shared list contracts，但 server handler 层仍未显式 typed，也缺少独立 server API 回归。
- [x] 让 server handlers 显式接回 shared projection contracts，并补最小 server 回归覆盖 event node / continuity 列表返回 shape。
- [ ] 跑定向验证并视结果决定是否直接提交。

## 当前执行
- 已确认当前工作树并行改动仍为：`CLAUDE.md`、`LifeOS/packages/server/config.json`、`LifeOS/packages/web/src/views/SettingsView.vue`、`LifeOS/packages/web/src/views/SettingsView.test.ts`、`lifeonline-claude-worker-v2.sh`。本轮未覆盖这些文件，也没有回到 grouped governance / SettingsView 的同类补强。
- 本轮完成的真实实现：
  - `LifeOS/packages/server/src/api/handlers.ts`
    - `listEventNodesHandler()` 显式接回 shared `ListEventNodesResponse`。
    - `listContinuityRecordsHandler()` 显式接回 shared `ListContinuityRecordsResponse`。
  - `LifeOS/packages/server/test/configLifecycle.test.ts`
    - 新增 `event node and continuity APIs respond with shared projection contracts`。
    - 通过直接 seed `event_nodes` / `continuity_records` 锁定 API 返回 shape，而不依赖更深的 promotion 时序。
- 这次修的不是继续堆前端同类稳定性测试，而是 event/continuity 已经作为 shared projection contracts 被 web client 消费，但 server handler 仍未显式接回，也缺少 API 层独立回归，后续最容易在 PR6 projection 返回 shape 上再次漂移。

## 本轮选择依据
- 用户要求继续优先处理新的高价值 `server/web/shared contract gap`。
- AI suggestions 收口后，event node / continuity 是下一条真实主路径：shared 已定义 `ListEventNodesResponse` / `ListContinuityRecordsResponse`，web client 已直接消费，但 handler 层仍未显式 typed。
- 这条线可以继续减少 PR6 projection API 在 server/web 两端的 contract 漂移风险。

## 本轮验证
- 待执行。

## 当前未完成项
- 跑定向验证。
- 若验证通过，直接提交本轮 event/continuity contract 收口。


# AI suggestions shared list contract 闭环

## 计划
- [x] 在不覆盖并行 dirty 文件的前提下，继续沿新的 `server/web/shared contract gap` 主线推进。
- [x] 复核 AI suggestions 主路径，确认 shared `ListAiSuggestionsResponse` 已存在，但 handler 层仍未显式 typed、web 侧缺少独立 client 回归。
- [x] 让 server handler 显式接回 shared AI suggestions contract，并补最小 web + server 回归。
- [ ] 跑定向验证并视结果决定是否直接提交。

## 当前执行
- 已确认当前工作树并行改动仍为：`CLAUDE.md`、`LifeOS/packages/server/config.json`、`LifeOS/packages/web/src/views/SettingsView.vue`、`LifeOS/packages/web/src/views/SettingsView.test.ts`、`lifeonline-claude-worker-v2.sh`。本轮未覆盖这些文件，也没有回到 grouped governance / SettingsView 的同类补强。
- 本轮完成的真实实现：
  - `LifeOS/packages/server/src/api/handlers.ts`
    - `listAiSuggestionsHandler()` 显式接回 shared `ListAiSuggestionsResponse`。
  - `LifeOS/packages/web/src/api/client.test.ts`
    - 新增 AI suggestions shared contract 回归。
    - 新增 AI suggestions 错误分支回归。
- 这次修的不是重复堆 UI 稳定性测试，而是 AI suggestions 已经作为真实主路径返回 shared list contract，但 handler 层仍未显式 typed，client 侧也缺少对该 contract 的独立锁定，后续最容易在 provider/fallback 分支上再次漂移。

## 本轮选择依据
- 用户要求继续优先处理新的高价值 `server/web/shared contract gap`。
- soul action 收口后，AI suggestions 是剩余成本最低但真实存在的一条主路径：shared 已定义 `ListAiSuggestionsResponse`，client 已消费该 shape，但 server handler 仍未显式接回，也缺少 web client 定向回归。
- 这条线可以继续减少建议列表在 provider/fallback 双路径下的 contract 漂移风险。

## 本轮验证
- 待执行。

## 当前未完成项
- 跑定向验证。
- 若验证通过，直接提交本轮 AI suggestions contract 收口。


# soul action shared governance contract 闭环

## 计划
- [x] 在不覆盖并行 dirty 文件的前提下，继续沿新的 `server/web/shared contract gap` 主线推进。
- [x] 复核 soul action 主路径，确认 list/detail/approve/defer/discard/dispatch 是否虽已存在 shared response contract，但 handler 层仍未显式 typed、缺少 API 回归锁定。
- [x] 让 server handlers 显式接回 shared soul action governance contracts，并补最小 web + server 回归覆盖返回 shape。
- [x] 跑定向验证并视结果决定是否直接提交。

## 当前执行
- 已确认当前工作树并行改动仍为：`CLAUDE.md`、`LifeOS/packages/server/config.json`、`LifeOS/packages/web/src/views/SettingsView.vue`、`LifeOS/packages/web/src/views/SettingsView.test.ts`、`lifeonline-claude-worker-v2.sh`。本轮未覆盖这些文件，也没有回到 grouped governance / SettingsView 的同类补强。
- 本轮完成的真实实现：
  - `LifeOS/packages/server/src/api/handlers.ts`
    - `listSoulActionsHandler()` 显式接回 shared `ListSoulActionsResponse`。
    - `getSoulActionHandler()` / `approveSoulActionHandler()` / `deferSoulActionHandler()` / `discardSoulActionHandler()` 显式接回 shared `SoulActionResponse`。
    - `dispatchSoulActionHandler()` 显式接回 shared `DispatchSoulActionResponse`。
  - `LifeOS/packages/web/src/api/client.test.ts` 新增 soul action shared contract 回归与错误分支回归。
  - `LifeOS/packages/server/test/configLifecycle.test.ts` 新增 `soul-action APIs respond with shared governance contracts`，并用直接 seed soul action 的方式锁定 defer/discard 路径，避免依赖异步派生时序。
- 这次修的不是继续堆 SettingsView 同类稳定性测试，而是 soul action governance 主路径虽然 shared 已定义 contract，但 API handler 仍未显式接回，server 端最容易在治理返回 shape 上再次漂移。

## 本轮选择依据
- 用户要求继续优先处理新的高价值 `server/web/shared contract gap`。
- reintegration 收口后，下一条直接服务 PR3/PR6 治理主路径、且 shared 已存在单一事实源的就是 soul action list/detail/governance/dispatch contracts。
- 这条线可以继续减少治理控制面在 server/web 两端的 contract 漂移风险。

## 本轮验证
- `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/api/client.test.ts` 通过；受 vitest 配置影响，同时跑过现有 web 测试集，9 files / 134 tests 全通过。
- `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test --test-name-pattern "soul-action APIs respond with shared governance contracts|soul-actions API approve then dispatch runs governance happy path" test/configLifecycle.test.ts` 通过，2/2。
- 当前环境仍有既有 Node engine warning（声明 `>=20 <21`，实际 `v25.8.1`），但未影响本轮验证。

## 当前未完成项
- 本轮改动尚未提交 git commit。
- soul action 主路径收口后，下一步可继续检查 event node / continuity / AI suggestions 等 shared 已存在但 API handler/client 未完全显式 typed 的残留点。


# reintegration shared contract 闭环

## 计划
- [x] 在不覆盖并行 dirty 文件的前提下，继续沿新的 `server/web/shared contract gap` 主线推进。
- [x] 复核 reintegration 主路径，确认 list/accept/reject/plan-promotions 是否已稳定依赖 shared response contract，但仍缺少显式回归锁定。
- [x] 让 server handlers 显式接回 shared reintegration contracts，并补最小 web + server 回归覆盖返回 shape。
- [ ] 跑定向验证并视结果决定是否直接提交。

## 当前执行
- 已确认当前工作树并行改动仍为：`CLAUDE.md`、`LifeOS/packages/server/config.json`、`LifeOS/packages/web/src/views/SettingsView.vue`、`LifeOS/packages/web/src/views/SettingsView.test.ts`、`lifeonline-claude-worker-v2.sh`。本轮未覆盖这些文件，也没有回到 grouped governance / SettingsView 的同类补强。
- 本轮完成的真实实现：
  - `LifeOS/packages/server/src/api/handlers.ts`
    - `listReintegrationRecordsHandler()` 显式接回 shared `ListReintegrationRecordsResponse`。
    - `acceptReintegrationRecordHandler()` 显式接回 shared `AcceptReintegrationRecordResponse`。
    - `rejectReintegrationRecordHandler()` 显式接回 shared `RejectReintegrationRecordResponse`。
    - `planPromotionsHandler()` 显式接回 shared `PlanReintegrationPromotionsResponse`。
  - `LifeOS/packages/web/src/api/client.test.ts` 新增 reintegration shared contract 回归。
  - `LifeOS/packages/server/test/configLifecycle.test.ts` 新增 `reintegration APIs respond with shared reintegration contracts`。
- 这次修的不是回到 SettingsView 做对称补强，而是 reintegration 主路径虽然 shared 已有稳定 response contracts，但缺少 API 层显式接回与回归保护，后续最容易再次发生 server/web 漂移。

## 本轮选择依据
- 用户要求继续优先处理新的高价值 `server/web/shared contract gap`。
- AI provider 收口后，reintegration 是下一条真实主路径：shared 已存在 `ListReintegrationRecordsResponse` / `AcceptReintegrationRecordResponse` / `RejectReintegrationRecordResponse` / `PlanReintegrationPromotionsResponse`，且 Settings 中正在直接消费这些行为。
- 这条线可以继续减少 reintegration 审核与 promotion planning 主路径的 contract 漂移风险。

## 本轮验证
- `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/api/client.test.ts` 通过；受 vitest 配置影响，同时跑过现有 web 测试集，9 files / 132 tests 全通过。
- `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test --test-name-pattern "reintegration APIs respond with shared reintegration contracts|soul-actions API approve then dispatch runs governance happy path" test/configLifecycle.test.ts` 通过，2/2。
- 当前环境仍有既有 Node engine warning（声明 `>=20 <21`，实际 `v25.8.1`），但未影响本轮验证。

## 当前未完成项
- 本轮改动尚未提交 git commit。
- reintegration 主路径收口后，下一步可继续检查 soul action detail/list 或其它 shared 已存在但 handler/client 未显式 typed 的残留点。


# AI provider shared contract 闭环

## 计划
- [x] 在不覆盖并行 dirty 文件的前提下，继续沿新的 `server/web/shared contract gap` 主线推进。
- [x] 复核 AI provider 主路径是否仍停留在 server handler 未显式复用 shared `AiProviderSettings` / `TestAiProviderConnectionResponse`、以及 web client 使用无类型 fallback 的状态。
- [x] 让 AI provider 的 web client / server handlers 显式接回 shared provider contracts。
- [x] 补最小 web + server 回归，锁定 AI provider 主路径已经切到 shared contract。
- [ ] 跑定向验证并视结果决定是否直接提交。

## 当前执行
- 已确认当前工作树并行改动仍为：`CLAUDE.md`、`LifeOS/packages/server/config.json`、`LifeOS/packages/web/src/views/SettingsView.vue`、`LifeOS/packages/web/src/views/SettingsView.test.ts`、`lifeonline-claude-worker-v2.sh`。本轮未覆盖这些文件，也没有回到 grouped governance / SettingsView 的同类补强。
- 本轮完成的真实实现：
  - `LifeOS/packages/web/src/api/client.ts`
    - `fetchAiProviderSettings()` 改为按 shared `AiProviderSettings` 解析返回。
    - `updateAiProviderSettings()` 改为按 shared `AiProviderSettings` 解析返回。
    - `testAiProviderConnection()` 改为按 shared `TestAiProviderConnectionResponse` 解析返回。
    - 三者均去掉无类型 `{}` fallback。
  - `LifeOS/packages/server/src/api/handlers.ts`
    - `getAiProviderHandler()` 显式接回 shared `AiProviderSettings`。
    - `updateAiProviderHandler()` 显式接回 shared `AiProviderSettings` request/response typing。
    - `testAiProviderHandler()` 显式接回 shared `TestAiProviderConnectionResponse` request/response typing。
  - `LifeOS/packages/web/src/api/client.test.ts` 新增 AI provider shared contract 回归。
  - `LifeOS/packages/server/test/configLifecycle.test.ts` 新增 `AI provider APIs respond with shared provider contracts`。
- 这次修的不是对称 UI 补强，而是 AI provider 主路径已有 shared 本体 contract，但 server/web 仍未显式 typed 接回，导致 handler 与 client 容易在错误分支或返回解析上再次漂移。

## 本轮选择依据
- 用户要求继续优先处理新的高价值 `server/web/shared contract gap`。
- AI prompt 收口后，AI provider 是同一主路径上的下一条真实 contract gap：shared 已定义 provider contracts，但 server handler 仍未显式复用，web client 仍使用无类型 fallback。
- 这条线能继续减少 provider 设置与连接测试主路径在 server/web 两端的 contract 漂移风险。

## 本轮验证
- `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/api/client.test.ts` 通过；受 vitest 配置影响，同时跑过现有 web 测试集，9 files / 130 tests 全通过。
- `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test --test-name-pattern "AI provider APIs respond with shared provider contracts|AI prompt APIs respond with shared prompt contracts" test/configLifecycle.test.ts` 通过，2/2。
- 当前环境仍有既有 Node engine warning（声明 `>=20 <21`，实际 `v25.8.1`），但未影响本轮验证。

## 当前未完成项
- 本轮改动尚未提交 git commit。
- AI provider 主路径收口后，下一步可继续检查 reintegration / soul action 相关 response wrapper 是否仍有 shared 外稳定 shape。


# AI prompt shared response contract 收口

## 计划
- [x] 在不覆盖并行 dirty 文件的前提下，继续沿新的 `server/web/shared contract gap` 主线推进。
- [x] 复核 AI prompt 主路径的 response wrapper，确认 `/api/ai/prompts` list/update/reset 是否仍停留在 shared 外的 server-local / web-local shape。
- [x] 把 AI prompt response wrappers 提升到 `packages/shared`，并让 web client / server handlers 直接复用。
- [x] 补最小 web + server 回归，锁定 AI prompt 主路径已经切到 shared contract。
- [ ] 跑定向验证并视结果决定是否直接提交。

## 当前执行
- 已确认当前工作树并行改动仍为：`CLAUDE.md`、`LifeOS/packages/server/config.json`、`LifeOS/packages/web/src/views/SettingsView.vue`、`LifeOS/packages/web/src/views/SettingsView.test.ts`、`lifeonline-claude-worker-v2.sh`。本轮未覆盖这些文件，也没有回到 grouped governance / SettingsView 的同类补强。
- 本轮完成的真实实现：
  - `LifeOS/packages/shared/src/types.ts` 新增：
    - `ListAiPromptsResponse`
    - `AiPromptResponse`
    - `ResetAiPromptResponse`
  - `LifeOS/packages/web/src/api/client.ts` 让 `fetchAiPrompts()` / `updateAiPrompt()` / `resetAiPrompt()` 直接消费 shared AI prompt response contract，而不再使用无类型 `{}` fallback。
  - `LifeOS/packages/server/src/api/handlers.ts`：
    - `listAiPrompts()` 显式接回 shared `ListAiPromptsResponse`
    - `updateAiPrompt()` 显式接回 shared `AiPromptResponse`
    - `resetAiPrompt()` 显式接回 shared `ResetAiPromptResponse`
  - `LifeOS/packages/web/src/api/client.test.ts` 新增 AI prompt shared contract 回归。
  - `LifeOS/packages/server/test/configLifecycle.test.ts` 新增 `AI prompt APIs respond with shared prompt contracts`。
- 这次修的不是 UI 同类补强，而是 AI prompt 主路径仍保留的 response wrapper duplication：web/client 与 server/handler 都在内联 `{ prompts }` / `{ prompt }` / `{ success: true }`，但 shared 之前没有单一事实源。

## 本轮选择依据
- 用户要求继续优先处理新的高价值 `server/web/shared contract gap`。
- worker task 收口后，AI prompt 主路径仍直接服务当前 Settings 中的真实功能，而且 server/web 都在重复稳定 wrapper shape；provider settings 本身直接返回 shared 类型本体，价值低于 prompt wrapper 收口。
- 这条线可以继续减少 AI prompt 主路径 response contract 的重复源和未来改动时的漂移风险。

## 本轮验证
- `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/api/client.test.ts` 通过；受 vitest 配置影响，同时跑过现有 web 测试集，9 files / 128 tests 全通过。
- `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test --test-name-pattern "AI prompt APIs respond with shared prompt contracts|worker task APIs respond with shared worker task contracts" test/configLifecycle.test.ts` 通过，2/2。
- 当前环境仍有既有 Node engine warning（声明 `>=20 <21`，实际 `v25.8.1`），但未影响本轮验证。

## 当前未完成项
- 本轮改动尚未提交 git commit。
- AI prompt 主路径收口后，下一步可继续检查 AI provider test/list 或 reintegration 主路径是否仍有 shared 外稳定 response shape。


# worker task shared response contract 收口

## 计划
- [x] 在不覆盖并行 dirty 文件的前提下，继续沿新的 `server/web/shared contract gap` 主线推进。
- [x] 复核 worker task 主路径的 response wrapper，确认 list/get/retry/cancel/clear-finished 是否仍停留在 shared 外的 server-local / web-local shape。
- [x] 把 worker task response wrappers 提升到 `packages/shared`，并让 web client / server handlers 直接复用。
- [x] 补最小 web + server 回归，锁定 worker task 主路径已经切到 shared contract。
- [ ] 跑定向验证并视结果决定是否直接提交。

## 当前执行
- 已确认当前工作树并行改动仍为：`CLAUDE.md`、`LifeOS/packages/server/config.json`、`LifeOS/packages/web/src/views/SettingsView.vue`、`LifeOS/packages/web/src/views/SettingsView.test.ts`、`lifeonline-claude-worker-v2.sh`。本轮未覆盖这些文件，也没有回到 grouped governance / SettingsView 的同类补强。
- 本轮完成的真实实现：
  - `LifeOS/packages/shared/src/types.ts` 新增：
    - `WorkerTaskListResponse`
    - `WorkerTaskResponse`
    - `ClearFinishedWorkerTasksResponse`
  - `LifeOS/packages/web/src/api/client.ts` 删除本地 `WorkerTaskListResponse`，并让 `createWorkerTask()` / `fetchWorkerTasks()` / `fetchWorkerTask()` / `retryWorkerTask()` / `cancelWorkerTask()` / `clearFinishedWorkerTasks()` 直接消费 shared worker task response contract。
  - `LifeOS/packages/server/src/api/handlers.ts`：
    - `createWorkerTaskHandler()` 显式接回 shared `CreateWorkerTaskResponse`
    - `listWorkerTasksHandler()` 显式接回 shared `WorkerTaskListResponse`
    - `getWorkerTaskHandler()` / `retryWorkerTaskHandler()` / `cancelWorkerTaskHandler()` 显式接回 shared `WorkerTaskResponse`
    - `clearFinishedWorkerTasksHandler()` 显式接回 shared `ClearFinishedWorkerTasksResponse`
  - `LifeOS/packages/web/src/api/client.test.ts` 新增 worker task shared contract 回归。
  - `LifeOS/packages/server/test/configLifecycle.test.ts` 新增 `worker task APIs respond with shared worker task contracts`。
- 这次修的不是低边际测试平移，而是 worker task 主路径仍然保留的 response wrapper duplication：shared 只覆盖了 create，其他稳定返回 shape 仍靠 web/server 各自内联约定。

## 本轮选择依据
- 用户要求优先继续处理新的高价值 `server/web/shared contract gap`。
- dashboard/timeline/calendar 收口后，worker task 主路径仍直接服务主流程，且 web 中还保留本地 `WorkerTaskListResponse`，server handlers 也仍在内联 `{ task }` / `{ tasks }` / `{ success, deleted }` wrapper。
- 这条线可以继续减少 worker task 主路径 response contract 的重复源和未来变更时的漂移风险。

## 本轮验证
- `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/api/client.test.ts` 通过；受 vitest 配置影响，同时跑过现有 web 测试集，9 files / 126 tests 全通过。
- `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test --test-name-pattern "worker task APIs respond with shared worker task contracts|dashboard, timeline, and calendar APIs respond with shared view contracts" test/configLifecycle.test.ts` 通过，2/2。
- 当前环境仍有既有 Node engine warning（声明 `>=20 <21`，实际 `v25.8.1`），但未影响本轮验证。

## 当前未完成项
- 本轮改动尚未提交 git commit。
- worker task 主路径收口后，下一步可继续检查 AI prompt / provider / reintegration 等 response wrapper 是否仍有 shared 外的稳定 shape。


# dashboard/timeline/calendar shared view contract 闭环

## 计划
- [x] 在不覆盖并行 dirty 文件的前提下，继续沿新的 `server/web/shared contract gap` 主线推进。
- [x] 复核 `DashboardView` / timeline / calendar 主路径是否仍停留在 server handler 未显式复用 shared `DashboardData` / `TimelineData` / `CalendarData` 的状态。
- [x] 让对应 server handlers 的 request/response typing 显式接回 shared view contracts，并避免继续返回未类型化对象字面量。
- [x] 补最小 server 回归，锁定三条主路径已接回 shared view contracts。
- [ ] 跑定向验证并视结果决定是否直接提交。

## 当前执行
- 已确认当前工作树并行改动仍为：`CLAUDE.md`、`LifeOS/packages/server/config.json`、`LifeOS/packages/web/src/views/SettingsView.vue`、`LifeOS/packages/web/src/views/SettingsView.test.ts`、`lifeonline-claude-worker-v2.sh`。本轮未覆盖这些文件，也没有回到 grouped governance / SettingsView 的同类补强。
- 本轮完成的真实实现：
  - `LifeOS/packages/server/src/api/handlers.ts`
    - `getDashboard()` 改为显式声明 `Request<Record<string, never>, DashboardData>` / `Response<DashboardData>`。
    - `getTimeline()` 改为显式声明 `Request<Record<string, never>, TimelineData, Record<string, never>, { start?: string; end?: string }>` / `Response<TimelineData>`，并先构造 `const response: TimelineData` 再统一 `res.json(response)`。
    - `getCalendar()` 改为显式声明 `Request<Record<string, never>, CalendarData, Record<string, never>, { year?: string; month?: string }>` / `Response<CalendarData>`，并先构造 `const response: CalendarData` 再统一 `res.json(response)`。
  - `LifeOS/packages/server/test/configLifecycle.test.ts` 新增 `dashboard, timeline, and calendar APIs respond with shared view contracts`。
- 这次修的不是继续补 SettingsView 对称测试，而是 dashboard / timeline / calendar 三条稳定主路径已经有 shared view data contract，但 handler 层仍未显式接回 shared，仍存在 server 侧 contract 漂移缺口。

## 本轮选择依据
- 用户要求下一步优先处理新的高价值 `server/web/shared contract gap`。
- schedule CRUD 收口后，下一条仍直接服务主面板浏览路径、且已经在 shared 中存在单一事实源的就是 `DashboardData` / `TimelineData` / `CalendarData`；但 server handlers 仍使用未类型化的 `Request` / `Response` 与内联对象返回。
- 这条线可以继续减少主路径 view contract 在 handler 层再次漂移的风险，且不是低边际同类测试平移。

## 本轮验证
- `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test --test-name-pattern "dashboard, timeline, and calendar APIs respond with shared view contracts|schedule APIs respond with shared schedule contracts" test/configLifecycle.test.ts` 通过，2/2。
- 当前环境仍有既有 Node engine warning（声明 `>=20 <21`，实际 `v25.8.1`），但未影响本轮验证。

## 当前未完成项
- 本轮改动尚未提交 git commit。
- 这三条 view 主路径的 server handler 已接回 shared；若继续沿 contract 主线推进，下一步可检查 worker task / AI prompt / reintegration 等 response wrapper 是否仍有 shared 外的稳定 shape。


# schedule CRUD shared contract 收口

## 计划
- [x] 在不覆盖并行 dirty 文件的前提下，继续沿新的 `server/web/shared contract gap` 主线推进。
- [x] 复核 `/api/schedules` 主路径剩余 response shape，确认 create/list/get/update/delete/run 是否仍停留在 server-local / web-local `{ schedule }`、`{ schedules }`、`{ success: true }` 结构。
- [x] 把 `TaskScheduleResponse`、`TaskScheduleListResponse`、`DeleteTaskScheduleResponse` 提升到 `packages/shared`，并让 web client / server handlers 直接复用。
- [x] 补最小 web + server 回归，锁定 schedule CRUD 主路径已经切到 shared contract。
- [ ] 跑定向验证并视结果决定是否直接提交。

## 当前执行
- 已确认当前工作树并行改动仍为：`CLAUDE.md`、`LifeOS/packages/server/config.json`、`LifeOS/packages/web/src/views/SettingsView.vue`、`LifeOS/packages/web/src/views/SettingsView.test.ts`、`lifeonline-claude-worker-v2.sh`。本轮未覆盖这些文件，也没有回到 grouped governance / SettingsView 的同类补强。
- 本轮完成的真实实现：
  - `LifeOS/packages/shared/src/types.ts` 新增：
    - `TaskScheduleResponse`
    - `TaskScheduleListResponse`
    - `DeleteTaskScheduleResponse`
  - `LifeOS/packages/web/src/api/client.ts`：
    - `createTaskSchedule()` 改为消费 shared `TaskScheduleResponse`
    - `fetchTaskSchedules()` 改为消费 shared `TaskScheduleListResponse`
    - `updateTaskSchedule()` 改为消费 shared `TaskScheduleResponse`
    - `deleteTaskSchedule()` 改为按 shared `DeleteTaskScheduleResponse` 解析错误分支
    - `runTaskScheduleNow()` 改为按 shared `TaskScheduleResponse` 解析错误分支
  - `LifeOS/packages/server/src/api/handlers.ts`：
    - `createScheduleHandler()` / `listSchedulesHandler()` / `getScheduleHandler()` / `updateScheduleHandler()` / `deleteScheduleHandler()` / `runScheduleNowHandler()` 全部显式接回 shared schedule CRUD response contract。
  - `LifeOS/packages/web/src/api/client.test.ts` 新增 schedule CRUD shared contract 回归，并修正测试样例以匹配当前真实 `TaskSchedule` / `CreateTaskScheduleRequest` contract。
  - `LifeOS/packages/server/test/configLifecycle.test.ts` 新增 `schedule APIs respond with shared schedule contracts`。
- 这次修的不是 SettingsView 的对称补强，而是 schedule 主路径仍然保留的 response wrapper duplication：server 与 web 都在各自内联 `{ schedule }` / `{ schedules }` / `{ success: true }` shape，却没有 shared 单一事实源。

## 本轮选择依据
- 用户要求继续优先找新的高价值 `server/web/shared contract gap`。
- stats 收口后，下一条仍直接服务 Settings 定时任务主路径的明显漂移点就是 schedule CRUD：response wrapper 已稳定存在，但 shared 尚未承载，web/client 与 server/handler 只能各自重复约定。
- 这条线能继续减少 schedule 主路径 response contract 重复源和未来页面/handler 调整时的漂移风险。

## 本轮验证
- `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/api/client.test.ts` 通过；受 vitest 配置影响，同时跑过现有 web 测试集，9 files / 124 tests 全通过。
- `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test --test-name-pattern "schedule APIs respond with shared schedule contracts|schedule health API responds with shared schedule health contract" test/configLifecycle.test.ts` 通过，2/2。
- 当前环境仍有既有 Node engine warning（声明 `>=20 <21`，实际 `v25.8.1`），但未影响本轮验证。

## 当前未完成项
- 本轮改动尚未提交 git commit。
- schedule CRUD contract 收口后，下一步可继续检查 Dashboard / Timeline / Calendar 等主路径是否还存在 shared 之外的稳定 response shape。


# stats shared contract 收口

## 计划
- [x] 在不覆盖并行 dirty 文件的前提下，继续沿新的 `server/web/shared contract gap` 主线推进。
- [x] 复核 `StatsView` 主路径依赖的 stats API，确认 trend/radar/monthly/tags 是否仍停留在 web-local response shape。
- [x] 把 stats response point contract 提升到 `packages/shared`，并让 web client / server handlers 直接复用。
- [x] 补最小 web + server 回归，锁定 stats 主路径已经切到 shared contract。
- [ ] 跑定向验证并视结果决定是否直接提交。

## 当前执行
- 已确认当前工作树并行改动仍为：`CLAUDE.md`、`LifeOS/packages/server/config.json`、`LifeOS/packages/web/src/views/SettingsView.vue`、`LifeOS/packages/web/src/views/SettingsView.test.ts`、`lifeonline-claude-worker-v2.sh`。本轮未覆盖这些文件，也没有回到 grouped governance / SettingsView 的同类补强。
- 本轮完成的真实实现：
  - `LifeOS/packages/shared/src/types.ts` 新增：
    - `StatsTrendPoint`
    - `StatsRadarPoint`
    - `StatsMonthlyPoint`
    - `StatsTagPoint`
  - `LifeOS/packages/web/src/api/client.ts` 删除四组 stats 的本地内联数组 shape，改为直接复用 shared stats point contract。
  - `LifeOS/packages/server/src/api/handlers.ts`：
    - `getStatsTrend()` 显式接回 shared `StatsTrendPoint[]`
    - `getStatsRadar()` 显式接回 shared `StatsRadarPoint[]`
    - `getStatsMonthly()` 显式接回 shared `StatsMonthlyPoint[]`
    - `getStatsTags()` 显式接回 shared `StatsTagPoint[]`
  - `LifeOS/packages/web/src/api/client.test.ts` 新增 `fetches typed stats contracts from shared response shapes`。
  - `LifeOS/packages/server/test/configLifecycle.test.ts` 新增 `stats APIs respond with shared stats contracts`。
- 这次修的不是对称测试平移，而是 `StatsView` 主路径下四组稳定返回 shape 一直停留在 web-local response type 的真实 contract drift。

## 本轮选择依据
- 用户要求继续优先找新的高价值 `server/web/shared contract gap`。
- `schedule health` 收口后，下一条直接可见的主路径就是 `StatsView`；`fetchStatsTrend` / `fetchStatsRadar` / `fetchStatsMonthly` / `fetchStatsTags` 仍全部使用 web-local 内联 shape，而 server 端也没有显式 shared typing。
- 这条线能继续减少主路径 response contract 的重复源和未来统计面板改动时的漂移风险。

## 本轮验证
- `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/api/client.test.ts` 通过；受 vitest 配置影响，同时跑过现有 web 测试集，9 files / 122 tests 全通过。
- `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test --test-name-pattern "stats APIs respond with shared stats contracts|schedule health API responds with shared schedule health contract" test/configLifecycle.test.ts` 通过，2/2。
- 当前环境仍有既有 Node engine warning（声明 `>=20 <21`，实际 `v25.8.1`），但未影响本轮验证。

## 当前未完成项
- 本轮改动尚未提交 git commit。
- Stats 主路径 contract 已收口，但 `StatsView.vue` 仍未显式从 shared 导入这些 point 类型；目前它通过 client 返回值推断使用，仍可视为后续可选收口点。
- 下一步可继续检查其他 Settings / Dashboard 主路径是否还有 web-local response shape。


# schedule health shared contract 收口

## 计划
- [x] 在不覆盖并行 dirty 文件的前提下，继续沿新的 `server/web/shared contract gap` 主线推进。
- [x] 复核 Settings 主路径里剩余的本地 shape，优先检查 `schedule health` 是否仍停留在 web-local / server-local contract。
- [x] 把 `ScheduleHealth` 提升到 `packages/shared`，并让 web client、server handler、scheduler 内部直接复用。
- [x] 补最小 web + server 回归，锁定 `/api/schedules/health` 已切到 shared contract。
- [ ] 跑定向验证并视结果决定是否直接提交。

## 当前执行
- 已确认当前工作树并行改动仍为：`CLAUDE.md`、`LifeOS/packages/server/config.json`、`LifeOS/packages/web/src/views/SettingsView.vue`、`LifeOS/packages/web/src/views/SettingsView.test.ts`、`lifeonline-claude-worker-v2.sh`。本轮未覆盖这些文件，也没有回到 grouped governance / SettingsView 的同类补强。
- 本轮完成的真实实现：
  - `LifeOS/packages/shared/src/types.ts` 新增：
    - `FailingScheduleHealthItem`
    - `ScheduleHealth`
  - `LifeOS/packages/server/src/workers/taskScheduler.ts` 删除本地 `ScheduleHealthData`，`getScheduleHealth()` 直接返回 shared `ScheduleHealth`。
  - `LifeOS/packages/server/src/api/handlers.ts` 的 `scheduleHealthHandler()` 显式接回 shared `ScheduleHealth`。
  - `LifeOS/packages/web/src/api/client.ts` 删除本地 `ScheduleHealth`，改为直接从 shared 导入。
  - `LifeOS/packages/web/src/api/client.test.ts` 新增 `fetches typed schedule health from the shared response shape`。
  - `LifeOS/packages/server/test/configLifecycle.test.ts` 新增 `schedule health API responds with shared schedule health contract`。
- 这次修的不是对称测试平移，而是 Settings 主路径里又一个真实的 contract duplication：web client 定义一份、scheduler 内部再定义一份、server handler 不显式类型化。

## 本轮选择依据
- 用户要求继续优先找新的高价值 `server/web/shared contract gap`。
- config 主路径闭环后，下一条仍直接服务 Settings 的明显漂移点就是 `schedule health`：
  - web `client.ts` 自带本地 `ScheduleHealth`
  - server `taskScheduler.ts` 自带本地 `ScheduleHealthData`
  - handler 层未显式接回 shared
- 这条线能继续减少 Settings 主路径的重复源和后续漂移风险。

## 本轮验证
- `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/api/client.test.ts` 通过；受 vitest 配置影响，同时跑过现有 web 测试集，9 files / 121 tests 全通过。
- `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test --test-name-pattern "schedule health API responds with shared schedule health contract|configManager reuses shared Config contract internally" test/configLifecycle.test.ts` 通过，2/2。
- 当前环境仍有既有 Node engine warning（声明 `>=20 <21`，实际 `v25.8.1`），但未影响本轮验证。

## 当前未完成项
- 本轮改动尚未提交 git commit。
- 下一步可继续检查 stats API 是否仍停留在 web-local response shape。


# configManager shared contract 闭环

## 计划
- [x] 在不覆盖并行 dirty 文件的前提下，继续沿新的 `server/web/shared contract gap` 主线推进。
- [x] 收掉上一轮留下的 config contract 最后一段：`configManager.ts` 本地 `Config` interface。
- [x] 让 server 内部 `loadStoredConfig()` / `loadConfig()` / `saveConfig()` 直接复用 shared `Config`。
- [x] 补最小 server 回归，锁定 configManager 内部也已经复用 shared `Config` contract。
- [ ] 跑定向 server 验证并视结果决定是否直接提交。

## 当前执行
- 已确认当前工作树并行改动仍为：`CLAUDE.md`、`LifeOS/packages/server/config.json`、`LifeOS/packages/web/src/views/SettingsView.vue`、`LifeOS/packages/web/src/views/SettingsView.test.ts`、`lifeonline-claude-worker-v2.sh`。本轮未覆盖这些文件，也没有回到 grouped governance / SettingsView 的同类补强。
- 本轮完成的真实实现：
  - `LifeOS/packages/server/src/config/configManager.ts` 删除本地 `Config` interface，改为直接 `import type { Config } from '@lifeos/shared'`。
  - `LifeOS/packages/server/src/index.ts` 不再从 `configManager.ts` 重导本地 `Config`，而是直接从 shared 导入。
  - `LifeOS/packages/server/test/configLifecycle.test.ts` 新增 `configManager reuses shared Config contract internally`，通过 `satisfies import('../../shared/src/types.js').Config` 锁定 `loadStoredConfig()` 与 `loadConfig()` 的返回值都已符合 shared contract。
- 这次不是重复整理命名，而是把上一轮 config/index contract 收口剩余的 server-internal 最后一段闭环补完，减少 config contract 在内部模块再次漂移的风险。

## 本轮选择依据
- 用户要求继续优先处理新的高价值 `server/web/shared contract gap`。
- 上一轮已经把 config/index 主路径的 API handler 与 web client 收回 shared，但 `configManager.ts` 仍保留本地 `Config` 类型，是这条主路径里最后一个明确的 contract duplication 点。
- 先收掉这个重复源，比继续做 SettingsView 对称测试更符合当前优先级。

## 本轮验证
- `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test --test-name-pattern "configManager reuses shared Config contract internally|config API responds with shared config contracts" test/configLifecycle.test.ts` 通过，2/2。

## 当前未完成项
- 本轮改动尚未提交 git commit。
- config 主路径收口后，可继续检查 `schedule health` / `stats` 这类 Settings 直接消费接口是否仍有 web-local shape。


# config/index shared contract 收口

## 计划
- [x] 在不覆盖并行 dirty 文件的前提下，继续沿新的 `server/web/shared contract gap` 主线推进。
- [x] 复核 Settings 主路径依赖的 config / index API，确认哪些 response/request shape 仍停留在 web-local 或 server-local 类型。
- [x] 把 `Config`、`UpdateConfigRequest`、`UpdateConfigResponse`、`IndexStatus` 收回 `packages/shared`，并让 web client / server handler 直接复用。
- [x] 复用已有 shared `IndexResult` / `IndexErrorEventData`，去掉 web client 里的重复定义。
- [x] 补最小 web + server 回归，锁定 config/index 主路径已切到 shared contract。
- [x] 跑定向验证并视结果决定是否直接提交。

## 当前执行
- 已确认当前工作树并行改动仍为：`CLAUDE.md`、`LifeOS/packages/server/config.json`、`LifeOS/packages/web/src/views/SettingsView.vue`、`LifeOS/packages/web/src/views/SettingsView.test.ts`、`lifeonline-claude-worker-v2.sh`。本轮未覆盖这些文件，也未回到 grouped governance / SettingsView 的同类对称补强。
- 本轮完成的真实实现：
  - `LifeOS/packages/shared/src/types.ts` 新增 shared：
    - `Config`
    - `UpdateConfigRequest`
    - `UpdateConfigResponse`
    - `IndexStatus`
  - `LifeOS/packages/web/src/api/client.ts`：
    - 删除本地 `Config` / `IndexStatus` / `IndexResult` / `IndexError` 的重复定义
    - 改为直接复用 shared `Config`、`UpdateConfigRequest`、`UpdateConfigResponse`、`IndexStatus`、`IndexResult`、`IndexErrorEventData`
    - `updateConfig()` 改为返回 shared `UpdateConfigResponse`，并对请求体使用 `UpdateConfigRequest`
  - `LifeOS/packages/server/src/api/handlers.ts`：
    - `triggerIndex()` 显式接回 shared `IndexResult`
    - `getIndexStatus()` 显式接回 shared `IndexStatus`
    - `getIndexErrors()` 显式接回 shared `IndexErrorEventData[]`
    - `getConfig()` 显式接回 shared `Config`
    - `updateConfig()` 显式接回 shared `UpdateConfigRequest` / `UpdateConfigResponse`
  - `LifeOS/packages/web/src/api/client.test.ts` 新增：
    - `fetches typed config and index contracts from shared response shapes`
    - `sends typed config updates and returns the shared response shape`
  - `LifeOS/packages/server/test/configLifecycle.test.ts` 新增：
    - `config API responds with shared config contracts`
- 这次修的不是重复命名整理，而是 Settings 主路径下仍然存在的真实 contract gap：config/index API 一直混用 web-local、server-local、shared 三套 shape。

## 本轮选择依据
- 用户要求继续优先找新的高价值 `server/web/shared contract gap`。
- Search 主路径刚闭环后，下一条直接可见、仍然多源漂移的主路径就是 Settings 里的 config/index API：
  - web client 自己定义 `Config` / `IndexStatus`
  - server configManager 自己定义 `Config`
  - shared 已有 `IndexResult` / `IndexErrorEventData`，但前后端没完全对齐复用
- 这条线可以直接减少主路径 contract 漂移和 Settings 页后续修改的重复源风险。

## 本轮验证
- `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/api/client.test.ts` 通过；受 vitest 配置影响，同时跑过现有 web 测试集，9 files / 121 tests 全通过。
- `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test --test-name-pattern "config API responds with shared config contracts|updating config persists vault path" test/configLifecycle.test.ts` 通过，2/2。
- 当前环境仍有既有 Node engine warning（声明 `>=20 <21`，实际 `v25.8.1`），但未影响本轮验证。

## 当前未完成项
- 本轮 config/index contract 收口改动尚未提交 git commit。
- `LifeOS/packages/server/src/config/configManager.ts` 仍保留本地 `Config` interface，可作为下一轮继续收口的候选点。
- 仍可继续检查其他主路径 API 是否还有 web-local / server-local shape，例如 stats 或 schedule health。

## 下一步建议
- 若继续沿 contract 主线推进，下一步优先把 `configManager.ts` 的本地 `Config` 也接回 shared，完成 config contract 的最后一段闭环。
- 收完 config 之后，再检查 `schedule health` / `stats` 这类 Settings 直接消费但仍停留在本地 shape 的接口。


# server search handler contract 闭环

## 计划
- [x] 在不覆盖并行 dirty 文件的前提下，继续沿新的 server/web/shared contract gap 主线推进。
- [x] 复核 `/api/search` 是否仍停留在 server 侧未显式复用 shared `SearchResult` 的状态。
- [x] 让 server `searchNotes()` handler 的 request/response typing 直接接回 shared `SearchResult`。
- [x] 复用现有 search 主路径回归，确认这次改动是 contract 闭环而不是重复语义补强。
- [ ] 跑定向 server 验证并视结果决定是否直接提交。

## 当前执行
- 已确认当前工作树的并行改动仍包括：`CLAUDE.md`、`LifeOS/packages/server/config.json`、`LifeOS/packages/web/src/views/SettingsView.vue`、`LifeOS/packages/web/src/views/SettingsView.test.ts`、`lifeonline-claude-worker-v2.sh`，以及上一轮已完成但未提交的 search shared contract 相关文件。本轮未覆盖 grouped governance / SettingsView 这条链。
- 本轮完成的真实实现：
  - `LifeOS/packages/server/src/api/handlers.ts` 引入 shared `SearchResult`。
  - `LifeOS/packages/server/src/api/handlers.ts` 的 `searchNotes()` 改为显式声明：
    - `Request<Record<string, never>, SearchResult, Record<string, never>, { q?: string }>`
    - `Response<SearchResult>`
  - `searchNotes()` 现在先构造 `const result: SearchResult = { notes, total: notes.length, query: q }`，再统一 `res.json(result)`，把上一轮刚提升到 shared 的 search response contract 真正闭环到 server handler。
- 这次没有再补 search 语义，也没有再加 SettingsView 同类测试；修的是剩余的 server/web/shared contract 缺口。

## 本轮选择依据
- 用户要求下一轮优先处理新的 `server/web/shared contract gap`，避免回到 grouped governance / SettingsView 的对称补强。
- 上一轮已经把 search response shape 从 web-local type 收回 shared；如果 server handler 仍然只返回未显式类型化的对象字面量，那么这条主路径的 contract 还没有真正三端闭环。
- 这一步能减少未来 search 返回 shape 再次漂移的风险，价值高于继续做同类稳定性扩展。

## 本轮验证
- `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test --test-name-pattern "search API matches" test/configLifecycle.test.ts` 通过，2/2。

## 当前未完成项
- 本轮以及上一轮 search contract 相关改动尚未提交 git commit。
- 下一步在 search 主路径收口后，可继续检查还有哪些主路径 API 仍停留在 server-local 或 web-local request/response shape。


# search response shared contract 收口

## 计划
- [x] 继续避开并行中的 `CLAUDE.md` / worker 草稿 / SettingsView 改动，只处理新的高价值 contract gap。
- [x] 复核 `/api/search` 的 response shape 是否仍停留在 web 本地类型，而未进入 shared contract。
- [x] 把 `SearchResult` 提升到 `packages/shared`，并让 web client / SearchView 直接复用。
- [x] 补最小 web client 回归，锁定 `searchNotes()` 使用 shared response shape。
- [x] 跑定向 web 验证并更新本文件。

## 当前执行
- 已确认当前工作树仍有与本轮无关的并行改动：`CLAUDE.md`、`LifeOS/packages/server/config.json`、`LifeOS/packages/web/src/views/SettingsView.vue`、`LifeOS/packages/web/src/views/SettingsView.test.ts`、`lifeonline-claude-worker-v2.sh`。本轮未覆盖这些文件。
- 本轮完成的真实实现：
  - `LifeOS/packages/shared/src/types.ts` 新增 shared `SearchResult` contract，正式把 `/api/search` 返回 shape 收回单一事实源。
  - `LifeOS/packages/web/src/api/client.ts` 删除本地 `SearchResult` 类型，改为直接从 `@lifeos/shared` 导入。
  - `LifeOS/packages/web/src/views/SearchView.vue` 不再从 client 本地导入 `SearchResult`，而是直接消费 shared contract。
  - `LifeOS/packages/web/src/api/client.test.ts` 新增 `sends typed search requests and returns the shared response shape`，锁定 `searchNotes()` 的请求路径与 shared 响应 shape。
- 这次不是继续做 search 语义补强，而是把上一轮刚修好的 search 主路径进一步完成三端 contract 对齐，消除 search result 仍停留在 web-local type 的漂移。

## 本轮选择依据
- 用户已经明确要求下一轮优先继续找新的 `server/web/shared contract gap`，避免再回到 grouped governance / SettingsView 的同类补强。
- 上一轮已经修复 `/api/search` 与 SearchView 文案的语义断裂；紧接着最自然的高价值收口点，就是把 search 返回值从 web 本地类型提升为 shared contract。
- 这属于真实主路径 contract 漂移，优先级高于继续做同类稳定性扩展。

## 本轮验证
- `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/api/client.test.ts` 通过。
- 受 vitest 当前配置影响，命令同时跑过现有 web 测试集；结果为 9 files / 120 tests 全通过，其中 `src/api/client.test.ts` 7 tests 全通过。
- 当前环境仍有 Node engine warning（包声明 `>=20 <21`，实际 `v25.8.1`），但未影响本轮验证结果。

## 当前未完成项
- 本轮 search contract 收口改动尚未提交 git commit。
- 工作区仍有与本轮无关的并行改动：`CLAUDE.md`、`LifeOS/packages/server/config.json`、`LifeOS/packages/web/src/views/SettingsView.vue`、`LifeOS/packages/web/src/views/SettingsView.test.ts`、`lifeonline-claude-worker-v2.sh`。
- server 侧虽然在测试里已经按 shared `SearchResult` 使用，但 `/api/search` handler 还没有显式把 response typing 接到 shared contract 上。

## 下一步建议
- 若继续沿 contract 主线推进，下一步优先把 server `/api/search` handler 的 response type 也显式接回 shared `SearchResult`，完成 server/web/shared 三端闭环。
- 做完这一步后，再继续检查还有哪些主路径 API 仍然停留在 web-local request/response shape。


# search 语义与 UI 承诺对齐

## 计划
- [x] 继续避开并行中的 `CLAUDE.md` / worker 草稿 / SettingsView 改动，只处理新的高价值主路径缺口。
- [x] 复核 SearchView 文案与 `/api/search` 实际匹配字段，确认是否存在真实的用户可见行为断裂。
- [x] 修正 search API，使其与前端承诺的“维度词、标签词”搜索语义一致。
- [x] 补最小 server 回归，分别锁定维度词和标签词搜索都能命中。
- [x] 跑定向验证并更新本文件。

## 当前执行
- 已确认当前工作树仍只有与本轮无关的并行改动：`CLAUDE.md`、`LifeOS/packages/server/config.json`、`LifeOS/packages/web/src/views/SettingsView.vue`、`LifeOS/packages/web/src/views/SettingsView.test.ts`、`lifeonline-claude-worker-v2.sh`。本轮未覆盖这些文件。
- 本轮完成的真实实现：
  - `LifeOS/packages/server/src/api/handlers.ts` 的 `/api/search` 查询从仅匹配 `file_name` / `content`，扩展为同时匹配 `dimension` / `tags`。
  - `LifeOS/packages/server/test/configLifecycle.test.ts` 新增两条回归：
    - `search API matches dimension terms used by search view copy`
    - `search API matches tag terms used by search view copy`
    直接锁定 SearchView 空态文案里承诺的“维度词、标签词”确实能通过 search API 命中结果。
- 这次修的不是 grouped governance，也不是同类稳定性平移；而是一个直接的主路径行为断裂：前端明确提示用户可以搜维度词、标签词，但后端此前根本不支持。

## 本轮选择依据
- 用户要求下一轮优先继续找新的高价值 contract gap / 事实源问题 / 主路径断裂。
- 搜索是直接可见的主路径；`SearchView.vue` 文案已经向用户承诺“尝试更短的关键词或维度词、标签词”，而 `/api/search` 之前只搜文件名和正文。
- 这属于明确的用户可见 false promise，优先级高于继续补 grouped governance 同类测试。

## 本轮验证
- 定向验证通过：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test --test-name-pattern "search API matches" test/configLifecycle.test.ts`
  - 2/2 通过。
- 全文件回归中新增 search 用例也通过；但 `configLifecycle.test.ts` 同时存在一条既有无关超时：`updating config treats equivalent vault paths as unchanged after normalization`。该波动与本轮 search 改动无关，因此本轮采用 scoped 定向验证作为通过依据。

## 当前未完成项
- 本轮 search 语义修正改动尚未提交 git commit。
- 工作区仍有与本轮无关的并行改动：`CLAUDE.md`、`LifeOS/packages/server/config.json`、`LifeOS/packages/web/src/views/SettingsView.vue`、`LifeOS/packages/web/src/views/SettingsView.test.ts`、`lifeonline-claude-worker-v2.sh`。
- 搜索 contract 仍是 server-local 返回 shape，尚未显式提升为 shared `SearchResult` contract；web 当前使用本地 client type。

## 下一步建议
- 若继续沿高价值 gap 主线推进，下一步优先把 `searchNotes()` 的响应 shape 收回 shared，消除 search 结果 contract 的本地类型漂移。
- 若继续做行为侧补强，也可以检查 search 是否还应匹配 `type` / `status`，但那需要先确认产品语义，优先级低于把当前 response contract 收回 shared。


# note 文件命名语义收口

## 计划
- [x] 继续避开并行中的 `CLAUDE.md` / worker 草稿 / SettingsView 改动，只处理新的高价值主路径缺口。
- [x] 复核 `createNote` 与 worker 输出的文件命名逻辑，确认是否存在真实的用户可见行为漂移。
- [x] 把 note 文件名清洗/截断规则收口到单一事实源，避免 create-note 与 worker 结果使用不同长度规则。
- [x] 补 server 回归，锁定长标题 create-note 的文件路径命名语义。
- [x] 跑定向 server 验证并更新本文件。

## 当前执行
- 已确认当前工作树仍只有与本轮无关的并行改动：`CLAUDE.md`、`LifeOS/packages/server/config.json`、`LifeOS/packages/web/src/views/SettingsView.vue`、`LifeOS/packages/web/src/views/SettingsView.test.ts`、`lifeonline-claude-worker-v2.sh`。本轮未覆盖这些文件。
- 本轮完成的真实实现：
  - `LifeOS/packages/server/src/vault/fileManager.ts` 新增：
    - `MAX_NOTE_FILE_STEM_LENGTH = 60`
    - `sanitizeNoteFileStem(title)`
    - `buildNoteFilePath()` 改为复用统一清洗/截断逻辑。
  - `LifeOS/packages/server/src/workers/workerTasks.ts` 的 `sanitizeFileName()` 改为复用 `sanitizeNoteFileStem()`，不再维护另一套独立的 60 字符规则实现。
  - `LifeOS/packages/server/test/configLifecycle.test.ts` 新增 `notes create API keeps longer file names aligned with shared note naming semantics`，通过真实 create-note 调用锁定长标题会按统一规则生成稳定文件路径。
- 这次不是继续补 grouped governance，也不是纯重命名；修的是一个真实的用户可见行为漂移：同一系统里 create-note 与 worker 输出此前使用两套不同文件名长度规则（30 vs 60）。

## 本轮选择依据
- 用户要求在前面的 contract / 事实源修正之后，继续优先处理新的主路径断裂或用户可见行为缺口。
- 上一轮测试已经暴露 `buildNoteFilePath()` 与 worker 输出命名规则不一致；这会让用户在 Vault 中看到同类内容因入口不同而得到不同截断行为。
- 这是一个新的主路径行为漂移，价值高于继续补 grouped governance 同类稳定性测试。

## 本轮验证
- `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/configLifecycle.test.ts` 通过，17/17。
- 测试尾部仍有 teardown 后 index queue 访问临时 vault 的既有 `Index file error` 日志，但断言全部通过，未影响本轮结果。
- 新回归确认：长标题 create-note 现在与 worker 输出共享同一 60 字符文件名裁剪语义。

## 当前未完成项
- 本轮命名语义收口改动尚未提交 git commit。
- 工作区仍有与本轮无关的并行改动：`CLAUDE.md`、`LifeOS/packages/server/config.json`、`LifeOS/packages/web/src/views/SettingsView.vue`、`LifeOS/packages/web/src/views/SettingsView.test.ts`、`lifeonline-claude-worker-v2.sh`。
- 仍有下一个潜在高价值点：虽然规则已统一，但文件命名语义仍是 server-local 约定，尚未以 shared-visible contract 或显式 helper 输出到其他层。

## 下一步建议
- 若继续沿主路径推进，优先看是否需要把 note 命名规则再向更明确的公共 seam 提升，避免 future entrypoints 再各自复制一套逻辑。
- 另一条可选主线是回到新的 contract gap：检查 note create/update 之外是否还有其他 web client 仍在用本地 response shape 而非 shared contract。


# note create source 事实源修正

## 计划
- [x] 继续避开并行中的 `CLAUDE.md` / worker 草稿 / SettingsView 改动，只沿新的高价值缺口推进。
- [x] 复核 `createNote` 主路径是否存在真实事实源漂移，而不只是 contract 命名问题。
- [x] 修正 web 控制台创建笔记时落盘 frontmatter 的 `source` 语义。
- [x] 补 server 回归，锁定 create-note 落盘的 frontmatter source 与入口事实一致。
- [x] 跑定向 server 验证并更新本文件。

## 当前执行
- 已确认当前工作树仍只有与本轮无关的并行改动：`CLAUDE.md`、`LifeOS/packages/server/config.json`、`LifeOS/packages/web/src/views/SettingsView.vue`、`LifeOS/packages/web/src/views/SettingsView.test.ts`、`lifeonline-claude-worker-v2.sh`。本轮未覆盖这些文件。
- 本轮完成的真实实现：
  - `LifeOS/packages/server/src/api/handlers.ts` 中 `createNote()` 写入 frontmatter 时，`source` 从错误的 `'desktop'` 修正为 `'web'`。
  - `LifeOS/packages/server/test/configLifecycle.test.ts` 新增 `notes create API records web source in created note frontmatter`，通过真实 POST `/api/notes` 创建笔记后直接读取落盘文件，断言 frontmatter 中包含 `source: web`。
- 这次不是继续做 contract 形式对齐，而是修复真实事实源一致性问题：web 控制台创建的笔记此前会被错误记成 desktop 来源。

## 本轮选择依据
- 用户要求在 contract gap 之后优先处理新的事实源一致性问题。
- 上一轮已经把 note create/update 的 request/response contract 收齐；继续看主路径时，`createNote` 的 `source` 固定写 `'desktop'` 是一个直接的运行时语义错误，而 web 入口实际来自控制台。
- 这属于用户可见数据来源事实错误，优先级高于继续补 grouped governance 的对称测试。

## 本轮验证
- `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/configLifecycle.test.ts` 通过，16/16。
- 测试尾部仍有 teardown 后 index queue 访问临时 vault 的既有 `Index file error` 日志，但断言全部通过，未影响本轮结果。
- 新增测试还顺带暴露当前 `buildNoteFilePath()` 的既有事实：长标题会被截断命名；这不是本轮修复目标，但已得到现实锚点。

## 当前未完成项
- 本轮事实源修正改动尚未提交 git commit。
- 工作区仍有与本轮无关的并行改动：`CLAUDE.md`、`LifeOS/packages/server/config.json`、`LifeOS/packages/web/src/views/SettingsView.vue`、`LifeOS/packages/web/src/views/SettingsView.test.ts`、`lifeonline-claude-worker-v2.sh`。
- 下一个潜在高价值点是：`CreateNoteRequest` 目前没有显式来源字段，若未来出现非-web 调用方，server 默认来源策略仍可能再次漂移。

## 下一步建议
- 若继续沿主路径推进，下一步优先评估是否需要把 create-note 来源策略显式化（例如 shared request 可选 source 或 server 按入口固定语义集中处理），避免后续再出现来源漂移。
- 若暂不扩来源字段，也可以先检查 `buildNoteFilePath()` 的标题截断/命名语义是否需要补成 shared-visible contract 锚点。


# server note handler contract 对齐

## 计划
- [x] 继续避开并行中的 `CLAUDE.md` / worker 草稿 / SettingsView 改动，只沿新的 shared contract 主线推进。
- [x] 复核 server note handlers 是否仍未显式复用上一轮补齐的 shared request/response contract。
- [x] 让 `createNote` / `updateNote` handler 的 request/response 类型直接接回 shared contract。
- [x] 补 server contract 回归，锁定 create/update note API 的成功响应 shape。
- [x] 跑定向 server 验证并更新本文件。

## 当前执行
- 已确认当前工作树只剩与本轮无关的并行改动：根目录 `CLAUDE.md`、根目录 `lifeonline-claude-worker-v2.sh`、`LifeOS/packages/server/config.json`、以及上一条 grouped governance / SettingsView 工作。本轮未覆盖这些文件。
- 本轮完成的真实实现：
  - `LifeOS/packages/server/src/api/handlers.ts`：
    - `updateNote()` 改为 `Request<{ id: string }, UpdateNoteResponse, UpdateNoteRequest>` + `Response<UpdateNoteResponse>`
    - `createNote()` 改为 `Request<Record<string, never>, CreateNoteResponse, CreateNoteRequest>` + `Response<CreateNoteResponse>`
    - 让 server handler 层直接复用 shared contract，而不再只在 web/client 侧单独对齐。
  - `LifeOS/packages/server/test/configLifecycle.test.ts` 新增：
    - `notes update API responds with shared success contract`
    - `notes create API responds with shared success contract`
    分别锁定 PATCH `/api/notes/:id` 与 POST `/api/notes` 的成功响应 shape 与 shared contract 一致。
- 这次没有新增接口行为，也没有去动 grouped governance；重点是把 note 写回 contract 的最后一段 server handler 也接回 shared 单一事实源。

## 本轮选择依据
- 用户已要求优先继续处理新的 `server/web/shared contract gap`。
- 上一轮已把 note 写回 contract 收进 shared，并让 web client 对齐；若 server handler 层仍不显式使用同一份 request/response type，那么三端对齐还差最后一段。
- 这比继续做 grouped governance 同类稳定性测试更贴近主路径，也更能减少 contract 漂移复发。

## 本轮验证
- `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/configLifecycle.test.ts` 通过，15/15。
- 测试末尾仍有两条 teardown 后 index queue 访问临时 vault 的既有 `Index file error` 日志，但断言全部通过，未影响本轮 contract 回归结果。

## 当前未完成项
- 本轮 server contract 对齐改动尚未提交 git commit。
- 工作区仍有与本轮无关的并行改动：`CLAUDE.md`、`LifeOS/packages/server/config.json`、`LifeOS/packages/web/src/views/SettingsView.vue`、`LifeOS/packages/web/src/views/SettingsView.test.ts`、`lifeonline-claude-worker-v2.sh`。
- 下一个更像“事实源一致性问题”的缺口是：`createNote` 当前服务端固定把新笔记 `source` 写成 `'desktop'`，而 web 创建入口实际来自 web 控制台，存在来源语义漂移。

## 下一步建议
- 继续沿主路径查这个新的事实源问题：评估并修正 `createNote` 默认 `source` 的写入语义，让 web 创建的笔记不再落成 `'desktop'`。
- 若不想改 runtime 语义，也至少先为当前事实补 contract/测试锚点，避免后续入口来源继续漂移。


# shared note write-back contract 收口

## 计划
- [x] 继续避开并行中的 `CLAUDE.md` / worker 草稿 / SettingsView 改动，只在新的 shared contract 主线上推进。
- [x] 复核 note 写回链（`createNote` / `updateNote`）的 server/web/shared contract，确认仍存在本地内联请求/响应 shape。
- [x] 把 note 写回请求/响应类型补进 `packages/shared`，避免 client 继续用裸字符串与本地 response shape。
- [x] 更新 web typed client 以复用新的 shared request/response contract。
- [x] 补 web client 回归，锁定 `createNote()` / `updateNote()` 的真实请求与响应 shape。
- [x] 跑定向验证并更新本文件。

## 当前执行
- 已确认当前仓库剩余 dirty state 主要是并行中的 `CLAUDE.md`、`lifeonline-claude-worker-v2.sh`、以及上一条 grouped governance / SettingsView 工作；本轮没有覆盖这些文件。
- 本轮完成的真实实现：
  - `LifeOS/packages/shared/src/types.ts` 新增：
    - `UpdateNoteRequest`
    - `UpdateNoteResponse`
    - `CreateNoteRequest`
    - `CreateNoteResponse`
    把 note 写回链的请求/响应 contract 正式收进 shared。
  - `LifeOS/packages/web/src/api/client.ts`：
    - `updateNote()` 改为返回 shared `UpdateNoteResponse`，并复用 `UpdateNoteRequest`
    - `createNote()` 改为复用 `CreateNoteRequest` / `CreateNoteResponse`
    - 同时修正 client 侧对 create-note 响应的读取方式，不再只靠本地 `{ filePath }` 窄类型。
  - `LifeOS/packages/web/src/api/client.test.ts` 新增两条回归：
    - `sends typed note update requests and returns the shared success response`
    - `sends typed create-note requests and returns the shared response shape`
    直接锁定 note 写回请求体与 server 实际成功响应的 contract。
- 这次没有回到 grouped governance，也没有只做重命名；重点是把 note 主路径的写回 contract 从 web 本地影子定义收回 shared 单一事实源。

## 本轮选择依据
- 用户要求下一轮优先继续处理新的 `server/web/shared contract gap`。
- 上一轮已补齐 note read/detail contract（title / encrypted / approval metadata），但 note write-back 仍存在两个真实漂移点：
  - `updateNote()` 仍以内联对象承载请求字段；
  - `createNote()` 仍以内联 request/response shape 承载 contract，而 server 实际返回 `{ success: true, filePath }`。
- 这些都属于主路径写回 contract 漂移，价值高于继续补 grouped governance 同类稳定性测试。

## 本轮验证
- `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/api/client.test.ts` 通过；vitest 同时跑过当前 web 测试集，9 files / 119 tests。
- 当前环境仍有 Node engine warning（包声明 `>=20 <21`，实际 `v25.8.1`），但本轮验证通过。

## 当前未完成项
- 本轮 shared/web contract 收口改动尚未提交 git commit。
- 工作区仍有与本轮无关的并行改动：`CLAUDE.md`、`LifeOS/packages/server/config.json`、`LifeOS/packages/web/src/views/SettingsView.vue`、`LifeOS/packages/web/src/views/SettingsView.test.ts`、`lifeonline-claude-worker-v2.sh`。
- server 侧 `updateNote` handler 仍直接从 `req.body` 解构字段，尚未显式对齐 shared request type；虽然 runtime 行为已匹配，但 handler 层还没拿到同一份 typed contract。

## 下一步建议
- 继续沿同一 contract 主线，把 server note handlers 的 request/response 也接回 shared 类型，形成 server/web/shared 完整对齐。
- 若这条线确认收得差不多，再看下一个主路径 gap：`createNote` 的 `source` 当前固定写 `'desktop'` 是否与 web 创建入口的事实源语义一致。


# shared Note metadata contract 收口

## 计划
- [x] 继续避开并行中的 `CLAUDE.md` / worker 草稿 / 上一轮 SettingsView 改动，只沿新的高价值 contract 主线推进。
- [x] 复核 `NoteDetail` 当前消费的 note metadata，确认哪些字段 server 已返回但 shared `Note` 尚未声明。
- [x] 补齐最小 shared contract：把 `encrypted` 与现有 approval metadata 纳入 `packages/shared`，不扩 API 语义。
- [x] 去掉 web 侧 `NoteDetail` 的本地临时扩展类型，直接复用共享 `Note` contract。
- [x] 补 `NoteDetail` 组件级回归，锁定 approval metadata 与 encrypted placeholder 的真实消费。
- [x] 跑定向 web 验证并更新本文件。

## 当前执行
- 已确认当前仓库仍有与本轮无关或未准备提交的并行改动：根目录 `CLAUDE.md`、根目录 `lifeonline-claude-worker-v2.sh`、以及上一轮尚未提交的 `LifeOS/packages/web/src/views/SettingsView.vue` / `SettingsView.test.ts`。本轮未覆盖这些改动。
- 本轮完成的真实实现：
  - `LifeOS/packages/shared/src/types.ts` 新增 `ApprovalStatus = 'pending' | 'approved' | 'rejected'`，并把 `approval_status`、`approval_operation`、`approval_action`、`approval_risk`、`approval_scope` 纳入 `Frontmatter`；同时把 `encrypted?: boolean` 纳入共享 `Note` contract。
  - `LifeOS/packages/web/src/components/NoteDetail.vue` 删除本地 `Note & {...}` 临时扩展，改为直接使用共享 `Note` 类型，避免 web 再自行维护一份与 server 实际响应并行的影子 contract。
  - `LifeOS/packages/web/src/components/NoteDetail.test.ts` 的测试数据工厂改为符合当前共享 `Note` 真实字段名（`id` / `file_path` / `created` / `updated` / `indexed_at` / `file_modified_at` 等），不再依赖旧的本地伪字段。
  - 同一测试文件新增两条回归：
    - `renders approval metadata from the shared Note contract`
    - `renders encrypted placeholder from the shared Note contract flag`
    直接锁定 `NoteDetail` 对 approval / encrypted 两类共享字段的真实消费。
- 这次没有新增后端接口，也没有继续深挖 grouped governance；重点是把另一个已经运行中的 note 详情 contract 缺口补齐。

## 本轮选择依据
- 用户已要求后续优先找新的 `server/web/shared contract gap`，避免继续在 grouped governance / SettingsView 同类收敛链上做低边际平移。
- 代码现实显示：
  - server 在 `LifeOS/packages/server/src/db/schema.ts` / `src/indexer/indexer.ts` 已持久化 approval metadata；
  - `LifeOS/packages/server/src/api/handlers.ts` 的 `parseNote()` 也会在返回 note 时附带 `encrypted`；
  - `LifeOS/packages/web/src/components/NoteDetail.vue` 已在真实 UI 中消费这些字段；
  - 但 `LifeOS/packages/shared/src/types.ts` 之前仍未声明这些 note metadata，导致 web 用本地扩展影子补洞。
- 这属于真实 shared contract 漂移，而不是形式重构。

## 本轮验证
- `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/components/NoteDetail.test.ts` 通过；vitest 同时跑过当前 web 测试集，9 files / 117 tests。
- 当前环境仍有 Node engine warning（包声明 `>=20 <21`，实际 `v25.8.1`），但本轮定向验证通过。

## 当前未完成项
- 本轮 shared/web contract 收口改动尚未提交 git commit。
- 仓库仍有与本轮无关或并行中的未提交改动：`CLAUDE.md`、`lifeonline-claude-worker-v2.sh`、`LifeOS/packages/web/src/views/SettingsView.vue`、`LifeOS/packages/web/src/views/SettingsView.test.ts`，以及上一轮尚未提交的 `LifeOS/packages/server/test/configLifecycle.test.ts` / `LifeOS/packages/shared/src/types.ts` 一并仍在工作区。
- `web/src/api/client.ts` 的 `updateNote()` 仍在使用内联 `{ approval_status?: string }`，还没有复用刚补齐的共享 approval status 类型。

## 下一步建议
- 若继续沿同一 contract 主线推进，优先收口 `updateNote()` / 相关调用点的 approval status 类型，让 note 写回入口也回到 shared contract，而不是继续保留字符串漂移口。
- 若准备提交，建议把本轮与上一轮的 shared contract 收口改动拆成只包含相关文件的干净 commit，继续避开无关 dirty 文件。


# shared Note.title contract 收口

## 计划
- [x] 复核当前仓库未提交状态，继续避开并行中的 `CLAUDE.md` / worker 草稿与上一轮尚未提交的 `SettingsView` 文案改动。
- [x] 沿用户要求转向新的高价值缺口，优先排查 server/web/shared contract gap，而不是继续深挖 grouped governance 同类补强。
- [x] 锁定并修复新的真实 contract gap：`packages/shared` 的 `Note` 缺少 `title`，但 server 实际返回、web 已在消费。
- [x] 补最小 server contract 回归，锁定 `/api/notes` 在 indexer 提取标题时会返回 `title`。
- [x] 跑定向 server / web 验证并记录结果。
- [x] 更新本文件，记录本轮选择依据、验证结果与下一步建议。

## 当前执行
- 已确认当前仓库仍有与本轮无关的未提交改动：根目录 `CLAUDE.md`、根目录 `lifeonline-claude-worker-v2.sh`，以及上一轮尚未提交的 `LifeOS/packages/web/src/views/SettingsView.vue` / `SettingsView.test.ts`。本轮未覆盖这些改动，也未把它们混入实现。
- 本轮完成的真实实现：
  - `LifeOS/packages/shared/src/types.ts` 为共享 `Note` contract 增加 `title?: string | null`，使 shared 类型与 server 实际返回、web 现有消费对齐。
  - `LifeOS/packages/server/test/configLifecycle.test.ts` 新增 `notes API returns shared note title field when indexer extracts one`，在测试 vault 中写入带 `##` 标题的笔记，启动 server 后通过 `/api/notes` 断言返回的 note 带有 `title: 'Shared contract title'`。
  - 这条回归同时确认现有 `file_name` contract 仍保持带 `.md` 的真实返回，没有误把新的 title coverage 写成 filename 语义改动。
- 本轮过程中发现并处理了一个测试副作用：`configLifecycle.test.ts` 跑完后把 `LifeOS/packages/server/config.json` 清空。已立即恢复为原内容，避免把无关配置漂移带入后续工作区。
- 这次没有新增接口、没有改 settings grouped governance 行为，也没有继续围绕同一链路做对称补强；重点是把一个已存在于主数据模型中的共享 contract 缺口补齐。

## 本轮选择依据
- 用户已明确要求下一轮优先寻找新的 `server/web/shared contract gap` 或新的事实源一致性问题，而不要再默认深挖 grouped governance / SettingsView 的 websocket/filter/retention 同类补强。
- 代码现实显示：
  - server 在 `LifeOS/packages/server/src/indexer/indexer.ts` 中会提取 markdown 标题并写入 `notes.title`；
  - `LifeOS/packages/server/src/api/handlers.ts` 的 `parseNote()` 直接把这部分数据返回给 API；
  - web 多处组件已使用 `note.title || note.file_name...`；
  - 但 `LifeOS/packages/shared/src/types.ts` 的 `Note` 却没有 `title` 字段。
- 这属于真实 shared contract 漂移：不是未来设计，而是当前运行中的 server/web 已经依赖、shared 仍未声明。

## 本轮验证
- `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/configLifecycle.test.ts` 通过，13/13。
- `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过；vitest 同时跑过当前 web 测试集，9 files / 116 tests。
- 当前环境仍有 Node engine warning（包声明 `>=20 <21`，实际 `v25.8.1`），但本轮定向验证全部通过。

## 当前未完成项
- 本轮 shared/server contract 收口改动尚未提交 git commit。
- 仓库仍有与本轮无关或并行中的未提交改动：`CLAUDE.md`、`lifeonline-claude-worker-v2.sh`、`LifeOS/packages/web/src/views/SettingsView.vue`、`LifeOS/packages/web/src/views/SettingsView.test.ts`。
- 仍有下一个潜在高价值 contract gap 可继续排查：note detail 流中的 `encrypted` / approval metadata 仍未进入 shared `Note` contract，而 web 已在本地扩展类型消费。

## 下一步建议
- 继续沿新的 contract 主线前进，优先排查并收口 `NoteDetail` 相关的共享 note metadata 缺口（如 `encrypted`、approval 字段），而不是回到 grouped governance 的文案/筛选微调。
- 若要提交本轮改动，建议只包含 `LifeOS/packages/shared/src/types.ts` 与 `LifeOS/packages/server/test/configLifecycle.test.ts`，继续避开无关 dirty 文件。


# PR6 grouped governance 命名语义收口

## 计划
- [x] 复核当前仓库未提交状态，确认本轮不去碰并行中的 `CLAUDE.md` / worker 草稿，只在产品代码内继续推进。
- [x] 基于 `README` / `tasks/todo.md` / `CLAUDE.md` / 当前代码搜索，判断是否仍有必要继续本轮，并避开已补得很深的 grouped governance websocket/filter/retention 同类对称补强。
- [x] 锁定新的真实缺口：web grouped governance 明明在按 reintegration 分组，却仍把组键命名成 `sourceNoteId`，容易把已分离的 `sourceReintegrationId` / `sourceNoteId` 双事实源再次混淆。
- [x] 仅在 web 侧做最小语义收口：将 `SoulActionGroup` 与 `SoulActionGovernancePanel` / `SettingsView` / 对应 tests 中承载“分组键”的字段统一改名为 `groupKey`，不扩大功能面、不改变现有治理规则。
- [x] 跑 web 定向测试与 build 验证回归。
- [x] 更新本文件，记录本轮选择依据、验证结果与下一步建议。

## 当前执行
- 已确认本轮继续推进是有必要的，但不应该再重复补 grouped governance 的 websocket/filter/retention 同类对称用例。
- 仓库当前仍有与本轮无关的未提交改动：根目录 `CLAUDE.md` 被本地收紧、根目录存在 `lifeonline-claude-worker-v2.sh` 草稿；本轮未触碰它们，也未尝试混入提交。
- 本轮完成的真实实现：
  - `LifeOS/packages/web/src/utils/soulActionGroups.ts` 中 `SoulActionGroup` 的分组主键由误导性的 `sourceNoteId` 改为 `groupKey`；内部 grouped map 也同步改名，明确表达“这里承载的是 reintegration group key（promotion 时优先 `sourceReintegrationId`，否则才回退 note id）”，而不是原始 source note 本身。
  - `LifeOS/packages/web/src/components/SoulActionGovernancePanel.vue` 所有组级 `key`、label、loading/disabled 判定、collapse emit 与 group toolbar 接线，全部同步切到 `group.groupKey`，避免组件继续在用户可见文案和事件层误传播 `sourceNoteId` 这一错误语义。
  - `LifeOS/packages/web/src/views/SettingsView.vue` 的组级 approve / dispatch handler 形参与 in-flight id 跟踪同步改为 `groupKey`，把父层状态机与 panel/utility 侧语义对齐。
  - `LifeOS/packages/web/src/views/SettingsView.test.ts`、`LifeOS/packages/web/src/components/SoulActionGovernancePanel.test.ts`、`LifeOS/packages/web/src/utils/soulActionGroups.test.ts` 中所有依赖该分组键的 props / emit / 断言同步改为 `groupKey`，保持 view + component + utility 三层回归保护一致。
- 本轮没有新增接口、没有改 shared/server contract、没有扩治理动作；只是把 web 里已经实际存在的“按 reintegration 分组”语义正式说清楚，避免以后又把 `sourceReintegrationId` / `sourceNoteId` 混回同一个名字里。

## 本轮选择依据
- `tasks/todo.md` 里已经明确记录：grouped governance / SettingsView 的 websocket/filter/retention 收敛链补得很深，继续同类测试边际收益低。
- 当前代码搜索显示，server/shared 侧已经把 `sourceReintegrationId` 与 `sourceNoteId` 区分开了，但 web grouped governance 这层仍在用 `sourceNoteId` 指代分组键；这会持续误导后续实现者，也容易让刚分离好的双事实源在 UI 层再次语义漂移。
- 所以本轮选择的是“命名与接线语义收口”这个真实缺口，而不是再做一轮对称性 coverage 补强。

## 本轮验证
- `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/utils/soulActionGroups.test.ts src/components/SoulActionGovernancePanel.test.ts src/views/SettingsView.test.ts` 通过，9 files / 115 tests。
- `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前环境仍有 Node engine warning（包声明 `>=20 <21`，实际 `v25.8.1`），但本轮测试与构建均通过。

## 当前未完成项
- 本轮 web 命名收口改动尚未提交 git commit。
- server / API 主链里是否还存在把 `sourceNoteId = record.id` 当主语义承载的兼容路径，仍值得后续继续排查；这比继续补 web 对称测试更有价值。
- 仓库仍有与本轮无关的未提交改动（`CLAUDE.md`、`lifeonline-claude-worker-v2.sh`），若后续要提交，需要先决定是否拆分或继续避开。

## 下一步建议
- 优先转回 server/shared contract 主链，继续检查 `reintegrationPromotionPlanner`、accept API 返回链、以及 related soul-action list 是否还残留“`sourceNoteId = record.id` 承载 reintegration 语义”的现实路径。
- 若确认主链还没完全切回“双字段分离”，下一步就直接补那条根因，而不是回头继续做 grouped governance 的 UI 微调。
- 若短期不继续扩实现，也可以先把本轮 web 语义收口单独提交，避免它长时间和无关 worker/CLAUDE 草稿混在未提交状态里。



## 计划
- [x] 读取 README / vision / tasks / CLAUDE.md 并复核当前 PR1–PR6 边界。
- [x] 复核 PR6 现有 coverage，确认本轮应优先做保守、可验证的小步扩展，而不是新开治理面。
- [x] 在 PR6 promotion planner / executor 中新增 `daily_report_reintegration -> promote_continuity_record` 的 review-backed 最小 coverage。
- [x] 补充对应测试，覆盖 accepted 可晋升，以及 pending/rejected 不得越过最终执行口。
- [x] 运行相关测试与 server build。
- [x] 记录本轮 review / 验证结果，并直接提交 git commit。
- [x] 复核 Claude 自主推进能力是否恢复可用。
- [x] 若 Claude 恢复正常输出，继续收敛 PR6 中下一处最小真实缺口（优先重复 review predicate / promotion rule 的集中化）；若仍异常，保留当前状态并等待下一轮 token/CLI 状态恢复。
- [x] 将 `workerTasks.ts` terminal reintegration hook 中剩余的 payload/result/record 拼装逻辑压回 `feedbackReintegration.ts` 的更窄 helper，减少 terminal hook 内联组装。
- [x] 补充最窄测试，锁定 reintegration record 输入组装对 persona evidence 与 continuity 字段的稳定输出。
- [x] 在 reintegration review accept 路径增加最小 orchestration helper：accepted 后自动规划 PR6 promotion actions，但仍不自动 dispatch，继续保持 approve/dispatch 分离。
- [x] 补充最窄测试，锁定 accept 即产出 promotion actions，以及重复规划复用既有 soul actions 的幂等性。

## 当前执行
- 已完成文档锚点读取：`README.md`、`CLAUDE.md`、`vision/00-权威基线/`、`vision/01-当前进度/`、`tasks/todo.md`、`tasks/lessons.md`。
- 已确认当前 PR6 已具备 review-backed `event_nodes` / `continuity_records` 最小闭环，上一轮刚补完最终执行口 accepted-review 守卫。
- 上一轮已完成真实实现：
  - `LifeOS/packages/server/src/soul/reintegrationPromotionPlanner.ts` 现在允许 `daily_report_reintegration` 在 accepted review 后同时规划 `promote_event_node` 与 `promote_continuity_record`。
  - `LifeOS/packages/server/src/soul/pr6PromotionExecutor.ts` 为 daily-report continuity promotion 落地 `daily_rhythm` continuity kind，并保持最终执行口的 accepted-review 强约束。
  - `LifeOS/packages/server/src/soul/types.ts`、`LifeOS/packages/server/src/db/schema.ts`、`LifeOS/packages/server/src/db/client.ts` 已同步扩展 `daily_rhythm` 持久化约束与迁移判断，避免现有库 schema 漂移。
  - `LifeOS/packages/server/test/feedbackReintegration.test.ts` 已补 daily report accepted/rejected 两条 continuity promotion 覆盖。
- 本轮继续完成的真实实现：
  - 新增 `LifeOS/packages/server/src/soul/pr6PromotionRules.ts`，把 PR6 promotion 的 accepted-review 守卫、signal -> actionKinds、signal -> eventKind、signal -> continuityKind 统一收口，减少 planner / executor 中重复规则。
  - `LifeOS/packages/server/src/soul/reintegrationPromotionPlanner.ts` 改为复用统一规则模块生成 promotion action，避免 signal 白名单在多个位置散落。
  - `LifeOS/packages/server/src/soul/pr6PromotionExecutor.ts` 改为复用统一规则模块解析 promotion kind，并保留 dispatch 侧更明确的错误信息 `PR6 promotion requires accepted reintegration review`。
  - `LifeOS/packages/server/test/feedbackReintegration.test.ts` 增加对统一规则模块的断言，确认 accepted daily-report promotion 仍稳定产出 event + continuity 两类 action。
  - `LifeOS/packages/server/src/workers/feedbackReintegration.ts` 新增 `getReintegrationSignalKind()` 与 `ReintegrationSignalKind`，把 worker task -> reintegration signal 的映射集中到 feedback/reintegration 边界。
  - `LifeOS/packages/server/src/workers/workerTasks.ts` 改为复用 `getReintegrationSignalKind()` 写入 reintegration record，去掉 terminal hook 内联的多层三元表达式。
  - `LifeOS/packages/server/src/soul/reintegrationRecords.ts` 将 `signalKind` 收紧为 `ReintegrationSignalKind`，减少后续 planner/review/executor 侧接受任意字符串的漂移。
  - `LifeOS/packages/server/test/feedbackReintegration.test.ts` 补充统一 signal helper 断言，锁定支持 taskType 的稳定映射。
  - `LifeOS/packages/server/src/workers/feedbackReintegration.ts` 新增 `createReintegrationRecordInput()`，统一 terminal reintegration record 的 payload / continuity / evidence 组装。
  - `LifeOS/packages/server/src/workers/workerTasks.ts` 改为仅收集 `soulActionId` 与 `personaSnapshot` 后调用统一 helper，进一步收窄 terminal hook 内联逻辑。
  - `LifeOS/packages/server/test/feedbackReintegration.test.ts` 补两条 helper 级别断言，锁定 persona evidence 存在/缺失时的 record 输入输出。
- 本轮继续完成的真实实现：
  - `LifeOS/packages/web/src/views/SettingsView.vue` 新增最小 reintegration review 面板，直接在现有 settings/admin 入口中展示 reintegration records，并支持按 review status 筛选、刷新、accept / reject 与可选 reason。
  - accept 动作现在在 UI 中直接消费 `acceptReintegrationRecord()` 返回的 `soulActions`，把 auto-planned PR6 promotion actions 即时展示在对应 record 下方，不再要求主流程里必须再点一次 plan。
  - 保留 `手动补规划` fallback 按钮，对已 accepted 但需要再次查看/确认 promotion action 的场景复用 `planReintegrationPromotions()`。
  - 同一面板里增加 evidence 展开区、review status summary strip 与紧凑的 operational layout，让这条 PR6 review-backed 链路首次在 web 控制台中被真实消费，而不只是停留在 contract/client 层。
- 本轮验证补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/reintegrationApi.test.ts test/feedbackReintegration.test.ts` 通过，47/47。
- 本轮继续完成的真实实现：
  - `LifeOS/packages/shared/src/types.ts` 补齐 soul-action list / approve / dispatch 的共享 contract，避免 settings 侧继续用松散内联响应类型。
  - `LifeOS/packages/web/src/api/client.ts` 新增 `fetchSoulActions()`、`approveSoulAction()`、`dispatchSoulAction()`，把 soul-action 治理入口收进现有 typed client。
  - `LifeOS/packages/web/src/views/SettingsView.vue` 在 reintegration review 面板旁补上最小 soul-action governance 面板，支持按 governance / execution status 筛选、刷新、批准与派发执行。
  - reintegration accept / 手动补规划、以及 websocket 的 `worker-task-updated` 现在都会联动刷新 soul actions，让 accept -> planned -> approve / dispatch 在同一 settings 入口形成连续链路。
  - soul-action 区块保留保守边界：只消费已有 approve / dispatch API，不新增 defer/discard 等更大治理面。
- 本轮继续完成的真实实现：
  - `LifeOS/packages/web/src/views/SettingsView.vue` 增加组级 quick action：只对当前分组中仍为 `pending_review` 的 soul actions 执行批量 approve，继续保持 approve / dispatch 分离，不扩大治理边界。
  - 这次完全复用现有单条 `approveSoulAction()` API 和本地分组数据，不新增 API、不改 contract，也不引入批量 dispatch 这类更高风险动作。
- 本轮继续完成的真实实现：
  - `LifeOS/packages/web/src/views/SettingsView.vue` 继续补上保守的组级 dispatch quick action，但只在当前分组所有 soul actions 都已 `approved` 且仍为 `not_dispatched` 时才开放，避免把部分完成/混合状态组错误地一键派发。
  - 组级 dispatch 仍完全复用现有单条 `dispatchSoulAction()` API，不新增批量接口；执行后继续刷新 reintegration records 与 soul actions，保持 settings 视图即时反映执行结果。
- 本轮继续完成的真实实现：
  - `LifeOS/packages/web/src/views/SettingsView.vue` 为 grouped soul-action governance 增加第二个保守 quick filter：`dispatch_ready_only`，只显示“整组全部已 approved 且都 still not_dispatched”的分组。
  - 这次不新增后端接口、不改 shared contract，只在现有 grouped computed 上复用 `dispatchReadyCount` 与 `group.actions.length` 做前端过滤，继续保持 approve / dispatch 分离与 review-backed 治理边界。
- 本轮继续完成的真实实现：
  - `LifeOS/packages/web/src/views/SettingsView.vue` 为 grouped soul-action governance 补了更直接的筛选可见性：在 summary strip 中增加 `当前分组` 计数，显示“当前命中的分组数 / 全部分组数”。
  - 同一处为空态补了保守提示文案，引导在 `dispatch_ready_only` / `pending_only` 过滤下快速回到 `全部分组` 或继续检查是否还有已批准未派发分组，减少 settings 里“看起来像没数据”的误判。
  - 这次仍只复用现有 `soulActions` / grouped computed 数据，不新增 API、不改 shared contract，也不改变 approve / dispatch 规则。
- 本轮继续完成的真实实现：
  - `LifeOS/packages/web/src/views/SettingsView.vue` 为 grouped soul-action governance 的分组头补了 `ready {{ group.dispatchReadyCount }}` pill，让当前组“还有多少条已批准待派发 action”在不展开明细时也能直接读到。
  - 这次继续只复用已有 grouped computed 中的 `dispatchReadyCount`，不新增任何接口、状态或治理动作，只提升 PR6 settings 分组扫描效率。
- 本轮继续完成的真实实现：
  - `LifeOS/packages/web/src/views/SettingsView.vue` 为 grouped soul-action governance 补了当前 quick filter 模式回显：在筛选区下方直接显示 `当前分组视图：全部分组 / 仅待治理分组 / 仅可派发分组`，避免用户切换后只看结果却忘记当前模式。
  - 这次只基于已有 `soulActionGroupQuickFilter` 增加一个本地 computed label 和轻量提示样式，不新增接口、不改 contract，也不扩治理动作。
- 本轮继续完成的真实实现：
  - `LifeOS/packages/web/src/views/SettingsView.vue` 把 reintegration / soul-action summary strip 的栅格从固定 `repeat(3, ...)` 调整为 `repeat(auto-fit, minmax(160px, 1fr))`，让已经扩到 4 个 summary item 的 grouped governance 卡片在当前实现下不再依赖挤压或换行碰运气。
  - 这次没有新增任何新功能，只是把前几轮已经加进去的 `当前分组` 指标纳入稳定布局约束，属于修正同一主线 UI 的真实显示问题，而不是纯形式整理。
- 本轮继续完成的真实实现：
  - `LifeOS/packages/web/src/views/SettingsView.vue` 为 grouped soul-action governance 的 filter mode 回显再补一层命中统计 pill：在 `当前分组视图` 文案旁直接显示 `X / Y 分组命中`，把当前过滤结果和总分组数并排放到同一个提示区。
  - 这次只复用已有 `soulActionGroups.length` 与 `soulActionGroupCount`，新增一个本地 computed 文案与轻量样式，不新增接口、不改 contract，也不扩治理动作。
- 本轮继续完成的真实实现：
  - `LifeOS/packages/web/src/views/SettingsView.vue` 将组级 approve / dispatch 成功提示从单纯的数量文案收紧为 `已批量批准 X/Y 条`、`已批量派发 X/Y 条`，把“本次处理了多少”与“当前分组总量”一起返回给 settings 使用者。
  - 这次不改治理规则、不新增接口，只复用现有 group actions 长度，让 group quick action 的结果反馈更可解释，符合当前 PR6 review-backed 管理面的小步增强方向。
- 本轮继续完成的真实实现：
  - `LifeOS/packages/server/test/reintegrationApi.test.ts` 新增一条 grouped settings 语义测试，锁定 `sourceNoteId` 分组下的 `pendingCount` / `dispatchReadyCount` 组合在“整组全 approved 可派发”和“部分 approved、仍混合 pending”两种场景下都能稳定从 API 读出。
  - 这次没有新增后端接口，也没有继续做纯 UI 微调，而是直接在现有 HTTP contract 覆盖里把 grouped governance 依赖的核心语义补成可回归的测试锚点。
- 本轮继续完成的真实实现：
  - `LifeOS/packages/server/test/reintegrationApi.test.ts` 继续扩 grouped settings 语义测试，新增“整组已 approve 且已全部 dispatch 后，dispatchReadyCount 必须回落为 0”这一条 contract 断言。
  - 这样一来，当前测试同时锁住了三种关键分组状态：整组全 approved 可派发、部分 approved 混合 pending、以及整组已 dispatch 后的 ready 清零，直接覆盖 settings grouped governance 里最核心的分组统计语义。
- 本轮继续完成的真实实现：
  - `LifeOS/packages/server/test/reintegrationApi.test.ts` 新增 approve 阶段的 websocket contract test，锁定 settings 依赖的 `soul-action-updated` 事件不仅在 dispatch 后触发，也会在 approve 后触发，并且携带正确的 `sourceNoteId`、`id` 与 `governanceStatus=approved`。
  - 这次继续走已有 server contract test 路径，不新增接口、不改 runtime 行为，而是把 grouped governance 刷新链路中“批准后也必须能实时刷新”的关键语义补成可回归保护。
- 本轮继续完成的真实实现：
  - `LifeOS/packages/server/test/reintegrationApi.test.ts` 新增 accept 阶段的 websocket contract test，锁定 reintegration record 被 accept 后自动规划出的 soul actions 也会立刻通过 `soul-action-updated` 广播出去，供 settings grouped governance 即时刷新。
  - 该测试要求同一 `sourceNoteId` 下收到两条 `pending_review` 的 websocket 事件，并与 accept API 返回的两条 planned actions 一一对齐，直接补上“accept -> planned -> web refresh”这段主链的回归保护。
- 本轮继续完成的真实实现：
  - `LifeOS/packages/server/test/reintegrationApi.test.ts` 新增 dispatch 后 follow-up list 收敛测试，锁定 `dispatch` API 返回的 soul action 状态与后续 `GET /api/soul-actions?sourceNoteId=...` 读到的组内状态保持一致。
  - 该测试直接覆盖 grouped governance 的一个关键前提：settings 在 dispatch 后重新拉取列表时，看到的分组内 action 必须与 dispatch 响应中的 execution status 对齐，而不是只依赖 websocket 瞬时事件。
- 本轮继续完成的真实实现：
  - `LifeOS/packages/server/test/reintegrationApi.test.ts` 新增 accept -> approve -> dispatch 全链路组状态收敛测试，锁定 daily-report 分组在完整治理链路走完后，再次 list 时整组 action 都保持 `approved` 且不再落回 `pending_review` / `not_dispatched`。
  - 该测试与上一条单 action dispatch/list 对齐测试互补：前者锁定单条响应和 follow-up list 一致，新增这条则锁定整组双 action 在完整主链结束后的最终 grouped settings 视图收敛。
- 本轮继续完成的真实实现：
  - `LifeOS/packages/server/test/reintegrationApi.test.ts` 新增 staggered approve/dispatch 收敛测试，锁定同一 `sourceNoteId` 分组里“一条已 dispatch、另一条刚 approved 仍待 dispatch”的混合状态也能被后续 list 稳定读出。
  - 该测试直接覆盖 grouped settings 在真实操作顺序下最容易隐含出错的场景：先 approve 第一条、再 approve 第二条、随后只 dispatch 第一条时，分组列表仍必须同时保留 1 条 dispatched action 和 1 条 dispatch-ready action，而不是被瞬时刷新顺序冲掉。
- 本轮继续完成的真实实现：
  - `LifeOS/packages/server/test/reintegrationApi.test.ts` 新增 sequential dispatch-ready 收敛测试，锁定同组两条 action 在“先 dispatch 一条、刷新、再 dispatch 第二条”的两次 list 之间，`dispatchReadyCount` 语义能从 1 稳定收敛到 0。
  - 该测试补上 grouped settings 真实使用里很关键的一段刷新链：第一次刷新必须还能看见剩余 1 条 dispatch-ready action，第二次刷新则必须看到整组 ready 清零，避免 UI 对 sequential dispatch 顺序产生隐性假设。
- 本轮继续完成的真实实现：
  - `LifeOS/packages/server/test/reintegrationApi.test.ts` 新增 grouped status filters 收敛测试，锁定 sequential dispatch 之后，按 `governanceStatus` / `executionStatus` 过滤得到的子列表仍与同一 `sourceNoteId` 的完整列表语义一致。
  - 该测试直接保护 settings grouped governance 的另一条真实依赖：即使用户切到仅看 dispatch-ready 或某类已 dispatch action 的筛选视图，过滤结果也必须和总表刷新后的组内状态保持一致，不能出现“总表对了、过滤视图漂移”的分叉。
- 本轮继续完成的真实实现：
  - `LifeOS/packages/server/test/reintegrationApi.test.ts` 新增 websocket + follow-up list 联动收敛测试，锁定同组两条 action 在 accept 后生成、随后只 approve/dispatch 第一条时，websocket 推送与后续 list 读到的 grouped 状态保持一致。
  - 该测试直接覆盖 settings grouped governance 对事件顺序最敏感的一段链路：accept 先广播两条 `pending_review`，随后 approve 第一条、approve 第二条、再 dispatch 第一条，最终 filtered ready list 与 follow-up 总表都必须收敛为“1 条 approved+dispatched、1 条 approved+not_dispatched”，而不是被瞬时 websocket 顺序带偏。
- 本轮继续完成的真实实现：
  - `LifeOS/packages/server/test/reintegrationApi.test.ts` 继续把同一 mixed-order 场景扩展到 dispatched filter，锁定 websocket 事件、ready filter、dispatched filter 与 full list 四者在同一 `sourceNoteId` 分组上的最终语义一致。
  - 这条测试进一步压缩 settings grouped governance 的隐性假设：不只“总表对”，而是“已派发筛选 / 待派发筛选 / 总表”都必须和 websocket 驱动后的最终组态收敛到同一事实源。
- 本轮继续完成的真实实现：
  - `LifeOS/packages/server/test/reintegrationApi.test.ts` 新增 same-status execution filter 收敛测试，锁定同组两条 action 在最终 dispatch 到相同 `executionStatus` 时，按该 status 过滤得到的结果不会漏掉任一 action。
  - 该测试直接覆盖 grouped settings 一个容易被忽视的边界：当多条 action 收敛到同一终态时，executionStatus filter 必须与 full list 保持同一成员集合，而不是默认一条一条地命中。
- 当前未完成项：
  - 当前 reintegration review 仍挂在 `SettingsView.vue` 里，适合作为 admin 入口，但还不是独立的治理控制面。
  - web 侧仍没有前端交互测试设施；当前 grouped governance 的显示/启用语义主要依赖 server contract test 与 web build 做回归保护。
- 下一步建议：
  - 若继续补验证，下一步优先继续在 `reintegrationApi.test.ts` 里补 accept/approve/dispatch 串联后的最终组状态收敛，减少 settings grouped governance 对瞬时事件顺序的隐性假设。
  - 若继续做实现，优先考虑引入最小前端测试设施，而不是回到低边际的 UI 微调。
- 本轮选择依据：前两轮已经锁住了 accept/approve/dispatch 的 websocket 刷新，但 settings 最终展示仍取决于后续 list 结果；因此先补 dispatch 后 list 收敛这条 contract，比继续做事件层微补强更贴近真实界面依赖。
- 本轮选择依据：`vision/01-当前进度/LifeOnline 第一阶段项目开发任务书（进度对齐正式版）.md` 要求第一阶段优先让治理链路可记录、可查看、可解释，而不是继续扩张高风险执行面；因此优先补能直接降低扫描成本的保守筛选，而不是新接口。
- 当前代码现实：Settings 中 grouped governance 已经有 pending-only quick filter 与组级 approve / dispatch；继续补 dispatch-ready-only filter，能更快聚焦“已经获得执行资格但尚未真正下发”的 PR6 分组，且不改变任何治理判定。
- 本轮选择依据：`vision/01-当前进度/LifeOnline 第一阶段项目开发任务书（进度对齐正式版）.md` 明确要求后续在保守边界内继续 review-backed、可解释、可审计的小步推进，而不是夸大成完整产品化系统。
- 当前代码现实：PR6 中 `accepted review` 判定与 signal 映射此前同时散落在 planner / executor；这轮做的是局部收束，不改变治理边界，不扩新对象面。
- 延续同一方向，本轮再把 terminal reintegration hook 中的 record 输入组装压回 `feedbackReintegration.ts`，继续减少 `workerTasks.ts` 内联规则拼装。
- 约束保持不变：不得绕过 review；不得把 continuity 当普通输出；不得扩成通用化大改。
- 已完成验证：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/feedbackReintegration.test.ts` 通过，42/42。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过。
  - 本轮新增的 signal helper 收口完成后，已再次运行同一条 reintegration 定向测试与 server build，确认无回归。
- 当前未完成项：
  - 还没有把这轮变更直接提交 git commit。
  - Claude/token 状态是否已经恢复到能稳定产出可消费结果，仍未重新确认。
- 下一步建议：
  - 若继续沿 PR6 保守推进，优先检查 `feedbackReintegration.ts` / `continuityIntegrator.ts` 与 PR6 promotion 规则之间是否还存在可进一步集中但不扩 scope 的重复 target/kind 语义。
  - 若没有新重复点，再回到更高价值的真实 coverage 缺口，而不是继续为了“更干净”做纯形式抽象。
- 本轮继续完成的真实实现：
  - `LifeOS/packages/web/package.json` 引入最小 web 测试脚本 `pnpm --filter web test`，并增加 `vitest` 依赖，补上此前完全缺失的前端测试入口。
  - `LifeOS/packages/web/src/utils/soulActionGroups.ts` 新增 grouped soul-action 纯函数，把 `SettingsView.vue` 中 `soulActionGroupQuickFilterLabel`、`soulActionGroupCount`、`soulActionGroups`、`soulActionGroupQuickFilterStats` 的核心语义抽离为可直接测试的最小 seam。
  - `LifeOS/packages/web/src/views/SettingsView.vue` 改为复用这组纯函数，保持现有 UI 行为不变，但不再把 grouped governance 规则内联死在单个大视图里。
  - `LifeOS/packages/web/src/utils/soulActionGroups.test.ts` 新增 5 条最小前端语义测试，覆盖分组计数、`pending_only` 过滤、`dispatch_ready_only` 过滤、按 reintegration 时间排序，以及 filter label/stats 文案一致性。
- 本轮验证补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test` 通过，2 files / 20 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 本轮继续完成的真实实现补充：
  - `LifeOS/packages/web/src/components/SoulActionGovernancePanel.test.ts` 再补 2 条空态 / loading 态 DOM 断言，分别锁定加载中提示与空列表提示文案。
  - 这样 grouped governance panel 在“正常列表 / 收起 / 无数据 / 加载中”几种核心显示模式上都已有直接测试保护。
- 当前未完成项：
  - 还没有覆盖空态下除 `refresh` 外的更多交互表现。
  - 还没有覆盖 `SettingsView` 父层接住这些事件后的联动刷新链路。
  - 本轮 web 变更尚未提交 git commit。
- 下一步建议：
  - 若继续沿同一主线推进，优先评估是否值得补一条 `SettingsView` 级最小联动测试，验证父层把状态与 handler 正确接到 `SoulActionGovernancePanel`。
  - 若保持当前低成本策略，也可以继续只在 panel 组件层补少量高价值显示/交互断言。
- 本轮继续完成的真实实现：
  - 新增 `LifeOS/packages/web/src/views/SettingsView.test.ts`，为 `SettingsView.vue` 补上最小父层联动测试，直接挂载真实 view 并校验 grouped governance panel 初始 props 是否正确下发。
  - 同一测试文件再补一条 child -> parent round-trip 断言，锁定 `SoulActionGovernancePanel` 发出的 `update:filterStatus`、`update:executionFilter` 与 `refresh` 事件会回到父层并以更新后的过滤参数调用 `fetchSoulActions()`。
  - 为了让这条 view 级测试稳定落地，测试里补了最小 `localStorage` stub，并继续只 mock 与本轮目标无关的 API/composable 依赖，没有扩大到整页端到端测试。
- 本轮验证补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test` 通过，3 files / 22 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项补充：
  - 还没有覆盖 `SettingsView` 中 websocket 驱动的 grouped governance 自动刷新。
  - 还没有覆盖父层 approve-group / dispatch-group handler 与 panel emit 之间的调用链。
  - 本轮 web 变更仍未提交 git commit。
- 下一步建议补充：
  - 若继续沿这条最小前端回归主线推进，优先补一条 `SettingsView` 级 websocket/update 驱动测试，确认 `soul-action-updated` 事件会同时刷新 reintegration records 与 soul actions。
  - 若继续补父层交互，则优先覆盖 approve-group / dispatch-group emit 到父层 handler 的调用链，而不是回到低边际的纯展示微调。
- 本轮继续完成的真实实现补充：
  - `LifeOS/packages/web/src/views/SettingsView.test.ts` 再补 1 条 websocket 驱动测试，直接派发 `ws-update` / `soul-action-updated` 事件，锁定 `SettingsView.vue` 会刷新 reintegration records 与 soul actions，而不会错误触发 worker task 刷新。
  - 同一测试文件顺手收口了 `mountSettingsView()` helper 与 `afterEach` 中的 global cleanup，让这组 view 级测试在新增 document listener 场景下不会互相串扰。
- 本轮验证补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test` 通过，3 files / 23 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项再补充：
  - 还没有覆盖父层 approve-group / dispatch-group handler 与 panel emit 之间的调用链。
  - 还没有覆盖 `worker-task-updated` 事件下 workerTasks / reintegration / soulActions 的联动刷新分支。
  - 本轮 web 变更仍未提交 git commit。
- 下一步建议再补充：
  - 若继续沿同一主线推进，下一步优先补 `approve-group` / `dispatch-group` 的父层调用链测试，直接锁定批量 approve/dispatch 与刷新行为。
  - 若继续补 websocket 分支，则再加一条 `worker-task-updated` 事件测试，覆盖 `loadWorkerTasks()` 也会被联动触发的路径。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/views/SettingsView.test.ts` 新增 2 条父层 handler coverage，直接通过 `SoulActionGovernancePanel` 的 `approve-group` / `dispatch-group` emit 驱动 `SettingsView.vue` 的批量 approve / dispatch 路径。
  - 新增断言锁定批量 approve 会按 pending action 调用 `approveSoulAction()`，批量 dispatch 会遍历整组 ready actions 调用 `dispatchSoulAction()`，并在成功后刷新对应的 soul-action / reintegration 列表。
  - 这次继续保持 view 级最小回归面，只验证父层接线与刷新行为，不引入更重的端到端 harness。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过，5 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test` 通过，3 files / 25 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项最后补充：
  - 还没有覆盖 `worker-task-updated` 事件分支下 `loadWorkerTasks()` 与 grouped governance 刷新同时发生的路径。
  - 还没有覆盖单条 `approve-action` / `dispatch-action` 在父层成功/失败提示上的 view 级断言。
  - 本轮 web 变更仍未提交 git commit。
- 下一步建议最后补充：
  - 若继续沿这条主线推进，优先补 `worker-task-updated` websocket 分支测试，锁定 `SettingsView.vue:1584` 与 `SettingsView.vue:1590` 的联合刷新语义。
  - 然后补单条 action handler 的成功/失败 view 级断言，进一步锁住 message 与 refresh 行为。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/views/SettingsView.test.ts` 新增 `worker-task-updated` websocket 分支测试，直接派发 `ws-update` 事件，锁定 `SettingsView.vue` 会同时刷新 `workerTasks`、`reintegrationRecords` 与 `soulActions`，且不会误触发 schedule 刷新。
  - 这次继续只补最窄的 view 级回归面，直接对齐当前 grouped governance 主线的剩余真实缺口，不扩展到新的 UI 功能或更重的端到端 harness。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过，3 files / 26 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项再补充：
  - 还没有覆盖单条 `approve-action` / `dispatch-action` 在父层成功/失败提示上的 view 级断言。
  - 本轮 web 变更仍未提交 git commit。
- 下一步建议再补充：
  - 若继续沿同一主线推进，优先补单条 action handler 的成功/失败提示与 refresh 行为，进一步锁住 `SettingsView` 父层治理接线。
  - 若本轮就收口，也可以直接提交当前 web 测试增量，保持 grouped governance 主线连续提交。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/views/SettingsView.test.ts` 新增 4 条单条 `approve-action` / `dispatch-action` 父层断言，分别覆盖成功提示、失败提示、成功后 refresh 行为，以及失败时不应误刷新相关列表。
  - `LifeOS/packages/web/src/views/SettingsView.vue` 将 `loadSoulActions()` 收紧为可选 `preserveMessage` 模式，避免 approve / dispatch 成功提示在成功后立即 refresh 时被清空；这次是直接修正新测试揭示的真实父层反馈缺口，而不是纯测试适配。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过，3 files / 30 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项再补充：
  - 本轮 web 变更仍未提交 git commit。
- 下一步建议再补充：
  - 若继续沿同一条高价值主线推进，优先检查 `SettingsView` 父层 message / reason 文案里是否还在直接拼接 `sourceNoteId`，是否需要最小范围切到显式 reintegration source 标签，继续减少用户可见层的语义歧义。
  - 若本轮就收口，也可以直接提交当前 governance panel 的 source 语义投射增量，把 helper 层已收口的 `sourceReintegrationId` 真正显示到 UI。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/components/SoulActionGovernancePanel.vue` 将组级主标签从裸 `sourceNoteId` 调整为显式 `Reintegration {{ group.sourceNoteId }}`，并在 group meta 中补充 `Source note: {{ group.reintegrationRecord.sourceNoteId }}`，把“分组来源是 reintegration record、原始 note 是另一层事实源”真正投射到用户可见层。
  - `LifeOS/packages/web/src/components/SoulActionGovernancePanel.test.ts` 同步切到更贴近当前 shared/server contract 的 promotion fixture（不同 `sourceNoteId`、相同 `sourceReintegrationId`），并新增 UI 断言锁定 panel 展示 reintegration source label，同时不再误泄漏单条 promotion action 的内部 note-level grouping key。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/components/SoulActionGovernancePanel.test.ts` 通过；Vitest 合计 9 files / 110 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
  - 仍有 Node engine warning：包声明要求 `>=20 <21`，当前环境是 `v25.8.1`，但本轮测试与构建结果均通过。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/views/SettingsView.vue` 将单条 dispatch 成功提示继续收紧为直接消费 `DispatchSoulActionResponse.task.taskType`，在已有 workerTaskId 基础上补充本地化 task label，避免 web 侧只展示 ID 而没有落地 shared/server 已锁住的 task contract。
  - `LifeOS/packages/web/src/views/SettingsView.test.ts` 同步把单条 dispatch 成功提示与两条 websocket retention 断言更新为包含 `人格快照更新` label，直接锁住 success message 在初次 dispatch、`worker-task-updated` refresh、`soul-action-updated` refresh 三条路径下都持续消费该 contract。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过。
- 当前未完成项再补充：
  - 本轮 web 变更仍未提交 git commit。
- 下一步建议再补充：
  - 若继续沿同一主线推进，可直接提交这条 web/shared contract 收敛增量；若还想再扩验证，再补一轮 `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build`。
  - 若还要继续补一轮，再评估是否值得补单条 action loading/disabled 态在父层往返中的 view 级断言。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/components/SoulActionGovernancePanel.test.ts` 新增 3 条按钮状态断言，覆盖单条 action 处理中时 approve/dispatch 双按钮禁用与 `处理中...` 文案、pending/approved 混合组内 approve/dispatch 各自启停条件，以及已完成 action 不应再次派发。
  - 这次继续收敛在现有 grouped governance 主线上，只补真正减少误操作风险的最小 DOM 级保护，不新增接口、不改 contract，也不扩 UI 范围。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/components/SoulActionGovernancePanel.test.ts` 通过，3 files / 33 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项再补充：
  - 本轮 web 变更仍未提交 git commit。
- 下一步建议再补充：
  - 若继续沿同一主线推进，可直接提交当前按钮状态回归补强。
  - 若还要继续补一轮，可评估 `SettingsView` 父层是否还值得补“操作进行中 actionId 正确透传到 panel” 的 view 级断言。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/views/SettingsView.test.ts` 新增 2 条 in-flight 断言，分别用 deferred promise 锁定单条 approve / dispatch 进行中时，`SettingsView` 会把当前 `actionId` 透传给 `SoulActionGovernancePanel`，并在异步完成后正确回落为 `null`。
  - 这次继续只补最窄的父层接线回归面，不新增 UI 功能，也不改治理规则；目标是把前一轮组件层按钮禁用语义，与父层真实 in-flight 状态来源正式接上。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过，3 files / 35 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项再补充：
  - 本轮 web 变更仍未提交 git commit。
- 下一步建议再补充：
  - 若继续沿同一主线推进，可直接提交当前 view 级 in-flight 状态回归补强。
  - 若还要继续补一轮，可评估 groupActionId / groupDispatchId 的父层 in-flight 透传是否还值得锁一条 view 级断言。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/views/SettingsView.test.ts` 新增 2 条 group in-flight 断言，分别用 deferred promise 锁定 `approve-group` / `dispatch-group` 进行中时，`SettingsView` 会把当前 `groupActionId` / `groupDispatchId` 透传给 `SoulActionGovernancePanel`，并在异步完成后正确回落为 `null`。
  - 这次继续只补最窄父层接线回归面，把 panel 组件里已经存在的 group-level disabled/processing 语义，与父层真实 in-flight 状态来源正式锁在一起。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过，9 files / 110 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/views/SettingsView.vue` 将手动 Inbox 整理成功提示从泛化文案改为直接消费 `classifyInbox()` 返回的 `WorkerTask` contract，统一复用 `workerTaskActionMessage('created', task)`。
  - `LifeOS/packages/web/src/views/SettingsView.test.ts` 新增一条 view 级回归，锁定手动 Inbox 整理入口在创建任务后会展示 `worker-task-classify · Inbox 整理 · 等待执行 · LifeOS`，并在后续 `worker-task-updated` websocket 刷新后继续保留该提示。
  - 这次补的是 `SettingsView` 里最后一个明显还停留在泛化成功提示的 worker-task 创建入口，避免同页不同入口对同一 typed contract 的投射继续分叉。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过，9 files / 110 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
  - 仍有 Node engine warning：包声明要求 `>=20 <21`，当前环境是 `v25.8.1`，但本轮测试与构建结果均通过。
- 当前未完成项再补充：
  - 本轮 web 变更仍未提交 git commit。
- 下一步建议再补充：
  - 若继续沿同一主线推进，可直接转向 server 侧剩余的事实源一致性缺口，优先检查 migration / list / filter 读路径里是否还把 legacy `sourceNoteId = reint:...` 当作主身份继续外溢。
- 本轮继续完成的真实实现：
  - `LifeOS/packages/server/src/db/client.ts` 收紧 `soul_actions` 迁移逻辑：对 `create_event_node` / `promote_event_node` / `promote_continuity_record` 这类 PR6 promotion action，不再把 legacy 行的 `source_note_id` 重写成 action id，而是保留原始 note 维度，仅把 reintegration 身份规范化写入 `source_reintegration_id`。
  - 这样迁移后的持久化语义与当前运行时 `createOrReuseSoulAction()` / `getSoulActionByIdentityAndKind()` 已集中出的规则对齐：显式 `sourceReintegrationId` 是主身份，legacy `sourceNoteId = reint:...` 只作为兼容 fallback，不再把 note/source 两个维度混成同一个 action id。
  - `LifeOS/packages/server/test/db.test.ts` 同步收紧断言，确认 legacy PR6 promotion 迁移后会保留 `source_note_id = reint:legacy-pr6-record`，并新增一条显式 `source_reintegration_id` 旧行迁移测试，锁定迁移不会覆盖已存在的 note 维度。
- 本轮验证补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/db.test.ts test/feedbackReintegration.test.ts` 通过，59/59。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过（当前环境仍提示 Node engine `>=20 <21`，但构建成功）。
- 当前未完成项补充：
  - 还未继续检查 API/list/filter 层是否仍有把 legacy `sourceNoteId = reint:...` 当主语义暴露给上层的读路径。
- 下一步建议补充：
  - 优先沿同一事实源主线检查 `listSoulActions()` / API filter 语义与 web 端展示，确认上层读取不会把 legacy fallback 误当成主身份字段继续扩散。
  - 若继续沿“worker task contract 直接投射到 UI”这条主线推进，优先检查 `SettingsView` / 其他入口里是否还存在少数泛化 worker-task 成功提示没有走统一 helper；若没有，就该直接提交当前最小收敛增量，而不是继续做对称性补强。
  - 由于仓库里已有并行未提交的 worker/CLAUDE 调整，下一轮若要提交，先分辨是否需要拆分提交范围，避免把无关脚本和当前产品代码改动混在一起。
- 本轮继续完成的真实实现：
  - `LifeOS/packages/server/src/soul/soulActions.ts` 把 `create_event_node` 也纳入与 PR6 promotion 相同的 reintegration identity 规则：`getSoulActionIdentityKey()`、`getSoulActionByIdentityAndKind()`、`createOrReuseSoulAction()` 现在都会优先用 `resolveSoulActionSourceReintegrationId()` 统一归一到 reintegration 身份，而不是仅对两类 promotion action 特判。
  - 这样 `create_event_node` 的运行时 create/reuse 语义终于与 `db` migration、`dispatchApprovedSoulAction()` 最终执行口、以及 `pr6PromotionExecutor.ts` 的 reintegration source 解析保持一致，避免 legacy `sourceNoteId = reint:...` 输入在不同 actionKind 下再次分叉。
  - `LifeOS/packages/server/test/feedbackReintegration.test.ts` 新增 `create_event_node` legacy source identity 回归，锁定同一 reintegration source 的重复建单会复用同一个 `soul:create_event_node:reint:...` action，并正确回填 `sourceReintegrationId`。
- 本轮验证补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/feedbackReintegration.test.ts test/db.test.ts` 通过，60/60。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过（当前环境仍提示 Node engine `>=20 <21`，但构建成功）。
- 当前未完成项补充：
  - 还没有继续确认 `/api/soul-actions` 的读路径在 `create_event_node` 这类 legacy 兼容输入下，是否需要额外提供更显式的主身份过滤语义。
- 下一步建议补充：
  - 优先检查 `listSoulActionsHandler()` / `listSoulActions()` 是否值得在 legacy `reint:` note 过滤场景下自动归一到 `sourceReintegrationId`，避免 API 读路径继续暴露“写路径已归一、查路径仍按 legacy note 维度猜”的不对称行为。
- 本轮继续完成的真实实现：
  - `LifeOS/packages/server/src/soul/soulActions.ts` 继续收紧 `listSoulActions()`：当调用方只传 `sourceNoteId=reint:...` 时，会自动把 `create_event_node` / `promote_event_node` / `promote_continuity_record` 这类 reintegration-identity action 一并按 `source_reintegration_id` 命中，而不再只按 legacy `source_note_id` 猜测。
  - `LifeOS/packages/server/src/api/handlers.ts` 同步把 `/api/soul-actions` 返回的 filters 归一化：如果这次查询实际命中的是 reintegration identity，会返回 `filters.sourceReintegrationId`，并清掉误导性的 `filters.sourceNoteId`，让 API contract 对“主身份”表达保持一致。
  - `LifeOS/packages/server/test/reintegrationApi.test.ts` 新增 API 回归，锁定 legacy `sourceNoteId = reint:...` 查询会正确返回 `create_event_node` 结果，并把响应 filters 规范化到 `sourceReintegrationId`。
- 本轮验证补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/reintegrationApi.test.ts test/feedbackReintegration.test.ts test/db.test.ts` 通过，93/93。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过（当前环境仍提示 Node engine `>=20 <21`，但构建成功）。
- 当前未完成项补充：
  - 还没有继续检查 web 端是否有地方会把 `ListSoulActionsResponse.filters.sourceNoteId` 当作 reintegration group key 继续缓存或展示。
- 下一步建议补充：
  - 优先检查 `packages/web/src/api/client.ts` 与 `SettingsView` 里 soul-action filter 状态的消费方式，确认这次 API filter 归一化不会在前端形成新的字段假设；若消费端已经天然兼容，就可以开始整理并提交这一段 server 事实源一致性收敛改动。
- 本轮继续完成的真实实现：
  - `LifeOS/packages/web/src/api/client.ts` 现在会在请求前就把 legacy `sourceNoteId = reint:...` 归一为 `sourceReintegrationId`，避免 web 端继续把兼容 fallback 当成主过滤字段发给 `/api/soul-actions`。
  - `LifeOS/packages/web/src/api/client.test.ts` 新增回归，锁定 `fetchSoulActions({ sourceNoteId: 'reint:...' })` 实际请求的是 `?sourceReintegrationId=...`，从 web 入口与刚收紧的 server contract 保持一致。
  - 这次没有继续深挖 SettingsView 同类 retention/filter 补强，而是把真正的 client->server 查询 contract 先统一，减少新的读路径分叉继续产生。
- 本轮验证补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/api/client.test.ts` 通过；Vitest 合计 9 files / 116 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项补充：
  - 还没有继续确认是否存在别的 web 入口会手工构造 `/api/soul-actions?sourceNoteId=reint:...`，绕过 `fetchSoulActions()`。
- 下一步建议补充：
  - 优先全局检查 web 端是否还有绕过 typed client 的 soul-action 请求；如果没有，就可以开始整理当前这组 server+web 事实源一致性改动并考虑提交。
- 本轮继续完成的真实实现：
  - `LifeOS/packages/web/src/utils/soulActionGroups.ts` 把 grouped governance 的分组键字段从误导性的 `sourceNoteId` 正式更名为 `groupKey`，明确这里承载的是“按 reintegration 优先、note 次之”的分组主键，而不是原始 source note 本身。
  - `LifeOS/packages/web/src/components/SoulActionGovernancePanel.vue`、`LifeOS/packages/web/src/views/SettingsView.vue` 同步把 group-level key、collapse id、in-flight id 与 handler 形参全部切到 `groupKey`，避免组件/父层继续把 reintegration group key 误传播成 `sourceNoteId` 语义。
  - `LifeOS/packages/web/src/utils/soulActionGroups.test.ts`、`LifeOS/packages/web/src/views/SettingsView.test.ts` 同步更新断言，锁定这次命名收口不改变现有治理行为，只修正 contract-to-UI 与 view/component 接线层的错误语义。
- 本轮验证补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/utils/soulActionGroups.test.ts src/components/SoulActionGovernancePanel.test.ts src/views/SettingsView.test.ts` 通过；Vitest 合计 9 files / 116 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项补充：
  - 这组 web 命名/投射收口改动还未单独提交。
- 下一步建议补充：
  - 这批 web 改动已经形成独立变更集，可与无关 `CLAUDE.md` / `lifeonline-claude-worker-v2.sh` 继续隔离后直接单独提交。
- 本轮继续完成的真实实现：
  - `LifeOS/packages/web/src/views/SettingsView.vue` 把 reintegration accept / 手动规划成功提示里的硬编码英文 `promotion actions` 收紧为中文 `候选动作`，让这条用户可见主路径文案与第一阶段“动作候选 → Gate / Review / Dispatch”语义保持一致，不再把 promotion implementation term 直接暴露到 UI。
  - 同文件里单条 soul-action approve / defer / discard 成功提示也改为直接消费 `promotionActionLabel(action.actionKind)`，让用户看到的是“生成 Event Node 已批准 / 已延后 / 已丢弃”这类具体动作，而不是泛化的 `Soul action 已...`。
  - `LifeOS/packages/web/src/views/SettingsView.test.ts` 同步更新回归断言，锁定这次文案收口在 websocket refresh 保留路径和单条治理路径上都成立。
- 本轮验证补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过；Vitest 合计 9 files / 116 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项补充：
  - 当前产品代码工作树未新增别的主线脏改动；仍只剩与本轮无关的 `CLAUDE.md` 与 `lifeonline-claude-worker-v2.sh`。
- 下一步建议补充：
  - 下一轮应继续转向新的 server/web/shared contract gap 或新的事实源一致性问题，不再回到 grouped governance 同类文案/retention 补强。
- 本轮继续完成的真实实现：
  - `LifeOS/packages/web/src/views/SettingsView.test.ts` 里 `acceptReintegrationRecord()` 的 mocked response 字段从错误的 `record` 对齐回 shared/server 已正式暴露的 `reintegrationRecord`，补上了一个真实的 web/shared contract gap，而不是继续做同类 UI 微调。
  - 这次修的是测试夹具对共享 contract 的漂移：运行时代码一直在消费 `result.reintegrationRecord`，而测试 mock 却偷偷返回 `record` 仍能靠局部路径幸存，后续如果继续扩同一 API 的前端逻辑，很容易在测试里掩盖真实 contract 断裂。
  - `LifeOS/packages/web/src/views/SettingsView.vue` 与前一轮文案收口改动一起保留，确认这条 accept/planning 主路径在共享 contract 名称正确后仍然稳定通过。
- 本轮验证补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts src/api/client.test.ts` 通过；Vitest 合计 9 files / 116 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项补充：
  - 这轮 contract 对齐与前一轮 SettingsView 文案收口仍未单独提交。
- 下一步建议补充：
  - 可将当前 `SettingsView` 文案收口 + reintegration accept response contract 对齐作为同一批 web 主路径修正提交；之后再转向新的 server/web/shared contract gap 或事实源一致性问题。
单条 action loading/disabled 态在父层往返中的 view 级断言。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/components/SoulActionGovernancePanel.test.ts` 新增 3 条按钮状态断言，覆盖单条 action 处理中时 approve/dispatch 双按钮禁用与 `处理中...` 文案、pending/approved 混合组内 approve/dispatch 各自启停条件，以及已完成 action 不应再次派发。
  - 这次继续收敛在现有 grouped governance 主线上，只补真正减少误操作风险的最小 DOM 级保护，不新增接口、不改 contract，也不扩 UI 范围。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/components/SoulActionGovernancePanel.test.ts` 通过，3 files / 33 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项再补充：
  - 本轮 web 变更仍未提交 git commit。
- 下一步建议再补充：
  - 若继续沿同一主线推进，可直接提交当前按钮状态回归补强。
  - 若还要继续补一轮，可评估 `SettingsView` 父层是否还值得补“操作进行中 actionId 正确透传到 panel” 的 view 级断言。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/views/SettingsView.test.ts` 新增 2 条 in-flight 断言，分别用 deferred promise 锁定单条 approve / dispatch 进行中时，`SettingsView` 会把当前 `actionId` 透传给 `SoulActionGovernancePanel`，并在异步完成后正确回落为 `null`。
  - 这次继续只补最窄的父层接线回归面，不新增 UI 功能，也不改治理规则；目标是把前一轮组件层按钮禁用语义，与父层真实 in-flight 状态来源正式接上。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过，3 files / 35 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项再补充：
  - 本轮 web 变更仍未提交 git commit。
- 下一步建议再补充：
  - 若继续沿同一主线推进，可直接提交当前 view 级 in-flight 状态回归补强。
  - 若还要继续补一轮，可评估 groupActionId / groupDispatchId 的父层 in-flight 透传是否还值得锁一条 view 级断言。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/views/SettingsView.test.ts` 再新增 2 条 group-level in-flight 断言，分别用 deferred promise 锁定批量 approve / dispatch 进行中时，`SettingsView` 会把 `groupActionId` / `groupDispatchId` 正确透传给 `SoulActionGovernancePanel`，并在异步完成后回落为 `null`。
  - 这次继续只补最窄的父层状态接线回归面，把前一轮单条 action 的 in-flight 语义补齐到组级 quick action，不新增 UI 功能，也不改变 approve / dispatch 分离边界。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过，3 files / 37 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项再补充：
  - 本轮 web 变更仍未提交 git commit。
- 下一步建议再补充：
  - 若继续沿同一主线推进，可直接提交当前 group-level in-flight 状态回归补强。
  - 若还要继续补一轮，可评估 group quick action 的成功/失败提示在 view 级是否还值得补更细的中途态断言。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/views/SettingsView.test.ts` 再新增 4 条 group quick action 反馈断言，分别覆盖 approve-group / dispatch-group 的成功提示、失败提示，以及成功后刷新 / 失败时不误刷新相关列表。
  - 这次继续只补最窄的父层反馈回归面，把上一轮 group-level in-flight 状态接线，进一步补到“完成后用户能看到什么、失败时不会误刷什么”的可回归语义。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过，3 files / 41 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项再补充：
  - 本轮 web 变更仍未提交 git commit。
- 下一步建议再补充：
  - 若继续沿同一主线推进，可直接提交当前 group quick action 反馈回归补强。
  - 若还要继续补一轮，可评估 grouped governance filter / quick filter 组合切换在 `SettingsView` 父层是否还值得补一条 round-trip 断言。
- 本轮继续完成的真实实现：
  - `LifeOS/packages/server/src/soul/types.ts` 把 PR6 promotion 里对来源 reintegration id 的解析规则收束成 `resolveSoulActionSourceReintegrationId()`，统一处理“优先显式 `sourceReintegrationId`，否则才回退 legacy `sourceNoteId = reint:...`”的来源判定。
  - `LifeOS/packages/server/src/soul/pr6PromotionExecutor.ts` 改为复用该 helper，而不再内联 `startsWith('reint:')` 逻辑，避免后续 planner / executor / 测试各自复制这条历史兼容规则。
  - `LifeOS/packages/server/test/feedbackReintegration.test.ts` 新增 helper 级回归，锁定 explicit / legacy fallback / no-source 三种来源解析结果，并保留既有 PR6 event + continuity promotion 主路径测试。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/feedbackReintegration.test.ts` 通过，53 tests / 53 pass。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过。
- 当前未完成项再补充：
  - 这条 legacy 兼容来源解析规则现在只在 server 内部收束；若未来要外提到 shared contract，需先确认 web 是否真的需要消费这层历史兼容语义。
  - 本轮 server 改动待提交 git commit。
  - `LifeOS/packages/web/src/views/SettingsView.test.ts` 同步补一条 view 级断言，锁定 promotion projections 初始渲染时会展示 `Reintegration record-ready`；同时顺手把已迁移的 classify-inbox 按钮文案断言对齐到当前真实入口 `手动整理 Inbox（创建任务）`，消除一条已有测试漂移。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过，9 files / 110 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
  - 仍有 Node engine warning：包声明要求 `>=20 <21`，当前环境是 `v25.8.1`，但本轮测试与构建结果均通过。
- 当前未完成项再补充：
  - `SettingsView.vue` 里 soul-action approve / batch-approve reason 文案仍直接拼接 `sourceNoteId`，若继续沿同一条 contract-to-UI 主线推进，可再评估是否要把这些内部 source key 收紧为显式 reintegration source 标签。
  - 本轮 web 变更仍未提交 git commit。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/views/SettingsView.test.ts` 新增 2 条 quick-filter round-trip 断言，覆盖 `update:quick-filter` 后 `quickFilter` / `quickFilterLabel` / `quickFilterStats` / `groups` 的联动收敛，以及 quick filter 与 governance / execution filter 组合切换后 refresh 仍保持同一父层状态。
  - 这次继续只补最窄的父层状态回归面，不新增功能、不改 contract；目标是把 grouped governance 面板中最后一段仍未在 view 级锁住的筛选组合语义补成可回归保护。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过，3 files / 43 tests。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/server/test/reintegrationApi.test.ts` 新增 `mixed worker-host dispatch response tasks stay aligned with websocket events and filtered follow-up worker-task lists` contract test，把真正走 worker host 的 mixed-order dispatch 场景进一步收紧到三方一致：`DispatchSoulActionResponse.task`、`worker-task-updated` 事件、以及按 `sourceNoteId + taskType + worker + status` 过滤后的 `/api/worker-tasks` follow-up 子表必须对齐。
  - 这次继续保持保守边界，只覆盖 `extract_tasks` / `update_persona_snapshot` 两类真实会产生 worker task 的 actionKinds，不把 promotion dispatch 错误混入 worker-task contract。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/reintegrationApi.test.ts` 通过，25/25。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过（当前环境仍提示 Node engine `>=20 <21`，但构建完成）。
- 当前未完成项再补充：
  - 本轮 server 测试增量尚未提交 git commit。
- 下一步建议再补充：
  - 若继续沿同一主线推进，优先检查这条三方对齐测试是否还需要再补 mixed status / repeated websocket 顺序边界；若没有新的真实 contract gap，就直接提交当前 server 增量。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/server/test/reintegrationApi.test.ts` 继续收紧 `dispatch websocket updates stay aligned with follow-up filtered lists for grouped settings refresh`，把 grouped dispatch websocket 场景从“websocket 只校验 source 字段，filtered list 只校验 id / executionStatus”提升到三方 payload 对齐：`DispatchSoulActionResponse.soulAction`、`soul-action-updated` 事件、以及按 `sourceReintegrationId + governanceStatus + executionStatus` 过滤后的 `/api/soul-actions` 子集，现在共同锁住 `id / sourceNoteId / sourceReintegrationId / governanceStatus / executionStatus`，并补上 filtered response 自身的 filter 字段断言。
  - 这次补的是新的 grouped dispatch websocket contract gap，直接保护 dispatch websocket 事件与 grouped follow-up API 事实源不会在 source / status 字段上漂移；不是继续做低边际 UI 对称补强。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test --test-name-pattern "dispatch websocket updates stay aligned with follow-up filtered lists for grouped settings refresh" test/reintegrationApi.test.ts` 通过，1/1。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/reintegrationApi.test.ts` 通过，37/37。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过（当前环境仍提示 Node engine `>=20 <21`，但构建完成）。
- 当前未完成项再补充：
  - 本轮 grouped dispatch websocket payload 对齐增量尚未提交 git commit。
- 下一步建议再补充：
  - 若验证通过，可继续检查 sequential approve / sequential dispatch websocket 用例里是否还有同类“事件和 filtered follow-up 没有 payload 级同场锁定”的空档；若没有新增真实缺口，就直接提交当前 server 增量。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项再补充：
  - 本轮 web 变更仍未提交 git commit。
- 下一步建议再补充：
  - 若继续沿同一主线推进，可直接提交当前 grouped governance filter round-trip 回归补强。
  - 若还要继续补一轮，可评估是否值得转去 server contract 层补 soul-action filter 组合收敛，而不是继续在 web view 层做低边际微补强。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/server/test/reintegrationApi.test.ts` 新增 2 条 soul-action filter convergence contract test：一条锁定 mixed group progress 下 `approved` 总子集等于 `ready(not_dispatched)` 与 `dispatched(current executionStatus)` 两个子集并集；另一条锁定 same-status dispatch 场景下 `approved` 列表与 executionStatus 子集保持同一成员集合。
  - 这次明确转回 server contract 层，直接保护 settings grouped governance 真正依赖的 API 事实源，避免继续停留在 web view 低边际微补强。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/reintegrationApi.test.ts` 通过，17/17。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/views/SettingsView.test.ts` 新增 1 条 worker-task cancel websocket retention 回归，锁定取消成功提示在 `worker-task-updated` 刷新后仍保持可见，与上一轮 retry retention 保持同级保护。
  - 这次没有再改运行时代码，只把当前 worker-task action feedback 主线最后一个同级缺口补成 view 级可回归断言，继续避免 `SettingsView` 与 `WorkerTaskDetail` 在 retention 保护上漂移。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/reintegrationApi.test.ts` 通过，14/14。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项再补充：
  - 本轮 server 变更仍未提交 git commit。
- 下一步建议再补充：
  - 若继续沿 grouped governance 主线推进，可直接提交当前 server filter convergence contract 补强。
  - 若还要继续补一轮，可评估是否值得把 websocket 推送后的 follow-up filter 收敛也补成同类 server contract 测试。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/components/PromotionProjectionPanel.vue` 将 projection 列表里的 `sourceReintegrationId` 裸值收紧为显式 `Reintegration {{ id }}` 标签，避免 promotion projection 继续把 reintegration source 当成无语义内部 ID 直接泄漏到用户可见层。
  - `LifeOS/packages/web/src/views/SettingsView.test.ts` 同步增加 projection 文案断言，并把 classify-inbox 用例从脆弱的首个 `.btn-ai` 选择器改为按真实按钮文案定位，修复因页面新增其他 AI 按钮导致的现有测试断点。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过，57 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
  - 当前环境仍有 Node engine warning：包声明要求 `>=20 <21`，实际为 `v25.8.1`，但本轮测试与构建均通过。
- 当前未完成项再补充：
  - 本轮 web 变更仍未提交 git commit。
- 下一步建议再补充：
  - 若继续沿当前高价值主线推进，优先转回新的 server/web/shared contract gap 或事实源一致性问题，不再继续做 grouped governance / SettingsView websocket/filter/retention 的同类对称补强。
  - 可优先检查 promotion dispatch 主路径上是否还有 `sourceReintegrationId` / `sourceNoteId` 语义混用未收口到 shared/server contract。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/server/test/reintegrationApi.test.ts` 新增 websocket + follow-up filter convergence contract test，锁定同组 action 在 dispatch 后收到 `soul-action-updated` 事件时，其 `executionStatus` 与随后 `approved + not_dispatched` / `approved + current executionStatus` 两个过滤列表的成员收敛保持一致。
  - 这次继续停留在 server contract 事实源，不扩 UI，不改 runtime 行为，直接补 settings grouped governance 最依赖的“事件驱动刷新后过滤结果仍可信”回归保护。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/reintegrationApi.test.ts` 通过，15/15。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项再补充：
  - 本轮 server 变更仍未提交 git commit。
- 下一步建议再补充：
  - 若继续沿 grouped governance 主线推进，可直接提交当前 websocket follow-up filter convergence contract 补强。
  - 若还要继续补一轮，可评估 accept 阶段 websocket 广播后的 follow-up filtered list 是否也值得补成同类 contract。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/server/src/soul/pr6PromotionExecutor.ts` 将缺失 promotion 来源时的错误信息从过时的 `requires reintegration-record sourceNoteId` 收紧为 `requires sourceReintegrationId or reintegration-record sourceNoteId`，让 runtime 报错与当前 shared/server contract 的显式来源语义保持一致。
  - `LifeOS/packages/server/test/feedbackReintegration.test.ts` 新增 1 条最小单元测试，直接锁定当 promotion action 既没有 `sourceReintegrationId`、其 `sourceNoteId` 也不是兼容的 reintegration id 时，会返回更新后的显式 contract 错误，而不是继续把调用方引向旧的 note-id 语义。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/feedbackReintegration.test.ts` 通过，47/47。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过。
  - 当前环境仍有 Node engine warning：包声明要求 `>=20 <21`，实际为 `v25.8.1`，但本轮测试与构建均通过。
- 当前未完成项再补充：
  - promotion executor 仍保留 `sourceNoteId.startsWith('reint:')` 的兼容 fallback；若继续沿同一条 contract 收口主线推进，可再评估 server 侧哪些真实 dispatch 场景仍依赖这条兼容路径，而不是显式 `sourceReintegrationId`。
  - 本轮 server 变更待提交 git commit。
  - 这次继续停留在 server contract 事实源，不扩 UI，不改 runtime 行为，直接补 settings grouped governance 在 accept 即时刷新阶段最关键的过滤收敛保护。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/reintegrationApi.test.ts` 通过，16/16。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项再补充：
  - 本轮 server 变更仍未提交 git commit。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/server/src/db/schema.ts` 为 `soul_actions` 增加独立 `source_reintegration_id` 列；`LifeOS/packages/server/src/db/client.ts` 同步补上缺列重建迁移，并在旧 promotion 数据上把历史 `source_note_id` 回填到新列，避免既有库升级后丢失显式 reintegration 来源。
  - `LifeOS/packages/server/src/soul/soulActions.ts` 改为直接读写持久化的 `source_reintegration_id`，不再从 `source_note_id` 反推；`LifeOS/packages/server/test/feedbackReintegration.test.ts` 新增 round-trip 断言，并把几处手工插入的 promotion soul_action fixture 同步到新列，修正存储层 contract 变更后的测试夹具漂移。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/feedbackReintegration.test.ts` 通过，50/50。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过。
  - 当前环境仍有 Node engine warning：包声明要求 `>=20 <21`，实际为 `v25.8.1`，但本轮定向测试与构建均通过。
- 当前未完成项再补充：
  - `reintegrationPromotionPlanner.ts` / accept 返回链里仍把 `sourceNoteId = record.id` 当作主承载语义，`sourceReintegrationId` 虽然已独立持久化，但 planner/API 主路径还没完全切回“真实 source note + 显式 reintegration source”双字段分离。
  - 本轮 server 变更仍未提交 git commit。
- 下一步建议再补充：
  - 优先继续检查 promotion planner、accept API payload 与 related soul-action list 是否还能去掉 `sourceNoteId = record.id` 这一兼容主承载，直接把本轮刚补好的持久化双事实源真正推到 planner/API 主链。
  - 若没有更高价值的新缺口，也可以先提交当前这轮 server 根因修复，避免 `sourceReintegrationId` 存储层与运行时 contract 长时间继续分叉。
- 下一步建议再补充：
  - 若继续沿 grouped governance 主线推进，可直接提交当前 accept websocket follow-up filter convergence contract 补强。
  - 若还要继续补一轮，可评估 approve 阶段 websocket 广播后 follow-up filtered list 是否也值得补成同类 contract。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/server/test/reintegrationApi.test.ts:1584` 新增 approve websocket + follow-up filter convergence contract test，锁定单条 action 在 approve 后收到 `soul-action-updated` 事件时，其 `governanceStatus=approved` / `executionStatus=not_dispatched` 会与随后 `pending_review + not_dispatched`、`approved + not_dispatched` 两个过滤列表及 full list 成员收敛保持一致。
  - 这次继续停留在 server contract 事实源，不扩 UI、不改 runtime 行为，直接把 accept / approve / dispatch 三段 websocket 后续过滤收敛链补齐。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/reintegrationApi.test.ts` 通过，17/17。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项再补充：
  - 本轮 server 变更仍未提交 git commit。
- 下一步建议再补充：
  - 若继续沿 grouped governance 主线推进，可直接提交当前 approve websocket follow-up filter convergence contract 补强。
  - 若还要继续补一轮，可评估是否值得把 approve / dispatch 两阶段 websocket 收敛再压成更通用的 helper 断言，但优先级低于继续找新的事实源缺口。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/server/test/reintegrationApi.test.ts:1821` 新增 sequential approve websocket + grouped follow-up filter convergence contract test，锁定同组两条 action 依次 approve 时，每次 `soul-action-updated` 事件都会与后续 `pending_review + not_dispatched`、`approved + not_dispatched` 过滤列表以及 full list 成员变化保持一致；首条批准后是 1 pending + 1 approved，第二条批准后收敛为 0 pending + 2 approved。
  - 这次仍然只补 server contract 事实源，不扩 UI、不改 runtime 行为，进一步把 approve 阶段从“单条事件正确”补强到“组内顺序推进时的刷新收敛也正确”。
- 当前未完成项再补充：
  - 本轮 server 变更待提交 git commit。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/views/SettingsView.vue` 新增 `soulActionApprovalReasonLabel()`，把单条 approve 与批量 approve 提交给 API 的治理 reason 从直接拼接内部 `sourceNoteId` 收紧为优先使用显式 `Reintegration {sourceReintegrationId}`，仅在非 promotion action 时才回退到 `source note {sourceNoteId}`。
  - `LifeOS/packages/web/src/views/SettingsView.test.ts` 同步把 fixture 切到“不同 `sourceNoteId`、相同 `sourceReintegrationId`”的 promotion action 形态，并更新 3 处断言，锁定 settings 父层 approve reason 现在真正消费 shared/server 已暴露的 `sourceReintegrationId` 语义，而不是继续把 reintegration group key 误写成 note id。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过，9 files / 110 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
  - 当前环境仍有 Node engine warning：包声明要求 `>=20 <21`，实际为 `v25.8.1`，但本轮测试与构建均通过。
- 本轮继续完成的真实实现：
  - `LifeOS/packages/web/src/components/SoulActionGovernancePanel.vue` 把 shared/client 已存在但此前未消费的 `defer` / `discard` 治理动作最小投射到 web panel：对 `pending_review` 的单条 soul action 新增 `延后` / `丢弃` 按钮，并通过 `defer-action` / `discard-action` emit 回父层。
  - `LifeOS/packages/web/src/views/SettingsView.vue` 接上 `deferSoulAction()` / `discardSoulAction()` typed client，复用现有 source-label reason 生成逻辑与 `preserveMessage` 刷新策略，在不新增后端接口、不扩批量治理面的前提下，把这两个已有治理状态真正纳入 settings 主路径。
  - `LifeOS/packages/web/src/components/SoulActionGovernancePanel.test.ts` 与 `LifeOS/packages/web/src/views/SettingsView.test.ts` 同步补回归：锁定 panel 会发出 defer/discard emit，且 view 在成功/失败场景下分别显示正确提示、只在成功后刷新 soul-action 列表。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/components/SoulActionGovernancePanel.test.ts src/views/SettingsView.test.ts` 通过，9 files / 115 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项再补充：
  - 当前只开放了单条 defer / discard；若后续确需扩到组级操作，需要先确认真实治理需求，避免再走同类对称补强。
  - 本轮 web 变更待提交 git commit。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/server/test/feedbackReintegration.test.ts` 新增 1 条 explicit-source contract test，直接锁定当 promotion action 的 `sourceNoteId` 已经回到真实 note id 时，只要显式提供 `sourceReintegrationId`，`executePromotionSoulAction()` 仍会按 reintegration record 成功派发，不会错误回退到 `sourceNoteId.startsWith('reint:')` 的兼容路径。
  - 该测试同时断言生成的 `event_node` 保留 `sourceReintegrationId = reint:task-pr6-explicit-source`，并把真实原始 note id 投到 `sourceNoteId = note-original-source`，把“promotion 来源”和“原始 source note”两层事实源明确分开。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/feedbackReintegration.test.ts` 通过，48/48。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过。
  - 当前环境仍有 Node engine warning：包声明要求 `>=20 <21`，实际为 `v25.8.1`，但本轮测试与构建均通过。
- 当前未完成项再补充：
  - `pr6PromotionExecutor.ts` 的兼容 fallback 仍存在，但现在至少已有直接测试证明未来 planner 一旦把 `sourceNoteId` 真迁回 note id，显式 `sourceReintegrationId` 仍能维持 promotion dispatch 主路径。
  - 本轮 server 变更待提交 git commit。
- 下一步建议再补充：
  - 若继续沿 grouped governance 主线推进，可直接提交当前 sequential approve websocket filter convergence contract 补强。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/server/test/feedbackReintegration.test.ts` 新增 1 条 legacy-source fallback contract test，直接锁定当旧 promotion action 仍把 reintegration id 塞在 `sourceNoteId`、且 `sourceReintegrationId` 为空时，`executePromotionSoulAction()` 仍能继续走兼容路径成功派发，不会因后续收口显式字段而把旧数据主路径打断。
  - 该测试同时断言生成的 `continuity_record` 继续保留 `sourceReintegrationId = reint:task-pr6-legacy-source`，并把真实原始 note id 维持在 `sourceNoteId = note-legacy-original-source`，证明兼容旧 action 输入时仍能把两层事实源正确分开投射到 projection 对象。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/feedbackReintegration.test.ts` 通过，49/49。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过。
  - 当前环境仍有 Node engine warning：包声明要求 `>=20 <21`，实际为 `v25.8.1`，但本轮测试与构建均通过。
- 当前未完成项再补充：
  - promotion dispatch 现在同时有 explicit-source precedence 与 legacy fallback 两条直接测试保护，但 planner / API 返回链路里是否还存在继续把 `sourceNoteId = record.id` 当主语义的现实路径，仍值得下一轮继续排查。
  - 本轮 server 变更待提交 git commit。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/views/SettingsView.test.ts` 新增 1 条 worker-task create websocket retention 回归，锁定手动创建 OpenClaw worker task 后的成功提示在 `worker-task-updated` 刷新后仍保持可见，补齐 SettingsView 中 create / retry / cancel 三条 action feedback 的同级保护面。
  - 这次继续只补最窄的 view-level 可回归断言，不改运行时代码；目标是避免 create 路径在跨刷新保留语义上再次落后于已补齐的 retry / cancel。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过，7 files / 75 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/views/SettingsView.vue` 继续把单条 dispatch 成功提示向 shared/server worker task contract 收敛：在已展示 `workerTaskId` 与 `taskType` 的基础上，再直接消费 `DispatchSoulActionResponse.task.status`，把 worker task 当前状态一起拼进用户可见反馈。
  - 同一条成功提示继续补上 `DispatchSoulActionResponse.task.worker` 的本地化标签，让 settings 里的 dispatch feedback 不再只显示 task id，而是把 task 类型、状态、执行端一起投射给用户。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/components/SoulActionGovernancePanel.test.ts` 通过；Vitest 合计 9 files / 110 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项再补充：
  - 本轮 web 变更待提交 git commit。
- 下一步建议再补充：
  - 若继续沿这条 contract-to-UI 主线推进，可优先检查其他 soul-action / worker-task 成功提示是否也还遗漏 shared/server 已有字段的用户可见投射。
  - `LifeOS/packages/web/src/views/SettingsView.vue` 新增 `workerTaskStatusLabel()`，把 `pending/running/succeeded/failed/cancelled` 统一映射为中文状态文案，避免 success message 直接暴露底层枚举值。
  - `LifeOS/packages/web/src/views/SettingsView.test.ts` 同步收紧单条 dispatch 成功提示与两条 websocket retention 断言，锁定 `等待执行` 状态会在初次 dispatch、`worker-task-updated` refresh、`soul-action-updated` refresh 三条路径下保持可见。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项再补充：
  - 本轮 web 变更尚未提交 git commit。
- 下一步建议再补充：
  - 若继续沿同一主线推进，可直接提交这条 dispatch status feedback 收敛增量；若还要继续补一轮，再找下一处 server/shared 已锁住但 web/client 尚未直接消费的 worker task contract 细节。
  - 若还要继续补一轮，可评估 approve / dispatch / accept 三阶段 websocket filter convergence 是否值得抽成共享断言 helper，但优先级低于继续寻找新的 contract 缺口。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/server/test/reintegrationApi.test.ts:802` 新增 dispatch response worker-task convergence contract test，改用真实会走 worker host 的 `update_persona_snapshot` soul action，锁定 dispatch 返回的 `result.workerTaskId` 会与随后 `worker-task-updated` websocket 事件以及 `/api/worker-tasks?sourceNoteId=...` follow-up 列表中的同一 task id / sourceNoteId / taskType 保持一致。
  - 这次补的是 grouped governance 在 dispatch 后除 `soul-action-updated` 外另一条关键事实源：worker task 视图刷新链；同时避免把瞬时 status 绑定死，只验证真正稳定的 contract 字段。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/reintegrationApi.test.ts` 通过，19/19。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项再补充：
  - 本轮 server 变更待提交 git commit。
- 下一步建议再补充：
  - 若继续沿 grouped governance 主线推进，可直接提交当前 worker-task convergence contract 补强。
  - 若还要继续补一轮，可检查 web 侧是否已有对 worker task websocket 刷新语义的回归保护；若没有，再决定是补 view 级测试还是继续找 server contract 缺口。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/views/SettingsView.test.ts:345` 新增 worker-task websocket refresh filter retention 断言，锁定在 grouped governance 面板已选中 `quickFilter=dispatch_ready_only`、`governanceStatus=approved`、`executionStatus=not_dispatched` 的情况下，收到 `worker-task-updated` 后父层刷新仍会按当前筛选条件重新请求 `fetchSoulActions`，且 panel 上下文不会丢失。
  - 这次补的是 web 侧真正对应上一轮 server contract 的监听链回归保护，防止 websocket 刷新把 grouped governance 当前 filter 上下文重置成默认态。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过，3 files / 44 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项再补充：
  - 本轮 web 变更待提交 git commit。
- 下一步建议再补充：
  - 若继续沿 grouped governance 主线推进，可直接提交当前 worker-task websocket filter retention 回归补强。
  - 若还要继续补一轮，可检查 `soul-action-updated` 刷新路径是否也缺同级“保留当前 filter 上下文”的断言，若缺则可用同样方式补齐。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/server/test/reintegrationApi.test.ts` 将 dispatch 后 worker-task convergence contract 扩展到同一 `sourceNoteId` 下的双 action 场景：现在会连续 dispatch `extract_tasks` 与 `update_persona_snapshot` 两条已批准 action，并分别校验各自的 `DispatchSoulActionResponse.task`、`worker-task-updated` websocket 事件，以及 `/api/worker-tasks?sourceNoteId=...` 与按 `taskType`/`worker` 过滤的 follow-up 列表都仍能稳定命中对应 task。
  - 这次补的是 grouped settings 更真实的 worker-task 刷新事实源：不再只证明“单条 dispatch 后能对上”，而是直接锁定同组连续 dispatch 两条不同 taskType 时，worker-task websocket 与 follow-up list 不会串 task 或被后一次 dispatch 覆盖。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/reintegrationApi.test.ts` 通过，19/19。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/views/SettingsView.test.ts:385` 新增 soul-action websocket refresh filter retention 断言，锁定在 grouped governance 面板已选中 `quickFilter=dispatch_ready_only`、`governanceStatus=approved`、`executionStatus=not_dispatched` 的情况下，收到 `soul-action-updated` 后父层刷新仍会按当前筛选条件重新请求 `fetchSoulActions`，且 panel 上下文不会丢失。
  - 这次补齐的是另一条同级 websocket 监听链，保证 grouped governance 不会因为 soul-action 事件刷新而掉回默认筛选态。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过，3 files / 45 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项再补充：
  - 本轮 web 变更待提交 git commit。
- 下一步建议再补充：
  - 若继续沿 grouped governance 主线推进，可直接提交当前 soul-action websocket filter retention 回归补强。
  - 若还要继续补一轮，可检查 index refresh 相关 websocket 路径是否也存在类似的“保留当前筛选上下文”缺口，但优先级低于治理主线本身。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/views/SettingsView.vue:466` 与 `LifeOS/packages/web/src/views/SettingsView.test.ts:245` 把 grouped governance quick-filter 事件统一收敛为组件真实声明的 `update:quickFilter` 契约，消除了此前测试运行中持续出现的 Vue emits warning。
  - 这次不是表面对称整理，而是补齐父子组件之间的真实事件命名契约，避免测试只靠错误事件名碰巧驱动、同时让回归验证输出恢复干净可信。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过，3 files / 45 tests，且不再出现 quick-filter emits warning。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项再补充：
  - 本轮 web 变更待提交 git commit。
- 下一步建议再补充：
  - 若继续沿 grouped governance 主线推进，可直接提交当前 quick-filter event contract 对齐修复。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/components/WorkerTaskDetail.vue` 按同一口径收紧 detail pills：`lifeos/openclaw` 映射为 `LifeOS/OpenClaw`，`update_persona_snapshot` 映射为 `人格快照更新`，避免 worker task 列表与 detail overlay 对同一 contract 展示口径不一致。
  - 新增 `LifeOS/packages/web/src/components/WorkerTaskDetail.test.ts`，直接锁定 detail overlay 会展示本地化 worker/task 标签而不是原始枚举值，并覆盖 LifeOS 与 OpenClaw 两条 worker 路径。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/components/WorkerTaskDetail.test.ts` 通过，5 files / 57 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项再补充：
  - 本轮 web 变更待提交 git commit。
- 下一步建议再补充：
  - 若继续沿同一主线推进，可直接提交这条 worker task detail contract 文案收敛增量；若还要继续补一轮，可评估 `WorkerTaskDetail.vue` 的时间线/结果区是否还有直接泄漏原始 contract 枚举值的文案缺口。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/views/SettingsView.vue:464` 把 grouped governance 的 `filterStatus` / `executionFilter` 父层监听同样统一为组件真实声明的 `@update:filterStatus` 与 `@update:executionFilter`，不再依赖 kebab/camel 混用的隐性兼容。
  - 这次补的是同一条真实事件契约链上的剩余缺口：`SettingsView.test.ts:218` 与 `:222` 本就通过组件真实 camelCase emits 驱动父层，因此运行时代码也应与测试和组件声明保持一致，避免未来出现“测试通过但真实监听名漂移”的风险。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过，3 files / 45 tests，且不再出现 grouped governance filter emits warning。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项再补充：
  - 本轮 web 变更待提交 git commit。
- 本轮继续完成的真实实现：
  - `LifeOS/packages/web/src/views/SettingsView.vue` 将组级 dispatch 成功提示从纯计数文案收紧为复用单条 dispatch 已消费的 worker-task contract：批量派发后现在会附带最后一个 dispatch 返回的 `Worker Task: {id} · {taskType} · {status} · {worker}` 元信息。
  - 这次补的是新的 contract-to-UI 投射缺口：server 的 `DispatchSoulActionResponse.task` 在单条 dispatch 路径已展示，但 group dispatch 仍丢失这条事实源，导致同一页两个派发入口对同一 contract 的用户反馈不一致。
  - `LifeOS/packages/web/src/views/SettingsView.test.ts` 同步把组级 dispatch 成功提示与 websocket refresh 后的保留断言更新为包含 worker task label，锁住这条主路径反馈不再退化回纯计数。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过，9 files / 115 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/api/client.ts` 补齐 soul-action detail / defer / discard 三个 typed client 入口：新增 `fetchSoulAction()`、`deferSoulAction()`、`discardSoulAction()`，把 server 侧已存在的治理接口正式收进 web/shared contract 消费面，避免后续继续靠散落的裸 fetch 或遗漏客户端封装。
  - `LifeOS/packages/server/test/reintegrationApi.test.ts` 新增 defer/discard contract test，锁定同一 soul action 在 `approve -> defer -> discard` 之后，detail 接口与按 `sourceNoteId + governanceStatus` 过滤的 list 结果保持一致，且 `governanceReason`、`deferredAt`、`discardedAt` 等关键字段不漂移。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/server/test/reintegrationApi.test.ts` 将几条 promotion follow-up API contract 用例同步到新的主语义：当 planner 已恢复真实 `sourceNoteId` 后，promotion soul action 的 follow-up 查询与断言改为围绕显式 `sourceReintegrationId`，不再继续把 `record.id` 当成 `sourceNoteId` 查询键。
  - 这次没有再改运行时代码；补的是上一轮 planner identity 根因修复后被真实打破的 server contract 锚点，避免测试继续把旧兼容语义误当成主 contract。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/feedbackReintegration.test.ts` 通过，50/50。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test --test-name-pattern "promotion dispatch response stays aligned with local-only execution results and follow-up soul-action list|event-node promotion dispatch response stays aligned with local-only execution results and follow-up soul-action list|grouped settings list converges after full accept-approve-dispatch chain|reintegration reject API returns reviewed record and filtered follow-up lists stay aligned" test/reintegrationApi.test.ts` 通过，4/4。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过。
  - 当前环境仍有 Node engine warning：包声明要求 `>=20 <21`，实际为 `v25.8.1`，但本轮定向测试与构建均通过。
- 当前未完成项再补充：
  - `reintegrationApi.test.ts` 全量整组运行里仍偶发出现既有超时噪声；本轮已确认被改动的 promotion/reject 相关 contract 用例单独重跑通过，问题更像现有 integration suite 的稳定性噪声，而不是本轮 source contract 回归。
  - 本轮 server 测试修正仍未提交 git commit。
- 下一步建议再补充：
  - 优先继续排查 `reintegrationApi.test.ts` 里其余仍默认按 `sourceNoteId=record.id` 查询 promotion 分组的旧断言，并按 `sourceReintegrationId` 继续收口，直到整组 API contract 全面转到新主语义。
  - 若要继续提高信噪比，再单独处理 server integration suite 的偶发超时隔离问题，但那是独立于本轮 source contract 收口之外的测试基础设施议题。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/server/test/reintegrationApi.test.ts` 将剩余 promotion source contract 用例继续从旧的 `sourceNoteId = record.id` 语义迁到显式 `sourceReintegrationId`：accept / manual-plan websocket follow-up、approve websocket follow-up、dispatch websocket follow-up、dispatch/list refresh、staggered grouped refresh、sequential dispatch、same-status execution filter 等场景现在统一按 reintegration source 查询和对齐。
  - 同批测试的 reintegration fixture 补回真实 `sourceNoteId`（如 `note-api-pr6-accept-ws-filter-followup`、`note-api-pr6-ws-filter-followup`、`note-api-pr6-event-node-dispatch-followup`、`note-api-pr6-staggered-grouped-settings-refresh`），避免 runtime 合法 fallback 到 `record.id` 后继续把旧兼容语义伪装成主语义。
  - websocket 断言现在显式区分两层事实源：`sourceNoteId` 断言真实 note source，`sourceReintegrationId` 断言对应 reintegration record id，不再把两者混成同一个字段。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/reintegrationApi.test.ts` 通过，31/31（重定向日志确认退出码 `EXIT:0`）。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过。
  - 当前环境仍有 Node engine warning：包声明要求 `>=20 <21`，实际为 `v25.8.1`，但本轮 server test/build 均通过。
- 当前未完成项再补充：
  - 旧兼容路径仍保留：若后续新 fixture 再写成 `sourceNoteId: null`，planner/runtime 仍会合法 fallback 到 `record.id`；继续补 contract coverage 时需要避免把 fallback 当成主语义。
  - 本轮 server 变更尚未提交 git commit。
- 下一步建议再补充：
  - 若继续沿同一高价值主线推进，优先检查 `feedbackReintegration.test.ts`、`feedbackReintegration.ts` 与未来新增 reintegration API fixture 是否还存在 `sourceNoteId: null` 但断言按真实 note source 编写的潜在漂移点。
  - 若本轮先收口，也可以直接提交当前这批 promotion source contract test 迁移，避免 `reintegrationApi.test.ts` 再次回退到旧兼容语义。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/server/test/reintegrationApi.test.ts` 将 promotion dispatch 后 mixed-group progress 用例里的 worker-task follow-up 查询从旧的 `record.id -> sourceNoteId` 误用，收回到真实 note source `note-api-pr6-filter-subset-convergence`，不再把 reintegration group key 错当成 worker task 的 note-level 事实源。
  - 同一用例新增对 `/api/worker-tasks` 返回 `filters.sourceNoteId` 的断言，明确锁住这条 contract 仍然是 note 级过滤，而 promotion soul-action follow-up 才走 `sourceReintegrationId`；这样把两个不同事实源边界直接在同一条测试里分开锚定。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test --test-name-pattern "soul-action filters converge when governance and execution subsets are queried after mixed group progress" test/reintegrationApi.test.ts` 通过，1/1。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过。
  - 当前环境仍有 Node engine warning：包声明要求 `>=20 <21`，实际为 `v25.8.1`，但本轮定向 contract test 与 build 均通过。
- 当前未完成项再补充：
  - 先修正 `LifeOS/packages/server/config.json` 被测试残留污染的问题：从不存在的 `/tmp/lifeos-config-restart-rollback-...` 临时 vault 路径恢复为正式运行配置 `/home/xionglei/Vault_OS` + `3000`，避免当前 working tree 被误用于运行时会直接指向失效数据目录。
  - `LifeOS/packages/web/src/components/AISuggestions.test.ts` 新增 5 条最窄前端回归测试，直接锁定 AI suggestions 面板在初始 idle、刷新成功、空结果、错误、加载中五种主状态下都正确消费 `fetchAISuggestions()` 与 shared `AISuggestion` contract，并继续展示本地化 type / dimension 文案。
- 本轮验证待执行：
  - 运行 web 定向测试与 build，确认 AI suggestions 新回归面通过，且不影响现有 dashboard 入口。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/server/test/configLifecycle.test.ts` 再补 2 条 AI prompt API contract 测试，直接锁定新加的 `suggest` prompt 能通过 `/api/ai/prompts` 被列出、可被 PATCH override、可被 DELETE reset，且 override 校验继续强制要求 `{dashboardData}` 与 `{recentNotes}` 两个占位符。
  - 这次补的是 AI suggestions 链路里此前真正没被保护的“配置入口 -> runtime prompt”主路径，而不是继续做 grouped governance 同类对称补强；这样后续即使 UI 还没直接暴露 suggest prompt 设置，也不会出现 registry 已加、但 prompt API 没有 contract 回归的漂移。
- 本轮验证待执行补充：
  - 运行 server `configLifecycle` 定向测试，确认 suggest prompt API 与现有 AI suggestions fallback contract 同时通过。
- 下一步建议再补充：
  - 若继续沿 grouped governance 主线推进，可直接提交当前 grouped governance emit contract 对齐修复。
  - 若还要继续补一轮，可检查 `index-queue-complete` 这类非治理数据刷新 websocket 路径下，panel 当前上下文是否仍缺最小 view 级保护。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/views/SettingsView.test.ts:285` 将 index refresh websocket coverage 从“只保 collapsed state”收紧为“collapsed state + quickFilter + governanceStatus + executionStatus 整体父层上下文都不漂移”，并继续锁定 `index-queue-complete` 只刷新 `loadStatus()`、不会误触发 worker/reintegration/soul-action loaders。
  - 这次补的是 grouped governance 在非 soul-action websocket 分支下的真实边界保护：既不把 index refresh 误判成治理数据刷新，也不让当前面板筛选上下文因全局状态更新而悄悄掉回默认值。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过，3 files / 45 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项再补充：
  - 本轮 web 变更待提交 git commit。
- 下一步建议再补充：
  - 若继续沿 grouped governance 主线推进，可直接提交当前 filter event contract 对齐修复。
  - 若还要继续补一轮，可检查 `toggle-collapsed` 等其余 emits 在模板监听、单测触发、组件声明之间是否还存在类似的命名漂移。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/server/test/reintegrationApi.test.ts` 继续把 grouped dispatch worker-task contract 补到 status filter：在同一 `sourceNoteId` 下连续 dispatch `extract_tasks` 与 `update_persona_snapshot` 两条 action 后，额外校验 `/api/worker-tasks?sourceNoteId=...&taskType=...&status=...` 仍能稳定命中各自 task，且返回 filters 与 dispatch response/task websocket 的 status 保持一致。
  - 这次补的是 grouped settings 继续细化 worker-task filter 刷新依赖：不仅 taskType / worker 不串，连 taskType + status 组合过滤也不会在同组连续 dispatch 后漂移。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/reintegrationApi.test.ts` 通过，19/19。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/views/SettingsView.test.ts:210` 新增 collapsed group ids 父层状态断言，锁定 grouped governance 面板触发 `toggle-collapsed` 时，`SettingsView` 会正确维护 `collapsedGroupIds`：首次折叠加入 id，继续折叠第二组追加，重复触发同组则正确移除。
  - 这次补的是一个此前确实存在但未被 view 级回归覆盖的父层状态面：`collapsedGroupIds` 已作为真实运行时状态传给 panel，却没有测试防止后续 wiring 退化。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过，3 files / 46 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项再补充：
  - 本轮 web 变更待提交 git commit。
- 下一步建议再补充：
  - 若继续沿 grouped governance 主线推进，可直接提交当前 collapsed-group state 回归补强。
  - 若还要继续补一轮，可检查 websocket refresh 之后 collapsedGroupIds 是否应保持不变；若这是预期语义，则值得再补一条 retention 断言。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/server/src/ai/suggestions.ts` 新增最小 AI suggestions 服务：先从 `notes` 聚合各维度 pending/in_progress/done 统计与最近 8 条记录，优先尝试走 `suggest` prompt + Claude 输出 2-3 条结构化建议；若无 provider/调用失败/解析失败，则稳定回退到本地 heuristic suggestions，不阻塞主界面。
  - `LifeOS/packages/server/src/ai/prompts.ts` 与 `LifeOS/packages/shared/src/types.ts` 补齐 `suggest` prompt key 及 `AISuggestion` / `ListAiSuggestionsResponse` 共享 contract，避免 web/client 继续内联自定义 suggestions 类型。
  - `LifeOS/packages/server/src/api/handlers.ts`、`src/api/routes.ts`、`LifeOS/packages/web/src/api/client.ts` 收口 `/api/ai/suggestions`：server 统一返回 `{ suggestions }`，web client 改为消费 shared list contract，并补上 `fetchSoulAction(id)`，顺手消除 suggestions 类型重复定义。
  - `LifeOS/packages/server/src/api/handlers.ts` 还补了 `deferSoulAction` / `discardSoulAction` 的 websocket 广播，修正当前 settings grouped governance 在这两条治理动作后缺少 `soul-action-updated` 刷新事件的真实缺口。
  - `LifeOS/packages/server/test/configLifecycle.test.ts` 与 `test/reintegrationApi.test.ts` 把 server `config.json` 定位统一改为相对当前测试文件解析，去掉硬编码绝对路径，避免新旧机器路径切换时测试直接失效。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/reintegrationApi.test.ts` 通过，26/26。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
  - 注意：把 `configLifecycle.test.ts` 与 `reintegrationApi.test.ts` 并行跑时会互相踩共享 `packages/server/config.json` 与 watcher/server 全局状态；单独顺序跑 `reintegrationApi.test.ts` 正常通过，但 `configLifecycle.test.ts` 目前仍暴露既有测试隔离问题，不宜把这轮失败误判成 suggestions 回归。
- 当前未完成项再补充：
  - 本轮 server/web 改动仍未提交 git commit。
  - `configLifecycle.test.ts` 仍依赖共享进程级状态（config 文件、watcher、server 单例），与其他 server integration test 并行或混跑时会串扰；这是独立于本轮 suggestions 改动之外的已有测试基础设施缺口。
- 下一步建议再补充：
  - 若继续沿当前最有价值主线推进，优先修 `configLifecycle.test.ts` 的测试隔离（例如把 config 路径注入到测试 env / server 启动，而不是继续共享同一个 `packages/server/config.json`），这样后续 server integration tests 才能稳定并行或整组运行。
  - 若先收口本轮，也可以直接提交当前 AI suggestions + shared contract + websocket 补广播增量；这批改动已具备最小可验证闭环。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/views/SettingsView.test.ts:233` 新增 collapsedGroupIds websocket retention 断言，锁定 grouped governance 面板在折叠某个 group 后，即使收到 `worker-task-updated` 触发的父层 refresh，`collapsedGroupIds` 仍保持不变。
  - 这次补的是同一状态面的后半段真实风险：不仅要能切换折叠态，还要避免 websocket 刷新把用户刚折叠的分组重新展开。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过，3 files / 47 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项再补充：
  - 本轮 web 变更待提交 git commit。
- 下一步建议再补充：
  - 若继续沿 grouped governance 主线推进，可直接提交当前 collapsedGroupIds websocket retention 回归补强。
  - 若还要继续补一轮，可评估 soul-action websocket 路径下 collapsedGroupIds 是否也该保持；若是，则可补同级 retention 断言。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/views/SettingsView.test.ts:259` 新增 soul-action websocket 下的 collapsedGroupIds retention 断言，锁定 grouped governance 面板在折叠某个 group 后，即使收到 `soul-action-updated` 触发的父层 refresh，`collapsedGroupIds` 仍保持不变，且不会误刷新 worker task 列表。
  - 这次补齐的是同一 retention 链的另一条关键 websocket 路径，保证用户在治理面板里的折叠状态不会因 soul-action 事件刷新而丢失。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过，3 files / 48 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项再补充：
  - 本轮 web 变更待提交 git commit。
- 本轮继续完成的真实实现：
  - `LifeOS/packages/server/src/soul/soulActions.ts` 将 promotion action 的 identity/create-or-reuse 路径也切到统一的 `resolveSoulActionSourceReintegrationId()`：当旧数据仍以 `sourceNoteId = reint:...` 进入且 `sourceReintegrationId` 为空时，现在会先归一化出 `sourceReintegrationId` 再查重/建 id/落库，不再出现 executor 认得 legacy source、但 createOrReuse 仍按 note 维度插入导致主键冲突的分叉。
  - `LifeOS/packages/server/test/feedbackReintegration.test.ts` 新增 legacy identity reuse 回归，并继续保留 explicit source 与 create_event_node 主路径断言，锁住三条 source 语义：explicit source、legacy fallback、create_event_node dispatch 主路径。
  - 这次补的是新的主路径断裂：上轮刚把 source resolution helper 收束到 executor，但 create/reuse 仍没跟上；只有实际补到 `soulActions.ts` 才真正消掉 runtime 分叉。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test --test-name-pattern "legacy reintegration source encoded in sourceNoteId|create_event_node action reuses PR6 event promotion executor|persists explicit sourceReintegrationId independently from sourceNoteId" test/feedbackReintegration.test.ts` 通过，3/3。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过。
- 下一步建议再补充：
  - 若继续沿 grouped governance 主线推进，可直接提交当前 soul-action collapsedGroupIds retention 回归补强。
  - 若还要继续补一轮，可检查 index refresh 相关事件是否也会影响 grouped governance 折叠态；若会，则可补最后一条同级 retention 断言。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/views/SettingsView.test.ts:285` 新增 index refresh 事件下的 collapsedGroupIds retention 断言，锁定 grouped governance 面板在折叠某个 group 后，即使收到 `index-queue-complete` 触发的父层 worker task refresh，`collapsedGroupIds` 仍保持不变；同时确认这条路径不会误刷新 reintegration records 或 soul actions。
  - 这次补上的是 grouped governance 折叠态 retention 链上的最后一条相关 websocket/event 路径，确保非治理事件驱动的刷新也不会打断用户当前面板展开状态。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过，3 files / 49 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项再补充：
  - 本轮 web 变更待提交 git commit。
- 下一步建议再补充：
  - 若继续沿 grouped governance 主线推进，可直接提交当前 index refresh collapsedGroupIds retention 回归补强。
  - 若还要继续补一轮，应回到新的 server/web/shared contract 缺口，而不是继续在当前折叠态链路上做低边际对称补强。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/views/SettingsView.test.ts` 新增 1 条 dispatch worker-task feedback 连续 retention 断言，锁定单条 dispatch 成功提示在先收到 `worker-task-updated`、再收到 `soul-action-updated` 两次连续 websocket 刷新后仍保持可见。
  - 这次补的是 dispatch worker-task feedback 的连续事件链保护：此前分别验证了两条 websocket 路径各自不会清空提示，但还没有直接锁住“连续经过两次不同刷新后仍不丢消息”的真实使用序列。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过，7 files / 76 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/components/NoteDetail.vue` 让 `handleCreateSummarizeTask()`、`handleCreateOpenClawTask()`、`handleExtractTasks()` 直接消费 `createWorkerTask()` / `extractTasks()` 返回的 `WorkerTask`，成功反馈统一收敛为 `任务 ID · 任务类型 · 状态 · worker` 的本地化文案，不再停留在固定提示语。
  - 新增 `LifeOS/packages/web/src/components/NoteDetail.test.ts`，覆盖摘要任务、OpenClaw 任务、行动项提取三条创建路径，并锁定成功反馈展示 `笔记摘要 / OpenClaw 任务 / 提取行动项`、`等待执行 / 执行中 / 已完成`、`LifeOS / OpenClaw`，避免 raw enum 回流到 UI。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/components/NoteDetail.test.ts` 通过，6 files / 60 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项再补充：
  - 本轮 web 变更待提交 git commit。
- 下一步建议再补充：
  - 若继续沿同一条 worker-task contract consumption 主线推进，可检查 `NoteDetail.vue` 中 retry/cancel 成功反馈是否也应补齐本地化 `WorkerTask` 元信息，而不是停留在固定文案。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/components/AISuggestions.vue` 改为组件挂载后自动触发首轮 `handleRefresh()`，让 dashboard 首次进入就直接消费已经落地的 `/api/ai/suggestions` 主路径，而不是默认停在“点击刷新”空态。
  - 同时在请求失败时也把 `fetched` 标记为真，保证首轮自动加载失败后面板进入明确 error/empty 分支，不会因为只剩 `fetched=false` 而回退成误导性的 idle 提示。
  - `LifeOS/packages/web/src/components/AISuggestions.test.ts` 同步改成主路径语义：新增自动加载成功、自动加载空结果两条断言，并把原有 success/error/loading 用例收口到“挂载即请求、手动刷新可再次请求”的真实行为。
- 本轮验证待执行再补充：
  - 运行 AI suggestions 组件测试与 web build，确认 dashboard 首屏洞察流现在默认自动拉取且回归通过。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/views/SettingsView.test.ts` 新增 3 条 AI Prompt 调优中心断言，直接锁定新加的 `suggest` prompt 会在 settings prompt 列表中真实出现、能展示 `{dashboardData}` / `{recentNotes}` 两个必需占位符、并且当编辑内容缺少占位符时保存按钮会被禁用。
  - 这次补的是 `server/shared -> settings prompt center` 的真实 contract-to-UI 投射缺口：此前后端与 shared 已支持 `suggest` prompt，但前端没有回归保证它真的被选中、展示、校验与编辑，不是继续在 grouped governance 链上做同类平移。
- 本轮验证待执行补充：
  - 运行 `SettingsView` 定向测试与 web build，确认 `suggest` prompt 已被 settings prompt center 稳定消费。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/views/SettingsView.test.ts` 再补 1 条 `save -> loadPrompts -> selectedPrompt` 主链断言，锁定 `suggest` prompt 保存 override 后，settings 会重新拉取 prompt 列表、保持当前仍选中 `suggest`、状态 pill 收敛到 `已覆盖`，并把编辑器内容同步为新的 override 文本。
  - 这次保护的是 prompt center 最关键的真实编辑回路，而不是继续补“能看见 suggest”这一类静态展示断言；它直接防止保存后跳回默认 prompt、状态不刷新、或 textarea 仍残留旧值等用户可见主路径断裂。
- 本轮验证待执行再补充：
  - 重新运行 `SettingsView` 定向测试与 web build，确认 suggest prompt 的保存回路与前一轮显示/校验回归一起稳定通过。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/server/test/reintegrationApi.test.ts` 再新增 1 条 event-node promotion dispatch contract 回归，锁定 `promote_event_node` / `create_event_node` 这类本地执行的 PR6 promotion action 在 `/dispatch` 后，同样返回 `workerTaskId=null`、`task=null`，并让 `soulAction.executionStatus=resultSummary` 与 follow-up `/api/soul-actions?sourceNoteId=...` 保持一致。
  - 同时把前一条 continuity promotion 用例的 reason 断言从宽泛的 `/continuity record|event node/` 收紧为仅匹配 `continuity record`，避免两条本地 promotion 分支继续共用同一模糊断言而掩盖错路执行。
- 本轮验证结果补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test --test-name-pattern "promotion dispatch response stays aligned with local-only execution results and follow-up soul-action list|event-node promotion dispatch response stays aligned with local-only execution results and follow-up soul-action list" test/reintegrationApi.test.ts` 通过，2/2。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/server/test/reintegrationApi.test.ts` 将 defer/discard API contract 从旧兼容语义继续收口到双事实源：fixture 改为显式真实 `sourceNoteId = note-api-soul-action-defer-discard`，而 follow-up list 改为按 `sourceReintegrationId = record.id` 查询，不再把 reintegration record id 继续当作 note-level filter key。
  - 同一条用例新增断言锁定 defer/discard follow-up list 返回的 `filters.sourceReintegrationId`、`action.sourceNoteId`、`action.sourceReintegrationId` 三者同时正确，避免这条非-dispatch 治理路径继续停留在旧 promotion 兼容语义上。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test --test-name-pattern "soul-action defer and discard APIs keep governance detail and list views aligned" test/reintegrationApi.test.ts` 通过，1/1。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过。
  - 当前环境仍有 Node engine warning：包声明要求 `>=20 <21`，实际为 `v25.8.1`，但本轮测试与构建通过。
- 当前未完成项再补充：
  - `reintegrationApi.test.ts` 与 `feedbackReintegration.test.ts` 中仍有不少 `sourceNoteId: null` fixture；其中一部分是合法 fallback 覆盖，但后续仍要继续筛掉那些与“真实 note source + 显式 reintegration source”主语义冲突的残留点。
  - 本轮 server 变更尚未提交 git commit。
- 下一步建议再补充：
  - 优先继续排查 `reintegrationApi.test.ts` / `feedbackReintegration.test.ts` 中仍把 promotion follow-up list 或治理断言锚在旧兼容语义上的用例，尤其是 defer/discard 之外的非-dispatch 路径。
  - 若本轮先收口，也可以直接提交当前这条非-dispatch governance contract 修正，避免这条边路继续把旧 source 语义保留在回归面里。
  - `LifeOS/packages/web/src/components/NoteDetail.vue` 让 related worker task 的 `handleRetryRelatedTask()` / `handleCancelRelatedTask()` 也直接消费 `retryWorkerTask()` / `cancelWorkerTask()` 返回的 `WorkerTask`，成功反馈与创建路径统一为本地化的 `任务 ID · 任务类型 · 状态 · worker` 文案，避免同一组件内 create 与 retry/cancel 两套展示口径分叉。
  - `LifeOS/packages/web/src/components/NoteDetail.test.ts` 新增 retry 与 cancel 两条回归，锁定关联任务操作后会展示 `提取行动项 · 等待执行 · LifeOS` 与 `OpenClaw 任务 · 已取消 · OpenClaw`，并继续防止 raw enum 回流到 UI。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/components/NoteDetail.test.ts` 通过，6 files / 62 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项再补充：
  - 本轮 web 变更待提交 git commit。
- 下一步建议再补充：
  - 若继续沿同一条 worker-task contract consumption 主线推进，可检查 `NoteDetail.vue` 是否还存在与 worker task 相关的错误态/刷新态提示未消费统一本地化 helper，优先补真实用户可见缺口而非对称扩张。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/views/SettingsView.test.ts` 新增 1 条 manual `planReintegrationPromotions` 的 `reintegration-record-updated` 单事件 retention 回归，锁定手动补规划成功提示在只收到 reintegration record websocket 刷新时仍保持可见，并继续要求仅刷新 reintegration records / soul actions，不误刷 worker tasks。
  - 这次延续 accept/reject 已补齐的同级事实源保护，把 manual planning 也收口到新的 `reintegration-record-updated` websocket contract 上，避免三条 reintegration review 成功路径在 view-level retention 上重新分叉。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过，7 files / 84 tests。
- 当前未完成项再补充：
  - 本轮 web 变更待提交 git commit。
- 下一步建议再补充：
  - 若继续沿这条 reintegration websocket 主线推进，下一步优先检查 `planReintegrationPromotions` 在 server/shared contract 层是否也值得补一条 `reintegration-record-updated` 对齐断言，避免 web 已锁住而 server 事实源仍留空档。
  - 若不再继续补强，可直接提交当前 manual planning reintegration-record retention 回归增量。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/server/test/reintegrationApi.test.ts` 将 accepted-group filter contract 从旧的 `sourceNoteId = record.id` 查询语义切回显式 `sourceReintegrationId`：两条 fixture 现在携带真实 `sourceNoteId`（`note-api-pr6-filter-a` / `note-api-pr6-filter-b`），而 pending/approved follow-up list 改为按 reintegration group id 过滤。
  - 同一条用例新增断言锁定 `pendingForA`、`approvedForA`、`pendingForB` 返回的 `filters.sourceReintegrationId`、`action.sourceNoteId`、`action.sourceReintegrationId` 一起保持正确，避免 accept 之后的治理筛选继续把 record id 当 note-level source key。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test --test-name-pattern "soul-action API filters stay scoped to the accepted reintegration group" test/reintegrationApi.test.ts` 通过，1/1。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过。
  - 当前环境仍有 Node engine warning：包声明要求 `>=20 <21`，实际为 `v25.8.1`，但本轮测试与构建通过。
- 当前未完成项再补充：
  - `reintegrationApi.test.ts` 中仍有少量 grouped-semantics / mixed-progress 场景可能残留 `sourceNoteId = record.id` 过滤锚点，需要继续逐条清理。
  - 本轮 server 变更尚未提交 git commit。
- 下一步建议再补充：
  - 继续优先扫 `reintegrationApi.test.ts` 中 grouped-semantics / mixed-progress 相关用例，找出还在按 `record.id` 过滤 soul actions 的残留点。
  - 若本轮先收口，也可以直接提交当前 accepted-group filter contract 修正，避免 accept 后治理筛选再次漂回旧兼容语义。
  - `LifeOS/packages/web/src/components/NoteDetail.vue` 将原先只适用于 create 路径的 `workerTaskCreatedMessage()` 收敛为 action-aware 的 `workerTaskActionMessage()`，让 create / retry / cancel 三条路径继续共用同一份本地化 worker-task 元信息拼装逻辑，同时修正 retry/cancel 成功反馈仍显示“已创建任务”的语义错误。
  - `LifeOS/packages/web/src/components/NoteDetail.test.ts` 将 retry/cancel 断言同步收紧为 `已重新入队任务` 与 `已取消任务`，避免 UI 在 contract 字段已正确消费后仍误导用户当前动作语义。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/components/NoteDetail.test.ts` 通过，6 files / 62 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项再补充：
  - 本轮 web 变更待提交 git commit。
- 下一步建议再补充：
  - 若继续沿同一条 worker-task feedback 主线推进，可检查 `NoteDetail.vue` 在 worker task 失败/加载刷新链路中是否还存在固定提示语与真实任务状态脱节的缺口，优先补会影响用户判断当前任务状态的文案。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/server/test/reintegrationApi.test.ts` 将 grouped-semantics contract 从旧的 `sourceNoteId = record.id` 聚合锚点切回显式 `sourceReintegrationId`：三条 fixture 现在都携带真实 `sourceNoteId`（`note-api-pr6-group-semantics-a/b/c`），整组 pending/dispatch-ready 统计改为按 reintegration group id 聚合。
  - 同一条用例新增断言锁定 `acceptedA/B/C` 返回的 actions 同时满足“真实 `sourceNoteId` + 对应 `sourceReintegrationId`”，避免分组统计虽然过了，但底层 action source 语义仍悄悄回退到旧兼容路径。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test --test-name-pattern "soul-action API preserves group-level pending and dispatch-ready semantics for settings view" test/reintegrationApi.test.ts` 通过，1/1。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过。
  - 当前环境仍有 Node engine warning：包声明要求 `>=20 <21`，实际为 `v25.8.1`，但本轮测试与构建通过。
- 当前未完成项再补充：
  - `reintegrationApi.test.ts` 中仍有少量 grouped-semantics / mixed-progress 场景可能残留 `sourceNoteId = record.id` 过滤锚点，需要继续逐条清理。
  - 本轮 server 变更尚未提交 git commit。
- 下一步建议再补充：
  - 继续优先扫 `reintegrationApi.test.ts` 中 grouped-semantics / mixed-progress 相关用例，找出还在按 `record.id` 过滤 soul actions 的残留点。
  - 若本轮先收口，也可以直接提交当前 grouped-semantics contract 修正，避免分组统计再次漂回旧兼容语义。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/server/test/reintegrationApi.test.ts` 将 event-node / continuity projection follow-up 两条 dispatch 用例的 reintegration fixture 改回真实 note source（`note-api-pr6-event-node-list-followup`、`note-api-pr6-continuity-list-followup`），不再继续靠 `sourceNoteId: null` 的 legacy fallback 把 projection 链跑通。
  - continuity follow-up 用例新增断言锁定 accept 返回的 promotion action 已同时携带真实 `sourceNoteId` 与对应 `sourceReintegrationId`；event-node follow-up 虽然当前 projection 断言已足够通过，但 fixture 也已回到主语义，避免后续再把 fallback 当默认来源。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test --test-name-pattern "event-node promotion dispatch writes follow-up event-node list aligned with soul-action source record|continuity promotion dispatch writes follow-up continuity-record list aligned with soul-action source record" test/reintegrationApi.test.ts` 通过，2/2。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过。
  - 当前环境仍有 Node engine warning：包声明要求 `>=20 <21`，实际为 `v25.8.1`，但本轮测试与构建通过。
- 当前未完成项再补充：
  - `reintegrationApi.test.ts` 中前半段仍有 2 处 `sourceNoteId: null` fixture，需要继续判定是合法 fallback coverage 还是旧主语义残留。
  - 本轮 server 变更尚未提交 git commit。
- 下一步建议再补充：
  - 继续优先处理 `reintegrationApi.test.ts` 中剩余的两处 `sourceNoteId: null` fixture，确认是否还能切回真实 note source 而不丢失测试目标。
  - 若本轮先收口，也可以直接提交当前 projection follow-up fixture 修正，避免 event-node / continuity projection 链继续默认走 fallback 语义。
- 本轮继续完成的真实实现再补充：
  - 新增 `LifeOS/packages/web/src/utils/workerTaskLabels.ts`，集中维护 worker task 的 `taskType / status / worker` 本地化映射与 action-aware 成功反馈文案，避免 `NoteDetail.vue`、`WorkerTaskCard.vue`、`WorkerTaskDetail.vue`、`SettingsView.vue` 四处各自维护同一份 shared contract 解释而再次漂移。
  - `LifeOS/packages/web/src/components/WorkerTaskCard.vue`、`LifeOS/packages/web/src/components/WorkerTaskDetail.vue`、`LifeOS/packages/web/src/components/NoteDetail.vue`、`LifeOS/packages/web/src/views/SettingsView.vue` 全部改为复用该 helper；其中 `WorkerTaskDetail.vue` 的 retry/cancel 成功反馈也同步收敛为与 `NoteDetail` 一致的 action-aware 本地化文案。
  - 新增 `LifeOS/packages/web/src/utils/workerTaskLabels.test.ts`，把共享 helper 本身作为事实源锁住，直接覆盖 `人格快照更新 / 等待执行 / LifeOS` 等映射以及 create/retry/cancel 三条消息前缀。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/utils/workerTaskLabels.test.ts src/components/WorkerTaskCard.test.ts src/components/WorkerTaskDetail.test.ts src/components/NoteDetail.test.ts src/views/SettingsView.test.ts` 通过，7 files / 64 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项再补充：
  - 本轮 web 变更待提交 git commit。
- 下一步建议再补充：
  - 若继续沿同一条 worker-task contract consumption 主线推进，可检查 server/shared 是否还有新的 worker task enum 值尚未被 web 侧共享 helper 与测试覆盖，优先补新增 contract 的集中事实源保护。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/utils/workerTaskLabels.ts` 改为用 `Record<WorkerTaskType, string>`、`Record<WorkerTaskStatus, string>`、`Record<WorkerName, string>` 显式声明 web 侧 worker task 本地化事实源，不再靠一串 if/return 维持；这样当 shared 新增 enum 值时，这里会在编译期直接暴露未覆盖项。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/server/test/reintegrationApi.test.ts` 将 accepted-grouping contract 从旧的 `sourceNoteId = record.id` 锚点切回当前主语义：两条 reintegration fixture 现在各自携带真实 `sourceNoteId`（`note-api-pr6-grouping-a` / `note-api-pr6-grouping-b`），accept 返回断言也同步要求 `sourceNoteId` 等于真实 note source、`sourceReintegrationId` 等于对应 reintegration record id。
  - 同一条 grouped list 断言改为按 `sourceReintegrationId` 聚合，而不是继续按 `sourceNoteId = record.id` 分组，直接锁住 accept 后 promotion action 的 group identity 已切到显式 reintegration source，而 note-level source 只保留为原始事实源字段。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test --test-name-pattern "soul-action API keeps accepted records grouped separately by source note" test/reintegrationApi.test.ts` 通过，1/1。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过。
  - 当前环境仍有 Node engine warning：包声明要求 `>=20 <21`，实际为 `v25.8.1`，但本轮测试与构建通过。
- 当前未完成项再补充：
  - `reintegrationApi.test.ts` / `feedbackReintegration.test.ts` 中仍可能有少量 accept / plan / governance follow-up 断言停留在旧兼容语义；需要继续逐条筛掉，而不是泛化清洗所有 `sourceNoteId: null` fixture。
  - 本轮 server 变更尚未提交 git commit。
- 下一步建议再补充：
  - 继续优先扫 `reintegrationApi.test.ts` 与 `feedbackReintegration.test.ts` 中 accept / manual-plan / governance follow-up 相关用例，找出仍把 `record.id` 当 `sourceNoteId` 或分组 key 的残留点。
  - 若本轮先收口，也可以直接提交当前 accepted-grouping contract 修正，避免这条旧锚点重新漂移回测试面。
  - 该断言继续直接对齐 shared contract 的真实返回形状，只验证 `reintegrationRecords` 成员收敛与 `id/reviewStatus/reviewedAt` 一致性，不再错误假设 list 响应额外暴露 `filters` 字段。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/reintegrationApi.test.ts` 通过，19/19。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过。
- 当前未完成项再补充：
  - 本轮 server 变更待提交 git commit。
- 下一步建议再补充：
  - 若继续沿同一条 reintegration review refresh 主线推进，可优先检查 reject 之后 `reviewStatus=rejected` / `pending_review` follow-up list 是否也缺同级 contract 保护。
  - `LifeOS/packages/web/src/utils/workerTaskLabels.test.ts` 进一步直接消费 shared 的 `SUPPORTED_WORKER_TASK_TYPES` / `SUPPORTED_WORKER_NAMES`，把 web helper 的覆盖范围与 shared 合约绑死，避免后续只更新 shared/server 而忘记补 web 标签映射。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/utils/workerTaskLabels.test.ts` 通过，7 files / 65 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项再补充：
  - 本轮 web 变更待提交 git commit。
- 下一步建议再补充：
  - 若继续沿 worker-task feedback retention 主线推进，可直接提交当前 dispatch feedback 连续 websocket retention 断言。
  - 若还要继续补一轮，可检查 `SettingsView` 里 group quick action 的成功提示是否也缺少跨连续 websocket 刷新保留断言。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/server/src/api/handlers.ts` 让 `planPromotionsHandler()` 也显式广播 `reintegration-record-updated` 与对应的 `soul-action-updated`，把手动 `planReintegrationPromotions` 收口到与 accept/reject 相同的 websocket 事实源链路，不再只返回 HTTP 响应。
  - `LifeOS/packages/server/test/reintegrationApi.test.ts` 新增 manual planning 的 websocket contract 回归，锁定对已 accepted reintegration record 调用 `/plan-promotions` 后，会先收到同一条 `reintegration-record-updated`，再收到两条与 response / follow-up pending list 对齐的 `soul-action-updated`。
  - 这次补的是上一轮 web-only retention 回归在 server 侧缺失的事实源保护，避免 `SettingsView` 已开始直接消费 `reintegration-record-updated`，但手动 planning 路径却没有对等广播。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test --test-name-pattern "reintegration manual planning emits reintegration-record-updated websocket event aligned with follow-up lists" test/reintegrationApi.test.ts` 通过，1/1。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/reintegrationApi.test.ts` 本轮再次跑到已有无关旧用例 `grouped settings list stays coherent across staggered approve and dispatch updates` 的偶发启动超时；新增 manual planning websocket 用例本身在定向重跑时稳定通过，因此本轮继续以定向回归 + server build 作为有效验证结论。
- 当前未完成项再补充：
  - 本轮 server/web 变更待提交 git commit。
- 下一步建议再补充：
  - 若继续沿 reintegration websocket 主线推进，下一步可检查 `SettingsView` 是否还缺一条 manual planning 成功后连续经过 `reintegration-record-updated -> soul-action-updated` 双事件链仍保留提示的 view-level 回归；若已有，则可直接提交当前 server/web 对齐增量。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/server/test/reintegrationApi.test.ts` 继续把 grouped dispatch worker-task contract 补到 `taskType + worker + status` 三者组合过滤：在同一 `sourceNoteId` 下连续 dispatch `extract_tasks` 与 `update_persona_snapshot` 后，额外校验 `/api/worker-tasks?sourceNoteId=...&taskType=...&worker=lifeos&status=...` 仍能稳定命中各自 task，且返回 filters 与 dispatch response / websocket 中的 worker、status 保持一致。
  - 这次继续压实 grouped settings 依赖的 worker-task filtered refresh 事实源：不仅 taskType/status 对得上，连 taskType/worker/status 三者组合过滤在同组连续 dispatch 后也不会把两个 task 串在一起。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/reintegrationApi.test.ts` 通过，19/19。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/components/WorkerTaskDetail.test.ts` 再补一条 websocket refresh retention 回归，锁定 detail overlay 在 retry/cancel 成功后即使收到同任务的 `worker-task-updated` 事件，也会继续保留刚显示出的本地化动作反馈，不会被紧随其后的刷新抹掉。
  - 这次补的是上一轮动作级回归的后半段真实风险：如果 websocket 刷新会立刻清空动作消息，那么前一轮把 action-aware 文案收紧到 UI 的价值仍会被抵消。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/components/WorkerTaskDetail.test.ts` 通过，7 files / 68 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项再补充：
  - 本轮 web 变更待提交 git commit。
- 下一步建议再补充：
  - 若继续沿同一条 worker-task contract 主线推进，可检查 `WorkerTaskDetail.vue` 的 source note / output note 打开链路是否也需要补一条最小回归，确保 detail overlay 不只展示 contract，还能稳定消费这些已存在的导航动作。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/views/SettingsView.test.ts` 新增 manual planning 的双事件链 retention 回归，锁定在 `planReintegrationPromotions()` 成功后，连续收到 `reintegration-record-updated -> soul-action-updated` 两次 websocket 刷新时，`已规划 1 条 promotion actions` 仍保持可见。
  - 同一用例继续要求这两次刷新都只联动 `fetchReintegrationRecords()` / `fetchSoulActions()`，不会误触发 `fetchWorkerTasks()`，把上一轮 server 新补的手动 planning websocket 广播链直接落到 view-level 连续行为保护上。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过，7 files / 85 tests。
- 当前未完成项再补充：
  - 本轮 web 变更待提交 git commit。
- 下一步建议再补充：
  - 若继续沿 reintegration websocket 主线推进，下一步可检查 accept / reject 的 success feedback 是否也缺同级“先 record、再 soul-action”双事件链 retention 断言；若不缺，则可直接提交当前手动 planning 连续刷新回归增量。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/components/WorkerTaskDetail.test.ts` 新增 source note pill 与 output note 列表两条导航回归，直接锁定 detail overlay 点击后会把对应 note id 传给 `NoteDetail`，避免后续重构时把这两条已存在动作链路悄悄断开。
  - 这次补的是上一轮 detail overlay 行为验证的剩余空白面：当前 UI 不只是展示 worker task contract，还承担从 source/output 跳回 note 详情的联动职责，因此需要一条真正覆盖导航消费面的测试，而不是只测静态渲染。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/components/WorkerTaskDetail.test.ts` 通过，7 files / 70 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项再补充：
  - 本轮 web 变更待提交 git commit。
- 下一步建议再补充：
  - `LifeOS/packages/server/test/reintegrationApi.test.ts:803` 将现有 dispatch worker-task convergence contract 收紧为三方对齐：除了原本已锁住的 `result.workerTaskId -> worker-task-updated -> /api/worker-tasks` 链路外，新增断言 `DispatchSoulActionResponse.task` 本身也必须与同一 worker task id / sourceNoteId / taskType / status 集合同步。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/server/test/reintegrationApi.test.ts` 将 dispatch worker-task convergence contract 收紧为三方对齐：除了原本已锁住的 `result.workerTaskId -> worker-task-updated -> /api/worker-tasks` 链路外，新增断言要求 `DispatchSoulActionResponse.task` 本身也必须与各个 follow-up worker-task filter 结果一一对齐。
  - 这次补的不是同类 filter 平移，而是把之前尚未被锁住的一块真实 contract 面补齐：dispatch 响应自带的 `task` 对象必须和 websocket 事件、以及按 `sourceNoteId / taskType / worker / status` 组合过滤后的 worker-task 列表保持同一事实源，而不是只校验 `workerTaskId` 能串起来。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test --test-name-pattern "dispatch response worker task stays aligned with websocket and follow-up worker task list for grouped settings refresh" test/reintegrationApi.test.ts` 通过，1/1。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过。
  - 当前环境仍有 Node engine warning：包声明要求 `>=20 <21`，实际为 `v25.8.1`，但本轮测试与构建通过。
- 当前未完成项再补充：
  - server 侧 promotion/source 主语义残留已明显减少，但 `reintegrationApi.test.ts` 中仍可继续排查是否还有零散 follow-up 断言只校验 id 串联、未同时锁住 payload 全字段对齐。
  - 本轮 server 变更尚未提交 git commit。
- 下一步建议再补充：
  - 若继续沿当前高价值主线推进，优先检查其余 dispatch / worker-task follow-up contract 是否还存在“只锁 id、不锁 payload 对齐”的空档。
  - 若本轮先收口，也可以直接提交当前三方对齐 contract 修正，避免 `DispatchSoulActionResponse.task` 再次脱离 websocket / list 事实源。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/views/SettingsView.test.ts` 为 reintegration accept 与 reject 各新增 1 条 `reintegration-record-updated -> soul-action-updated` 双事件链 retention 回归，锁定 success feedback 在连续两次非 worker websocket 刷新后仍保持可见。
  - 这两条新用例继续要求刷新只联动 `fetchReintegrationRecords()` / `fetchSoulActions()`，不会误触发 `fetchWorkerTasks()`，把 accept / reject / manual planning 三条 reintegration success path 的 websocket 语义进一步收口一致。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过，7 files / 89 tests。
- 当前未完成项再补充：
  - 本轮 web 变更待提交 git commit。
- 下一步建议再补充：
  - 若继续沿 reintegration websocket 主线推进，下一步可回到 server contract，补 `DispatchSoulActionResponse.task` 与 `worker-task-updated` / follow-up worker-task list 的三方对齐断言；若保持 web 主线，则可直接提交当前 accept/reject 双事件链回归补强。
  - 同文件顶部同时把 websocket 测试里的事件类型收紧为 `SoulActionWsEvent` / `WorkerTaskWsEvent`，消除 `WsEvent` 联合类型中 `index-queue-complete` 无 `data` 字段造成的 tsc 漂移；这次不是纯类型整理，而是修复“定向测试能过、server build 却失败”的真实验证缺口。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/views/SettingsView.test.ts` 新增 2 条 reintegration feedback 连续 retention 回归，分别锁定 `接受并自动规划` 与 `手动补规划` 成功提示在先收到 `worker-task-updated`、再收到 `soul-action-updated` 两次连续 websocket 刷新后仍保持可见。
  - 这次继续只补最窄的 view 级保护面，不改运行时代码；目标是把当前 grouped governance / worker-task feedback retention 主线从 soul-action quick actions 延伸到 reintegration review 成功反馈，避免 accept / manual plan 消息在真实刷新链中掉失。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过，7 files / 80 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项再补充：
  - 本轮 web 变更待提交 git commit。
- 下一步建议再补充：
  - 若继续沿同一条 reintegration feedback retention 主线推进，可检查 reintegration reject success feedback 是否也缺同级连续 websocket retention 保护。
  - 若转回 server contract 侧，则优先寻找 reintegration review 刷新链与 worker-task filtered refresh 之间还未被锁住的事实源缺口。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/views/SettingsView.test.ts` 再新增 1 条 reintegration reject feedback 连续 retention 回归，锁定 `拒绝` 成功提示在先收到 `worker-task-updated`、再收到 `soul-action-updated` 两次连续 websocket 刷新后仍保持可见。
  - 这次继续沿同一条 reintegration review feedback 主线把最后一条同级成功动作补齐，避免 accept / manual plan 已有连续刷新保护，但 reject 仍在真实刷新链中掉消息而形成行为分叉。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过，7 files / 81 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项再补充：
  - 本轮 web 变更待提交 git commit。
- 下一步建议再补充：
  - 若定向测试与 build 通过，可直接提交当前 reintegration review feedback retention 补齐增量。
  - 若转回下一轮开发，可优先找 reintegration review refresh 链与 worker-task filtered refresh 之间还未被锁住的 server fact-source gap。
  - 这次补的是 web/client 直接可消费的共享 contract 缺口：前面只证明“任务确实被创建并能从 websocket/list 看到”，现在进一步锁住“dispatch 响应里直接返回的 `task` 也不能和后续事实源漂移”。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/server/test/reintegrationApi.test.ts` 继续把 grouped dispatch worker-task contract 从 `taskType + worker + status` 收紧到 `worker + status` 子表：在同一 `sourceNoteId` 下连续 dispatch `extract_tasks` 与 `update_persona_snapshot` 后，额外校验 `/api/worker-tasks?sourceNoteId=...&worker=lifeos&status=...` 仍能稳定命中对应 task，且返回 filters 与 dispatch response / websocket 的 worker、status 保持一致。
  - 这次补的是 worker-task filtered refresh 事实源里最后一个同级组合缺口：不仅 taskType 维度的子表要准，worker 维度的 status 子表在同组连续 dispatch 后也不能把两条 task 串在一起或悄悄漏项。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/reintegrationApi.test.ts` 通过，19/19。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过。
- 当前未完成项再补充：
  - 本轮 server 变更待提交 git commit。
- 下一步建议再补充：
  - 若定向测试与 build 通过，可直接提交当前 worker-task worker+status filtered refresh 收敛补强。
  - 若继续往下补，同主线优先检查是否还缺少 `sourceNoteId + status` 非 worker 子表与 full list / websocket 的同级收敛保护。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/server/test/reintegrationApi.test.ts` 继续把 grouped dispatch worker-task contract 从 `sourceNoteId + worker + status` 再补到 `sourceNoteId + status` 非 worker 子表：在同一 `sourceNoteId` 下连续 dispatch `extract_tasks` 与 `update_persona_snapshot` 后，额外校验 `/api/worker-tasks?sourceNoteId=...&status=...` 仍能稳定命中对应 task，且返回 filters.status 与 dispatch response / websocket 的 status 保持一致。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/server/test/reintegrationApi.test.ts` 将现有 dispatch worker-task convergence contract 收紧为更明确的三方对齐：现在除了 `result.workerTaskId -> worker-task-updated -> /api/worker-tasks` 之外，还要求 `DispatchSoulActionResponse.task` 的 `id/sourceNoteId/taskType/worker` 与 websocket 事件及 follow-up list 中命中的同一 task 保持一致。
  - 对 `status` 的处理保持真实运行时口径：websocket 事件与 follow-up list 只要求是合法状态集合成员，不再假设它一定与 dispatch 响应返回瞬间的 status 完全相等，从而避免把异步 worker 推进时序误当成 contract 本身。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test --test-name-pattern "dispatch response worker task stays aligned with websocket and follow-up worker task list for grouped settings refresh" test/reintegrationApi.test.ts` 通过，1/1。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过。
- 当前未完成项再补充：
  - 本轮 server 变更待提交 git commit。
- 下一步建议再补充：
  - 若继续沿 server contract 主线推进，下一步可检查 mixed-order grouped dispatch/filter 测试里是否也值得补上 `DispatchSoulActionResponse.task` 本体断言；若不继续扩，则可直接提交当前三方对齐收紧增量。
  - 这次补的是 worker-task filtered refresh 事实源中的最后一层 status-only 子表缺口，避免 future web/client 只按状态聚焦任务时出现“总表、worker 子表、taskType 子表都对，但纯 status 子表漏项或串 task”的分叉。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/reintegrationApi.test.ts` 通过，19/19。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过。
- 当前未完成项再补充：
  - 本轮 server 变更待提交 git commit。
- 下一步建议再补充：
  - 若定向测试与 build 通过，可直接提交当前 worker-task status-only filtered refresh 收敛补强。
  - 若继续往下补，应转去寻找新的 fact-source gap，而不是继续在当前 worker-task filter 维度做低边际对称扩张。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/api/client.ts` 新增 `fetchEventNodes()` 与 `fetchContinuityRecords()`，把刚上收进 shared 的 promotion projection list contract 真正落到 web typed client，而不是继续让后续页面/组件直接手写 fetch + 内联响应类型。
  - 新增 `LifeOS/packages/web/src/api/client.test.ts`，最小锁定这两条 client 会按 shared response shape 解析成功结果，并在 API 返回 error 时抛出对应错误，防止 event/continuity 投射链在真正接 UI 前又退回“server 有 contract、web client 无 typed seam”的状态。
  - 这次补的是新的 contract-to-client 投射缺口，不是继续在 settings websocket/retention 上做对称平移。
- 本轮验证结果补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/api/client.test.ts` 通过；当前 web test runner 会一并跑现有 9 个测试文件，合计 104 tests 全通过。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/reintegrationApi.test.ts` 通过，19/19。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过。
- 当前未完成项再补充：
  - 本轮 server 变更待提交 git commit。
- 下一步建议再补充：
  - 若定向测试与 build 通过，可直接提交当前 reintegration review-status follow-up list 收敛补强。
  - 若继续沿同一条 refresh 主线推进，可检查 reject 之后 `reviewStatus=rejected` / `pending_review` follow-up list 是否也缺同级 contract 保护。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/server/test/reintegrationApi.test.ts` 在 accept follow-up list 收敛断言之后，再补 reject API contract：锁定 `/api/reintegration-records?reviewStatus=rejected` 会稳定命中刚 reject 的 record，而 `/api/reintegration-records?reviewStatus=pending_review` 不再包含它。
  - 新断言继续只对齐 shared contract 的真实返回形状，并额外校验 follow-up record 的 `reviewReason/reviewedAt` 与 reject response 保持一致，把 reintegration review refresh 主线从 accept 扩到 reject。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/reintegrationApi.test.ts` 通过，20/20。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过。
- 当前未完成项再补充：
  - 本轮 server 变更待提交 git commit。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/server/test/reintegrationApi.test.ts` 新增一条 `mixed worker-host dispatch response tasks stay aligned with follow-up worker-task filters` contract test，专门覆盖真正走 worker host 的 mixed-order 场景：同一 `sourceNoteId` 下先 dispatch `extract_tasks`、保留 `update_persona_snapshot` 待发，随后再 dispatch 第二条，并分别校验两次 `DispatchSoulActionResponse.task` 与对应的 `/api/worker-tasks?sourceNoteId=...&taskType=...&worker=lifeos&status=...` follow-up 子表保持一致。
  - 这次刻意不再把 promotion 类 dispatch 硬套成 worker-task contract，而是把三方对齐断言放到真正会返回 `task` 的 worker-host 动作上，避免把“某类 action 本来就不产出 worker task”误判成 contract 缺陷。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test --test-name-pattern "mixed worker-host dispatch response tasks stay aligned with follow-up worker-task filters" test/reintegrationApi.test.ts` 通过，1/1。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过。
- 当前未完成项再补充：
  - 本轮 server 变更待提交 git commit。
- 下一步建议再补充：
  - 若继续沿 server contract 主线推进，下一步可检查同类 `DispatchSoulActionResponse.task` 三方对齐是否还缺 websocket 事件参与的 mixed-order worker-host 覆盖；若不继续扩，则可直接提交当前 mixed worker-host follow-up contract 增量。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/shared/src/types.ts` 新增 `reintegration-record-updated` websocket 事件类型；`LifeOS/packages/server/src/api/handlers.ts` 在 accept / reject reintegration review 后同步广播更新后的 record，补上 review 主线缺失的事件事实源，而不再只依赖 `worker-task-updated` / `soul-action-updated` 间接触发刷新。
  - `LifeOS/packages/server/test/reintegrationApi.test.ts` 新增 reject websocket contract，锁定 reject 后会收到 `reintegration-record-updated`，且事件中的 `reviewStatus/reviewReason/reviewedAt` 会与 reject response 和 follow-up rejected/pending 列表保持一致。
  - `LifeOS/packages/web/src/views/SettingsView.vue` 为 reintegration refresh 新增 `preserveMessage` 语义，并让 `reintegration-record-updated` 走与现有 review 刷新一致的 `loadReintegrationRecords + loadSoulActions` 链；`LifeOS/packages/web/src/views/SettingsView.test.ts` 同步新增 view 级回归，锁定 reject 成功提示经过该新 websocket 刷新后仍保持可见。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/reintegrationApi.test.ts` 通过，21/21。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过，7 files / 82 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项再补充：
  - 本轮 server/web/shared 变更待提交 git commit。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/views/SettingsView.test.ts` 在现有 accept 三段连续刷新回归之外，再新增 1 条“只经过 `reintegration-record-updated`” 的 view-level 断言：锁定 accept 成功提示在不依赖 `worker-task-updated` 或 `soul-action-updated` 的情况下，也能仅凭新引入的 reintegration review websocket 刷新链继续保留。
  - 这次补的是上一轮 websocket 事件拆分后的最小前端闭环：既然 `reintegration-record-updated` 已经成为独立事实源，就应显式证明 web 端只收到这条事件时也不会丢掉 review success feedback，而不是继续只在混合刷新序列里间接覆盖。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过，7 files / 83 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/reintegrationApi.test.ts` 通过，22/22。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项再补充：
  - 本轮 server/web/shared 变更待提交 git commit。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/server/test/reintegrationApi.test.ts` 在 reject 事件回归之外，再新增 accept 路径的 `reintegration-record-updated` websocket contract：锁定 accept 后会先收到更新后的 reintegration record，再收到两条对应的 `soul-action-updated`，且 record 事件里的 `reviewStatus/reviewReason/reviewedAt` 与 accept response 及 accepted/pending follow-up 列表保持一致。
  - 这次继续停留在同一条 review refresh 主线，不做对称整理；目标是把上一轮刚引入的独立 reintegration websocket 事实源，在 accept 场景也正式锁成 server contract，避免新事件只被 reject 路径覆盖。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/reintegrationApi.test.ts` 通过，22/22。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过，7 files / 82 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项再补充：
  - 本轮 server/web/shared 变更待提交 git commit。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/views/SettingsView.vue:1583` 将 soul-action websocket 刷新改成在当前 `soulActionMessageType === 'success'` 且已有消息时沿用 `preserveMessage`，避免刚显示出的 dispatch 成功反馈被随后的 `worker-task-updated` / `soul-action-updated` 自动刷新立即清空。
  - `LifeOS/packages/web/src/views/SettingsView.test.ts:926` 新增 view 级回归，锁定单条 dispatch 成功后即使立刻收到 `worker-task-updated`，`workerTasks` / `reintegration` / `soulActions` 会正常刷新，但 `Worker Task` 成功反馈仍保持可见。
  - 这次补的是上一轮新引入 feedback contract 的真实后半段：如果 websocket 自动刷新会把成功消息立刻抹掉，那前一轮把 `workerTaskId` 暴露到 UI 的价值就会被抵消；因此这里修的是消息保留的根因，而不是再加一层表面文案。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过，3 files / 51 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/views/SettingsView.test.ts:955` 新增 `soul-action-updated` 分支下的 dispatch feedback retention 回归，锁定单条 dispatch 成功后即使马上收到 `soul-action-updated`，`reintegrationRecords` / `soulActions` 仍会刷新，但带 `Worker Task` 的成功提示不会被清空。
  - 这次不再改运行时，而是把上一轮已经修好的 `preserveMessage` 根因保护扩到另一条同级 websocket 分支，避免回归只在 `worker-task-updated` 路径成立、换到 `soul-action-updated` 就再次退化。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过，3 files / 52 tests。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/views/SettingsView.test.ts` 新增 1 条 group quick action 连续 retention 断言，锁定批量 dispatch 成功提示在先收到 `worker-task-updated`、再收到 `soul-action-updated` 两次连续 websocket 刷新后仍保持可见。
  - 这次补的是 grouped governance quick action 的连续事件链保护：此前只锁住了单条 dispatch feedback 在连续刷新后的保留语义，还没有覆盖用户同样可见的批量 dispatch 成功提示。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过，7 files / 77 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/views/SettingsView.test.ts` 新增 1 条 group approve quick action 连续 retention 断言，锁定批量 approve 成功提示在先收到 `worker-task-updated`、再收到 `soul-action-updated` 两次连续 websocket 刷新后仍保持可见。
  - 这次补齐 grouped governance 成功反馈的另一条同级主线：批量 dispatch 已有连续刷新保护后，批量 approve 也需要在同样的真实刷新序列里稳定保留消息，避免两种 quick action 行为再次分叉。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过，7 files / 78 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/views/SettingsView.test.ts:381` 新增 `worker-task-updated` 分支下的 grouped summary / filtered groups 收敛回归，锁定当 quick filter 处于 `dispatch_ready_only` 时，websocket 刷新后 `workerTasks` / `reintegrationRecords` / `soulActions` 会一起刷新，同时 `quickFilterStats`、`groupCount`、`groups.length` 与 `summary` 仍保持同一事实源语义。
  - 这次补的是 `SettingsView` 三路刷新中的一条组合 contract：此前只在 `soul-action-updated` 下锁过 grouped 聚合/过滤收敛，还没有覆盖 `worker-task-updated` 这条更宽的联动刷新分支。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过，3 files / 53 tests。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/views/SettingsView.test.ts:300` 将既有 `index-queue-complete` 回归从“state/filter/groups 不漂移”收紧为“state/filter/groups + quickFilterStats + groupCount + summary 全部不漂移”，并继续锁定这条非治理事件不会误触发 worker/reintegration/soul-action loaders。
  - 这次补的是 grouped governance 的非治理刷新边界：即使全局 index 队列事件到来，面板当前聚合统计也不应被悄悄改写或重算成不同语义。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SettingsView.test.ts` 通过，3 files / 53 tests。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/server/test/reintegrationApi.test.ts:869` 将 dispatch worker-task convergence contract 再收紧一层：除现有 `response.task -> worker-task-updated -> /api/worker-tasks?sourceNoteId=...` 三方对齐外，新增 `taskType` 过滤后的 follow-up worker task 列表也必须包含同一 task，并回传正确的 `filters.taskType`。
  - 这次补的是 shared/server 事实源里还没锁住的查询过滤 contract，直接保护 web/client 未来如果按 taskType 聚焦 worker task 时，不会出现“总表对了、过滤表漂移”的分叉。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/reintegrationApi.test.ts` 通过，19/19。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/server/test/reintegrationApi.test.ts:873` 将同一 dispatch worker-task convergence contract 再补一层 `status` 过滤：除了总表与 `taskType` 子表外，按 `dispatched.task.status` 过滤后的 follow-up worker task 列表也必须包含同一 task，并正确回传 `filters.status`。
  - 这次继续补的是 shared/server 事实源里的查询过滤 contract，避免未来 worker task 面板若切到某个 status 过滤时，出现“dispatch 响应、websocket、总表都对，但 status 子表漏项”的分叉。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/reintegrationApi.test.ts` 通过，19/19。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/web/src/components/NoteDetail.vue` 将笔记详情里的三条 worker task 创建成功反馈统一收敛为直接消费返回 task contract，不再只给模糊提示语；成功后会稳定展示 `task.id + taskType + status + worker` 的本地化组合消息。
  - 同文件新增 `workerTaskCreatedMessage()` 以及 taskType / worker / status 三组本地化 helper，把 `summarize_note`、`openclaw_task`、`extract_tasks` 等创建反馈口径与现有 worker task 列表/详情保持一致，避免再次泄漏原始枚举值。
  - 新增 `LifeOS/packages/web/src/components/NoteDetail.test.ts`，覆盖摘要任务、OpenClaw 任务、行动项提取三条创建路径，锁定成功提示直接展示本地化 worker task 元数据，而不是旧的泛化文案。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/components/NoteDetail.test.ts` 通过；实际跑到当前 web 测试全集，6 files / 60 tests。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web build` 通过。
- 当前未完成项再补充：
  - 本轮 `NoteDetail` web 变更待提交 git commit。
- 下一步建议再补充：
  - 若继续沿“worker task contract 直接投射到 UI”这条线推进，下一步优先检查 `NoteDetail` 下方关联任务列表/详情以外，是否还有创建入口或 toast 仍在复用泛化提示文案。
  - 若没有新的真实 contract 缺口，就应结束这一轮，避免再回到 grouped governance / worker-task filter 的低边际对称补强。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/server/src/db/schema.ts` 将 `soul_actions` 的唯一约束从 `UNIQUE(source_note_id, action_kind)` 收紧为 `UNIQUE(source_note_id, action_kind, source_reintegration_id)`，使 promotion action 的幂等键真正落在“原始 source note + action kind + 显式 reintegration source”三元组上，不再把不同 reintegration 误撞成同一条 action。
  - `LifeOS/packages/server/src/db/client.ts` 同步把 `ensureSoulActionsTable()` 的 rebuild 判定扩到唯一约束形态；旧库即使已经有 `source_reintegration_id` 列，只要仍保留旧的二元唯一键，也会被自动重建到新 schema，避免运行时继续被历史约束卡住。
  - `LifeOS/packages/server/test/feedbackReintegration.test.ts` 新增同一 `sourceNoteId` 下两条不同 reintegration record 的回归测试，锁定 `acceptReintegrationRecordAndPlanPromotions()` 会为两条 record 各自产生独立的 event/continuity promotion actions，而不是被旧唯一键错误复用或冲突。
  - `LifeOS/packages/server/test/db.test.ts` 同步补一条 schema 级断言，直接锁定 `soul_actions` 表的建表 SQL 中包含新的三元唯一约束。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/db.test.ts test/feedbackReintegration.test.ts` 通过，54/54。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过。
  - 当前环境仍有 Node engine warning：包声明要求 `>=20 <21`，实际为 `v25.8.1`，但本轮定向测试与构建均通过。
- 当前未完成项再补充：
  - planner / API 主链虽然已经能稳定携带 `sourceReintegrationId`，但 `sourceNoteId = record.sourceNoteId ?? record.id` 的兼容回退仍在；若下一轮继续沿同一主线推进，可再评估是否要把“promotion action 的 sourceNoteId 始终回到真实 note id”进一步从 planner 层彻底收口。
  - 本轮 server 变更仍未提交 git commit。
- 本轮继续完成的真实实现再补充：
  - `LifeOS/packages/server/src/db/client.ts` 继续把 `soul_actions` rebuild 迁移收紧到“事实源一致性”层：对历史 PR6 promotion action，若旧库把 reintegration id 暂存在 `source_note_id`，迁移时会自动拆分成 `source_reintegration_id = reint:*`，并把 `source_note_id` 收回到稳定主键 `id`，不再把兼容占位值继续留在主事实字段里。
  - 这样旧的 `sourceNoteId = reint:*` fallback 仍可被 executor 兼容读取，但数据库重建后新增 schema 会尽量把 promotion source 的真实语义放回显式列，而不是继续让 `source_note_id`/`source_reintegration_id` 双字段语义缠绕。
  - `LifeOS/packages/server/test/db.test.ts` 新增 legacy migration 回归测试，直接构造仅有旧二元唯一键、且把 reintegration id 塞在 `source_note_id` 的历史 `soul_actions` 表，锁定 `initDatabase()` 重建后会把该 promotion action 收敛为显式 `source_reintegration_id`。
- 本轮验证再补充：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS/packages/server" exec node --import tsx --test test/db.test.ts test/feedbackReintegration.test.ts` 通过，55/55。
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server build` 通过。
- 当前未完成项再补充：
  - planner 侧 `record.sourceNoteId ?? record.id` 兼容回退仍保留；当前 schema/migration 已把旧库历史 promotion action 尽量收口到显式 `source_reintegration_id`，但新建 planning 路径尚未彻底去掉该 fallback。
  - 本轮 server 变更仍未提交 git commit。
- 下一步建议再补充：
  - 下一轮优先检查 `plan/list/API/web label` 这条新事实源链上，是否还能在用户可见层误把 reintegration id 当作 source note 展示；若没有新的真实 gap，就直接提交这一轮 schema + migration 根因修复，不再回去深挖 grouped governance 的同类补强。
