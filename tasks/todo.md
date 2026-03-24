# LifeOnline 开发任务

## 第二阶段：Phase 2 — 规模化认知、多智能体协同、主动记忆

> 下发人：项目经理 | 启动日期：2026-03-24
> 模式：四组并行（A 认知深化 / B 治理产品化 / C 基础设施 / D 灵光APP）
> 蓝图来源：`vision/02-权威基线/LifeOnline_Phase2_技术蓝图.md`

### Phase 2 五大演进方向

| # | 方向 | 负责组 | 说明 |
|---|---|---|---|
| 1 | 多智能体拆分 | A 组主导 | Extractor / Critic / Planner Agent DAG ✅ 已替换原分析器 |
| 2 | 向量存储升级 | C 组主导 | sqlite-vec + semantic-search API ✅ 已上线 |
| 3 | 主动思考机制 | A+C 联合 | 闲时思考机 + 跨 Session 联想 ✅ 已落地 |
| 4 | 移动化与跨端 | B 组主导 | 卡片式治理 + 认知雷达 ✅ 已落地 |
| 5 | 灵光APP进化 | D 组主导 | API 直连 + 推送 + 内嵌审批 ✅ 已落地 |

---

### 🔴 C 组 — 基础设施与稳定性

#### Sprint 1 ✅ | Sprint 2 ✅

<details>
<summary>已完成（点击展开）</summary>

**Sprint 1**: sqlite-vec 集成 / Embedding 管线 / 认知对象向量化
**Sprint 2**: 语义搜索 API / Vault File Watcher / 向量清理机制

</details>

#### Sprint 3（新任务）

- [x] **P1：多 Agent 执行性能监控**
  - 目标：记录每次 Agent DAG 执行的耗时、token 消耗、各 Agent 单步延迟
  - 关键文件：`packages/server/src/soul/agents/agentOrchestrator.ts`, `packages/server/src/utils/logger.ts`
  - 完成标准：每次认知分析在结构化日志中输出 `{extractorMs, criticMs, plannerMs, totalTokens}`
  - 验证：索引一条笔记后日志中有完整的性能数据

- [x] **P2：数据库迁移版本管理**
  - 目标：为 schema 变更引入版本号管理机制（migration table），确保升级安全
  - 关键文件：`packages/server/src/db/schema.ts` (新增 migrations 逻辑)
  - 完成标准：`schema_version` 表记录当前版本，新增 schema 变更以 migration 函数形式执行
  - 验证：从旧版 DB 启动服务可自动升级

- [x] **P3：AI API 调用成本追踪**
  - 目标：统计每日/每周的 AI API 调用次数和 token 消耗，输出成本报告
  - 关键文件：`packages/server/src/ai/` (新增 usageTracker.ts)
  - 完成标准：`GET /api/ai-usage` 返回调用统计
  - 验证：API 返回近 7 天的 token 用量

---

### 🟢 B 组 — 治理产品化

#### Sprint 1 ✅ | Sprint 2 ✅

<details>
<summary>已完成（点击展开）</summary>

**Sprint 1**: Tinder 式治理卡片 / 语义关联侧边栏 / 治理通知推送
**Sprint 2**: 认知健康雷达图 / 闲时洞察 Feed / 多 Agent 分层展示

</details>

#### Sprint 3（新任务）

- [ ] **P1：设置页 AI 成本面板**
  - 目标：在 SettingsView 中展示 AI 调用次数、token 消耗趋势、预估月费用
  - 关键文件：`packages/web/src/views/SettingsView.vue` (新增 AICostPanel)
  - 完成标准：设置页可视化 AI 用量趋势
  - 验证：打开设置页可见数据图表
  - 依赖：C 组 AI 成本追踪 API

- [ ] **P2：全局键盘快捷键与命令面板**
  - 目标：实现 `Cmd+K` 或 `/` 唤起的全局命令面板，快速跳转页面或执行操作
  - 关键文件：`packages/web/src/components/` (新增 CommandPalette.vue)
  - 完成标准：任何页面按快捷键弹出命令面板，可搜索页面/操作
  - 验证：按 `Ctrl+K` 弹出面板，输入关键词可跳转

