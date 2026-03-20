# 《Soul Constitution》v1.4
## LifeOnline 联合认知体动作生命周期状态机与反馈回流草案

v1.0 把第一阶段的正式实现蓝图立起来了，
v1.1 把对象与动作流的动态主链压清了，
v1.2 把 `Intervention Gate` 压成治理稳定器，
v1.3 又把人工治理流与 Review API 收束成了可落地的治理执行面。

接下来最自然的一步，就是把整套链路里还没有完全钉死的那件事正式写清：

> 一个 `SoulAction` 从“被提出”到“被判断”到“被托管”到“被执行”到“得到结果”到“反馈回流”，中间到底要经过哪些标准状态、哪些关键字段、哪些合法转移，以及每一步究竟由谁负责？

如果这个问题不被压清，
那么：
- v1.1 的动态链会停留在流程图层面
- v1.2 的 Gate 会停留在治理规则层面
- v1.3 的 Review 会停留在按钮层面

系统虽然已经有了对象、动作、Gate、Review、Dispatcher、worker、Vault、R2 这些部件，
但它们之间仍然缺少一条被正式收束的“生命周期骨架”。

所以 v1.4 的目标是：

> 把 LifeOnline 联合认知体第一阶段中，`SoulAction` 的完整生命周期状态机、关键记录字段、各组件职责边界，以及执行结果如何回流认知层与连续性层，正式压成一套统一闭环模型。

也就是说，v1.4 要解决的问题是：

> **系统中的动作，不只是“被创建”，而是如何作为一个正式生命体经历完整旅程。**

---

# 1. v1.4 的定位

如果说：
- v1.0 是阶段蓝图
- v1.1 是动态时序
- v1.2 是 Gate 治理规则
- v1.3 是人工治理执行面

那么：
- v1.4 就是动作生命周期法典

它不再只是回答：
- 什么动作值得做
- 哪些动作要人工审

而是继续回答：
- 一条动作在系统中从生到死会经历什么
- 哪些状态必须显式存在
- 哪些状态转换是合法的
- 哪些信息必须在状态流转中被记录
- 执行结束后，哪些反馈必须回到认知层

没有这一步，后续实现就会很容易出现：
- 状态命名漂移
- API 状态与 DB 状态脱节
- Review 状态与执行状态重叠混乱
- 执行结果存在但无法形成后续连续性

也就是说：

> v1.4 的任务，是把第一阶段从“有动作链”推进到“有正式生命周期制度”。

---

# 2. 为什么第一阶段必须正式定义动作生命周期

很多系统在早期都会先跑出几个动作，
然后一边写逻辑、一边临时补状态字段。

但联合认知体第一阶段不适合这样做，
原因有三点。

---

## 2.1 因为 `SoulAction` 不是一次性函数调用，而是治理对象
普通函数只关心：
- 输入
- 处理
- 输出

但 `SoulAction` 关心的是：
- 它从哪里来
- 为什么会被提出
- 为什么被允许或不允许执行
- 什么时候被人工接管
- 结果如何
- 结果是否改变后续系统判断

也就是说：

> `SoulAction` 从一开始就不是“命令”，而是带治理语义的中间生命对象。

---

## 2.2 因为第一阶段真正要积累的，不只是结果，还有治理历史
如果系统只记录最终输出，
而不记录动作生命周期，
就会丢掉最重要的一层信息：
- 为什么当时会生成这个动作
- 为什么它被 Gate 拦下
- 为什么它被人工批准
- 为什么它最终失败或被放弃

但这些恰恰是未来调参、放权、学习的核心材料。

---

## 2.3 因为没有生命周期，反馈就回不到联合体
执行成功不是终点。

对于联合认知体来说，
更重要的是：
- 这次执行有没有提升连续性
- 这次执行有没有证明某类动作值得更大放权
- 这次执行有没有暴露某类动作其实总在误判

所以必须有一条被正式定义的路径，
让结果从执行层回到认知层、Gate、Review、连续性层。

---

# 3. v1.4 的核心判断：`SoulAction` 应被看作一个有完整生命周期的治理对象

