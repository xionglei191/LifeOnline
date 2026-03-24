# LifeOnline Phase 3: 主动执行引擎 (Active Action Automations) 蓝图

> 起草日期：2026-03-24
> 目标阶段：Phase 3

## 一、Phase 3 核心定位

在 Phase 1 (个人数据穹顶) 和 Phase 2 (多智体协同与认知记忆) 成功落地的基础上，LifeOnline 的大脑中已经积累了海量的结构化认知、连续性规律与决策记录。然而，目前的系统主要停留在“建议”与“反思”（Governance）层面。

**Phase 3 的核心愿景是「打通真实世界」**。
系统将从被动的“认知治理面板”进化为“主动的数字代理”。当系统洞察到你连续三周出现运动短缺，且情绪检测为“压力焦虑”时，它不再只是在面板上挂一个卡片，而是能直接通过 API 帮你预约下周的壁球场地，并在日历中自动锁住对应时段。

## 二、架构演进策略

### 1. 从 SoulAction 到 PhysicalAction
目前的 `SoulAction` 是精神世界的闭环（提炼任务、更新快照、追问等）。在 Phase 3 中，规划网关 (Planner Agent) 将具备 `dispatch_physical_action` 的能力：
- 接收用户的意图或基于历史洞察产生的需求。
- 解析转换为物理动作：例如发送邮件、插入日历、调用 webhook。

### 2. The Protocol Layer (外部网关桥接)
我们将开发 `packages/server/src/integrations` 的全量插件体系：
- **Calendar Protocol**: 读写 Google Calendar / Apple Calendar，防冲突调度。
- **Communication Protocol**: 对接 Telegram / 邮箱发送通知，甚至自动回复非紧急邮件。
- **Finance Protocol**: 对接简单记账 API，做到消费分析预警的即时触发。
- **IoT / Home Hub**: 对接 HomeAssistant，在情绪报告极度焦虑时自动调整居室灯光与音乐（可选高阶扩展）。

### 3. Execution Engine 与权限熔断
物理执行涉及高危险性，必须引入 **Execution Engine** 与 **Budget Enforcer V2**：
- **Approval Gate (审批墙)**：所有的物理动作在第一次执行前，必须在客户端 GovernanceView 弹出明显的 🚫/✅ 双向滑动卡片让用户授权（可勾选“下次自动放行”）。
- **Dry-Run (模拟运行)**：通过 LLM 生成运行轨迹向用户展示预测结果。

## 三、Phase 3 研发路径（Sprint 预演）

| Sprint | 主题 | A组 (认知与调度) | B组 (客户端与UX) | C组 (基础设施) | D组 (移动端) |
|---|---|---|---|---|---|
| **Sprint 1** | 动作模型树建立 | 设计 `PhysicalAction` 体系与转换引擎 | 开发物理行动授权 UI 组件 | 对接首个日历 API 并处理 OAuth | 支持手机端一键授权物理动作 |
| **Sprint 2** | 日常自动化闭环 | Planner Agent 融合物理动作建议路线 | 日程冲突图表绘制 | 构建跨进程执行队列 (Execution Engine) | 实现底层静默日历同步探测 |
| **Sprint 3** | 高级串联与熔断 | 设计复合式任务流 (Dag Of Physical Actions) | “自动化审计日志”面板 | R2 持久化物理日志与安全阻断器 | Widget 一键停止所有自动化 |

## 四、下一阶段预期成果
当 Phase 3 完成时，LifeOnline 将不再是一个日记或笔记软件，而是一个拥有绝对记忆、懂你的性格底色、并且拥有执行力与手脚的**超级数字孪生体**。
