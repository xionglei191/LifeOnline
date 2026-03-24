# LifeOnline 开发任务

## 当前迭代：Sprint-2026-03-24

> 下发人：项目经理 | 下发日期：2026-03-24
> 模式：三组并行（A 认知深化 / B 治理产品化 / C 基础设施）

---

### 🔴 C 组 — 基础设施与稳定性

#### Sprint 1 ✅ | Sprint 2 ✅

<details>
<summary>已完成任务（点击展开）</summary>

- [x] P0：统一 SoulActionKind 定义
- [x] P3：R2 凭据配置与实际冷存储验证
- [x] P2：测试覆盖增强
- [x] P2：部署流水线一键化（`scripts/deploy.sh`）
- [x] P2：R2 冷存储读回验证 + 清理（`listR2Objects` / `getR2Object`）
- [x] P3：错误监控与日志结构化（`utils/logger.ts`）

</details>

#### Sprint 3（新任务）

- [ ] **P2：WebSocket 心跳与断线重连健壮性**
  - 目标：确保 WebSocket 连接在网络不稳定时自动重连，避免前端页面状态陈旧
  - 关键文件：`packages/server/src/websocket/wsServer.ts`, `packages/web/src/composables/useWebSocket.ts`
  - 完成标准：服务端添加心跳检测（30s ping/pong），客户端添加指数退避重连
  - 验证：人为断网后 10 秒内自动重连

- [ ] **P2：索引队列并发控制与错误恢复**
  - 目标：`indexQueue.ts` 增加并发限制和失败重试机制
  - 关键文件：`packages/server/src/indexer/indexQueue.ts`, `packages/server/src/indexer/indexer.ts`
  - 完成标准：索引队列有最大并发数、失败任务有 3 次重试
  - 验证：编译通过 + 模拟失败文件能被重试

- [ ] **P3：health check API**
  - 目标：新增 `/api/health` 端点，返回服务状态（DB 连通、R2 配置、WebSocket 数量）
  - 关键文件：`packages/server/src/api/` (新增 handler)
  - 完成标准：GET /api/health 返回 JSON 包含各组件状态
  - 验证：curl 验证可用

---

### 🟢 B 组 — 治理产品化

#### Sprint 1 ✅ | Sprint 2 ✅

<details>
<summary>已完成任务（点击展开）</summary>

- [x] P3：治理面板 UX 提升 (GovernanceView 组件拆分)
- [x] P2：SoulAction Detail 页面增强
- [x] P2：追问交互 UI 优化
- [x] P1：Dashboard 主页产品化（`DashboardOverview.vue` 落地）
- [x] P2：OpsView 运维中心组件拆分（拆分出 `WorkerTaskPanel` 和 `SchedulePanel`）
- [x] P3：NoteDetail 认知增强展示

</details>

#### Sprint 3（新任务）

- [ ] **P1：全局时序线与事件流展示（Event Stream）**
  - 目标：将散落的 EventNode 按照时间轴或主题，在前端串联展示为一条生活事件流
  - 关键文件：`packages/web/src/views/` (新增 EventsView.vue), `packages/server/src/api/`
  - 完成标准：新增 /events 页面，可以按主轴浏览已入库的 EventNode
  - 验证：在导航栏加入入口，点击可查看大事件时间线

- [ ] **P2：全局搜索页增强**
  - 目标：搜索结果页不仅仅展示笔记，还可以混合展示命中的 BrainstormSession / 总结
  - 关键文件：`packages/web/src/views/SearchView.vue`
  - 完成标准：Search 页面在呈现笔记结果的同时展现相关认知实体的卡片
  - 验证：搜索一个关键词，既能看到原笔记，又能看到系统做过的对应的洞察

- [ ] **P3：移动端 PWA 与快捷指令支持预研**
  - 目标：为 Dashboard / 治理面板增加 PWA manifest，支持添加到手机主屏幕
  - 关键文件：`packages/web/index.html`, `manifest.json`
  - 完成标准：页面可被识别为 PWA 并安装
  - 验证：Chrome Lighthouse 检测 PWA 分数达标

---

### 🔵 A 组 — 认知深化

#### Sprint 1 ✅ | Sprint 2 ✅

<details>
<summary>已完成任务（点击展开）</summary>

- [x] P2：BrainstormSession 深度提炼（distilled 阶段）
- [x] P2：连续性模式识别增强
- [x] P3：Gate 学习机制增强
- [x] P1：interventionGate 接入 Gate 学习（`adjustConfidenceByHistory` 已串入决策流程）
- [x] P2：认知分析质量提升（Prompt 调优）
- [x] P3：BrainstormSession 跨笔记关联

</details>

#### Sprint 3（新任务）

- [ ] **P1：Reintegration 深层回流（PR5 深化）**
  - 目标：reintegration 结果可反向影响后续笔记分析的 persona context
  - 关键文件：`packages/server/src/soul/reintegrationOutcome.ts`, `packages/server/src/soul/personaSnapshots.ts`
  - 完成标准：approved reintegration 数据可被 cognitiveAnalyzer 读取并纳入分析上下文
  - 验证：编译通过 + 有 reintegration 记录的笔记分析结果中体现历史回流

- [ ] **P2：SoulAction 执行结果反馈闭环**
  - 目标：SoulAction 执行后的 resultSummary 自动回写 BrainstormSession 的 distilledInsights
  - 关键文件：`packages/server/src/soul/soulActionDispatcher.ts`, `packages/server/src/soul/brainstormSessions.ts`
  - 完成标准：已执行 SoulAction 的 outcome 自动丰富对应的 BrainstormSession
  - 验证：编译通过 + 执行后 BrainstormSession 的 distilledInsights 包含执行结果

- [ ] **P3：认知对象健康度评估**
  - 目标：新增 API 统计 5 个认知对象的数据健康度（记录数、新鲜度、覆盖度）
  - 关键文件：`packages/server/src/soul/` (新增 cognitiveHealth.ts)
  - 完成标准：API 返回各认知对象的健康指标
  - 验证：编译通过 + API 可调用
