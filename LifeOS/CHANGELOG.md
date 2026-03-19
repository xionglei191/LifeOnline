## 2026-03-20 - 拆分 websocket 队列完成事件语义

### 工作内容

继续收口 websocket 语义边界：把“队列已清空”和“全量索引完成并带结果”拆成两个独立事件，并同步更新前端监听逻辑，减少 `index-complete` 的语义过载。

### 本次变更

#### 1. 拆分共享 websocket 事件协议
- `packages/shared/src/types.ts`
- `index-complete` 现在必须携带 `IndexResult`
- 新增无 payload 的 `index-queue-complete` 事件，用于表达索引队列处理完毕

#### 2. server 队列广播改为显式发送 queue-complete
- `packages/server/src/indexer/indexQueue.ts`
- 队列处理完成后不再广播泛化的 `index-complete`
- 改为广播 `index-queue-complete`
- `POST /api/index` 与 `POST /api/config` 这类真正返回 `IndexResult` 的全量索引路径继续保留 `index-complete`

#### 3. 前端监听统一复用 websocket helper
- `packages/web/src/composables/useWebSocket.ts`
- 新增：
  - `isIndexRefreshEvent(...)`
  - `isIndexSettledEvent(...)`
- `App.vue`、`SettingsView.vue`、`NoteDetail.vue`、`useDashboard.ts`、`useCalendar.ts`、`useTimeline.ts`、`useDimensionNotes.ts` 统一改为复用 helper，避免散落的硬编码事件判断

### 行为变化
- `index-complete` 语义收紧为：有完整 `IndexResult` 的索引完成事件
- `index-queue-complete` 语义明确为：增量索引队列已经处理完毕
- 前端自动刷新行为保持不变，但事件语义更清晰

### 本地验证结果
- `pnpm --dir "/home/xionglei/Project/LifeOnline/LifeOS" --filter web build`
- `pnpm --dir "/home/xionglei/Project/LifeOnline/LifeOS" check`
- 结果：通过

## 2026-03-19 - 收尾 server 本地重复逻辑，统一 worker 持久化与维度元数据

### 工作内容

完成最后一轮保守收尾，把 server 内部仍然局部重复的逻辑继续收口到已有 helper，不改变 worker 行为、输出路径或调度语义。

### 本次变更

#### 1. 维度元数据集中化
- 新增 `packages/server/src/utils/dimensions.ts`
- 统一维护：
  - dimension -> 目录名
  - dimension -> 展示名
  - 目录名 -> dimension
  - report 使用的维度顺序
- `packages/server/src/indexer/parser.ts` 改为复用共享目录反查 helper
- `packages/server/src/vault/fileManager.ts` 改为复用共享目录映射 helper
- `packages/server/src/workers/workerTasks.ts` 的日报/周报维度统计改为复用共享展示名与维度列表

#### 2. worker 结果笔记写回流程复用
- `packages/server/src/workers/workerTasks.ts` 新增 `persistWorkerGeneratedMarkdownNote(...)`
- 统一复用 `buildWorkerResultFrontmatter(...)` + `matter.stringify(...)` + `persistGeneratedNote(...)`
- 已接入：
  - `persistOpenClawResult(...)`
  - `persistSummarizeNoteResult(...)`
  - `persistClassifyInboxResult(...)`
  - `persistDailyReportResult(...)`
  - `persistWeeklyReportResult(...)`

#### 3. worker 笔记查询复用
- `packages/server/src/workers/workerTasks.ts` 新增：
  - `getRequiredWorkerNote(...)`
  - `getWorkerNoteTitle(...)`
- `runSummarizeNoteDirect(...)` 与 `runExtractTasks(...)` 不再重复同一段 SQLite 查询和标题兜底逻辑

#### 4. 继续复用共享日期 helper
- `packages/server/src/workers/workerTasks.ts` 继续统一改用 `packages/server/src/utils/date.ts` 的 `getTodayDateString()`
- `packages/server/src/ai/taskExtractor.ts`、`packages/server/src/api/handlers.ts` 与 worker 侧日期默认值保持一致

### 行为变化
- 无新增外部能力
- 无 API 形状变化
- 无调度语义变化
- worker 输出文件名、目录与现有落盘行为保持不变

### 本地验证结果
- 构建通过：`pnpm --dir "/home/xionglei/Project/LifeOnline/LifeOS" --filter server build`

## 2026-03-18 - 新增 summarize_note 第二类 worker task + WorkerTaskCard 共享组件

### 工作内容

继续完善 worker task 体系：抽取共享组件、新增第二类任务类型、重构 OpenClaw 调用层。

### 本次变更

#### 1. 抽取 WorkerTaskCard 共享组件
- 新增 `packages/web/src/components/WorkerTaskCard.vue`
- Settings 和 NoteDetail 统一复用，消除重复的任务卡片渲染代码
- 支持 `open-detail`、`open-output`、`cancel`、`retry` 事件
- 提供 `extra-actions` 插槽供父组件扩展

#### 2. 新增 summarize_note worker task 类型
- `packages/shared/src/types.ts`：扩展 `WorkerTaskType`、`WorkerTaskInputMap`、`WorkerTaskResultMap`
- `packages/server/src/db/schema.ts`：`task_type` CHECK 约束新增 `summarize_note`
- `packages/server/src/integrations/openclawClient.ts`：
  - 重构为通用 `callOpenClaw<T>` 泛型调用器，统一 fetch/abort/timeout/error 逻辑
  - `runCollectTrendingNews` 改为调用 `callOpenClaw`，消除重复代码
  - 新增 `validateSummarizeNoteResult` 校验器
  - 新增 `runSummarizeNote` 函数
- `packages/server/src/workers/workerTasks.ts`：
  - 新增 `normalizeTaskInput` 统一输入规范化
  - 新增 `buildSummarizeNoteMarkdown` + `persistSummarizeNoteResult`
  - `executeWorkerTask` 支持 `summarize_note` 分发