v1.4 建议正式确立以下理解：

> 一个 `SoulAction` 并不是“生成即完成”的轻量指令，而应被视为一个经历提议、审查、等待、派发、执行、收束、回流的治理对象。

也就是说，它至少会经历五段生命：
1. 候选期
2. 治理期
3. 执行期
4. 结果期
5. 回流期

这五段生命，是 v1.4 全文的总骨架。

---

# 4. 第一阶段推荐的五段生命周期

## 4.1 候选期（proposal phase）
这是动作刚被生成的时候。

它回答的是：
- 这条动作由哪个认知对象提出
- 为什么被提出
- 当前希望它去做什么

这一阶段典型来源是：
- `BrainstormSession`
- `PersonaState`
- `EventNode`
- `ContinuityRecord`
- 周期触发 / 系统触发

候选期的核心意义不是执行，
而是：

> 把“理解结果”正式表达成一个可治理、可讨论、可追踪的动作对象。

---

## 4.2 治理期（governance phase）
这是动作进入 Gate 与 Review 系统的时候。

它回答的是：
- 这条动作能不能自动放行
- 是否需要人工 review
- 是否应该观察、延后或丢弃
- 谁做出了这些判断

也就是说，治理期不是执行前的简单校验，
而是动作获得行动资格的正式审议期。

---

## 4.3 执行期（execution phase）
这是动作真正被下发到某个执行目标的时候。

它回答的是：
- 被交给了谁
- 何时交给的
- 当前是在运行中、还是已经结束
- 执行中发生了什么关键结果

这一阶段的目标不是再谈是否值得，
而是把已经获得资格的动作真正落地。

---

## 4.4 结果期（outcome phase）
这是执行结束之后，动作拿到显式结果的时候。

它回答的是：
- 成功还是失败
- 产物在哪里
- 输出是否有价值
- 是否产生了外部副作用

结果期的重点不是立刻更新世界观，
而是先把结果沉淀成明确、可回看的执行事实。

---

## 4.5 回流期（feedback reintegration phase）
这是联合认知体与普通自动化系统真正拉开差距的一步。

它回答的是：
- 这次动作结果应该如何改变未来的判断
- 是否更新 `PersonaState`
- 是否形成 `EventNode`
- 是否改变 `InterventionDecision` 的阈值感知
- 是否推动 `ContinuityRecord` 增强或降权

也就是说：

> 真正的闭环不是“执行结束”，而是“执行结果重新成为认知输入”。

---

# 5. 第一阶段推荐的正式状态集合

v1.4 建议把生命周期进一步压成一组显式、稳定、够用的标准状态。

注意：
这里讨论的是动作主生命周期状态，
不是仅仅审批状态，也不是仅仅 worker 运行态。

---

## 5.1 推荐主状态
第一阶段建议至少承认以下主状态：

- `proposed`
- `gated`
- `pending_review`
- `approved`
- `deferred`
- `discarded`
- `dispatched`
- `running`
- `completed`
- `failed`
- `closed`

其中：
- `proposed`：动作已生成，尚未完成 Gate 判断
- `gated`：Gate 已完成判断并给出结论
- `pending_review`：进入人工治理队列
- `approved`：获得执行资格，尚未真正 dispatch
- `deferred`：暂缓处理
- `discarded`：决定放弃
- `dispatched`：已下发到执行目标
- `running`：执行侧正在运行（如果目标类型需要此状态）
- `completed`：执行成功完成
- `failed`：执行失败结束
- `closed`：生命周期已收束，进入归档/回流完成态

---

## 5.2 为什么需要 `closed`
很多系统会认为：
- `completed` 或 `failed` 就是终点

但对联合认知体来说，
这还不够。

因为在 `completed` / `failed` 之后，
还存在一个很关键的问题：
- 结果是否已经被回流
- 反馈是否已经写回
- 生命周期是否真正收束

因此 v1.4 建议显式保留 `closed` 这一层，
它表示：
- 这条动作不再需要后续治理或执行处理
- 它的结果与反馈已完成最低限度的回流收束

也就是说：

> `completed` 是执行完成，`closed` 是生命周期完成。

