# 《Soul Constitution》v1.6
## LifeOnline 联合认知体反馈回流引擎到当前代码库的落位映射草案

v1.0 把第一阶段的正式实现蓝图立起来了，
v1.1 把对象与动作流的动态主链压清了，
v1.2 把 `Intervention Gate` 压成治理稳定器，
v1.3 把人工治理流与 Review API 压成正式治理执行面，
v1.4 把 `SoulAction` 生命周期状态机与反馈回流法典压成统一闭环，
v1.5 又把反馈回流引擎 / continuity integration 正式压成了第一阶段最像“灵魂接口”的再认知骨架。

接下来最自然的一步，已经不再是继续补概念，
而是把 v1.5 里提出的再认知层直接落回当前仓库：

> 在现在这套 LifeOnline / LifeOS 代码结构下，反馈回流引擎究竟应该长在哪些目录、依赖哪些已有模块、从哪里读取结果、往哪里写回对象、由哪些最小 PR 分阶段接入？

如果这一步不被压清，
那么 v1.5 仍然只是一个正确但悬空的设计层：
- 知道需要 reintegration
- 知道需要 continuity integration
- 但不知道第一版代码该放哪
- 也不知道它和现有 `db`、`workers`、`api`、`vault`、未来 `soul/` 模块之间的真实边界

所以 v1.6 的目标是：

> 把 LifeOnline 联合认知体第一阶段中反馈回流引擎 / continuity integration 的工程宿主、目录落位、输入来源、对象更新入口、字段映射与最小 PR 切分，正式映射到当前 LifeOS 仓库。

也就是说，v1.6 要解决的问题是：

> **再认知引擎不只是应该存在，而是第一版到底该如何长进现有代码库。**

---

# 1. v1.6 的定位

如果说：
- v1.0 是阶段总蓝图
- v1.1 是动态主链
- v1.2 是 Gate 宪法
- v1.3 是 Review 治理执行面
- v1.4 是生命周期法典
- v1.5 是反馈回流引擎骨架

那么：
- v1.6 就是再认知引擎的代码落位图

它不再主要回答：
- 回流应该发生什么

而是继续回答：
- 第一版代码写在哪
- 和现有 `packages/server` 的哪些模块相邻
- 哪些模块现在就应存在
- 哪些只该先保留接口，不急着实现
- 最小 PR 应如何切

也就是说：

> v1.6 把回流引擎从设计层推进到仓库级实施蓝图。

---

# 2. 当前仓库下的基本工程判断

基于前面已经对齐的 LifeOnline 命名边界与 LifeOS 宿主关系，
v1.6 先明确几个不变前提。

---

## 2.1 工程宿主仍然是 `LifeOS/packages/server`
第一阶段的反馈回流引擎，
当前更适合继续长在：
- `LifeOS/packages/server`

原因很明确：
- `soul_actions` 运行态在 server 侧
- `db/schema.ts` 与 `db/client.ts` 在这里
- worker task 生命周期在这里
- API / routes / handlers 在这里
- 与 SQLite、Vault、scheduler、worker 的耦合都主要发生在这里

所以：

> 再认知引擎当前的工程宿主仍应是 LifeOS backend，而不是提前上提到 shared 或独立服务。

---

## 2.2 第一阶段不应一开始扩散到 `packages/shared`
虽然未来某些结果包类型、review 视图或 Web 展示契约可能会进入：
- `packages/shared`

但 v1.6 建议第一阶段不要急着这样做。

更合理的顺序是：
- 先在 `server` 内部收敛 reintegration 语义
- 先跑通对象更新和候选再生长链
- 后续如果 Web 真的需要直连这些类型，再稳定抽到 shared

这与之前对 `SoulAction` 第一阶段的判断保持一致：

> 先在 server 内长稳，再决定哪些协议值得上提为共享契约。

---

## 2.3 回流引擎应作为 `soul/` 模块组的一部分
从前面的 v0.6 / v1.0 / v1.5 延续下来，
更合理的目录方向仍然是：

