# LifeOnline 开发任务

## 第二阶段：Phase 2 — 规模化认知、多智能体协同、主动记忆

> 下发人：项目经理 | 启动日期：2026-03-24
> 模式：三组并行（A 认知深化 / B 治理产品化 / C 基础设施）
> 蓝图来源：`vision/02-权威基线/LifeOnline_Phase2_技术蓝图.md`

### Phase 2 四大演进方向

| # | 方向 | 负责组 | 说明 |
|---|---|---|---|
| 1 | 多智能体拆分 | A 组主导 | 将单体 cognitiveAnalyzer 拆为 Extractor / Critic / Planner Agent |
| 2 | 向量存储升级 | C 组主导 | 引入 sqlite-vec，实现语义关联 |
| 3 | 主动思考机制 | A+C 联合 | 闲时思考机，主动发酵 BrainstormSession |
| 4 | 移动化与跨端 | B 组主导 | PWA 深化 + 语音闪念 + 卡片式治理 |

---

### 🔴 C 组 — 基础设施与稳定性

<details>
<summary>Phase 1 已完成 36 项任务（Sprint 1-4 ✅）</summary>
</details>

#### Phase 2 Sprint 1（新任务）

- [ ] **P1：sqlite-vec 向量存储集成验证**
  - 目标：验证 `sqlite-vec` 扩展在当前 better-sqlite3 环境中的集成可行性
  - 关键文件：`packages/server/src/db/` (新增 vectorStore.ts)
  - 完成标准：能存储 embedding 向量并执行 kNN 查询
  - 验证：编写单测，存入 5 条向量并按相似度排序查询

- [ ] **P2：Embedding 生成管线**
  - 目标：通过 AI API 将文本转为 embedding 向量
  - 关键文件：`packages/server/src/ai/` (新增 embedding.ts)
  - 完成标准：`getEmbedding(text)` 返回 float[] 向量
  - 验证：编译通过 + 对相似文本和不相似文本的向量做余弦相似度计算

- [ ] **P3：BrainstormSession / ContinuityRecord 向量化**
  - 目标：在笔记索引触发后，自动为 distilledInsights 和 continuitySignals 生成并存储 embedding
  - 关键文件：`packages/server/src/soul/brainstormSessions.ts`, `vectorStore.ts`
  - 完成标准：BrainstormSession 创建/更新时自动附带 embedding
  - 验证：编译通过 + 查询相似 session 返回语义相近结果

---

### 🟢 B 组 — 治理产品化

<details>
<summary>Phase 1 已完成 36 项任务（Sprint 1-4 ✅）</summary>
</details>

#### Phase 2 Sprint 1（新任务）

- [ ] **P1：治理卡片流交互（Tinder 式 Approve/Reject）**
  - 目标：实现移动端友好的卡片滑动审批交互，左滑 Reject、右滑 Approve
  - 关键文件：`packages/web/src/components/` (新增 GovernanceCard.vue, SwipeStack.vue)
  - 完成标准：在 375px 移动视口下可用手势滑动审批 SoulAction
  - 验证：浏览器 DevTools 触摸模拟 + 实际审批操作生效

- [ ] **P2：语义关联侧边栏（Related Insights）**
  - 目标：在笔记详情或 Dashboard 中展示"语义相关的历史灵感"
  - 关键文件：`packages/web/src/components/` (新增 RelatedInsights.vue)
  - 完成标准：基于向量相似度展示与当前笔记语义相关的 BrainstormSession
  - 验证：打开笔记详情，侧边栏展示 3-5 条语义相关灵感
  - 依赖：C 组 向量存储就绪后串联

- [ ] **P3：语音闪念录入预研**
  - 目标：利用 Web Speech API / Whisper 实现移动端语音快速录入
  - 关键文件：`packages/web/src/components/` (新增 VoiceCapture.vue)
  - 完成标准：点击麦克风 → 语音转文字 → 自动创建 Inbox Note
  - 验证：手机浏览器实际录音并自动创建笔记

---

### 🔵 A 组 — 认知深化

<details>
<summary>Phase 1 已完成 36 项任务（Sprint 1-4 ✅）</summary>
</details>

#### Phase 2 Sprint 1（新任务）

- [x] **P1：认知管线 Agent 化架构设计与 Extractor Agent 实现**
  - 目标：将 cognitiveAnalyzer 的主题/事实提取逻辑独立为 Extractor Agent
  - 关键文件：`packages/server/src/soul/agents/` (新建目录), `extractorAgent.ts`
  - 完成标准：Extractor Agent 独立运行，输出与原 cognitiveAnalyzer 一致的主题/事实结构
  - 验证：编译通过 + 对同一笔记，Extractor Agent 输出与原实现可对比

- [x] **P2：Critic Agent 实现**
  - 目标：实现情绪分析、逻辑破绽发现、ambiguity 标记的独立 Agent
  - 关键文件：`packages/server/src/soul/agents/criticAgent.ts`
  - 完成标准：Critic Agent 接收 Extractor 输出，补充情绪/ambiguity 标注
  - 验证：编译通过 + 对同一笔记，Critic 输出包含情绪和质疑

- [x] **P3：闲时思考机原型（Idle-State Processor）**
  - 目标：基于现有 TaskScheduler，实现定时捞取"长时间未回顾"的 BrainstormSession 进行 AI 二次发散
  - 关键文件：`packages/server/src/soul/` (新增 idleProcessor.ts), `packages/server/src/workers/taskScheduler.ts`
  - 完成标准：每日自动触发一次闲时思考，结果以 ReintegrationRecord 形式展示
  - 验证：编译通过 + 手动触发闲时思考产出可见结果
