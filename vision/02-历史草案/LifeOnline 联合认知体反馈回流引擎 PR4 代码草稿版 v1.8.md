# 《Soul Constitution》v1.8
## LifeOnline 联合认知体反馈回流引擎 PR4 代码草稿版

v1.7 已经把 PR4 压到了逐文件实现稿层：
- 知道该改哪些文件
- 知道该加哪些类型
- 知道该导出哪些函数
- 知道第一版明确不做什么

接下来最自然的一步，就是把这些文件再继续压成更接近真实实现的代码草稿。

也就是说，v1.8 的目标不是直接改仓库代码，
而是：

> 把 PR4 所需的核心类型与函数进一步压成接近真实 TypeScript 的实现稿，帮助后续实现时几乎可以直接对照落代码。

本版重点收束为四个文件：
- `soulActionTypes.ts`
- `feedbackReintegration.ts`
- `continuityIntegrator.ts`
- `soulActionGenerator.ts`

---

# 1. `soulActionTypes.ts` 草稿

这一版的关键目标，是把 reintegration 相关类型直接压成第一版可写的 TypeScript 结构。

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

export type ReintegrationSummary = {
  actionId: string;
  targets: ReintegrationTarget[];
  strengths: Partial<Record<ReintegrationTarget, ReintegrationStrength>>;
  summary: string;
  shouldGenerateNextActions: boolean;
  nextActionTypes?: SoulActionType[];
};
```

### 这一版的关键判断
- `ActionOutcomePacket` 先保持扁平
- `ReintegrationSummary` 先保持摘要导向
- 第一版不急着做更复杂的嵌套 reason graph

也就是说：
- 先把“结果输入包”和“回流摘要”钉稳
- 不要提前把类型系统做重

---

# 2. `continuityIntegrator.ts` 草稿

这个文件第一版只做 continuity promotion 的高门槛判断。

```ts
import type {
  ActionOutcomePacket,
  ReintegrationStrength,
} from './soulActionTypes.js';

const CONTINUITY_ELIGIBLE_ACTION_TYPES = new Set([
  'persist_continuity_markdown',
  'launch_daily_report',
  'launch_weekly_report',
  'launch_openclaw_task',
]);

export function shouldPromoteToContinuity(
  outcome: ActionOutcomePacket,
): boolean {
  if (outcome.executionStatus !== 'succeeded') {
    return false;
  }

  if (!CONTINUITY_ELIGIBLE_ACTION_TYPES.has(outcome.actionType)) {
    return false;
  }

  if (!outcome.resultSummary?.trim()) {
    return false;
  }

  if (outcome.actionType === 'launch_openclaw_task') {
    return Boolean(outcome.generatedSignals?.length);
  }

  return true;
}

export function getContinuityPromotionStrength(
  outcome: ActionOutcomePacket,
): ReintegrationStrength {
  if (!shouldPromoteToContinuity(outcome)) {
    return 'light';
  }

  if (outcome.actionType === 'persist_continuity_markdown') {
    return 'promotion';
  }

  if (outcome.actionType === 'launch_weekly_report') {
    return 'strong';
  }

  if (outcome.actionType === 'launch_openclaw_task') {
    return 'strong';
  }

  return 'medium';
}
```

### 这一版的关键判断
- continuity 判断先显式、保守
- 不引入复杂评分器
- `launch_openclaw_task` 只有在出现足够明确的 `generatedSignals` 时才更像 continuity 候选

这意味着第一版 continuity 逻辑的重点是：
- 先守门
- 不是先放权

---

# 3. `feedbackReintegration.ts` 草稿

这是 PR4 的核心文件。

第一版建议只做三件事：
1. 从 `SoulAction` 构造 `ActionOutcomePacket`
2. 根据结果推断回流目标
3. 生成 `ReintegrationSummary`

```ts
import type {
  ActionOutcomePacket,
  ReintegrationSummary,
  ReintegrationTarget,
  ReintegrationStrength,
  SoulAction,
  SoulActionType,
} from './soulActionTypes.js';
import {
  getContinuityPromotionStrength,
  shouldPromoteToContinuity,
} from './continuityIntegrator.js';

function getExecutionStatus(action: SoulAction): 'succeeded' | 'failed' {
  return action.status === 'failed' ? 'failed' : 'succeeded';
}

function getLifecycleStatus(action: SoulAction): 'completed' | 'failed' {
  return action.status === 'failed' ? 'failed' : 'completed';
}

export function buildActionOutcomePacket(action: SoulAction): ActionOutcomePacket {
  return {
    actionId: action.id,
    actionType: action.actionType,
    sourceType: action.sourceType,
    sourceId: action.sourceId,
    lifecycleStatus: getLifecycleStatus(action),
    executionStatus: getExecutionStatus(action),
    resultSummary: action.resultSummary ?? undefined,
    errorMessage: action.errorMessage ?? undefined,
    feedbackRef: action.feedbackRef ?? undefined,
    gateDecision: action.approvalStatus ?? undefined,
    approvalStatus: action.approvalStatus ?? null,
    targetType: action.targetType ?? null,
    completedAt: action.completedAt ?? undefined,
    failedAt: action.failedAt ?? undefined,
  };
}