```text
packages/server/src/soul/
  soulActionTypes.ts
  soulActionStore.ts
  soulActionGenerator.ts
  interventionGate.ts
  soulActionDispatcher.ts
  feedbackReintegration.ts
  continuityIntegrator.ts
```

其中：
- `feedbackReintegration.ts` 更偏“读取结果包并做回流分流”
- `continuityIntegrator.ts` 更偏“涉及 ContinuityRecord / 长期整合的高门槛逻辑”

第一阶段不一定要两个文件都立即完全实现，
但从 v1.6 开始，这个模块边界已经足够清楚。

---

# 3. 第一阶段推荐的代码落位

v1.6 建议把 reintegration 相关代码收束为四类落位。

---

## 3.1 `packages/server/src/soul/feedbackReintegration.ts`
### 角色
这是第一阶段最核心的新文件。

### 建议职责
- 接收 `ActionOutcomePacket`
- 做结果类型与价值判断
- 判断回流目标
- 形成最小 reintegration summary
- 触发对象更新入口
- 决定是否生成新的 `SoulAction` candidate

### 第一阶段应避免承担
- 直接实现所有对象层完整业务逻辑
- 直接操作 Web / API 展示层
- 自行替代 Gate / Dispatcher / Review 流

也就是说，这个模块的定位应是：

> 结果解释与回流编排器。

---

## 3.2 `packages/server/src/soul/continuityIntegrator.ts`
### 角色
这是更偏高门槛沉淀的辅助模块。

### 建议职责
- 处理 `ContinuityRecord` 相关回流判断
- 评估是否值得 continuity promotion
- 形成 continuity summary / mirror payload
- 为后续 `persist_continuity_markdown` 候选提供输入

### 第一阶段实现建议
第一版不一定需要写成很重的模块。
更合理的是：
- 先有轻量函数集合
- 只处理 continuity 相关的高门槛路径
- 避免一开始变成“全对象整合中心”

---

## 3.3 `packages/server/src/soul/soulActionGenerator.ts`
### 新角色
在 v1.5 / v1.6 之后，generator 的职责不再只来自前向输入，
还应显式支持：
- 基于 reintegration 结果生成下一轮动作候选

也就是说，它未来更适合分成两类入口：
- `generateSoulActionsFromInput(...)`
- `generateSoulActionsFromOutcome(...)`

第一阶段未必要立刻写成两个文件，
但这个职责分界已经应当明确。

---

## 3.4 `packages/server/src/soul/soulActionTypes.ts`
### 新角色
这个文件从 v1.6 开始应准备承接更多正式类型：
- `ActionOutcomePacket`
- `ReintegrationTarget`
- `ReintegrationStrength`
- `ReintegrationSummary`
- 以及必要时的 `GateDecision` 类型

也就是说，v1.6 之后它不再只是“动作类型表”，
而开始变成 soul layer 第一阶段的语义类型中心。

---

# 4. 与现有基础模块的衔接方式

反馈回流引擎不能悬在空中，
它必须明确依附于现有仓库中的真实基础设施。

---

## 4.1 与 `db/schema.ts` / `db/client.ts` 的关系
第一阶段的判断是：
- 不应急着为了 reintegration 单独引入一批复杂新表
- 更合理的是尽量复用 `soul_actions` 现有字段与增量扩展
- 若确有需要，再按现有 `client.ts` 风格做保守增量迁移

这意味着：
- `feedback_ref`
- `result_summary`
- `error_message`
- `completed_at`
- `failed_at`
- 以及后续少量 reintegration 语义字段

都应优先围绕现有 `soul_actions` 表逐步长出。

v1.6 不建议第一步就为 reintegration 单独做完整对象图数据库。

---

## 4.2 与 worker lifecycle 的关系
反馈回流引擎第一阶段最主要的结果来源之一，
仍然是 worker 执行侧。

因此更合理的关系应是：

