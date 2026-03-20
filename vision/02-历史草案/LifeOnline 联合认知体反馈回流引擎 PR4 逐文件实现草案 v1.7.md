# 《Soul Constitution》v1.7
## LifeOnline 联合认知体反馈回流引擎 PR4 逐文件实现草案

v1.0 到 v1.6 已经把第一阶段从愿景、对象、动作、Gate、Review、生命周期、反馈回流，一路压到了当前仓库的真实落位图。

到这一刻，继续补抽象名词的价值已经明显变小。
真正最自然的一步，是把 v1.6 里收束出来的 PR4 继续压到逐文件实现层：

> 如果现在正式开始写第一版 reintegration 骨架，那么 `feedbackReintegration.ts`、`continuityIntegrator.ts`、`soulActionTypes.ts`、`soulActionGenerator.ts` 分别应该新增什么类型、什么函数签名、什么最小调用链，以及第一步明确做什么、不做什么？

所以 v1.7 的目标是：

> 把 LifeOnline 联合认知体第一阶段中反馈回流引擎的 PR4，继续压成逐文件实现稿，明确每个文件里该出现的最小结构、导出函数、输入输出类型与调用边界。

也就是说，v1.7 关注的不是“回流引擎应该存在”，
而是：

> **第一版代码最小到底该怎么写。**

---

# 1. v1.7 的定位

如果说：
- v1.5 是再认知引擎骨架
- v1.6 是到当前代码库的落位映射

那么：
- v1.7 就是 PR4 的逐文件实现稿

它的任务不是：
- 直接开始写所有实现代码
- 一步到位把 Persona / Event / Continuity 全接完

它的任务是：
- 把第一版骨架文件压清
- 把类型边界压清
- 把最小调用链压清
- 把 PR4 里明确“不做什么”压清

也就是说：

> v1.7 的目标，是让 PR4 进入“已经接近可直接落代码”的状态。

---

# 2. PR4 的范围重新压实

v1.7 建议再次把 PR4 收紧，
避免一上来把 reintegration 做重。

## 2.1 PR4 只做四件事
1. 扩展 `soulActionTypes.ts`，引入 reintegration 相关正式类型
2. 新增 `feedbackReintegration.ts`，提供结果包读取与回流摘要生成骨架
3. 新增 `continuityIntegrator.ts`，只提供 continuity 相关的轻量判断函数骨架
4. 在 `soulActionGenerator.ts` 中预留或补上从 outcome 生成候选的最小入口签名

---

## 2.2 PR4 明确不做
- 不真正写 PersonaState / EventNode / ContinuityRecord 的持久化更新
- 不新增复杂对象表
- 不开放 reintegration 外部 API
- 不把 reintegration 结果直接写入 Vault
- 不真正自动触发新的 `SoulAction` 持久化写入
- 不实现完整 continuity promotion
- 不重构 worker 主执行链

也就是说：

> PR4 的真正目标不是“系统已经学会再认知”，而是先把再认知骨架做出来，并让它有稳定的输入输出边界。

---

# 3. 第一阶段推荐的文件改动清单

v1.7 建议 PR4 的逐文件范围明确限定为：

```text
packages/server/src/soul/
  soulActionTypes.ts           ← 扩展类型
  soulActionGenerator.ts       ← 预留 outcome 入口
  feedbackReintegration.ts     ← 新增
  continuityIntegrator.ts      ← 新增
```

必要时可附带极小改动：
- `soulActionStore.ts`（仅当需要读取构造结果包所需字段）

但 v1.7 的主判断是：
- PR4 最好先不碰 API
- 先不碰 routes / handlers
- 先不碰 worker 的复杂主链

---

# 4. `soulActionTypes.ts` 的逐文件实现建议

这是 PR4 最重要的基础文件之一。

它从这一版开始不再只描述 `SoulAction` 本体，
还要开始描述“结果如何重新进入认知链”。

---

## 4.1 应新增的核心类型

建议新增：

```ts
export type ReintegrationTarget =
  | 'persona_state'
  | 'event_node'
  | 'continuity_record'
  | 'intervention_decision'
  | 'next_action_candidates';

export type ReintegrationStrength =
  | 'light'
  | 'medium'
  | 'strong'
  | 'promotion';

export type ActionOutcomeLifecycleStatus = 'completed' | 'failed';

export type ActionOutcomeExecutionStatus = 'succeeded' | 'failed';
```

这些类型的意义是：
- 先把 reintegration 的目标和强度语义钉住
- 避免后续在不同文件里重复发明同类字符串

---

## 4.2 `ActionOutcomePacket` 的第一版结构建议

建议加入：

```ts
export type ActionOutcomePacket = {
  actionId: string;
  actionType: SoulActionType;
  sourceType: SoulActionSourceType;
  sourceId: string;
  lifecycleStatus: ActionOutcomeLifecycleStatus;
  executionStatus: ActionOutcomeExecutionStatus;
  resultSummary?: string;
  errorMessage?: string;
  feedbackRef?: string;
  gateDecision?: string;
  approvalStatus?: string | null;
  targetType?: SoulActionTargetType | null;
  userResponseSummary?: string;
  artifactRefs?: string[];
  generatedSignals?: string[];
  completedAt?: string;
  failedAt?: string;
};
```

