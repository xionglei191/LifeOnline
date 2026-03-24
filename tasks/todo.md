# LifeOnline 开发任务

## 第二阶段：Phase 2 — 规模化认知、多智能体协同、主动记忆

> 下发人：项目经理 | 启动日期：2026-03-24
> 模式：四组并行（A 认知深化 / B 治理产品化 / C 基础设施 / D 灵光APP）
> 蓝图来源：`vision/02-权威基线/LifeOnline_Phase2_技术蓝图.md`

### Phase 2 五大演进方向

| # | 方向 | 负责组 | 说明 |
|---|---|---|---|
| 1 | 多智能体拆分 | A 组主导 | 将单体 cognitiveAnalyzer 拆为 Extractor / Critic / Planner Agent |
| 2 | 向量存储升级 | C 组主导 | 引入 sqlite-vec，实现语义关联 |
| 3 | 主动思考机制 | A+C 联合 | 闲时思考机，主动发酵 BrainstormSession |
| 4 | 移动化与跨端 | B 组主导 | 卡片式治理 + PWA 深化 |
| 5 | 灵光APP进化 | D 组主导 | 语音增强、认知反馈通道、实时同步 |

### 数据流全景图

```
灵光APP (语音→文字→扩展) → Obsidian Vault (手机) → 同步到服务器
    → LifeOS Indexer 定时扫描 → 认知管线 → 分类结果写回 Vault → 同步回手机/电脑
```
---

### 🔴 C 组 — 基础设施与稳定性

#### Sprint 1 ✅

<details>
<summary>已完成（点击展开）</summary>

- [x] P1：sqlite-vec 向量存储集成验证
- [x] P2：Embedding 生成管线
- [x] P3：BrainstormSession / ContinuityRecord 向量化

</details>

#### Sprint 2（新任务）

- [ ] **P1：向量搜索 API 与语义查询端点**
  - 目标：暴露 `/api/semantic-search` 端点，支持文本输入 → embedding → kNN 查询
  - 关键文件：`packages/server/src/api/` (新增 handler), `packages/server/src/db/vectorStore.ts`
  - 完成标准：前端可通过 API 查询语义相关的 BrainstormSession / ContinuityRecord
  - 验证：curl 查询返回语义排序结果

- [ ] **P2：Vault 文件变更实时监听（File Watcher）**
  - 目标：替代定时扫描，使用 `chokidar` 或 `fs.watch` 实时监听 Vault 目录变化
  - 关键文件：`packages/server/src/indexer/` (新增 fileWatcher.ts)
  - 完成标准：Vault 中新增/修改 .md 文件后，3 秒内自动触发索引
  - 验证：手动创建一个 .md 文件，观察日志中自动触发索引

- [ ] **P3：向量存储维护与清理机制**
  - 目标：当笔记删除/更新时，同步清理或更新对应的 embedding 记录
  - 关键文件：`packages/server/src/db/vectorStore.ts`
  - 完成标准：删除笔记后其 embedding 自动清理
  - 验证：删除一条笔记后查询不再返回其 embedding

---

### 🟢 B 组 — 治理产品化

#### Sprint 1 ✅

<details>
<summary>已完成（点击展开）</summary>

- [x] P1：治理卡片流交互（Tinder 式 Approve/Reject）
- [x] P2：语义关联侧边栏（Related Insights）
- [x] P3：治理通知推送机制（NotificationToast + soul-action-created 事件）

</details>

#### Sprint 2（新任务）

- [ ] **P1：认知对象可视化仪表盘（Cognitive Dashboard）**
  - 目标：在 Dashboard 中增加认知健康度可视化，展示 5 个认知对象的活跃度/健康度雷达图
  - 关键文件：`packages/web/src/components/DashboardOverview.vue`, `packages/web/src/components/CognitiveRadar.vue`
  - 完成标准：Dashboard 展示认知健康度雷达图 + 各认知对象活跃度趋势
  - 验证：打开首页可见认知健康度可视化

- [ ] **P2：闲时思考结果展示（Idle Insights Feed）**
  - 目标：将闲时思考机产出的结果以时间流形式展示给用户
  - 关键文件：`packages/web/src/views/` (新增 InsightsFeedView.vue)
  - 完成标准：新增 `/insights` 页面，展示系统主动思考的发现
  - 验证：导航栏有入口，页面展示闲时思考产出的 ReintegrationRecord

