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

#### Sprint 1 ✅ | Sprint 2 ✅ | Sprint 3 ✅

<details>
<summary>已完成（点击展开）</summary>

**Sprint 1**: sqlite-vec 集成 / Embedding 管线 / 认知对象向量化
**Sprint 2**: 语义搜索 API / Vault File Watcher / 向量清理机制
**Sprint 3**: 多 Agent 执行性能监控 / 数据库迁移版本管理 / AI API 调用成本追踪

</details>

#### Sprint 4 — 收官冲刺（新任务）

- [x] **P1：混合检索能力建设（Hybrid Search）**
  - 目标：结合全文检索引擎（FTS5）与 sqlite-vec 向量检索，提供统一的 `/api/search`
  - 关键文件：`packages/server/src/db/` (新增 search.ts)
  - 完成标准：搜索接口支持关键词+语义的双通道路由，按相关性综合排序
  - 验证：输入包含确切关键词和抽象概念的 query，能同时命中对应结果

- [ ] **P2：低并发小模型 API 测试环境**
  - 目标：使用外部小模型 API（并发上限 3）专供自动化测试使用，以降低跑偏或消耗核心 Token 的成本
  - 关键文件：`packages/server/test/setup.ts`, `packages/server/src/ai/aiClient.ts`
  - 完成标准：配置 `TEST_AI_URL` 和 `TEST_AI_KEY`，并在测试环境或 AI Client 内部实现一个并发锁（Semaphore <= 3）防止 429 报错
  - 验证：运行全量集成测试（`npm test`），不触发商业 API 且不爆 429 错误

- [x] **P3：生产环境稳定性演练**
  - 目标：模拟 SQLite 数据库损坏与 R2 恢复、File Watcher 大量并发写入等场景
  - 关键文件：`packages/server/test/chaos/`
  - 完成标准：形成故障演练恢复手册
  - 验证：PM 确认容灾能力

---

### 🟢 B 组 — 治理产品化

#### Sprint 1 ✅ | Sprint 2 ✅ | Sprint 3 ✅

<details>
<summary>已完成（点击展开）</summary>

**Sprint 1**: Tinder 式治理卡片 / 语义关联侧边栏 / 治理通知推送
**Sprint 2**: 认知健康雷达图 / 闲时洞察 Feed / 多 Agent 分层展示
**Sprint 3**: 设置页 AI 成本面板 / 全局命令面板 (Cmd+K) / 用户新手引导

</details>

#### Sprint 4 — 收官冲刺（新任务）

- [ ] **P1：Phase 2 核心新特性 UI 融合**
  - 目标：将多 Agent 分析、闲时思考记录、长期记忆画像无缝融合进主 Governance 视图，确保入口统一
  - 关键文件：`packages/web/src/views/GovernanceView.vue`
  - 完成标准：UI 不显得拥挤，信息按重要度渐进式呈现
  - 验证：交互走查，确保认知负荷不超过 Phase 1

- [ ] **P2：响应式布局终极验收**
  - 目标：验证全站所有页面在 375px(手机)、768px(iPad)、1080p(桌面) 三端的展现
  - 关键文件：`packages/web/src/assets/layout.css`
  - 完成标准：无任何横向溢出或组件遮挡
  - 验证：浏览器多端模拟器切换检查

- [ ] **P3：性能审计（Lighthouse 100 分挑战）**
  - 目标：针对 Web 可访问性、性能、SEO、最佳实践进行优化打磨
  - 关键文件：`packages/web/index.html`
  - 完成标准：Lighthouse 综合评分达到 4 项 95+
  - 验证：Vite 生产构建后静态服压测

---

### 🟡 D 组 — 灵光APP (LingGuangCatcher)

#### Sprint 1 ✅ | Sprint 2 ✅ | Sprint 3 ✅

<details>
<summary>已完成（点击展开）</summary>

**Sprint 1**: LifeOS API 直连 / 认知反馈推送 / 语音增强
**Sprint 2**: 内嵌治理审批 / 历史闪念浏览搜索 / 离线队列化上传
**Sprint 3**: 认知洞察卡片流 / Widget 桌面小组件 / Wear OS 预研

</details>

> ⚠️ 注意：D 组编译需要 Android SDK 环境，当前开发服务器（246）无 SDK，需在本地开发机（252）编译验证

#### Sprint 4 — 收官冲刺（新任务）

- [x] **P1：极端网络环境健壮性测试**
  - 目标：在 2G/3G 及频繁断网重连环境下，验证语音识别和同步队列不会丢数据
  - 关键文件：`LingGuangCatcher/app/src/`
  - 完成标准：网络中断时的录入 100% 留存在本地队列
  - 验证：手机 Charles 弱网模拟 + 断网断点测试

- [x] **P2：最终打包与签名配置**
  - 目标：配置 Android Release Keystore，输出可上架的 APK/AAB
  - 关键文件：`LingGuangCatcher/app/build.gradle.kts`
  - 完成标准：能生成正式签名的 release 包
  - 验证：`assembleRelease` 成功构建

- [x] **P3：灵光 APP 交互动效打磨**
  - 目标：为录音波动、卡片滑动等增加基于物理惯性的丝滑反馈
  - 关键文件：`LingGuangCatcher/`
  - 完成标准：手感具备顶级原生 APP 体验
  - 验证：真机动效走查

---

### 🔵 A 组 — 认知深化

#### Sprint 1 ✅ | Sprint 2 ✅ | Sprint 3 ✅

<details>
<summary>已完成（点击展开）</summary>

**Sprint 1**: Extractor Agent / Critic Agent / 闲时思考机原型
**Sprint 2**: Planner Agent + DAG 编排 / Agent 链路替换 cognitiveAnalyzer / 跨 Session 联想
**Sprint 3**: Agent 自评估与质量反馈 / 认知记忆长期化 / 认知冲突检测

</details>

#### Sprint 4 — 收官冲刺（新任务）

- [ ] **P1：Phase 2 认知图谱报告生成**
  - 目标：输出一份能让用户惊叹的自动化报告："过去两周，LifeOS 发现了你的这 5 个深层模式"
  - 关键文件：`packages/server/src/soul/` (新增 insightsReport.ts)
  - 完成标准：结合长期记忆与跨域联想，生成结构化洞察报告
  - 验证：执行脚本输出包含真实价值的 MarkDown 报告

- [ ] **P2：Token 预算控制器 (Budget Enforcer)**
  - 目标：给 Agent DAG 加安全锁，防止死循环重试或遇到超长笔记时 Token 账单爆炸
  - 关键文件：`packages/server/src/soul/agents/agentOrchestrator.ts`
  - 完成标准：超过指定的单次或单日 Token 预算直接熔断，进入 observe_only
  - 验证：伪造长文本，验证系统自动熔断

- [ ] **P3：第三阶段 (Phase 3) 愿景起草**
  - 目标：基于 Phase 2 构建的多智体协作和被动发酵，梳理下一阶段目标（例如：连接真实外部 API 自动化执行预定义小任务）
  - 关键文件：`vision/02-权威基线/` (新增 Phase3_技术蓝图.md)
  - 完成标准：明确下一步的突破口
  - 验证：PM 审阅方向