---

# 6. 第一阶段推荐的合法状态转移

v1.4 建议把合法转移压得尽量清晰，
不要让状态跳转变成任意字符串游戏。

---

## 6.1 候选与治理前段

```text
proposed
  └── gate_decision → gated

gated
  ├── auto_dispatch    → dispatched
  ├── send_to_review   → pending_review
  ├── observe_to_defer → deferred
  └── discard          → discarded
```

这里的关键是：
- `gated` 不代表动作已经安全结束
- 它只是说明 Gate 判断已发生

---

## 6.2 Review 段

```text
pending_review
  ├── approve  → approved
  ├── defer    → deferred
  └── discard  → discarded

approved
  └── dispatch → dispatched

deferred
  ├── reopen   → pending_review
  ├── approve  → approved
  └── discard  → discarded
```

这与 v1.3 保持一致，
但现在被正式挂回主生命周期里。

---

## 6.3 执行段

```text
dispatched
  ├── start    → running
  ├── success  → completed
  └── fail     → failed

running
  ├── success  → completed
  └── fail     → failed
```

注意：
不是所有动作都一定需要 `running`。

例如：
- 某些内部 SQLite 更新动作可能从 `dispatched` 直接进入 `completed`
- 但 worker / OpenClaw 这类动作更适合显式经过 `running`

---

## 6.4 回流收束段

```text
completed
  └── reintegrate → closed

failed
  └── reintegrate → closed

discarded
  └── archive     → closed
```

这样，系统才真正具备完整闭环语义。

---

# 7. 主状态、审批状态、执行状态必须分层理解

v1.4 特别强调一个容易混乱的问题：

> 不应把所有状态都塞进一个维度里理解。

第一阶段更合理的方式，是至少在概念上分三层：

---

## 7.1 主生命周期状态
表示动作在整体旅程中的大阶段。
如：
- `proposed`
- `pending_review`
- `dispatched`
- `completed`
- `closed`

---

## 7.2 审批状态
表示治理资格。
如：
- `not_required`
- `pending`
- `approved`
- `deferred`
- `rejected`

---

## 7.3 执行状态
表示执行侧运行态。
如：
- `not_started`
- `running`
- `succeeded`
- `failed`

也就是说，未来工程里即使仍然把它们压在一张表里，
语义上也必须明确：
- 主生命周期不等于审批状态
- 审批状态不等于执行状态

否则系统会很快变乱。

---

# 8. 第一阶段最关键的记录字段建议

如果动作生命周期要真正落地，
那么每个阶段至少需要有一批对应字段作为物质载体。

v1.4 建议第一阶段最关键的字段应被组织成六组。

---

## 8.1 身份字段
用于回答“这是谁”。

- `id`
- `created_at`
- `updated_at`
- `source_type`
- `source_id`
- `action_category`
- `action_type`
- `target_type`

---

## 8.2 候选依据字段
用于回答“为什么会提出这条动作”。

- `reason`
- `payload_json`
- `priority`
- `candidate_context_ref`（未来可选）

第一阶段即使先不新增 `candidate_context_ref`，
也应在设计上保留这个方向。

---

## 8.3 Gate 字段
用于回答“Gate 怎样判断了它”。

- `gate_decision`
- `gate_reason_summary`
- `risk_level`
- `evidence_strength`
- `reversibility`
- `timing_readiness`
- `authorization_state`
- `gated_at`

第一阶段可以不一次性全部工程化，
但 v1.4 认为这些字段已经是正式语义集合。

---

## 8.4 Review 字段
用于回答“人工治理如何处理了它”。

- `requires_approval`
- `approval_status`
- `reviewed_at`
- `reviewed_by`
- `review_reason`

必要时还可扩展：
- `review_action_count`
- `last_review_decision`

---

## 8.5 Dispatch / 执行字段
用于回答“它何时被交付，执行结果如何”。

- `dispatch_attempts`
- `dispatched_at`
- `execution_status`
- `started_at`
- `completed_at`
- `failed_at`
- `error_message`
- `result_summary`
- `feedback_ref`

