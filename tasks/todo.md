# LifeOnline 开发任务

## 当前迭代：Sprint-2026-03-24

> 下发人：项目经理 | 下发日期：2026-03-24
> 模式：三组并行（A 认知深化 / B 治理产品化 / C 基础设施）

---

### 🔴 C 组 — 基础设施与稳定性

#### Sprint 1（已完成 / 进行中）

- [ ] **P0：统一 `SoulActionKind` 定义**
  - 目标：消除 server 和 shared 中 `SoulActionKind` 的重复定义
  - 关键文件：`packages/shared/src/core.ts`, `packages/shared/src/soulActionTypes.ts`, `packages/server/src/soul/types.ts`
  - 完成标准：仅在 `@lifeos/shared` 中定义一次，server 端 re-export
  - 验证：`npx tsc --noEmit` 全量通过

- [x] **P3：R2 凭据配置与实际冷存储验证**
  - 验证：实际 R2 存储桶写入成功 ✅

- [ ] **P2：测试覆盖增强**
  - 目标：为新增的 11 个 actionKind 闭环补充测试
  - 关键文件：`packages/server/test/`
  - 完成标准：核心闭环路径有测试锁定
  - 验证：`npm test` 通过

#### Sprint 2（新任务）

- [ ] **P2：部署流水线一键化**
  - 目标：将 git pull → build → systemctl restart 串成一键脚本，支持回滚
  - 关键文件：`scripts/deploy.sh`（新建）, `services/lifeos-server.service`
  - 完成标准：本地执行 `./scripts/deploy.sh` 即可完成远程部署
  - 验证：在 252 本地执行部署脚本，246 服务正常重启

- [ ] **P2：R2 冷存储读回验证 + 清理**
  - 目标：实现 R2 对象的列举（ListObjects）和读回（GetObject），清理测试文件
  - 关键文件：`packages/server/src/infra/r2Client.ts`
  - 完成标准：新增 `listR2Objects()` 和 `getR2Object()` 函数，确认冷存储内容可读
  - 验证：能列出 `vault2026` 桶中的对象并读取内容

- [ ] **P3：错误监控与日志结构化**
  - 目标：统一 server 端 `console.log` 为结构化日志（带时间戳和模块标识）
  - 关键文件：`packages/server/src/utils/`（新建 logger.ts）
  - 完成标准：`soul/` 和 `workers/` 的日志输出统一为 `[模块名] [级别] 消息` 格式
  - 验证：编译通过 + 日志可 grep 过滤

---

### 🟢 B 组 — 治理产品化

#### Sprint 1（已完成）

- [x] **P3：治理面板 UX 提升 (GovernanceView 组件拆分)**
  - 验证：主页面体积大幅减小 ✅

- [x] **P2：SoulAction Detail 页面增强**
  - 验证：正确加载展示 source reintegration 卡片和相关 actions 列表 ✅

- [x] **P2：追问交互 UI 优化**
  - 验证：页面可交互、POST 请求成功 ✅

#### Sprint 2（新任务）

- [ ] **P1：Dashboard 主页产品化**
  - 目标：当前 DashboardView 仅 8 行 wrapper，需升级为真正的项目首页
  - 关键文件：`packages/web/src/views/DashboardView.vue`, `packages/web/src/components/DashboardOverview.vue`
  - 建议内容：今日待办摘要 + 最近认知活动（最新 SoulAction 3 条）+ persona 状态卡片 + 快捷入口
  - 完成标准：首页有实质信息展示，不再是空壳
  - 验证：打开 `/` 页面信息完整、数据实时

- [ ] **P2：OpsView 运维中心组件拆分**
  - 目标：OpsView.vue 28KB / 533 行，需拆分为 WorkerTaskPanel + SchedulePanel
  - 关键文件：`packages/web/src/views/OpsView.vue`, `packages/web/src/components/`
  - 完成标准：主页面 < 15KB，功能不回归
  - 验证：运维中心所有功能可用

- [ ] **P3：NoteDetail 认知增强展示**
  - 目标：在 NoteDetail 中展示该笔记触发的 SoulAction 列表和 BrainstormSession
  - 关键文件：`packages/web/src/components/NoteDetail.vue`
  - 完成标准：笔记详情中可看到 "该笔记触发了 N 个认知动作" 和对应列表
  - 验证：从笔记列表点入详情，可看到关联的 SoulAction

---

### 🔵 A 组 — 认知深化

#### Sprint 1（已完成）

- [x] **P2：BrainstormSession 深度提炼（distilled 阶段）**
  - 验证：`brainstormSessions.ts` 扩展至 275 行，含 distilledInsights 字段和 AI 提炼逻辑 ✅

- [x] **P2：连续性模式识别增强**
  - 验证：continuitySignals 多模式识别已实现 ✅

- [x] **P3：Gate 学习机制增强**
  - 验证：`gateLearning.ts` 227 行，含 `detectGatePatterns()` + `adjustConfidenceByHistory()` ✅

#### Sprint 2（新任务）

- [ ] **P1：interventionGate 接入 Gate 学习**
  - 目标：将 `adjustConfidenceByHistory()` 实际接入 `interventionGate.ts` 的决策流程
  - 关键文件：`packages/server/src/soul/interventionGate.ts`, `packages/server/src/soul/gateLearning.ts`
  - 完成标准：Gate 决策时自动查询历史模式，调整置信度并在 reason 中说明依据
  - 验证：编译通过 + Gate 输出包含 patterns 信息

- [ ] **P2：认知分析质量提升（Prompt 调优）**
  - 目标：优化 cognitiveAnalyzer 的 AI prompt，提升主题提取和连续性识别准确度
  - 关键文件：`packages/server/src/soul/cognitiveAnalyzer.ts`
  - 完成标准：分析结果的 themes/continuitySignals 更贴合笔记实际内容
  - 验证：选取 5 条真实笔记对比分析前后质量

- [ ] **P3：BrainstormSession 跨笔记关联**
  - 目标：当多个笔记的 BrainstormSession 出现相似 themes 时，自动建立关联
  - 关键文件：`packages/server/src/soul/brainstormSessions.ts`
  - 完成标准：相似 themes 的 BrainstormSessions 可被查询为一组
  - 验证：编译通过 + API 可查询关联 sessions

