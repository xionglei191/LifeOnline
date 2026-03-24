# LifeOnline 开发任务

## 当前迭代：Sprint-2026-03-24

> 下发人：项目经理 | 下发日期：2026-03-24
> 模式：三组并行（A 认知深化 / B 治理产品化 / C 基础设施）

---

### 🔴 C 组 — 基础设施与稳定性

- [ ] **P0：统一 `SoulActionKind` 定义**
  - 目标：消除 server 和 shared 中 `SoulActionKind` 的重复定义
  - 关键文件：`packages/shared/src/core.ts`, `packages/shared/src/soulActionTypes.ts`, `packages/server/src/soul/types.ts`
  - 完成标准：仅在 `@lifeos/shared` 中定义一次，server 端 re-export
  - 验证：`npx tsc --noEmit` 全量通过

- [ ] **P3：R2 凭据配置与实际冷存储验证**
  - 目标：验证 `sync_continuity_to_r2` 的实际 R2 写入能力
  - 关键文件：`packages/server/src/infra/r2Client.ts`
  - 完成标准：环境变量配置后，可成功写入 R2
  - 验证：实际 R2 存储桶写入成功

- [ ] **P2：测试覆盖增强**
  - 目标：为新增的 11 个 actionKind 闭环补充测试
  - 关键文件：`packages/server/test/`
  - 完成标准：核心闭环路径有测试锁定
  - 验证：`npm test` 通过

---

### 🟢 B 组 — 治理产品化

- [x] **P3：治理面板 UX 提升 (GovernanceView 组件拆分)**
  - 目标：GovernanceView 组件拆分、样式优化，并适配移动端宽度
  - 关键文件：`packages/web/src/views/GovernanceView.vue`, `packages/web/src/components/`
  - 完成标准：提取了 ReintegrationReviewPanel 和 BrainstormSessionPanel
  - 验证：主页面体积大幅减小，组件职责清晰，响应式布局工作正常

- [x] **P2：SoulAction Detail 页面增强**
  - 目标：增加 reintegration 卡片与同源 actions 关联展示
  - 关键文件：`packages/web/src/views/SoulActionDetailView.vue`
  - 完成标准：详情页展示完整信息
  - 验证：正确加载展示 source reintegration 卡片和相关 actions 列表

- [x] **P2：追问交互 UI 优化**
  - 目标：优化 `ask_followup_question` 类 SoulAction 的交互体验
  - 关键文件：`packages/web/src/views/GovernanceView.vue`
  - 完成标准：追问类动作有清晰的交互入口和回答体验
  - 验证：页面可交互、POST 请求成功

---

### 🔵 A 组 — 认知深化

- [ ] **P2：BrainstormSession 深度提炼（distilled 阶段）**
  - 目标：实现 BrainstormSession 从 `parsed` → `distilled` 的二阶认知提炼
  - 关键文件：`packages/server/src/soul/brainstormSessions.ts`, `packages/server/src/soul/cognitiveAnalyzer.ts`
  - 完成标准：高价值笔记的 BrainstormSession 可进入 distilled 状态，生成 `distilledInsights`
  - 验证：编译通过 + 实际笔记索引后产生 distilled 结果

- [ ] **P2：连续性模式识别增强**
  - 目标：提升 continuitySignals 的识别准确度和覆盖面
  - 关键文件：`packages/server/src/soul/cognitiveAnalyzer.ts`, `packages/server/src/soul/postIndexPersonaTrigger.ts`
  - 完成标准：continuitySignals 能识别更多模式（目标、习惯、风险等）
  - 验证：编译通过 + 实际分析结果改善

- [ ] **P3：Gate 学习机制增强**
  - 目标：`gateLearning.ts` 基于历史 approve/defer/discard 记录优化闸门决策
  - 关键文件：`packages/server/src/soul/gateLearning.ts`, `packages/server/src/soul/interventionGate.ts`
  - 完成标准：Gate 能参考历史决策模式调整新动作的治理建议
  - 验证：编译通过 + Gate 输出包含学习依据