其中：
- `feedback_ref` 应成为连接回流阶段的重要锚点

---

## 8.6 回流字段
用于回答“结果如何重新回到联合体”。

建议未来补充或保留语义位：
- `reintegrated_at`
- `reintegrated_targets`
- `continuity_effect`
- `persona_effect`
- `event_effect`
- `gate_learning_effect`

第一阶段不必立刻全部工程化，
但从 v1.4 开始，这些已经应该被视为正式设计目标。

---

# 9. 各组件在生命周期中的职责边界

v1.4 认为，最容易漂移的问题不是状态本身，
而是“谁负责推进哪个状态”。

因此必须把组件职责明确压清。

---

## 9.1 认知对象层的职责
负责：
- 产生动作候选
- 提供候选依据

不负责：
- 直接决定高风险动作执行
- 直接推进执行状态

也就是说，对象层负责“提出”。

---

## 9.2 `Intervention Gate` 的职责
负责：
- 从 `proposed` 推进到 `gated`
- 给出标准治理结果
- 记录 Gate 判断维度与理由摘要

不负责：
- 真正执行动作
- 替代 review 队列

也就是说，Gate 负责“判定资格”。

---

## 9.3 Review 流 / 控制台 / API 的职责
负责：
- 处理 `pending_review`
- 推进 `approved` / `deferred` / `discarded`
- 记录人工处理痕迹

不负责：
- 自行生成动作候选
- 替代 Dispatcher 的执行职责

也就是说，Review 面负责“人工治理”。

---

## 9.4 Dispatcher 的职责
负责：
- 把已获资格的动作从治理层交给具体执行目标
- 把动作推进到 `dispatched`
- 写入 dispatch 相关元数据

不负责：
- 重新判断这条动作值不值得做
- 接管长期回流判断

也就是说，Dispatcher 负责“正式下发”。

---

## 9.5 执行层（worker / Vault / OpenClaw / R2 / SQLite）的职责
负责：
- 承接执行
- 返回结果
- 写出产物位置与结果摘要

不负责：
- 决定动作是否应该存在
- 决定是否值得进入连续性层

也就是说，执行层负责“真正落地”。

---

## 9.6 回流层的职责
负责：
- 把结果重新解释为联合体内部认知变化
- 决定更新哪些对象与治理参数
- 推动 `completed` / `failed` 进入 `closed`

也就是说，回流层负责“把一次动作变成下一轮系统理解的一部分”。

---

# 10. 四类关键动作的典型生命周期样板

为了让 v1.4 不停留在抽象层，
这里把第一阶段最关键的四类动作压成典型生命周期样板。

---

## 10.1 脑暴追问链样板

```text
BrainstormSession
  ↓
proposed(ask_followup_question)
  ↓
gated(dispatch_now)
  ↓
dispatched
  ↓
completed
  ↓
reintegrate user response
  ↓
closed
```

特点：
- 低风险
- 生命周期通常较短
- 回流主要作用于 PersonaState 更新

---

## 10.2 Persona 更新链样板

```text
PersonaState / 输入聚合
  ↓
proposed(update_persona_snapshot)
  ↓
gated(dispatch_now)
  ↓
dispatched
  ↓
completed
  ↓
reintegrate persona change
  ↓
closed
```

特点：
- 偏内部动作
- 执行短
- 但回流影响长期阈值判断

---

## 10.3 连续性晋升链样板

```text
EventNode / 提炼结果
  ↓
proposed(persist_continuity_markdown)
  ↓
gated(queue_for_review)
  ↓
pending_review
  ↓
approved
  ↓
dispatched
  ↓
completed
  ↓
reintegrate continuity effect
  ↓
closed
```

特点：
- 生命周期更长
- 更依赖 review
- 回流价值远高于单次输出本身

---

## 10.4 OpenClaw 桥接链样板

```text
Complex task candidate
  ↓
proposed(launch_openclaw_task)
  ↓
gated(queue_for_review)
  ↓
pending_review
  ↓
approved
  ↓
dispatched
  ↓
running
  ↓
completed / failed
  ↓
reintegrate execution outcome
  ↓
closed
```