- `packages/server/src/api/handlers.ts`：
  - `parseWorkerTaskType` 接受 `summarize_note`
  - `createWorkerTaskHandler` 校验 `summarize_note` 必须提供 `noteId`

#### 3. 前端入口
- `NoteDetail.vue` 新增"生成笔记摘要"按钮
- `WorkerTaskCard.vue` 支持 `summarize_note` 标签和输入展示
- `SettingsView.vue` 任务类型筛选下拉新增"笔记摘要"选项
- 修复 `SettingsView.vue` 缺失的 `formatTime` 函数

### 行为变化
- `POST /api/worker-tasks` 现在接受 `taskType: 'summarize_note'`
- 摘要结果笔记写入 `学习/` 目录，`source: openclaw`，tags 含 `summary`
- 前端可从 NoteDetail 直接发起笔记摘要任务

## 2026-03-18 - Worker Task 查询规范化 + 任务详情弹层

### 工作内容

继续完善 worker task 的可操作性与可观测性，把查询接口规范化为通用 filters，并新增独立的任务详情弹层组件。

### 本次变更

#### 1. 后端查询接口规范化
- `listWorkerTasks` 改为通用 `WorkerTaskListFilters`，支持 `status`、`taskType`、`worker`、`sourceNoteId` 四维过滤
- `GET /api/worker-tasks` 响应中回显当前生效的 `filters`
- 新增 `WorkerTaskListFilters` 共享类型（`packages/shared/src/types.ts`）
- handler 层新增 `parseWorkerTaskStatus`、`parseWorkerTaskType`、`parseWorkerName` 校验函数

#### 2. 前端任务列表增强
- Settings 任务区新增 `taskType` 筛选下拉
- 每条任务卡片展示更多上下文：worker / taskType / sourceNoteId 简写 / 输出数量 / 开始时间 / 完成时间
- 空结果态：筛选无结果时显示"当前筛选下没有任务"
- NoteDetail 关联任务区新增 `status` 筛选 + 刷新按钮
- NoteDetail 空结果态区分"未发起过任务"与"当前筛选下没有关联任务"

#### 3. 新增 WorkerTaskDetail 组件
- `packages/web/src/components/WorkerTaskDetail.vue`
- 独立弹层展示单条任务完整信息：时间线、输入参数 JSON、结果摘要、错误详情、输出笔记列表
- 支持直接重试 / 取消 / 刷新
- 支持点击 sourceNoteId 打开关联笔记
- 支持点击输出笔记打开 NoteDetail
- 接入 WebSocket 自动刷新（worker-task-updated 事件）
- Settings 和 NoteDetail 均可通过"查看详情"按钮打开

### 行为变化
- `GET /api/worker-tasks` 现在支持 `taskType` 和 `worker` query 参数
- Settings 和 NoteDetail 的任务卡片新增"查看详情"入口

## 2026-03-18 - LifeOS 收回编排主导权，OpenClaw 改为按需 worker

### 工作内容

完成一次架构收敛：LifeOS 后端持有任务请求、调用外部 worker、校验结果并落成标准笔记。

### 本次变更

#### 1. 新增 worker task 一等模型
- `packages/shared/src/types.ts` 新增 `WorkerTask`、`WorkerTaskStatus` 与首批 worker task 输入/输出类型
- `packages/server/src/db/schema.ts` 新增 `worker_tasks` 表与相关索引
- 任何 OpenClaw 结果都必须先关联到一条 LifeOS 持有的任务记录

#### 2. OpenClaw 调用独立封装
- 新增 `packages/server/src/integrations/openclawClient.ts`
- 统一处理 OpenClaw 配置、超时、网络错误与返回结构校验
- 首版先用早期专用 OpenClaw endpoint 验证链路

#### 3. 结果转笔记闭环收敛到 LifeOS
- 新增 `packages/server/src/workers/workerTasks.ts`
- LifeOS 负责把 worker 结果写成 Markdown 笔记
- 写入后继续复用 `getIndexQueue()?.enqueue(filePath, 'upsert')`
- 所有新 worker 结果笔记统一写 `source: openclaw`

#### 4. 新增 worker task API
- `POST /api/worker-tasks`
- `GET /api/worker-tasks`
- `GET /api/worker-tasks/:id`
- `POST /api/worker-tasks/:id/retry`
- `POST /api/worker-tasks/:id/cancel`
- `openclaw_task` 首先作为试点任务落地，后续继续收敛为统一类型
- 支持 `pending/running/succeeded/failed/cancelled` 状态流转

#### 5. 前端主入口改造
- `packages/web/src/views/SettingsView.vue` 统一以 worker task 作为任务入口
- 可手动发起外部执行任务，并查看最近任务状态 / 摘要 / 输出笔记
- 成功结果从纯路径升级为可点击笔记入口，可直接打开 `NoteDetail`
- `failed/cancelled` 任务支持重试，`pending/running` 任务支持取消
- 原“一键整理 Inbox”收敛为补充性的手动任务入口
- `NoteDetail.vue` 中的行动项提取改为直接创建 worker task

### 行为变化
- OpenClaw 不再是默认的持续自治整理主流程
- 没有 task record，不允许产出最终结果笔记
- 历史同步 AI 路由已移除，当前统一走 worker task API

## 2026-03-18 - 笔记删除能力与启动配置修复完成

### 工作内容

为 LifeOS 看板补全笔记删除能力，并完成一次本地端到端验证；同时修复 server 配置文件路径解析逻辑，确保根目录启动开发环境时也能正确读取配置。

### 本次变更

#### 1. 笔记删除能力
- 在 `packages/web/src/components/NoteDetail.vue` 增加 Danger Zone 删除入口
- 新增删除确认弹层，明确提示会删除 Vault 中真实 Markdown 文件
- 删除中按钮进入 loading / disabled，避免重复点击
- 删除成功后关闭详情，并通过 `deleted` 事件通知父层刷新