- [ ] **P3：用户引导与首次使用体验**
  - 目标：新用户首次打开时展示引导流程，介绍核心功能
  - 关键文件：`packages/web/src/components/` (新增 OnboardingGuide.vue)
  - 完成标准：首次访问时有步骤式引导
  - 验证：清除 localStorage 后刷新页面触发引导

---

### 🟡 D 组 — 灵光APP (LingGuangCatcher)

#### Sprint 1 ✅ | Sprint 2 ✅

<details>
<summary>已完成（点击展开）</summary>

**Sprint 1**: LifeOS API 直连 / 认知反馈推送 / 语音增强
**Sprint 2**: 内嵌治理审批 / 历史闪念浏览搜索 / 离线队列化上传

</details>

> ⚠️ 注意：D 组编译需要 Android SDK 环境，当前开发服务器（246）无 SDK，需在本地开发机（252）编译验证

#### Sprint 3（新任务）

- [x] **P1：认知洞察卡片流**
  - 目标：在灵光APP中展示 LifeOS 的闲时思考结果，以卡片流形式呈现跨笔记洞察
  - 关键文件：`LingGuangCatcher/app/src/` (新增 InsightsFragment)
  - 完成标准：灵光APP有"洞察"tab，展示系统主动发现的关联和建议
  - 验证：打开灵光APP可浏览最新的 AI 洞察卡片

- [x] **P2：Widget 桌面小组件（快速录入）**
  - 目标：Android 桌面小组件，一键打开语音录入
  - 关键文件：`LingGuangCatcher/app/src/` (新增 QuickCaptureWidget)
  - 完成标准：长按桌面 → 添加灵光 Widget → 点击即录入
  - 验证：实际在手机桌面添加并使用

- [x] **P3：Wear OS 快速录入预研**
  - 目标：评估基于 Wear OS 的手表端快速语音录入可行性
  - 关键文件：`LingGuangCatcher/` (新增 wear module)
  - 完成标准：产出技术可行性报告 + 最小 demo
  - 验证：文档完整，demo 可在模拟器运行

---

### 🔵 A 组 — 认知深化

#### Sprint 1 ✅ | Sprint 2 ✅

<details>
<summary>已完成（点击展开）</summary>

**Sprint 1**: Extractor Agent / Critic Agent / 闲时思考机原型
**Sprint 2**: Planner Agent + DAG 编排 / Agent 链路替换 cognitiveAnalyzer / 跨 Session 联想

</details>

#### Sprint 3（新任务）

- [ ] **P1：Agent 自评估与质量反馈回路**
  - 目标：每个 Agent 执行后自动评估输出质量（confidence score），低质量结果触发重试
  - 关键文件：`packages/server/src/soul/agents/agentOrchestrator.ts`
  - 完成标准：Orchestrator 支持 Agent 输出质量检查，低分自动重试一次
  - 验证：模拟低质量输出验证重试机制

- [ ] **P2：认知记忆长期化（Long-term Memory）**
  - 目标：从累积的 BrainstormSession / ContinuityRecord 中提炼长期记忆摘要
  - 关键文件：`packages/server/src/soul/` (新增 longTermMemory.ts)
  - 完成标准：系统可查询用户在特定维度（health/career 等）的长期认知画像
  - 验证：编译通过 + API 返回维度级别的长期摘要

- [ ] **P3：认知冲突检测**
  - 目标：当新笔记的分析结果与历史认知形成矛盾时，自动标记冲突
  - 关键文件：`packages/server/src/soul/agents/criticAgent.ts`
  - 完成标准：Critic Agent 能检测到"过去你说要减肥，今天又说甜品好吃"类似的认知冲突
  - 验证：编译通过 + 构造矛盾笔记验证冲突检测
