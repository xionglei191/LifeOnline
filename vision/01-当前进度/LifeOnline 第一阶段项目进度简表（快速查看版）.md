# LifeOnline 第一阶段项目进度简表（快速查看版）

> 用途：这一页不是替代正式任务书，而是给日常对齐时快速查看“现在在哪、下一步干什么、哪些话不能说”。

## 1. 当前总判断
- **总体路线已清楚**：第一阶段继续按 PR1–PR6 推进。
- **当前已形成从 PR1 到 PR6 的最小可锚定链路**：PR1 最小 `SoulAction` 骨架、PR4 最小 skeleton、PR5 轻量回流信号层、PR6 高阈值 promotion 骨架均已有最小落地。
- **当前不应夸大**：不能把 PR1 写成完整完成，也不能把 PR5/PR6 写成通用、全量、产品化的 persona/event/continuity 系统已完成。

## 2. 六阶段快照

| 阶段 | 当前状态 | 一句话判断 |
|---|---|---|
| PR1｜SoulAction 运行态骨架 | 部分落地（最小骨架） | 已有最小 `SoulAction` runtime/store 与 `soul_actions` 落地，当前仅保守覆盖 `extract_tasks` |
| PR2｜低风险闭环 | 最小落地（保守口径） | 已形成以 `update_persona_snapshot` 为中心的最小 `candidate -> gate -> dispatch -> execute` 闭环 |
| PR3｜治理执行桥 | 最小落地（保守口径） | 已有 `soul_actions` 双状态、review queue、approve / dispatch / defer / discard 最小治理面 |
| PR4｜最小回流骨架 | 已落地（保守口径） | 已在真实 terminal worker path 接线最小 payload / summary / target / strength skeleton |
| PR5｜轻量 persona/intervention 回流 | 最小落地（保守口径） | 已有 `reintegration_records` 轻量回流信号层，并覆盖当前全部已支持 PR4 task types |
| PR6｜高阈值 continuity / event 回流 | 最小落地（保守口径） | 已有 review-backed `event_nodes` / `continuity_records` 最小 promotion 闭环 |

## 3. 当前已明确存在的代码锚点
- PR1 最小骨架：`LifeOS/packages/server/src/soul/soulActions.ts`
- PR1 类型定义：`LifeOS/packages/server/src/soul/types.ts`
- PR1 持久化锚点：`LifeOS/packages/server/src/db/schema.ts`
- PR1 初始化锚点：`LifeOS/packages/server/src/db/client.ts`
- 执行主链：`LifeOS/packages/server/src/workers/workerTasks.ts`
- 最小回流 payload：`LifeOS/packages/server/src/workers/feedbackReintegration.ts`
- 最小 continuity summary：`LifeOS/packages/server/src/workers/continuityIntegrator.ts`
- 验证锚点：`LifeOS/packages/server/test/feedbackReintegration.test.ts`

## 4. 当前明确尚未完成或不能夸大宣称的内容
- 完整 `src/soul/` 治理中枢体系
- 覆盖多 task types 的通用 `SoulAction` runtime/store 主体
- 通用化、全量化的 low-risk candidate → gate → dispatch 真闭环
- 完整产品化 review / governance 控制面
- 通用、全量、产品化的 persona / event / continuity 对象层 reintegration

## 5. 当前实现形态 vs 目标形态
- **当前实现形态**：`SoulAction` 先作为 `workerTasks` 生命周期镜像层，范围仅保守覆盖 `extract_tasks`；reintegration 先落在 `src/workers/`，保持 best-effort、side-effect-free。
- **目标形态**：后续再补 generator / gate / dispatcher / review queue，并再决定相关能力是否进一步向 `src/soul/` 中枢收束。

## 6. 当前主线程优先级
1. **P0：冻结保守口径**
2. **P1：同步 PR5 / PR6 文档状态**
3. **P2：收口验证与落地审查**
4. **P3：在保守边界内继续后续演进**

## 7. 后续每轮对齐只回答三件事
- 现在推进的是哪一阶段？
- 是否满足该阶段完成定义？
- 是否越过了本文件写明的 out-of-scope 边界？
