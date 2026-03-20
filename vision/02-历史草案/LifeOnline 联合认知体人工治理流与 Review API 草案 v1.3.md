# 《Soul Constitution》v1.3
## LifeOnline 联合认知体人工治理流与 Review API 草案

v1.0 把第一阶段的正式实现蓝图立起来了，
v1.1 把对象与动作流的动态主链压清了，
v1.2 又把 `Intervention Gate` 的治理规则收束成了第一阶段的正式稳定器。

接下来最自然的一步，就是把另一条尚未完全压实的关键链路正式写清：

> 当 Gate 给出 `queue_for_review`、`observe_only`、`defer` 这类非立即执行结果时，联合认知体第一阶段究竟如何通过人工治理流把这些动作继续托管、审阅、批准、派发或放弃？

如果这一步不被压清，
那么 v1.2 虽然已经有了治理原则，
但系统依然会停在一个半悬空状态：
- 知道哪些动作不能立刻自动做
- 却不知道这些动作后续该被谁接住
- 也不知道 review 本身应作为什么工程对象存在

所以 v1.3 的目标是：

> 把 LifeOnline 联合认知体第一阶段中，围绕 `SoulAction` 的人工治理流、review 队列、审批状态机、最小 API 落点与控制台交互职责，正式压成一条可落地的治理执行链。

也就是说，v1.3 要解决的核心问题是：

> **当系统不能自己直接行动时，如何优雅地把动作交还给人机联合治理。**

---

# 1. v1.3 的定位

如果说：
- v1.0 是阶段蓝图
- v1.1 是动态时序
- v1.2 是 Gate 治理宪法

那么：
- v1.3 就是人工治理执行面

它不再回答：
- 哪些动作该被拦
- 哪些动作风险更高

而是继续回答：
- 被拦下来的动作去哪里
- 谁来审
- 审完之后有哪些合法去向
- review 结果如何回流到联合体连续性层

没有这一步，系统就会出现一个很现实的问题：

> Gate 虽然会“克制”，但克制之后没有组织能力。

---

# 2. 为什么第一阶段必须显式保留人工治理流

很多系统在设计时，会把“人工 review”当成过渡方案，
仿佛只要自动化足够成熟，它就会被迅速移除。

但对联合认知体第一阶段来说，人工治理不是权宜之计，
而是正式结构的一部分。

---

## 2.1 因为第一阶段的目标不是自治幻觉，而是可治理成长
第一阶段并不追求：
- 系统看起来非常自主
- 系统任何事情都能自己做

第一阶段追求的是：
- 动作可以被提出
- 风险可以被分级
- 高风险动作可以被托管
- 人工判断可以被记录
- 系统可以从治理反馈中学习

也就是说：

> 人工治理不是自动化的失败，而是第一阶段学习放权边界的正式训练场。

---

## 2.2 因为连续性层与外部执行层都天然需要更高责任
尤其是这两类动作：
- 连续性晋升
- 外部执行桥接

它们的共同点是：
- 逆转成本更高
- 外部性更强
- 对未来解释影响更长

所以：
- `persist_continuity_markdown`
- `launch_openclaw_task`
- 部分高价值 `launch_weekly_report`

在第一阶段都更适合进入人工治理流。

---

## 2.3 因为 review 本身就是联合体的认知反馈来源
人工 review 不只是“点一个通过按钮”。
它本身会产生非常重要的反馈：
- 这条动作为什么被批准
- 为什么被拒绝
- 为什么被延后
- 用户对这类动作的容忍度如何
- 未来是否可以逐步降低阈值

也就是说：

> review 不是执行链的补丁，而是 Gate 学习闭环的一部分。

---

# 3. 人工治理流的正式职责

v1.3 建议把第一阶段人工治理流的职责明确压成四件事：

## 3.1 承接 Gate 未直接放行的高价值动作
也就是把以下结果接住：
- `queue_for_review`
- 部分 `defer`
- 部分值得保留的 `observe_only`

这些动作不应简单消失，
而应进入一个可见、可审、可追踪的治理队列。

---

## 3.2 为动作提供人工判断入口
人工治理流应允许至少做以下判断：
- 批准执行
- 驳回
- 延后
- 保持观察
- 人工修改后再执行（未来阶段可开）

但第一阶段建议先收紧为：
- `approve`
- `discard`
- `defer`
- `dispatch`

其中：
- `approve` 是获得执行资格
- `dispatch` 是实际下发执行

---

## 3.3 保留最小治理痕迹
每次人工处理动作时，都应尽量记录：
- 谁处理了
- 何时处理
- 做了什么决定
- 决定理由是什么

这一步非常关键，
因为它直接决定未来能不能基于真实治理历史调整 Gate 阈值。

---

## 3.4 把人工判断回流为联合体记忆的一部分
review 结果不应只停留在控制台状态变化里，
还应回流给：
- `InterventionDecision`
- `PersonaState` 的偏好边界
- Gate 的后续策略调整
- 必要时的 `ContinuityRecord`