#### 2. 前后端接口补齐
- `packages/web/src/api/client.ts` 新增 `deleteNote(id)`
- `packages/server/src/api/routes.ts` 注册 `DELETE /api/notes/:id`
- `packages/server/src/api/handlers.ts` 新增 `deleteNote()`
- 保持后端只删文件，不直接删数据库记录

#### 3. 文件操作统一入口
- `packages/server/src/vault/fileManager.ts` 新增 `deleteFile(filePath)`
- 统一服务端文件层操作入口，便于后续扩展

#### 4. 宿主视图刷新收敛
- `DimensionView.vue`
- `SearchView.vue`
- `TimelineView.vue`
- `CalendarView.vue`
- `DashboardOverview.vue`

以上视图全部接入 `@deleted`，删除后主动清空 `selectedNoteId` 并执行刷新。

#### 5. 启动配置路径修复
- `packages/server/src/config/configManager.ts`
- 改为基于 `import.meta.url` 解析 `SERVER_ROOT`
- 消除 server 在根目录 `pnpm dev` 下读取错误本地开发示例 Vault 的问题
- 现在根目录和 `packages/server` 目录启动都能指向同一个 `packages/server/config.json`

### 本地验证结果

- 构建通过：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" build`
- 根目录启动通过：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" dev`
- 删除接口实测通过：`DELETE /api/notes/:id` 返回 200
- 文件删除后 watcher 收到 `unlink`
- indexer 删除 DB 记录并广播 websocket 更新
- 删除后 `GET /api/notes/:id` 返回 404
- growth 列表中对应笔记消失

### 影响范围

- 前端：NoteDetail 与 5 个宿主视图
- 后端：notes 删除接口、配置路径解析
- 文件系统：真实删除 Vault Markdown 文件
- 架构：继续沿用 watcher / index queue / indexer 收敛，不引入双写

## 2026-03-17 - 前端控制台重构与性能优化完成

### 工作内容

完成 LifeOS Web 前端第一轮系统级视觉重构，并完成首轮前端性能打磨。

### 补充微调

- 对首页、时间线、统计页、搜索页、日历页、维度页的英雄标题做二次收敛
- 降低主标题尺寸与压迫感，优化中轴版面呼吸感
- 保留局部颜色强调，移除斜体强调
- 将标题策略同步为当前仓库文档基线

### 本次改造范围

#### 1. App Shell + Dashboard 重构
- 重构全局主题变量与明暗主题色板
- 重构顶部品牌区、导航区、系统状态区、搜索区
- 仪表盘升级为“LifeOS Mission Control”总控台布局
- 今日待办升级为任务队列
- 八维度统计升级为生命矩阵
- AI 建议升级为系统洞察流

#### 2. Timeline + Stats 重构
- 时间线页面升级为“生命轨道”视图
- 新增时间窗口摘要、轨道活跃度与更强的维度信号表达
- 统计页升级为“生命信号分析面板”
- 重绘 ECharts 容器、图表配色、图例、网格与交互状态

#### 3. Dimension + Detail 层重构
- 维度详情页统一到控制台视觉体系
- 重构维度概览头、健康环、分析面板
- 重构筛选栏、记录列表卡片
- 重构 NoteDetail 详情弹层

#### 4. 前端性能优化
- ECharts 改为按需注册与按需导入
- 抽离 `packages/web/src/lib/echarts.ts`
- Vite manualChunks 拆分 `echarts` 与 `zrender`
- 为时间线轨道区和记录列表添加 `content-visibility`

### 性能结果

构建优化前：
- `echarts` 单包约 `1119 kB`

构建优化后：
- `echarts` 约 `382 kB`
- `zrender` 约 `175 kB`
- 已消除 Vite 大 chunk 告警

### 影响范围

- 前端视觉：大范围重构
- 前端性能：首轮优化完成
- 无后端 API 变更
- 无数据库结构变更

### 验证

- 执行 `pnpm --filter @lifeos/web build`
- 结果：构建通过

### 延伸空间

- 统一空状态 / 加载态 / 错误态细节
- 做移动端适配与触摸交互打磨
- 视需要继续做更细粒度懒加载与交互性能优化

## 2026-03-17 - 前端视觉设计说明归档

### 工作内容

补充 LifeOS 前端视觉设计说明，作为该阶段的设计记录保留。

### 变更摘要

- 补充当时的前端视觉设计说明
- 明确产品视觉方向为 `LifeOS Mission Control`
- 补充当前前端视觉问题分析
- 定义全局视觉系统、信息架构升级方向、八维度视觉协议
- 制定分阶段实施顺序与验收标准

### 设计结论

前端后续改造不应停留在换皮层面，而应围绕以下目标推进：
- 从通用管理后台升级为更强的个人控制台体验
- 强化首页总控台叙事
- 将八维度沉淀为稳定视觉资产
- 统一仪表盘、时间线、统计页、维度页的系统感

### 影响范围

- 文档更新：前端视觉设计记录
- 无代码逻辑改动
- 无 API / 数据结构改动

### 延伸空间

- 优先重构 `App Shell + Dashboard`
- 再推进 `Timeline + Stats`
- 最后统一维度页、动效和响应式体验

## 2026-03-16 - WebSocket 与索引队列完成

### 工作内容

完成 LifeOS WebSocket + 索引队列 + 错误恢复 + 手动重索引

**耗时**: 约 2 小时

### 实施清单

#### WebSocket 实时推送系统
- [x] 安装 ws 和 @types/ws 依赖
- [x] 创建 WebSocket 服务（wsServer.ts）
  - 附加到 HTTP server，路径 `/ws`
  - 广播 `file-changed` / `index-complete` / `index-error` 事件
- [x] 前端 WebSocket composable（useWebSocket.ts）
  - 原生 WebSocket API
  - 自动重连（指数退避，最大 10s）
  - 派发 CustomEvent 到 document
- [x] Vite proxy 配置 `/ws` 路径

#### 索引队列系统
- [x] 创建 IndexQueue 类（indexQueue.ts）
  - 300ms 去抖
  - 串行处理
  - 3 次重试，间隔 1s
  - 错误记录（最多 100 条）
