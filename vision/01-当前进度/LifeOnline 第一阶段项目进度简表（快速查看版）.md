# LifeOnline 第一阶段项目进度简表（快速查看版）

> 用途：这一页不是替代正式任务书，而是给日常对齐时快速查看"现在在哪、下一步干什么、哪些话不能说"。
> 最后更新：2026-03-24

## 1. 当前总判断
- **总体路线已清楚**：第一阶段继续按 PR1–PR6 推进。
- **当前已形成从 PR1 到 PR6 的最小可锚定链路**，且 SoulAction 覆盖面已从最初 2 种扩展到 10 种 actionKind。
- **蓝图 5 个核心认知对象全部落地**：PersonaState ✅ EventNode ✅ ContinuityRecord ✅ InterventionDecision(gate_decisions) ✅ BrainstormSession ✅
- **当前不应夸大**：不能把这些最小落地写成完整、通用、全量、产品化的自治治理系统已完成。
- **部署闭环已建立**：246 服务器已有 systemd 自动管理，从开发到部署有完整链路。

## 2. 六阶段快照

| 阶段 | 当前状态 | 一句话判断 |
|---|---|---|
| PR1｜SoulAction 运行态骨架 | 已落地 | `soul_actions` 表、18 个 soul 模块、10 种 actionKind 覆盖、完整 CRUD + lifecycle 同步 |
| PR2｜低风险闭环 | 已落地（保守口径） | 以 `update_persona_snapshot` / `extract_tasks` 为中心的 `candidate → gate → review → dispatch → execute` 闭环已稳定运行 |
| PR3｜治理执行桥 | 已落地（保守口径） | `approve / dispatch / defer / discard` 治理面已完整，actionKind 筛选器、分组批量操作、WebSocket 实时更新、SoulAction Detail 页面均已落地 |
| PR4｜最小回流骨架 | 已落地 | terminal worker task 在真实路径中 best-effort 进入 reintegration hook，outcome/summary/evidence/record 已收口 |
| PR5｜轻量 persona/intervention 回流 | 已落地（保守口径） | `persona_snapshots` + `reintegration_records` 已形成最小 persona/intervention reintegration |
| PR6｜高阈值 continuity / event 回流 | 已落地（保守口径） | review-backed `event_nodes` / `continuity_records` promotion 最小闭环，`promote_event_node` / `promote_continuity_record` / `create_event_node` 均已支持 |

## 3. 当前已明确存在的代码锚点

### 核心 soul 模块区（18 个文件）
- `LifeOS/packages/server/src/soul/types.ts` — 核心类型定义
- `LifeOS/packages/server/src/soul/soulActions.ts` — SoulAction store/CRUD
- `LifeOS/packages/server/src/soul/soulActionGenerator.ts` — 动作候选生成
- `LifeOS/packages/server/src/soul/soulActionDispatcher.ts` — 动作分发与 worker bridge
- `LifeOS/packages/server/src/soul/interventionGate.ts` — 干预闸门
- `LifeOS/packages/server/src/soul/cognitiveAnalyzer.ts` — AI 认知分析
- `LifeOS/packages/server/src/soul/gateLearning.ts` — Gate 学习
- `LifeOS/packages/server/src/soul/personaSnapshots.ts` — Persona 管理
- `LifeOS/packages/server/src/soul/postIndexPersonaTrigger.ts` — 索引后 Persona 触发
- `LifeOS/packages/server/src/soul/brainstormSessions.ts` — BrainstormSession 认知对象
- `LifeOS/packages/server/src/soul/reintegrationRecords.ts` — 回流记录存储
- `LifeOS/packages/server/src/soul/reintegrationReview.ts` — 回流审核
- `LifeOS/packages/server/src/soul/reintegrationOutcome.ts` — 回流结果处理
- `LifeOS/packages/server/src/soul/reintegrationPromotionPlanner.ts` — 提升规划器
- `LifeOS/packages/server/src/soul/pr6PromotionRules.ts` — PR6 提升规则
- `LifeOS/packages/server/src/soul/pr6PromotionExecutor.ts` — PR6 提升执行
- `LifeOS/packages/server/src/soul/eventNodes.ts` — 事件节点管理
- `LifeOS/packages/server/src/soul/continuityRecords.ts` — 连续性记录管理

### 治理面 / Web 前端区
- `LifeOS/packages/web/src/views/GovernanceView.vue` — 治理中心主页（含认知分析面板）
- `LifeOS/packages/web/src/views/SoulActionDetailView.vue` — SoulAction 详情页
- `LifeOS/packages/web/src/components/SoulActionGovernancePanel.vue` — SoulAction 治理面板
- `LifeOS/packages/web/src/components/PromotionProjectionPanel.vue` — 提升投射面板

### 验证锚点
- `LifeOS/packages/server/test/feedbackReintegration.test.ts` — 198 个测试全通过

## 4. 蓝图首批 actionType 覆盖状态

| actionType | 已实现 | 备注 |
|---|---|---|
| `update_persona_snapshot` | ✅ | 最小闭环核心 |
| `extract_tasks` | ✅ | 最小闭环核心 |
| `create_event_node` | ✅ | PR6 review-backed |
| `promote_event_node` | ✅ | PR6 promotion |
| `promote_continuity_record` | ✅ | PR6 promotion |
| `launch_daily_report` | ✅ | 2026-03-24 新增 |
| `launch_weekly_report` | ✅ | 2026-03-24 新增 |
| `launch_openclaw_task` | ✅ | 2026-03-24 新增 |
| `ask_followup_question` | ✅ | 交互层，用户追问 UI |
| `persist_continuity_markdown` | ✅ | Vault 写入层 |
| `sync_continuity_to_r2` | ✅ | R2 冷存储桥接（凭据通过环境变量配置） |

## 5. 当前明确尚未完成的内容
- 完全通用化的 low-risk candidate → gate → dispatch 框架
- BrainstormSession 深度提炼（distilled 阶段）
- R2 凭据配置与实际冷存储验证（框架已就绪）

## 6. 当前主线程优先级
1. **P1：稳定验证**（确认所有 11 个 actionKind 的完整闭环运行正常）
2. **P2：深度提炼**（BrainstormSession distilled 阶段、连续性模式识别增强）
3. **P3：R2 凭据配置与实际验证**（提供环境变量后即可生效）

## 7. 后续每轮对齐只回答三件事
- 现在推进的是哪一阶段？
- 是否满足该阶段完成定义？
- 是否越过了本文件写明的 out-of-scope 边界？