也就是说：

> 第一阶段真正要积累的，不只是动作本身，还有“怎样判断这些动作”的历史。

---

# 4. 第一阶段 review 队列的正式对象定义

如果人工治理流要真正落地，
那么“review 队列”不能只是一个模糊概念，
它至少应是一个可被列出、查询、处理的正式对象集合。

第一阶段建议不单独引入全新复杂表，
而是把 review 队列理解为：

> 一组满足特定条件的 `SoulAction` 视图。

也就是说，第一阶段更合适的做法不是新建独立 `reviews` 系统，
而是复用 `soul_actions` 的生命周期与审批字段。

---

## 4.1 最小队列进入条件
一个 `SoulAction` 应进入 review 队列，当它同时满足：
- `requires_approval = true`
- Gate 结果为 `queue_for_review`，或后续被人工标记为待审
- 当前状态仍未完成 / 未失败 / 未丢弃

这样，review 队列本质上是动作层上的治理视图，
而不是另起一套平行对象体系。

---

## 4.2 第一阶段最重要的队列视角
建议控制台和 API 至少支持以下几类视角：
- `pending_review`：等待人工审阅
- `approved_waiting_dispatch`：已批准但尚未下发
- `deferred`：已决定延后
- `observing`：暂时观察中
- `closed`：已 dispatch / discarded / completed / failed

这会让第一阶段的人工治理流拥有明确的工作面板。

---

# 5. 第一阶段推荐的审批状态机

v1.3 建议把第一阶段的人工治理状态机保持得非常保守、非常显式。

不要一开始设计复杂 BPMN，
而是先有一条稳定可解释的状态链。

---

## 5.1 核心状态建议
从审批视角看，第一阶段建议至少显式承认这些状态：

- `pending_review`
- `approved`
- `rejected`
- `deferred`
- `dispatched`
- `completed`
- `failed`
- `discarded`

其中：
- `pending_review`：等待人工判断
- `approved`：获得执行资格，但未必已经执行
- `rejected` / `discarded`：结束，但语义略有差别
- `deferred`：暂不做，保留将来再看
- `dispatched`：已进入执行链
- `completed` / `failed`：执行闭环结果

---

## 5.2 推荐的最小合法转移
推荐第一阶段只允许以下几类核心转移：

```text
pending_review
  ├── approve  → approved
  ├── discard  → discarded
  └── defer    → deferred

approved
  └── dispatch → dispatched

dispatched
  ├── success  → completed
  └── fail     → failed

deferred
  ├── reopen   → pending_review
  └── discard  → discarded
```

这条状态机的价值在于：
- 简单
- 可解释
- 不易乱
- 足够承接第一阶段需要的治理流

---

# 6. `approve` 与 `dispatch` 必须显式分离

这是 v1.3 非常关键的一个判断。

很多系统会把“批准”直接等同于“立即执行”，
但对联合认知体第一阶段来说，这两步更适合分开。

---

## 6.1 为什么不能混成一步
因为批准回答的是：
- 这条动作是否获得执行资格

而 dispatch 回答的是：
- 现在是否真的要把它下发到执行层

这两者并不永远等价。

### 例子
- 某条 `launch_openclaw_task` 经 review 后被认为合理，但需要等待某个时机再发
- 某条 `persist_continuity_markdown` 被批准保留，但需要进一步等待其他上下文汇合后再输出

因此：

> `approve` 是治理判断，`dispatch` 是执行动作。

---

## 6.2 这会带来什么工程好处
分离后，第一阶段可以更稳地支持：
- 先通过，再手动下发
- 先批准入队，后续定时执行
- review 与执行责任解耦

这比“审批 = 马上执行”的粗糙方案要稳得多。

---

# 7. 第一阶段最小 Review API 落点

v1.3 建议继续沿用 v0.6 / v1.0 的判断：
第一阶段不宜开放任意外部创建 `SoulAction` 的接口，
而应优先开放人工治理相关接口。

也就是说，API 重点不是“随便造动作”，
而是“处理系统已产生的动作”。

---

## 7.1 建议优先开放的接口
第一阶段最适合先开放：
- `GET /api/soul-actions`
- `GET /api/soul-actions/:id`
- `POST /api/soul-actions/:id/approve`
- `POST /api/soul-actions/:id/dispatch`
- `POST /api/soul-actions/:id/discard`
- `POST /api/soul-actions/:id/defer`

如果需要 review 队列视角，
也可以通过 query 参数先解决，而不是急着做独立资源：
- `GET /api/soul-actions?reviewStatus=pending_review`

---

## 7.2 第一阶段不建议优先开放的接口
第一阶段暂不适合优先开放：
- 任意 `POST /api/soul-actions` 外部创建
- 任意 payload 改写式 patch 接口
- 复杂批量审批接口
- 自定义任意状态跳转接口

原因很简单：
- 第一阶段最重要的是稳定治理流
- 不是开放一个高度自由、可被任意注入的动作总线