- [x] 重构 FileWatcher 使用 IndexQueue
  - 替代直接调用 indexFile/deleteFileRecord
  - 添加 error 事件处理
  - 自动重启（最多 5 次，指数退避）

#### 索引状态/错误 API
- [x] `GET /api/index/status` — 队列状态
- [x] `GET /api/index/errors` — 错误列表
- [x] `POST /api/index` — 广播 index-complete
- [x] `POST /api/config` — 广播 index-complete

#### 前端自动刷新
- [x] useDashboard — 监听 ws-update 事件
- [x] useTimeline — 监听 ws-update 事件
- [x] useCalendar — 监听 ws-update 事件
- [x] useDimensionNotes — 监听 ws-update 事件

#### App.vue 增强
- [x] 初始化 WebSocket 连接
- [x] 索引进行中时显示旋转动画 + "索引中"
- [x] WebSocket 断开时显示"离线"徽章

#### SettingsView 增强
- [x] 手动重新索引按钮
- [x] 索引错误日志展示
- [x] WebSocket 连接状态显示
- [x] 索引队列状态显示

#### API 客户端扩展
- [x] triggerIndex() 返回 IndexResult
- [x] fetchIndexStatus()
- [x] fetchIndexErrors()

### 技术决策

#### 1. WebSocket 库：ws
- **原因**: Node.js 生态最成熟的 WebSocket 库，轻量稳定
- **配置**: 附加到 HTTP server，路径 `/ws`
- **前端**: 原生 WebSocket API，无需额外依赖

#### 2. 索引队列：Map + 去抖
- **原因**: 快速连续修改同一文件只触发一次索引
- **去抖时间**: 300ms（平衡响应速度和性能）
- **串行处理**: 避免并发索引导致的数据库锁竞争

#### 3. 错误恢复：指数退避
- **FileWatcher**: 最多 5 次重启，2s → 4s → 8s → 16s → 32s
- **WebSocket**: 最多重连，1s → 2s → 4s，最大 10s
- **索引重试**: 最多 3 次，每次间隔 1s

#### 4. 前端事件分发：CustomEvent
- **原因**: 解耦 WebSocket 和各 composable
- **实现**: WebSocket 消息 → CustomEvent → document → 各 composable 监听
- **优势**: 避免 composable 之间的直接依赖

### 遇到的问题与解决

#### 问题 1: chokidar glob 模式无法匹配文件
**现象**: 使用 `chokidar.watch('${vaultPath}/**/*.md')` 监听，但 `getWatched()` 返回空对象 `{}`，无法检测文件变更

**根本原因**:
1. 早期实现中的相对示例 Vault 路径会受启动目录影响
2. `path.join()` 生成的路径在 chokidar glob 模式中不可靠

**解决方案**:
1. 在 `configManager.ts` 中添加 `resolveVaultPath()` 函数，将相对路径转换为绝对路径
   ```typescript
   function resolveVaultPath(vaultPath: string): string {
     if (vaultPath.startsWith('~')) {
       return path.join(process.env.HOME || '', vaultPath.slice(1));
     }
     if (path.isAbsolute(vaultPath)) return vaultPath;
     return path.resolve(SERVER_ROOT, vaultPath);
   }
   ```
2. 在 `FileWatcher` 构造函数中使用 `path.resolve()` 确保路径为绝对路径
3. 改用 `chokidar.watch(vaultPath)` 监听目录而非 glob 模式，配合 `depth: 99` 递归监听子目录
4. 在事件处理函数中手动过滤 `.md` 文件
5. 添加 `awaitWriteFinish` 选项避免重复索引

**影响**: 文件监听正常工作，成功监听 11 个目录

示例日志：
```
FileWatcher: resolved vault path = <local-dev-vault>
FileWatcher: watching directory: <local-dev-vault>
FileWatcher: ready and watching for changes
FileWatcher: number of watched directories: 11

File changed: <local-dev-vault>/健康/2026-03-16-测试WebSocket.md
Indexed file: <local-dev-vault>/健康/2026-03-16-测试WebSocket.md
```

#### 问题 2: chokidar error 事件类型错误
**现象**: `Argument of type '(error: Error) => void' is not assignable to parameter of type '(err: unknown) => void'`

**原因**: chokidar v5 的 error 事件参数类型是 `unknown`，不是 `Error`

**解决**: 修改参数类型为 `unknown`
```typescript
.on('error', (error: unknown) => {
  console.error('FileWatcher error:', error);
  this.handleError();
})
```

**影响**: 编译通过

#### 问题 3: Vite WebSocket 代理配置
**现象**: 前端 WebSocket 连接到 `ws://localhost:5173` 无法到达后端

**原因**: Vite 默认只代理 `/api` 路径，WebSocket 需要单独配置

**解决**: 添加 `/ws` 代理配置
```typescript
proxy: {
  '/api': 'http://localhost:3000',
  '/ws': {
    target: 'ws://localhost:3000',
    ws: true,
  }
}
```

**影响**: WebSocket 连接正常

### 性能数据

| 操作 | 耗时 | 备注 |
|------|------|------|
| WebSocket 连接建立 | ~50ms | 握手 + 升级 |
| 索引队列入队 | <5ms | Map.set() |
| 索引队列处理（单文件）| ~30ms | indexFile() |
| WebSocket 广播 | <10ms | 遍历所有客户端 |
| 前端 CustomEvent 分发 | <5ms | document.dispatchEvent() |
| 前端自动刷新 | ~50ms | API 请求 + 渲染 |

### 变更摘要

- 引入 WebSocket 推送与 IndexQueue，统一实时刷新链路
- 增强 watcher / 索引恢复能力，并补充手动 reindex 入口
- 前端各视图接入自动刷新与索引状态展示
- 补齐 `/ws` 代理与相关 API 支撑

---

## 2026-03-16 - 实时索引与 Vault 配置完成

### 工作内容

完成 LifeOS 实时索引 + Vault 配置 + 文件监听