注意：
- 第一版不需要做特别复杂的嵌套结构
- 关键是先把“回流引擎的正式输入对象”钉住

---

## 4.3 `ReintegrationSummary` 的第一版结构建议

建议加入：

```ts
export type ReintegrationSummary = {
  actionId: string;
  targets: ReintegrationTarget[];
  strengths: Partial<Record<ReintegrationTarget, ReintegrationStrength>>;
  summary: string;
  shouldGenerateNextActions: boolean;
  nextActionTypes?: SoulActionType[];
};
```

其核心作用是：
- PR4 先不真正执行对象更新
- 先把“这次结果如果被回流，应回到哪里、以什么力度、是否值得生成新动作”表达清楚

也就是说，PR4 的最小产物不是对象更新，
而是**结构化回流判断结果**。

---

## 4.4 可选辅助类型

如果希望让第一版代码更清晰，
还可以新增：

```ts
export type ReintegrationDecision = {
  target: ReintegrationTarget;
  strength: ReintegrationStrength;
  reason: string;
};
```

但 v1.7 的判断是：
- 这不是必须
- 若 `ReintegrationSummary` 已经够表达，则不必过度加类型层次

---

# 5. `feedbackReintegration.ts` 的逐文件实现建议

这是 PR4 的核心新增文件。

它的定位应该非常克制：
- 做结果读取
- 做目标判断
- 做摘要输出
- 不直接写对象层

---

## 5.1 第一版建议导出的函数

建议第一版至少导出：

```ts
export function buildActionOutcomePacket(action: SoulAction): ActionOutcomePacket;

export function summarizeReintegration(
  outcome: ActionOutcomePacket,
): ReintegrationSummary;
```

如果需要更清楚地分层，也可以采用：

```ts
export function determineReintegrationTargets(
  outcome: ActionOutcomePacket,
): ReintegrationTarget[];

export function summarizeReintegration(
  outcome: ActionOutcomePacket,
): ReintegrationSummary;
```

但 v1.7 更推荐：
- 先把导出函数数目控制在最小
- 不要过早拆出一堆 helper 并把结构做散

---

## 5.2 `buildActionOutcomePacket(...)` 的职责

第一版它应负责：
- 从已完成或失败的 `SoulAction` 中提取最基本结果字段
- 统一构造成 `ActionOutcomePacket`
- 对空字段提供保守默认值

它不应负责：
- 读额外复杂业务上下文
- 做对象更新
- 做 candidate 持久化

其定位应是：

> 从动作运行态记录到回流输入包的转换器。

---

## 5.3 `summarizeReintegration(...)` 的职责

第一版它应负责：
- 根据 `actionType`、执行结果、结果摘要、错误信息等
- 判断这次结果应命中的回流目标
- 为每个目标给出粗粒度强度
- 输出总 summary
- 判断是否值得生成下一轮动作候选

第一版它不应负责：
- 真正写 PersonaState
- 真正创建 EventNode
- 真正写 ContinuityRecord
- 真正创建新的 `SoulAction`

也就是说，PR4 中它的本质是：

> 结果解释器，而不是对象写入器。

---

## 5.4 第一版实现风格建议

v1.7 建议保持：
- 显式 `switch (outcome.actionType)`
- 显式 success / failure 分支
- 少量本地 helper
- 不引入 class
- 不引入复杂规则引擎
- 不引入注册中心

原因很简单：
- 这一层目前还处于强语义收敛期
- 显式比抽象更容易调试和审计

---

# 6. `continuityIntegrator.ts` 的逐文件实现建议

这个文件第一版不应做成“大 Continuity 中心”。

它在 PR4 中更适合扮演：
- continuity 路径判断辅助器

---

## 6.1 第一版建议导出的函数

建议只导出一个非常克制的函数：

```ts
export function shouldPromoteToContinuity(
  outcome: ActionOutcomePacket,
): boolean;
```

如果希望理由更清楚，也可以用：

```ts
export function evaluateContinuityPromotion(
  outcome: ActionOutcomePacket,
): {
  shouldPromote: boolean;
  strength: ReintegrationStrength;
  reason: string;
};
```

但 v1.7 的判断是：
- 第一版优先简单
- 返回布尔值 + 内部让 `feedbackReintegration.ts` 生成 summary 更轻

---

## 6.2 第一版判断依据建议

`shouldPromoteToContinuity(...)` 第一版建议只依赖这些保守维度：
- `actionType`
- `executionStatus`
- 是否已有高价值 `resultSummary`
- 是否存在足够明确的 `generatedSignals`

并且显式偏保守：
- 单次普通成功不应直接升 Continuity
- 普通追问结果默认不应升 Continuity
- report / continuity / 某些高价值外部执行结果才有资格进入判断

也就是说，这个文件第一版存在的目的不是“帮系统多写连续性”，
而是“先把连续性门槛钉住”。