---

# 8. 控制台在第一阶段的职责

v1.3 建议把控制台视为人工治理流的主要宿主，
但仍保持它的职责克制。

第一阶段控制台最适合承担的是：
- 展示 review 队列
- 展示动作详情
- 展示 Gate 理由摘要
- 提供 approve / dispatch / defer / discard 按钮
- 展示处理历史与当前状态

而不宜一开始承担：
- 复杂流程编排器
- 任意动作手工编辑器
- 大规模策略面板

也就是说：

> 第一阶段控制台是治理看板，不是自治编排器。

---

# 9. Review 结果的最小记录建议

既然人工治理流是正式结构，
那么 review 结果就应当至少留下最小记录。

第一阶段建议最少记录：

```ts
type ReviewActionRecord = {
  actionId: string
  reviewDecision: 'approve' | 'dispatch' | 'defer' | 'discard'
  operator: string
  reason?: string
  createdAt: string
}
```

这里不一定意味着第一阶段必须单独建一张新表，
也可以先通过：
- `soul_actions` 上的审批字段
- 配套日志记录
- 或最小操作历史字段

去承接。

重点是：
- 不要让人工判断变成无痕按钮
- 要让未来可以回看治理史

---

# 10. Review 流与 Gate 的关系

v1.3 必须明确一个关键关系：

> Review 流不是 Gate 的替代品，而是 Gate 的人工延伸面。

也就是说：
- Gate 决定一条动作能否自动放行
- Review 决定高阈值动作在人机治理下的去向

因此它们不是两套冲突机制，
而是一前一后的同一治理链。

推荐的关系应是：

```text
SoulAction candidate
   ↓
Intervention Gate
   ├── dispatch_now
   ├── observe_only
   ├── defer
   ├── discard
   └── queue_for_review
            ↓
       Review queue
            ↓
approve / dispatch / defer / discard
            ↓
执行层 or 继续等待 or 关闭
```

这条关系一旦明确，
后续系统就不会出现“Gate 一套、控制台一套、执行层又一套”的漂移。

---

# 11. Review 流与连续性层的关系

第一阶段里，最需要 review 的动作之一就是连续性晋升。

因此 v1.3 特别建议明确：
- `persist_continuity_markdown` 不只是普通 artifact output
- 它更接近“长期精神资产晋升”
- 它的批准记录本身就值得作为治理证据保留

这意味着：
- 某条连续性内容为什么被批准
- 为什么被延后
- 为什么被放弃

这些信息未来都可能反过来成为 `ContinuityRecord` 质量判断的一部分。

也就是说：

> 连续性层不仅需要被 Gate 保护，也需要被 review 历史保护。

---

# 12. 第一阶段的治理原则补充

在 v1.2 的 Gate 原则之上，v1.3 建议再补充四条 review 流原则。

---

## 12.1 审批先于自动化扩张
在没有稳定 review 流之前，
不应轻易扩大自动 dispatch 范围。

---

## 12.2 可追踪先于便利
即使按钮操作看起来更快，
也不能牺牲治理痕迹。

---

## 12.3 状态机清晰先于功能丰富
第一阶段最重要的是状态简单、转移清楚，
而不是一开始支持所有高级动作。

---

## 12.4 人机共同治理先于单边自治
第一阶段的重点不是证明系统多聪明，
而是建立一个真正可共同演化的治理回路。

---

# 13. v1.3 对后续实现的直接启发

v1.3 的最大工程价值，是把 PR3 的边界进一步压实了。

---

## 13.1 PR3 应优先实现 review 队列视图与最小状态机
也就是说，先做：
- list
- detail
- approve
- dispatch
- defer
- discard

不要一开始做复杂审批平台。

---

## 13.2 `soul_actions` 的审批字段已经有了明确语义宿主
从 v1.3 开始，审批字段不再只是为未来预留，
而是明确用于承接：
- pending review
- approved waiting dispatch
- deferred
- discarded

这会让 PR1 中保守留下的字段真正获得治理语义。

---

## 13.3 控制台最小设计目标已经清楚
控制台第一阶段不是“灵魂操作台”，
而是“人工治理看板”。

这会直接帮助后续 UI/API 不至于过度膨胀。

---

## 13.4 Review 历史会成为后续放权学习的重要数据源
一旦系统开始积累：
- 哪类动作常被批准
- 哪类动作常被驳回
- 哪类动作总被延后

后续才真正有可能：
- 调整 Gate 阈值
- 打开更多低风险自动 dispatch
- 逐步形成更成熟的放权边界

---

# 14. 一句话总结 v1.3

> v1.3 的意义，是把 LifeOnline 联合认知体第一阶段中“高阈值动作该如何被人机共同接住”这件事正式压成了一条人工治理流：Gate 不再只是拦截器，review 不再只是按钮集合，`SoulAction` 也不再只是待执行对象，而开始拥有可审、可批、可延、可派发、可追踪、可回流学习的正式治理执行面。