**耗时**: 约 2 小时

### 变更摘要

- 增加实时文件监听、Vault 配置管理与设置页入口
- 让增量索引从全量流程中拆出，支持单文件更新与删除同步
- 补齐配置 API、路径校验和重新索引能力
- 为后续实时刷新和任务系统演进打下基础

### 遇到的问题与解决

#### 问题 1: chokidar 类型错误
**现象**: `Cannot find namespace 'chokidar'`

**原因**: chokidar v5 导出 FSWatcher 类，不是命名空间

**解决**: 使用 `import chokidar, { type FSWatcher as ChokidarWatcher } from 'chokidar'`

**影响**: 类型检查通过

#### 问题 2: sql.js 缺少类型定义
**现象**: `Could not find a declaration file for module 'sql.js'`

**原因**: sql.js 包没有自带 TypeScript 类型定义

**解决**: 创建 `src/types/sql.js.d.ts`，定义 Database、Statement 接口

**影响**: 编译通过，类型安全

#### 问题 3: tsconfig rootDir 冲突
**现象**: `File 'scripts/init-db.ts' is not under 'rootDir'`

**原因**: tsconfig 包含 scripts 目录，但 rootDir 设为 src

**解决**: 从 include 中移除 `scripts/**/*`

**影响**: 构建成功

### 性能数据

| 操作 | 耗时 | 备注 |
|------|------|------|
| 单文件索引 | ~30ms | indexFile() |
| 删除文件记录 | ~10ms | deleteFileRecord() |
| 配置 API（GET）| ~5ms | 读取 JSON 文件 |
| 配置 API（POST）| ~250ms | 验证 + 重新索引 |
| 文件监听启动 | ~50ms | chokidar.watch() |

### 代码统计