function determineTargets(outcome: ActionOutcomePacket): ReintegrationTarget[] {
  const targets: ReintegrationTarget[] = ['intervention_decision'];

  switch (outcome.actionType) {
    case 'ask_followup_question':
      targets.push('persona_state');
      if (outcome.executionStatus === 'succeeded' && outcome.userResponseSummary) {
        targets.push('next_action_candidates');
      }
      break;

    case 'update_persona_snapshot':
      targets.push('persona_state');
      break;

    case 'create_event_node':
      targets.push('event_node');
      break;

    case 'persist_continuity_markdown':
      targets.push('continuity_record');
      break;

    case 'launch_daily_report':
    case 'launch_weekly_report':
      targets.push('intervention_decision');
      if (shouldPromoteToContinuity(outcome)) {
        targets.push('continuity_record');
      }
      targets.push('next_action_candidates');
      break;

    case 'launch_openclaw_task':
      targets.push('event_node');
      if (shouldPromoteToContinuity(outcome)) {
        targets.push('continuity_record');
      }
      targets.push('next_action_candidates');
      break;

    case 'sync_continuity_to_r2':
      targets.push('intervention_decision');
      break;
  }

  return Array.from(new Set(targets));
}

function determineStrengths(
  outcome: ActionOutcomePacket,
  targets: ReintegrationTarget[],
): Partial<Record<ReintegrationTarget, ReintegrationStrength>> {
  const strengths: Partial<Record<ReintegrationTarget, ReintegrationStrength>> = {};

  for (const target of targets) {
    switch (target) {
      case 'persona_state':
        strengths[target] = outcome.executionStatus === 'succeeded' ? 'medium' : 'light';
        break;
      case 'event_node':
        strengths[target] = outcome.executionStatus === 'succeeded' ? 'strong' : 'medium';
        break;
      case 'continuity_record':
        strengths[target] = getContinuityPromotionStrength(outcome);
        break;
      case 'intervention_decision':
        strengths[target] = outcome.executionStatus === 'failed' ? 'strong' : 'light';
        break;
      case 'next_action_candidates':
        strengths[target] = outcome.executionStatus === 'succeeded' ? 'medium' : 'light';
        break;
    }
  }

  return strengths;
}

function determineNextActionTypes(outcome: ActionOutcomePacket): SoulActionType[] {
  switch (outcome.actionType) {
    case 'ask_followup_question':
      return outcome.executionStatus === 'succeeded'
        ? ['update_persona_snapshot']
        : [];

    case 'launch_daily_report':
      return shouldPromoteToContinuity(outcome)
        ? ['persist_continuity_markdown']
        : [];

    case 'launch_weekly_report':
      return shouldPromoteToContinuity(outcome)
        ? ['persist_continuity_markdown']
        : [];

    case 'launch_openclaw_task':
      return outcome.executionStatus === 'failed'
        ? ['create_event_node']
        : [];

    default:
      return [];
  }
}

export function summarizeReintegration(
  outcome: ActionOutcomePacket,
): ReintegrationSummary {
  const targets = determineTargets(outcome);
  const strengths = determineStrengths(outcome, targets);
  const nextActionTypes = determineNextActionTypes(outcome);

  const summaryParts = [
    `action=${outcome.actionType}`,
    `execution=${outcome.executionStatus}`,
    `targets=${targets.join(',')}`,
  ];

  if (outcome.resultSummary) {
    summaryParts.push(`result=${outcome.resultSummary}`);
  }

  if (outcome.errorMessage) {
    summaryParts.push(`error=${outcome.errorMessage}`);
  }

  return {
    actionId: outcome.actionId,
    targets,
    strengths,
    summary: summaryParts.join(' | '),
    shouldGenerateNextActions: nextActionTypes.length > 0,
    nextActionTypes: nextActionTypes.length > 0 ? nextActionTypes : undefined,
  };
}
```

---

## 3.1 这一版最重要的取舍

### a. `buildActionOutcomePacket(...)` 只做转换
它不做额外业务推断。

### b. `determineTargets(...)` 用显式 `switch`
第一版不要做规则中心或 DSL。

### c. `intervention_decision` 默认几乎总会被命中
因为任何动作结果都至少会为治理学习提供一点材料。

### d. `next_action_candidates` 先只在少量明确场景出现
避免 PR4 过早形成递归动作风暴。

---

# 4. `soulActionGenerator.ts` 草稿

这一版只需要把 outcome-based candidate generation 正式钉住。

```ts
import type {
  ActionOutcomePacket,
  CreateSoulActionInput,
  ReintegrationSummary,
  SoulActionType,
} from './soulActionTypes.js';

function mapNextActionTypeToCategory(
  actionType: SoulActionType,
): CreateSoulActionInput['actionCategory'] {
  switch (actionType) {
    case 'ask_followup_question':
      return 'interaction';
    case 'update_persona_snapshot':
      return 'state_update';
    case 'create_event_node':
      return 'memory_promotion';
    case 'persist_continuity_markdown':
      return 'artifact_output';
    case 'launch_daily_report':
    case 'launch_weekly_report':
    case 'launch_openclaw_task':
      return 'task_launch';
    case 'sync_continuity_to_r2':
      return 'bridge_sync';
  }
}