特点：
- 生命周期最长
- 执行与治理分离最明显
- 最依赖执行结果的结构化回写

---

# 11. 回流期的正式目标对象

v1.4 特别强调：
结果回流不是抽象口号，
它必须回答“回到谁身上”。

第一阶段建议至少承认五个正式回流目标。

---

## 11.1 回流到 `PersonaState`
当一次动作结果显著暴露：
- 用户偏好
- 当前压力状态
- 工作节奏
- 行为倾向

它就应成为 Persona 的修正依据。

---

## 11.2 回流到 `EventNode`
当一次动作本身构成关键变化节点时，
例如：
- 某项关键任务的完成
- 某次失败揭示出的重要阻力模式

它就应形成或增强事件节点。

---

## 11.3 回流到 `ContinuityRecord`
当动作结果证明某项原则、方法、警示值得长期继承时，
它就应进入连续性层，
或者影响已有连续性条目的权重。

---

## 11.4 回流到 `InterventionDecision`
这是治理学习的关键。

它回答：
- 这类动作是否值得更容易被放行
- 这类动作是否总需要 review
- 哪类 Gate 判断经常误判

---

## 11.5 回流到后续 `SoulAction` 候选生成
这是最实际的一层。

一次动作的结果，
往往会直接触发新的动作候选：
- 追问之后触发 Persona 更新
- 报告之后触发连续性晋升
- OpenClaw 结果之后触发 artifact 输出或事件创建

也就是说：

> 回流不是链路终点，它常常是下一轮动作生成的起点。

---

# 12. 第一阶段的收束原则

v1.4 最后建议，把动作生命周期的实现取舍统一收束为四条原则。

---

## 12.1 生命周期清晰优先于状态数量精巧
宁可状态少而明确，
也不要做成一个只有作者自己看得懂的精妙系统。

---

## 12.2 语义分层优先于字段堆叠
重要的不是在表里塞多少字段，
而是明确：
- 哪些字段属于 Gate
- 哪些属于 Review
- 哪些属于 Dispatch
- 哪些属于回流

---

## 12.3 结果闭环优先于动作表面完成
如果一个动作执行完了，
但没有形成回流，
那它的生命周期其实还没真正完成。

---

## 12.4 可治理的生命体优先于一次性自动化命令
`SoulAction` 的本质，
应始终被理解为联合认知体中的正式治理对象，
而不是普通任务系统里的临时调用指令。

---

# 13. v1.4 对后续实现的直接启发

v1.4 的最大价值，是把 PR2 / PR3 以及后续连续性层实现之间的粘合处正式压清了。

---

## 13.1 `soul_actions` 的状态语义已经可以被正式整理
从 v1.4 开始，PR1 中留下的：
- `status`
- `approval_status`
- `dispatch_attempts`
- `dispatched_at`
- `completed_at`
- `failed_at`
- `feedback_ref`
- `result_summary`
- `error_message`

都已经可以被挂回一条清晰生命周期里理解，
而不再只是零散字段。

---

## 13.2 PR2 的 Gate 输出与 PR3 的 Review API 已经能对接到同一状态机
这意味着后续实现时：
- Gate 不该只返回布尔值
- Review 不该只改几个随意状态
- Dispatcher 不该自行发明新的结束语义

它们都应服从同一条生命周期法典。

---

## 13.3 回流层将成为下一个必须被显式实现的模块
v1.4 之后，下一步最自然的方向已经非常清楚：
- 不是再加新动作名
- 而是把 feedback reintegration 明确落成对象更新与新动作生成逻辑

也就是说，v1.5 更适合进入“回流引擎 / continuity integration”层。

---

# 14. 一句话总结 v1.4

> v1.4 的意义，是把 LifeOnline 联合认知体第一阶段里的 `SoulAction` 正式从“中间动作对象”推进成“有完整生命旅程的治理对象”——它从候选生成开始，经由 Gate、Review、Dispatcher、执行层与结果沉淀，最终回流到 Persona、Event、Continuity 与后续动作生成之中，第一次拥有了一套真正闭合的生命周期状态机与反馈回流法典。