```bash
# 后端新增
packages/server/src/watcher/fileWatcher.ts: +55 行
packages/server/src/config/configManager.ts: +37 行
packages/server/src/types/sql.js.d.ts: +22 行
packages/server/src/indexer/indexer.ts: 重构（+70 行）
packages/server/src/api/handlers.ts: +40 行
packages/server/src/api/routes.ts: +2 行
packages/server/src/index.ts: 重构（+20 行）
packages/server/src/db/client.ts: +1 行（类型断言）

# 前端新增
packages/web/src/views/SettingsView.vue: +180 行
packages/web/src/api/client.ts: +20 行
packages/web/src/router.ts: +1 行
packages/web/src/App.vue: +1 行

### 变更摘要

- 增加实时文件监听、Vault 配置管理与设置页入口
- 让增量索引从全量流程中拆出，支持单文件更新与删除同步
- 补齐配置 API、路径校验和重新索引能力
- 为后续实时刷新和任务系统演进打下基础

---

## 2026-03-16 - 全文搜索能力完成

### 工作内容

完成 LifeOS 全文搜索：全文搜索 + 快捷键 + 搜索历史

**耗时**: 约 1 小时

### 实现清单

#### 全文搜索系统
- [x] 全局搜索框（导航栏右侧）
- [x] 搜索结果页（展示匹配笔记）
- [x] 搜索历史（localStorage，最多 10 条）
- [x] 快捷键支持（Ctrl/Cmd + K）

#### 后端 API
- [x] searchNotes handler（全文搜索）
  - 搜索 file_name 和 content 字段
  - SQLite LIKE 查询
  - 限制 50 条结果

#### 新增组件
- [x] SearchBar - 全局搜索框
  - 输入框 + 搜索按钮
  - Enter 提交、Escape 清空
  - 搜索历史下拉（最近 5 条）
  - 快捷键监听
- [x] SearchView - 搜索结果页
  - 搜索统计显示
  - 复用 NoteList 组件
  - 空结果提示
  - 笔记详情弹窗

#### Composables
- [x] useSearchHistory - 搜索历史管理
  - localStorage 存储
  - 自动去重
  - 最多 10 条

#### 路由和导航
- [x] 添加 /search 路由
- [x] 导航栏添加搜索框
- [x] 响应式布局

#### 验证测试
- [x] 搜索 API 正常响应
- [x] 搜索框正常显示和工作
- [x] 搜索结果页正确展示
- [x] 搜索历史正常保存
- [x] 快捷键 Ctrl/Cmd + K 正常
- [x] 点击结果打开详情弹窗
- [x] 空结果提示正常

### 技术决策

#### 1. 搜索实现：SQLite LIKE
- **原因**: 简单高效，无需额外依赖
- **性能**: 41 条笔记搜索 <60ms，足够快
- **未来**: 如果数据量增大，可升级到 SQLite FTS5

#### 2. 搜索历史：localStorage
- **原因**: 无需后端支持，实现简单
- **容量**: 10 条历史记录，约 1KB
- **优势**: 跨会话持久化，用户体验好

#### 3. 快捷键：原生实现
- **原因**: 无需引入额外库（如 hotkeys.js）
- **实现**: addEventListener + metaKey/ctrlKey 判断
- **优势**: 代码简洁，性能好

#### 4. 搜索框位置：导航栏右侧
- **原因**: 符合用户习惯（GitHub、Google 等）
- **布局**: flex 布局，自动适配
- **响应式**: 小屏幕可考虑折叠为图标

### 遇到的问题与解决

#### 问题 1: 历史下拉框点击失效
**现象**: 点击历史项时，blur 事件先触发，下拉框关闭

**解决**: 使用 `@mousedown.prevent` 代替 `@click`
```vue
<div @mousedown.prevent="handleHistoryClick(item)">
```

**影响**: 历史项点击正常工作

#### 问题 2: 快捷键与浏览器冲突
**现象**: Ctrl+K 触发浏览器地址栏搜索

**解决**: `e.preventDefault()` 阻止默认行为
```typescript
if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
  e.preventDefault();
  inputRef.value?.focus();
}
```

**影响**: 快捷键正常工作

### 性能数据

| 操作 | 耗时 | 备注 |
|------|------|------|
| 搜索 API（10 条）| ~30ms | SQLite LIKE |
| 搜索 API（50 条）| ~60ms | 达到限制 |
| 搜索结果渲染 | ~80ms | 列表渲染 |
| 快捷键响应 | <5ms | 原生监听 |
| 历史读取 | <5ms | localStorage |

### 变更摘要

- 增加全文搜索、搜索历史与快捷键入口
- 补齐搜索结果页并复用现有笔记列表能力
- 以轻量 SQLite LIKE 方案完成首版搜索闭环

---

## 2026-03-16 - 维度详情页与筛选完成

### 工作内容

完成 LifeOS 各维度详情页 + 筛选排序功能

**耗时**: 约 1.5 小时

### 实现清单

#### 维度详情页系统
- [x] DimensionView 通用维度详情页
- [x] 动态路由（/dimension/:dimension）
- [x] 从仪表盘点击维度卡片跳转

#### 新增组件
- [x] FilterBar - 筛选工具栏
  - 类型筛选（6 种类型多选）
  - 状态筛选（4 种状态多选）
  - 优先级筛选（3 种优先级多选）
  - 排序功能（日期/优先级，升序/降序）
  - 重置按钮
- [x] NoteList - 笔记列表组件
  - 卡片式网格布局（响应式）
  - 状态颜色编码
  - 点击卡片打开详情弹窗
  - 空状态提示
- [x] DimensionStats - 维度统计卡片
  - 圆形健康分数进度
  - 总数/待办/进行中/完成统计
  - 水平进度条可视化

#### Composables
- [x] useDimensionNotes - 维度笔记数据管理
  - 加载指定维度笔记
  - 客户端筛选逻辑
  - 客户端排序逻辑
  - 统计计算

#### 路由和导航
- [x] 添加维度详情页路由
- [x] 仪表盘维度卡片添加点击跳转
- [x] hover 效果优化

#### 验证测试
- [x] 8 个维度详情页全部正常访问
- [x] 筛选功能正常（类型、状态、优先级）
- [x] 排序功能正常（日期、优先级）
- [x] 统计数据正确
- [x] 笔记详情弹窗正常
- [x] 浏览器后退按钮正常
- [x] URL 直接访问正常
- [x] 与早期仪表盘 / 时间线基础功能无回归

### 技术决策

#### 1. 筛选和排序在客户端实现
- **原因**: 数据量小（每个维度 <100 条），客户端筛选性能足够
- **优势**: 减少 API 请求，交互更流畅
- **实现**: 使用 computed property 缓存筛选结果

#### 2. 组件高度解耦
- **原因**: FilterBar 和 NoteList 可能在其他场景复用
- **设计**: 组件只负责 UI 和事件，数据逻辑在 composable 中
- **优势**: 易于测试和维护

#### 3. 圆形进度条使用 conic-gradient
- **原因**: 纯 CSS 实现，无需引入图表库
- **实现**: `conic-gradient(color ${score * 3.6}deg, #f0f0f0 0deg)`
- **优势**: 性能好，代码简洁

#### 4. 网格布局使用 CSS Grid
- **原因**: 自动响应式，代码简洁
- **实现**: `grid-template-columns: repeat(auto-fill, minmax(300px, 1fr))`
- **优势**: 无需媒体查询，自适应屏幕宽度

### 遇到的问题与解决

#### 问题 1: 筛选状态同步
**现象**: FilterBar 和 DimensionView 之间筛选状态同步困难

**解决**: 使用 `v-model:filters` 双向绑定
```vue
<!-- 父组件 -->
<FilterBar :filters="filters" @update:filters="filters = $event" />

<!-- 子组件 -->
emit('update:filters', filters.value);
```

**影响**: 筛选状态管理清晰，易于调试

#### 问题 2: 圆形进度条中心遮罩
**现象**: conic-gradient 绘制圆环，需要中心镂空

**解决**: 使用伪元素 `::before` 作为白色遮罩
```css
.health-score::before {
  content: '';
  position: absolute;
  width: 46px;
  height: 46px;
  background: white;
  border-radius: 50%;
}
```

**影响**: 实现了圆环效果，无需 SVG 或 Canvas

### 性能数据

| 操作 | 耗时 | 备注 |
|------|------|------|
| 维度笔记 API | ~40ms | 单个维度查询（5-10 条笔记）|
| 维度详情页渲染 | ~80ms | 统计 + 列表渲染 |
| 筛选操作 | <10ms | computed 缓存 |
| 排序操作 | <10ms | computed 缓存 |
| 路由跳转 | ~100ms | 懒加载 + 渲染 |

### 变更摘要

- 增加统一的维度详情页与筛选/排序能力
- 补齐可复用的列表、筛选栏和维度统计组件
- 让仪表盘中的维度入口能直接进入对应详情视图

---

## 2026-03-16 - 时间线与日历视图完成

### 工作内容

完成 LifeOS 时间线 + 日历视图 + 路由导航

**耗时**: 约 2 小时

### 实现清单

#### 后端 API 扩展
- [x] 新增 `GET /api/timeline?start=&end=` 端点（按八维度分组返回笔记）
- [x] 新增 `GET /api/calendar?year=&month=` 端点（按日期分组 + 笔记计数）
- [x] 新增 `GET /api/notes/:id` 端点（单条笔记详情）
- [x] 扩展共享类型（TimelineData, CalendarData, TimelineTrack, CalendarDay）
- [x] 修复日期比较 bug（ISO 时间戳 vs 日期字符串）

#### 前端路由与导航
- [x] 安装 vue-router@4
- [x] 创建 router.ts 配置文件
- [x] 改造 App.vue 为导航布局（header + nav + router-view）
- [x] 创建 DashboardView（包装现有仪表盘）
- [x] 创建 TimelineView（时间线页面）
- [x] 创建 CalendarView（日历页面）

#### 时间线组件
- [x] TimelineTrack 组件（单维度轨道）
  - 左侧固定列：维度名称 + 颜色标识 + 笔记数量
  - 右侧横向滚动：按日期排列笔记卡片（每天 120px）
  - 笔记卡片状态颜色编码（pending/in_progress/done/cancelled）
  - 优先级标记 + 类型徽章
- [x] useTimeline composable（数据管理）
- [x] 日期范围选择器（默认当月）

#### 日历组件
- [x] CalendarGrid 组件（月历网格）
  - 7 列网格（周一到周日）
  - 自动计算起始星期 + 前置空白格子
  - 日期数字 + 笔记数量气泡
  - 有笔记的日期高亮显示
  - 今日日期特殊标记
  - 点击日期展开当天笔记列表
- [x] useCalendar composable（数据管理）
- [x] 年月切换按钮（上月/下月）

#### 笔记详情弹窗
- [x] NoteDetail 组件（模态弹窗）
  - Teleport 到 body（避免 z-index 问题）
  - 显示完整 frontmatter 元数据（维度、类型、状态、优先级、日期、标签）
  - 维度/状态/优先级颜色编码
  - 显示 markdown 正文（纯文本渲染）
  - ESC 键或点击遮罩关闭
  - 根据 noteId 自动加载数据

#### API 客户端扩展
- [x] fetchTimeline(start, end)
- [x] fetchCalendar(year, month)
- [x] fetchNoteById(id)

#### 示例数据补充
- [x] 新增 8 个 2026-02 月文件（健康/事业/学习/生活/兴趣/财务/关系/成长）
- [x] 新增 8 个 2026-04 月文件（关系/成长/生活/健康/学习/财务/兴趣/事业）
- [x] 总计 41 个文件，覆盖 3 个月（Feb, Mar, Apr）

#### 验证测试
- [x] Timeline API 正常响应（8 条轨道，按维度分组）
- [x] Calendar API 正常响应（按日期分组 + 计数）
- [x] Note Detail API 正常响应（完整笔记内容）
- [x] 导航栏正常切换三个页面
- [x] 仪表盘页面功能与最初仪表盘版本一致（无回归）
- [x] 时间线页面：8 条维度轨道正确显示，横向滚动正常
- [x] 时间线：切换日期范围后数据正确刷新
- [x] 日历页面：月历网格正确显示，有数据的日期高亮
- [x] 日历：点击日期展示当天笔记列表
- [x] 日历：上月/下月切换正常
- [x] 笔记详情弹窗：点击任意笔记卡片弹出详情
- [x] 笔记详情弹窗：ESC 或点击遮罩关闭

### 技术决策

#### 1. 路由方案: vue-router
- **原因**: Vue 官方路由库，生态成熟，支持懒加载
- **配置**: createWebHistory（HTML5 History 模式）
- **懒加载**: 使用动态 import() 按需加载视图组件

#### 2. 时间线布局: 横向滚动 + 固定左侧
- **原因**: 时间轴天然适合横向展示，固定左侧维度名称便于识别
- **实现**: flex 布局 + overflow-x: auto
- **性能**: 使用 CSS Grid 按日期分列，避免绝对定位计算

#### 3. 日历布局: CSS Grid 7 列
- **原因**: Grid 天然适合表格布局，响应式友好
- **实现**: grid-template-columns: repeat(7, 1fr)
- **前置空白**: 计算起始星期，填充上月日期（灰色显示）

#### 4. 笔记详情: Teleport + 模态弹窗
- **原因**: Teleport 避免 z-index 层级问题，模态弹窗符合用户习惯
- **实现**: 遮罩层 + 居中卡片 + ESC 键监听
- **数据加载**: watch noteId 变化，自动调用 API

### 遇到的问题

#### 问题 1: 日历笔记数量为 0
**现象**:
```json
{"year": 2026, "month": 2, "dayCount": 28, "notesCount": 0}
```

**原因**: 数据库中 note.date 是 ISO 时间戳 `"2026-02-28T00:00:00.000Z"`，日历生成的 date 是 `"2026-02-28"`，Map.get() 匹配失败

**解决**: 在 getCalendar handler 中，对 note.date 执行 split('T')[0] 提取日期部分
```typescript
const dayMap = new Map<string, Note[]>();
notes.forEach(note => {
  const noteDate = note.date.split('T')[0];  // 提取日期部分
  if (!dayMap.has(noteDate)) {
    dayMap.set(noteDate, []);
  }
  dayMap.get(noteDate)!.push(note);
});
```

**影响**: 修复后日历正常显示笔记数量

#### 问题 2: Vite 端口冲突
**现象**:
```
Port 5173 is in use, trying another one...
Local: http://localhost:5174/
```

**原因**: 5173 端口被占用（可能是之前的进程未关闭）

**解决**: Vite 自动切换到 5174 端口

**影响**: 无影响，前端正常运行

### 性能数据

| 操作 | 耗时 | 备注 |
|------|------|------|
| Timeline API (1 个月) | ~80ms | 查询 + 按维度分组 |
| Calendar API (1 个月) | ~60ms | 查询 + 按日期分组 |
| Note Detail API | ~20ms | 单条查询 |
| 时间线渲染 (31 天 × 8 轨道) | ~150ms | 248 个 DOM 节点 |
| 日历渲染 (31 天) | ~50ms | 31 个 DOM 节点 |
| 路由切换 | ~100ms | 懒加载 + 渲染 |

### 变更摘要

- 新增时间线与日历视图，以及对应导航入口
- 新增笔记详情弹窗，补齐多视图下的浏览路径
- 修复日历接口中的日期比较问题
- 同步补充本地示例数据用于开发验证

---

## 2026-03-16 - 仪表盘最小版本完成

### 工作内容

完成 LifeOS 最小可用版本：索引服务 + 仪表盘

**耗时**: 约 3 小时

### 实现清单

#### 基础设施
- [x] 初始化 pnpm monorepo (workspace + 3 个 packages)
- [x] 配置 TypeScript (shared/server/web)
- [x] 创建 .gitignore 和 README.md

#### 共享类型 (packages/shared)
- [x] 定义 Frontmatter 协议类型
- [x] 定义 Note、DashboardData、DimensionStat 接口

#### 后端服务 (packages/server)
- [x] SQLite schema 设计 (notes 表 + 5 个索引)
- [x] 数据库客户端 (sql.js 封装)
- [x] Vault 扫描器 (递归扫描 .md 文件)
- [x] Frontmatter 解析器 (gray-matter + 字段验证)
- [x] 索引服务 (增量更新 + 孤立记录清理)
- [x] REST API (dashboard/notes/index 三个端点)
- [x] Express 服务器入口

#### 前端应用 (packages/web)
- [x] Vite + Vue 3 配置
- [x] API 客户端封装
- [x] useDashboard composable
- [x] TodayTodos 组件
- [x] WeeklyHighlights 组件
- [x] DimensionHealth 组件
- [x] DashboardOverview 容器组件
- [x] App.vue 主布局

#### 示例数据
- [x] 创建 8 个维度目录
- [x] 编写 25 个示例 markdown 文件
  - 健康: 3 个 (体检/晨跑/饮食)
  - 事业: 4 个 (晋升/API开发/会议/技术分享)
  - 财务: 3 个 (定投/报税/预算)
  - 学习: 3 个 (Vue课程/TypeScript/阅读)
  - 关系: 3 个 (家庭聚餐/朋友聚会/生日礼物)
  - 生活: 3 个 (超市购物/大扫除/月度目标)
  - 兴趣: 3 个 (摄影/观影/吉他)
  - 成长: 3 个 (年度目标/Q1复盘/阅读计划)

#### 验证测试
- [x] 数据库初始化成功
- [x] 索引 25 个文件成功 (0 错误)
- [x] API 端点正常响应
- [x] 前端仪表盘正常展示
- [x] 八维度健康分数计算正确

### 技术决策

#### 1. 包管理器选择: pnpm
- **原因**: Monorepo 支持好，依赖共享，磁盘占用小
- **替代方案**: npm workspaces / yarn workspaces
- **权衡**: pnpm 学习曲线略高，但性能和空间优势明显

#### 2. 数据库选择: sql.js
- **原因**: 纯 JS 实现，无需编译原生模块，跨平台兼容性好
- **替代方案**: better-sqlite3 (性能更好但需要编译)
- **权衡**: 性能略低 (~10-20%)，但避免了 Node.js 版本兼容问题
- **背景**: better-sqlite3 在 Node.js 25.8.1 + C++20 环境下编译失败

#### 3. Frontmatter 解析: gray-matter
- **原因**: 标准 YAML frontmatter 解析器，Obsidian 生态常用
- **注意**: 会自动将日期字符串解析为 Date 对象，需要转换回字符串

#### 4. 前端框架: Vue 3
- **原因**: 渐进式，学习曲线平缓，适合快速原型
- **替代方案**: React / Svelte
- **权衡**: Vue 3 Composition API 与 React Hooks 类似，但模板语法更直观

### 遇到的问题

#### 问题 1: better-sqlite3 编译失败
**现象**:
```
error: #error "C++20 or later required."
```

**原因**: Node.js 25.8.1 的 V8 引擎需要 C++20，但 better-sqlite3 的 node-gyp 配置使用旧标准

**尝试方案**:
1. ❌ 设置 `CXXFLAGS="-std=c++20"` - 仍然失败
2. ❌ 手动编译 better-sqlite3 - 缺少依赖
3. ✅ 改用 sql.js - 成功

**解决**: 切换到 sql.js (纯 JS 实现)

**影响**: 性能略有下降，但对最初版本的数据量 (25 个文件) 无感知

#### 问题 2: sql.js API 差异
**现象**:
```javascript
db.prepare('SELECT * FROM notes').all() // ❌ 不存在
```

**原因**: sql.js 的 API 与 better-sqlite3 不同

**解决**:
```javascript
// 查询单行
const stmt = db.prepare('SELECT * FROM notes WHERE id = ?');
stmt.bind([id]);
const hasRow = stmt.step();
const row = hasRow ? stmt.get() : null;
stmt.free();

// 查询多行
const result = db.exec('SELECT * FROM notes');
const rows = result[0]?.values || [];
```

#### 问题 3: Date 对象序列化
**现象**:
```
Error: Wrong API use: tried to bind a value of an unknown type (Sun Mar 01 2026...)
```

**原因**: gray-matter 将 frontmatter 中的日期字符串 `2026-03-01` 解析为 Date 对象，sql.js 不接受 Date 类型

**解决**: 插入前统一转换
```typescript
const toSqlValue = (val: any) => {
  if (val instanceof Date) return val.toISOString();
  if (val === undefined) return null;
  return val;
};
```

#### 问题 4: 数据库路径解析
**现象**:
- 早期实现会因为启动目录不同而指向错误的数据库位置

**原因**: 早期实现依赖工作目录推断数据库路径，不同执行上下文会出现偏差

**解决**: 改为基于模块位置固定解析 `SERVER_ROOT`
```typescript
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_ROOT = path.resolve(__dirname, '../..');

function getDbPath(): string {
  if (process.env.DB_PATH) {
    return process.env.DB_PATH;
  }

  return path.join(SERVER_ROOT, 'data/lifeos.db');
}
```

### 性能数据

| 操作 | 耗时 | 备注 |
|------|------|------|
| 数据库初始化 | ~50ms | 创建表 + 索引 |
| 索引 25 个文件 | ~200ms | 首次全量索引 |
| 索引 25 个文件 (增量) | ~100ms | 全部跳过 |
| Dashboard API | ~50ms | 包含 3 个查询 + 8 个维度统计 |
| 前端首屏加载 | ~1s | 包含 API 请求 |

### 变更摘要

- 初始化 LifeOS monorepo 与 shared/server/web 三层结构
- 落地最早期索引服务、Dashboard API 和前端总览界面
- 用示例 Vault 数据完成首轮端到端验证
- 作为后续索引、调度和自动化能力扩展的起点