function mapNextActionTypeToTargetType(
  actionType: SoulActionType,
): CreateSoulActionInput['targetType'] {
  switch (actionType) {
    case 'ask_followup_question':
      return 'user';
    case 'update_persona_snapshot':
    case 'create_event_node':
      return 'sqlite';
    case 'persist_continuity_markdown':
      return 'vault';
    case 'launch_daily_report':
    case 'launch_weekly_report':
      return 'worker_task';
    case 'launch_openclaw_task':
      return 'openclaw';
    case 'sync_continuity_to_r2':
      return 'r2';
  }
}

export function generateSoulActionsFromOutcome(
  outcome: ActionOutcomePacket,
  reintegration: ReintegrationSummary,
): CreateSoulActionInput[] {
  if (!reintegration.shouldGenerateNextActions || !reintegration.nextActionTypes?.length) {
    return [];
  }

  return reintegration.nextActionTypes.map((actionType) => ({
    sourceType: outcome.sourceType,
    sourceId: outcome.sourceId,
    actionCategory: mapNextActionTypeToCategory(actionType),
    actionType,
    targetType: mapNextActionTypeToTargetType(actionType),
    priority: actionType === 'persist_continuity_markdown' ? 'medium' : 'low',
    payload: {
      triggeredByActionId: outcome.actionId,
      triggeredByActionType: outcome.actionType,
      reintegrationSummary: reintegration.summary,
    },
    reason: `Generated from outcome reintegration of ${outcome.actionType}`,
    requiresApproval:
      actionType === 'persist_continuity_markdown' ||
      actionType === 'launch_openclaw_task',
  }));
}
```

---

## 4.1 这一版的关键判断

### a. 先返回 `CreateSoulActionInput[]`
不直接调用 store。

### b. 先让 reintegration 决定“是否需要新候选”
generator 不重复做那层判断。

### c. `payload` 先只保留最小回溯信息
例如：
- 由哪个 action 触发
- 回流摘要是什么

这样后面更容易 trace。

---

# 5. 第一版最小调用链草稿

v1.8 进一步把 v1.7 的调用链压成接近真实实现的样子：

```ts
import { buildActionOutcomePacket, summarizeReintegration } from './feedbackReintegration.js';
import { generateSoulActionsFromOutcome } from './soulActionGenerator.js';

export function handleCompletedSoulAction(action: SoulAction) {
  const outcome = buildActionOutcomePacket(action);
  const reintegration = summarizeReintegration(outcome);
  const nextActionInputs = generateSoulActionsFromOutcome(outcome, reintegration);

  return {
    outcome,
    reintegration,
    nextActionInputs,
  };
}
```

### 这段草稿的意义
它非常清楚地表明：
- 第一版 PR4 的最小闭环产物不是对象写入
- 而是：
  - 结果包
  - 回流摘要
  - 新候选输入

这为后面的 PR5 / PR6 留出了最干净的接入点。

---

# 6. 这一版明确不做的实现

为了防止 v1.8 草稿误导后续实现，
这里再次把“不做什么”钉死。

## 6.1 不在 `feedbackReintegration.ts` 中调用数据库
第一版不要在这里直接：
- 写 `PersonaState`
- 写 `EventNode`
- 写 `ContinuityRecord`
- 改 `soul_actions`

---

## 6.2 不让 `generateSoulActionsFromOutcome(...)` 直接入库
它只产出 `CreateSoulActionInput[]`。

是否真正持久化，
留给后续 PR 决定。

---

## 6.3 不做复杂用户反馈解析
`userResponseSummary` 先只是预留字段，
不在 PR4 草稿里引入复杂 NLP 提炼层。

---

## 6.4 不让 continuity 判断变成神秘黑箱
第一版 continuity promotion 明确走保守显式规则。

---

# 7. v1.8 的最终判断

到了 v1.8，这套 reintegration PR4 已经不只是：
- 有概念
- 有落位
- 有函数名

而是已经进一步具备：
- 接近真实代码的类型定义
- 接近真实代码的函数骨架
- 接近真实代码的显式 `switch` 逻辑
- 接近真实代码的最小调用链

也就是说：

> 如果下一步要真正进入实现，v1.8 已经足够作为 PR4 的近代码蓝本使用。

---

# 8. 一句话总结 v1.8

> v1.8 的意义，是把 LifeOnline 联合认知体第一阶段中反馈回流引擎的 PR4，进一步压成了近代码实现稿：`ActionOutcomePacket` 与 `ReintegrationSummary` 被正式写成可用类型，`buildActionOutcomePacket(...)`、`summarizeReintegration(...)`、`shouldPromoteToContinuity(...)`、`generateSoulActionsFromOutcome(...)` 被压成接近真实 TypeScript 的函数骨架，从而让再认知层第一次几乎可以直接进入实现。