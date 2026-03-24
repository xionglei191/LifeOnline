# LifeOnline 第一阶段项目进度简表（快速查看版）

> 用途：这一页不是替代正式任务书，而是给日常对齐时快速查看"现在在哪、下一步干什么、哪些话不能说"。
> 最后更新：2026-03-24

## 1. 当前总判断
- **总体路线已清楚**：第一阶段继续按 PR1–PR6 推进。
- **当前已形成从 PR1 到 PR6 的最小可锚定链路**，且 SoulAction 覆盖面已从最初 2 种扩展到 8 种 actionKind。
- **当前不应夸大**：不能把这些最小落地写成完整、通用、全量、产品化的自治治理系统已完成。
- **部署闭环已建立**：246 服务器已有 systemd 自动管理，从开发到部署有完整链路。

## 2. 六阶段快照

| 阶段 | 当前状态 | 一句话判断 |
|---|---|---|
| PR1｜SoulAction 运行态骨架 | 已落地 | `soul_actions` 表、17 个 soul 模块、8 种 actionKind 覆盖、完整 CRUD + lifecycle 同步 |
| PR2｜低风险闭环 | 已落地（保守口径） | 以 `update_persona_snapshot` / `extract_tasks` 为中心的 `candidate → gate → review → dispatch → execute` 闭环已稳定运行 |
| PR3｜治理执行桥 | 已落地（保守口径） | `approve / dispatch / defer / discard` 治理面已完整，actionKind 筛选器、分组批量操作、WebSocket 实时更新均已落地 |
| PR4｜最小回流骨架 | 已落地 | terminal worker task 在真实路径中 best-effort 进入 reintegration hook，outcome/summary/evidence/record 已收口 |
| PR5｜轻量 persona/intervention 回流 | 已落地（保守口径） | `persona_snapshots` + `reintegration_records` 已形成最小 persona/intervention reintegration |
| PR6｜高阈值 continuity / event 回流 | 已落地（保守口径） | review-backed `event_nodes` / `continuity_records` promotion 最小闭环，`promote_event_node` / `promote_continuity_record` / `create_event_node` 均已支持 |

## 3. 当前已明确存在的代码锚点

### 核心 soul 模块区（17 个文件）
- `LifeOS/packages/server/src/soul/types.ts` — 核心类型定义
- `LifeOS/packages/server/src/soul/soulActions.ts` — SoulAction store/CRUD
- `LifeOS/packages/server/src/soul/soulActionGenerator.ts` — 动作候选生成
- `LifeOS/packages/server/src/soul/soulActionDispatcher.ts` — 动作分发与 worker bridge
- `LifeOS/packages/server/src/soul/interventionGate.ts` — 干预闸门
- `LifeOS/packages/server/src/soul/cognitiveAnalyzer.ts` — AI 认知分析
- `LifeOS/packages/server/src/soul/gateLearning.ts` — Gate 学习
- `LifeOS/packages/server/src/soul/personaSnapshots.ts` — Persona 管理
- `LifeOS/packages/server/src/soul/postIndexPersonaTrigger.ts` — 索引后 Persona 触发
- `LifeOS/packages/server/src/soul/reintegrationRecords.ts` — 回流记录存储
- `LifeOS/packages/server/src/soul/reintegrationReview.ts` — 回流审核
- `LifeOS/packages/server/src/soul/reintegrationOutcome.ts` — 回流结果处理
- `LifeOS/packages/server/src/soul/reintegrationPromotionPlanner.ts` — 提升规划器
- `LifeOS/packages/server/src/soul/pr6PromotionRules.ts` — PR6 提升规则
- `LifeOS/packages/server/src/soul/pr6PromotionExecutor.ts` — PR6 提升执行
- `LifeOS/packages/server/src/soul/eventNodes.ts` — 事件节点管理
- `LifeOS/packages/server/src/soul/continuityRecords.ts` — 连续性记录管理

### 治理面 / Web 前端区
- `LifeOS/packages/web/src/views/GovernanceView.vue` — 治理中心主页
- `LifeOS/packages/web/src/components/SoulActionGovernancePanel.vue` — SoulAction 治理面板
- `LifeOS/packages/web/src/components/PromotionProjectionPanel.vue` — 提升投射面板

### 验证锚点
- `LifeOS/packages/server/test/feedbackReintegration.test.ts` — 198 个测试全通过

## 4. 蓝图 8 个首批 actionType 覆盖状态

| actionType | 已实现 | 备注 |
|---|---|---|
| `update_persona_snapshot` | ✅ | 最小闭环核心 |
| `extract_tasks` | ✅ | 最小闭环核心 |
| `create_event_node` | ✅ | PR6 review-backed |
| `launch_daily_report` | ✅ | 2026-03-24 新增 |
| `launch_weekly_report` | ✅ | 2026-03-24 新增 |
| `launch_openclaw_task` | ✅ | 2026-03-24 新增 |
| `ask_followup_question` | ❌ | 蓝图 PR2 scope，需 UI + API |
| `persist_continuity_markdown` | ❌ | Vault 写入层 |
| `sync_continuity_to_r2` | ❌ | R2 基础设施尚未开始 |

## 5. 当前明确尚未完成的内容
- 完整产品化 SoulAction Detail / Lifecycle 控制面
- `BrainstormSession` 认知对象（蓝图 5 个对象之一）
- `ask_followup_question` 交互层
- R2 桥接基础设施
- 完全通用化的 low-risk candidate → gate → dispatch 框架

## 6. 当前主线程优先级
1. **P1：技术债务收口**（SoulActionKind 重复定义、status 冗余字段、gate_decisions 不在 schema 内）
2. **P2：在保守边界内继续后续演进**（评估 `ask_followup_question`、`BrainstormSession` 落地路径）
3. **P3：产品化治理控制面**（SoulAction Detail / Lifecycle View）

## 7. 后续每轮对齐只回答三件事
- 现在推进的是哪一阶段？
- 是否满足该阶段完成定义？
- 是否越过了本文件写明的 out-of-scope 边界？