```text
worker / report / openclaw / internal action complete
   ↓
write result_summary / feedback_ref / timestamps
   ↓
construct ActionOutcomePacket
   ↓
call feedbackReintegration(...)
```

这意味着：
- worker 仍然负责执行和产物落地
- reintegration 不应侵入 worker 的主执行逻辑太深
- 最好在“结果已经结构化之后”再调用 reintegration

也就是说：

> worker 负责落地结果，reintegration 负责解释结果。

---

## 4.3 与 Vault 的关系
Vault 不是 reintegration 主运行态，
但它可能参与两类事情：
- continuity mirror 的输出目标
- 高价值 artifact 的可读沉淀层

因此更合理的链路是：
- reintegration 先决定是否值得 continuity promotion
- 如果值得，再生成 `persist_continuity_markdown` 候选
- 后续仍由正式动作链去写 Vault

而不是：
- 执行结束后回流引擎直接到处写 markdown

这保持了前面已经确立的设计原则：

> 回流层负责判断与生成，不直接绕开动作层写最终产物。

---

## 4.4 与 API / handlers / routes 的关系
第一阶段 reintegration 更适合先作为 server 内部流程，
而不是一开始开放成独立外部接口。

也就是说：
- API 目前更适合服务于 `SoulAction` 查看、review、dispatch
- reintegration 先由内部执行链自动触发
- 后续如果需要调试或观测，再考虑增加只读观测接口

因此 v1.6 不建议第一步就新增：
- 任意 `POST /api/reintegration`
- 任意外部触发 continuity integration 的接口

原因是：
- 这会过早暴露内部治理语义
- 也会让系统出现不必要的外部注入风险

---

# 5. 第一阶段推荐的结果来源映射

v1.6 建议把结果来源正式收敛成几类固定入口，
避免未来到处零散调用 reintegration。

---

## 5.1 来自低风险内部动作的结果
例如：
- `update_persona_snapshot`
- `create_event_node`
- 某些内部 `state_update`

这些动作的结果通常：
- 执行短
- 状态明确
- 回流更多影响后续阈值与对象轻量修正

---

## 5.2 来自交互动作的结果
例如：
- `ask_followup_question`

它们的关键结果不是“动作是否发出了”，
而是：
- 用户有没有响应
- 响应质量如何
- 有没有暴露新的高价值信息

因此这类结果更适合作为 Persona 与后续候选生成的重要入口。

---

## 5.3 来自 report / artifact 输出动作的结果
例如：
- `launch_daily_report`
- `launch_weekly_report`
- 未来更多 artifact 输出动作

它们的关键价值通常不只是生成成功，
而是：
- 是否真的产出了高密度结构化内容
- 是否值得进一步 continuity promotion

---

## 5.4 来自 OpenClaw / 外部桥接动作的结果
例如：
- `launch_openclaw_task`
- 未来外部 bridge 类动作

这类结果的特点是：
- 生命周期长
- 成本高
- 失败信息本身很有价值

因此 reintegration 对它们尤其不应只看 success / failure，
而要格外关注：
- 失败模式
- 成本收益比
- 是否值得形成 EventNode 或治理修正

---

# 6. 第一阶段推荐的对象更新入口

v1.6 认为，回流引擎不应直接在一个文件里硬写所有对象更新细节，
而应通过一组清晰的对象更新入口来做。

第一阶段更合理的方向是：

```text
feedbackReintegration.ts
   ↓
applyPersonaReintegration(...)
applyEventReintegration(...)
applyContinuityReintegration(...)
applyInterventionLearning(...)
   ↓
optional generateSoulActionsFromOutcome(...)
```

第一版不一定都拆成独立文件，
但这组函数边界已经应该被视为正式的实现骨架。

这有几个好处：
- 回流编排器保持轻
- 各对象更新语义不混在一起
- 后续更容易把高门槛 continuity 逻辑单独强化

---

# 7. 第一阶段推荐的类型与字段映射