- [ ] **P3：多 Agent 分析结果分层展示**
  - 目标：在笔记详情中分层展示 Extractor / Critic 的独立输出
  - 关键文件：`packages/web/src/components/NoteDetail.vue`
  - 完成标准：笔记详情中可切换查看"事实提取"和"批判分析"两个视角
  - 验证：有 Critic 输出的笔记可以看到情绪/质疑标注

---

### 🟡 D 组 — 灵光APP (LingGuangCatcher)

#### Sprint 1 ✅

<details>
<summary>已完成（点击展开）</summary>

- [x] P1：LifeOS API 直连通道
- [x] P2：认知反馈通知（推送通道）
- [x] P3：语音输入增强（多语言 + 智能扩展）

</details>

#### Sprint 2（新任务）

- [ ] **P1：灵光APP 内嵌治理审批**
  - 目标：在灵光APP内直接展示待审批的 SoulAction 卡片，支持滑动 Approve/Reject
  - 关键文件：`LingGuangCatcher/app/src/` (新增 GovernanceFragment)
  - 完成标准：灵光APP中可查看并审批 pending 的 SoulAction
  - 验证：实际在手机上滑动审批一个 SoulAction

- [ ] **P2：历史闪念浏览与搜索**
  - 目标：在灵光APP中浏览历史录入的闪念列表，支持全文搜索
  - 关键文件：`LingGuangCatcher/app/src/`
  - 完成标准：下拉可浏览历史闪念，搜索框可按关键词筛选
  - 验证：录入 5 条闪念后可搜索到历史记录

- [ ] **P3：离线模式与队列化上传**
  - 目标：无网络时缓存录入，恢复网络后自动上传到 Vault 并触发 API
  - 关键文件：`LingGuangCatcher/app/src/`
  - 完成标准：飞行模式下录入 → 恢复网络后自动同步
  - 验证：飞行模式测试录入 + 恢复后检查 Vault 文件

---

### 🔵 A 组 — 认知深化

#### Sprint 1 ✅

<details>
<summary>已完成（点击展开）</summary>

- [x] P1：认知管线 Agent 化架构设计与 Extractor Agent 实现
- [x] P2：Critic Agent 实现
- [x] P3：闲时思考机原型（Idle-State Processor）

</details>

#### Sprint 2（新任务）

- [x] **P1：Planner Agent 实现与 Agent DAG 编排**
  - 目标：实现第三个 Agent（Planner），并用 DAG 编排串联 Extractor → Critic → Planner
  - 关键文件：`packages/server/src/soul/agents/plannerAgent.ts`, `packages/server/src/soul/agents/agentOrchestrator.ts`
  - 完成标准：三个 Agent 按 DAG 顺序执行，Planner 输出最终行动建议
  - 验证：编译通过 + 一条笔记走完三 Agent 链路产出完整认知结果

- [x] **P2：Agent 链路替换原 cognitiveAnalyzer**
  - 目标：将 postIndexPersonaTrigger 中的 cognitiveAnalyzer 调用替换为 Agent 链路
  - 关键文件：`packages/server/src/soul/postIndexPersonaTrigger.ts`, `agentOrchestrator.ts`
  - 完成标准：实际笔记索引走 Agent 链路而非单体分析
  - 验证：索引一条真实笔记，分析结果由三 Agent 协作产出

- [x] **P3：闲时思考机深化（跨 Session 联想）**
  - 目标：闲时思考不仅二次发散单个 Session，还利用向量相似度跨 Session 联想
  - 关键文件：`packages/server/src/soul/idleProcessor.ts`, `vectorStore.ts`
  - 完成标准：闲时思考产出包含"跨笔记关联发现"
  - 验证：闲时思考结果中出现引用多个不同笔记的洞察
  - 依赖：C 组向量搜索 API 就绪

  **[A组 结果复盘]**
  - **实现过程**：废弃并删除了原有的重型单体 `cognitiveAnalyzer.ts`。在 `agents/` 下建立了全新的 `agentOrchestrator.ts` 来承载 DAG 调度职责 (Extractor -> Critic -> Planner)。
  由于抽象完全按原 `NoteAnalysis` 接口向后兼容，切换仅需调整项目内多处 import 路径。223 个集成测试用不修改直接 pass。
  对于闲时发想 (P3)，在 `idleProcessor.ts` 的 `IDLE_PROMPT` 中注入了“重要强制规则”，要求模型明确陈述跨碎片的联想链路，从单点发散变为 RAG 式的跨维碰撞。