---

# 7. `soulActionGenerator.ts` 的逐文件实现建议

v1.7 认为，PR4 不应在这里直接接入完整 next-action 生成，
但应至少为后续留出正式入口。

---

## 7.1 第一版建议新增的函数签名

建议新增：

```ts
export function generateSoulActionsFromOutcome(
  outcome: ActionOutcomePacket,
  reintegration: ReintegrationSummary,
): CreateSoulActionInput[];
```

第一版这个函数可以非常克制：
- 甚至先只返回空数组
- 或只对极少数明确场景生成候选

例如：
- `ask_followup_question` 成功后 → `update_persona_snapshot`
- `launch_daily_report` 成功后且满足条件 → `persist_continuity_markdown`

但 v1.7 建议：
- PR4 中可以只做函数签名 + 最小显式 `switch`
- 先不让它真的接入 store

---

## 7.2 为什么要现在就加这个入口

因为从 v1.5 开始已经明确：
- 回流不仅要更新对象
- 还可能触发下一轮动作生成

如果 PR4 完全不在 generator 里预留这个入口，
后面 PR5 / PR6 会被迫重新打断语义边界。

所以：

> PR4 不一定真正放开 outcome-based generation，但必须先把入口钉住。

---

# 8. 推荐的最小调用链

v1.7 建议把 PR4 的调用链压到非常简单。

第一版理想形态应是：

```ts
const outcome = buildActionOutcomePacket(action);
const reintegration = summarizeReintegration(outcome);
const nextActions = generateSoulActionsFromOutcome(outcome, reintegration);
```

其中：
- `reintegration` 先只是摘要，不做真实对象写入
- `nextActions` 先只是候选输入，不必立刻持久化

这样做的价值是：
- 先把语义链跑通
- 再逐步把骨架接到真实对象层和 store 上

---

# 9. 第一版明确不做的内容

v1.7 建议把“不做什么”再压清一次，
避免 PR4 失控。

## 9.1 不做真实对象持久化
PR4 不应直接写：
- PersonaState store
- EventNode store
- ContinuityRecord store
- InterventionDecision history

这些属于 PR5 / PR6 才更适合接入的内容。

---

## 9.2 不做复杂信号融合
第一版不要引入：
- 多轮结果聚合器
- 加权评分器
- 模型驱动的回流判断器
- 高级规则 DSL

先用显式规则 + 保守分支就够了。

---

## 9.3 不做自动写回 `soul_actions`
PR4 不应在 `feedbackReintegration.ts` 里偷偷创建新动作。

如果要返回新动作候选，
也应先只以：
- `CreateSoulActionInput[]`
- 或 summary 中的 `nextActionTypes`

形式返回。

这能避免 PR4 过早把编排、store、execution 再次耦死。

---

# 10. PR4 的成功标准

v1.7 认为，PR4 是否成功，不应看它“看起来多聪明”，
而应看它是否做到这些最小标准：

---

## 10.1 类型边界稳定
至少：
- `ActionOutcomePacket`
- `ReintegrationTarget`
- `ReintegrationStrength`
- `ReintegrationSummary`

已经在 `soulActionTypes.ts` 中正式存在并可被其它模块复用。

---

## 10.2 回流摘要链跑通
至少能够：
- 从一个已完成或失败的 `SoulAction` 构造 `ActionOutcomePacket`
- 对其生成 `ReintegrationSummary`

---

## 10.3 continuity 路径有正式判断入口
至少：
- `continuityIntegrator.ts` 已存在
- continuity promotion 不再散落在未来的某个模糊逻辑里

---

## 10.4 outcome-based generation 入口已钉住
至少：
- `generateSoulActionsFromOutcome(...)` 已经存在
- 即使第一版只支持极少量场景，语义边界也已经固定

---

## 10.5 没有破坏现有主链
至少应确保：
- 不改 worker 生命周期语义
- 不改 API 语义
- 不改现有 review / dispatch 主链
- 不引入新的架构耦合

也就是说，PR4 的价值是：
- 给 PR5 / PR6 铺路
- 而不是提前把整个回流系统写重

---

# 11. v1.7 的最终收束

v1.7 最关键的意义，不是发明了新的模块名，
而是把 reintegration PR4 压到了一个非常实际的程度：
- 哪些文件改
- 新增什么类型
- 导出什么函数
- 最小调用链是什么
- 什么现在不做
- 成功标准是什么

这意味着：

> 从这一版开始，反馈回流引擎已经接近可以直接进入逐文件编码阶段。

---

# 12. 一句话总结 v1.7

> v1.7 的意义，是把 LifeOnline 联合认知体第一阶段中反馈回流引擎的 PR4，正式压成了逐文件实现稿：`soulActionTypes.ts` 开始承接结果包与回流类型，`feedbackReintegration.ts` 负责结果解释与回流摘要，`continuityIntegrator.ts` 负责 continuity 路径的高门槛判断，`soulActionGenerator.ts` 预留 outcome-based candidate 入口，从而让再认知层第一次具备了可以直接落代码的最小函数签名与调用骨架。