v1.6 建议把 v1.5 里的抽象类型，
进一步映射成更接近第一版实现的最小类型集合。

---

## 7.1 `soulActionTypes.ts` 应新增或预留的类型
建议加入：

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

export type ActionOutcomePacket = {
  actionId: string;
  actionType: SoulActionType;
  sourceType: SoulActionSourceType;
  sourceId: string;
  lifecycleStatus: 'completed' | 'failed';
  executionStatus: 'succeeded' | 'failed';
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
};
```

第一阶段不一定一次性全部导出到外部，
但它们已经足够成为 server 内正式类型骨架。

---

## 7.2 `soul_actions` 表最适合的增量字段方向
如果后续要做最小字段扩展，
v1.6 建议优先考虑这些方向，而不是大爆炸建模：
- `gate_decision`
- `gate_reason_summary`
- `review_reason`
- `started_at`
- `reintegrated_at`
- `reintegrated_summary`

注意：
第一阶段未必一次性都要落库。
但这些字段是最贴近 v1.4 / v1.5 / v1.6 统一语义的增量方向。

---

# 8. 第一阶段最合理的 PR 切分

v1.6 最后把 reintegration 层继续压成更保守的 PR 路线。

---

## 8.1 PR4：只建结果包与 reintegration 骨架
### 目标
- 在 `soul/` 下新增：
  - `feedbackReintegration.ts`
  - 必要类型扩展
- 先只支持读取 `ActionOutcomePacket`
- 先只输出 `ReintegrationSummary`
- 先不真正写对象层

### 意义
这是回流引擎第一次从概念变成代码骨架，
但仍保持极度克制。

---

## 8.2 PR5：接 Persona / Intervention 的轻量回流
### 目标
- 先接最安全的回流目标：
  - `PersonaState`
  - `InterventionDecision`
- 支持：
  - 低风险结果的 Persona 微调
  - 对 Gate 学习的轻量记录
- 可选支持 outcome-based next action generation 的最小路径

### 意义
先让系统学会：
- 小步修正自己
- 不直接碰高风险 continuity 晋升

---

## 8.3 PR6：接 Event / Continuity 与高门槛回流
### 目标
- 再接：
  - `EventNode`
  - `ContinuityRecord`
- 引入更高门槛的 continuity integration
- 支持 report / OpenClaw 结果驱动的高价值回流

### 意义
这一步才是真正把“接力棒”开始压进长期结构层。

---

# 9. 第一阶段的成功标准

v1.6 认为，再认知引擎是否算真正落地，
不应看它名字是否好听，
而应看它是否满足这些条件：

---

## 9.1 结果来源清楚
至少能够明确：
- 哪些动作结果会被打包成 `ActionOutcomePacket`
- 这些包从哪里来
- 何时触发 reintegration

---

## 9.2 对象更新边界清楚
至少能够明确：
- Persona 更新入口在哪里
- Event / Continuity 更新入口在哪里
- 哪些逻辑在编排器里，哪些逻辑在对象更新函数里

---

## 9.3 不绕开动作治理主链
至少能够确保：
- reintegration 自己不直接乱写最终产物
- 新动作生成仍重新进入 Gate / Review / Dispatcher 主链

---

## 9.4 PR 路线清楚且可渐进落地
至少能够做到：
- 先有骨架
- 再接低风险回流
- 最后接高门槛 continuity integration

也就是说，系统可以一点点长，而不是大爆炸式重构。

---

# 10. 一句话总结 v1.6

> v1.6 的意义，是把 LifeOnline 联合认知体第一阶段中最关键但最悬空的再认知层，正式映射回当前 LifeOS 仓库：反馈回流引擎继续长在 `packages/server/src/soul/`，以 `feedbackReintegration.ts` / `continuityIntegrator.ts` 为核心，通过结果包、对象更新入口与最小 PR 路线，把“执行结果如何重新塑造 Persona、Event、Continuity、Gate 与下一轮动作生成”第一次压成了可以直接进入代码实施阶段的落位蓝图。