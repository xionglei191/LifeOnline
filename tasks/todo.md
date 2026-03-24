# LifeOnline 开发任务

---

## 第三阶段：Phase 3 — 主动执行引擎 (Active Action Automations)

> 下发人：项目经理 | 启动日期：2026-03-24
> 模式：四组并行（A 认知与调度 / B 客户端与UX / C 基础设施 / D 灵光APP移动端）
> 蓝图来源：`vision/02-权威基线/LifeOnline_Phase3_技术蓝图.md`
> 核心愿景：系统从"被动认知治理面板"进化为"主动的数字代理"

### Phase 3 三大架构演进

| # | 方向 | 说明 |
|---|---|---|
| 1 | SoulAction → PhysicalAction | Planner Agent 可 dispatch 真实世界动作（日历/邮件/webhook） |
| 2 | Protocol Layer 外部网关 | Calendar / Communication / Finance / IoT 四大协议插件 |
| 3 | Execution Engine + 权限熔断 | 审批墙（首次必须用户授权）+ Dry-Run 模拟运行 |

<details>
<summary>📦 Phase 1 + Phase 2 已完成 83 项任务（点击展开）</summary>

**Phase 1** (3组 × 4 Sprint = 36 任务)：认知双循环建立
**Phase 2** (4组 × 4 Sprint = 47+1 任务)：多智能体 + 向量存储 + 主动思考 + 灵光APP进化

</details>

---

### 🔴 C 组 — 基础设施

#### Phase 3 Sprint 1（新任务）

- [x] **P0：PhysicalAction 数据模型与 DB Schema**
  - 目标：设计 `physical_actions` 表结构，定义 PhysicalAction 的类型枚举与状态机
  - 关键文件：`packages/server/src/db/schema.ts`, `packages/shared/types/physicalAction.ts`
  - 完成标准：新增 `physical_actions` 表（类型/目标/状态/授权信息），DB migration 自动执行
  - 验证：启动服务后表自动创建，TypeScript 类型可用

- [x] **P1：Google Calendar API OAuth 2.0 对接**
  - 目标：实现 Google Calendar 的 OAuth 授权流程与 token 管理
  - 关键文件：`packages/server/src/integrations/` (新建目录), `calendarProtocol.ts`
  - 完成标准：完成 OAuth 授权 → 获取 access_token → 读取用户日历事件
  - 验证：API 调用返回真实的日历数据

- [x] **P2：Execution Engine 核心框架**
  - 目标：构建物理动作执行引擎，支持队列化执行、状态追踪、执行日志
  - 关键文件：`packages/server/src/integrations/executionEngine.ts`
  - 完成标准：PhysicalAction 从 pending → approved → executing → completed/failed 全生命周期
  - 验证：模拟一个动作走完完整状态机

---

### 🟢 B 组 — 客户端与 UX

#### Phase 3 Sprint 1（新任务）

- [ ] **P1：PhysicalAction 授权审批 UI**
  - 目标：在 GovernanceView 中新增"物理动作审批"区域，展示待授权的 PhysicalAction 卡片
  - 关键文件：`packages/web/src/components/` (新增 PhysicalActionCard.vue)
  - 完成标准：滑动授权 ✅ 或拒绝 🚫，支持勾选"下次同类自动放行"
  - 验证：前端展示待审批卡片，操作后状态同步到后端

- [ ] **P2：Dry-Run 预览面板**
  - 目标：当用户审批前，展示 LLM 生成的"如果执行，预测结果是…"的模拟预览
  - 关键文件：`packages/web/src/components/` (新增 DryRunPreview.vue)
  - 完成标准：点击卡片展开预览，展示动作的预测效果
  - 验证：模拟数据渲染预览面板

- [ ] **P3：集成管理设置页（Integrations Settings）**
  - 目标：在设置页新增"外部集成"tab，管理已授权的外部服务（Google Calendar 等）
  - 关键文件：`packages/web/src/views/SettingsView.vue`
  - 完成标准：展示已连接/未连接的外部服务，支持授权/解绑
  - 验证：点击授权跳转 OAuth 流程

---

### 🟡 D 组 — 灵光APP (LingGuangCatcher)

#### Phase 3 Sprint 1（新任务）

- [x] **P1：手机端 PhysicalAction 一键授权**
  - 目标：灵光APP收到"系统想帮你预约壁球场"推送时，可直接在通知中滑动授权
  - 关键文件：`LingGuangCatcher/app/src/` (扩展 GovernanceFragment)
  - 完成标准：推送通知内嵌 Approve/Reject 按钮，操作后调用 LifeOS API
  - 验证：实际收到推送并在手机上完成授权

- [x] **P2：日历视图预览**
  - 目标：在灵光APP中展示简版日历视图，展示 LifeOS 自动添加的事件
  - 关键文件：`LingGuangCatcher/app/src/` (新增 CalendarPreviewFragment)
  - 完成标准：月视图下可看到 PhysicalAction 产生的日历事件
  - 验证：授权日历写入后手机端可见

- [x] **P3：自动化开关面板**
  - 目标：在灵光设置中增加"自动化总开关"和按类型的细粒度开关
  - 关键文件：`LingGuangCatcher/app/src/`
  - 完成标准：可全局关闭自动化，或仅关闭日历类/通讯类
  - 验证：关闭后不再收到对应类型的授权推送

---

### 🔵 A 组 — 认知与调度

#### Phase 3 Sprint 1（新任务）

- [ ] **P1：PhysicalAction 类型体系与转换引擎**
  - 目标：定义 PhysicalAction 的类型层级（calendar_event / send_email / webhook_call 等），构建 SoulAction → PhysicalAction 的转换逻辑
  - 关键文件：`packages/server/src/soul/` (新增 physicalActionMapper.ts)
  - 完成标准：Planner Agent 可输出 `dispatch_physical_action` 类型的建议，mapper 将其转为结构化 PhysicalAction
  - 验证：编译通过 + 给定一条"建议你下周二打壁球"的 SoulAction，自动生成 calendar_event 类型的 PhysicalAction

- [ ] **P2：Approval Gate 审批网关逻辑**
  - 目标：实现"首次必须人工授权，可选自动放行"的审批策略引擎
  - 关键文件：`packages/server/src/integrations/approvalGate.ts`
  - 完成标准：每种 PhysicalAction 类型维护授权策略（always_ask / auto_after_first / auto_approve）
  - 验证：首次日历写入需审批，勾选自动放行后同类动作直接执行

- [ ] **P3：Calendar Protocol 首个完整写入闭环**
  - 目标：打通 "笔记 → 认知分析 → Planner 建议日历事件 → 用户授权 → Google Calendar 写入" 的全链路
  - 关键文件：`packages/server/src/integrations/calendarProtocol.ts`, `executionEngine.ts`
  - 完成标准：一条真实笔记走完全链路，Google Calendar 上出现对应事件
  - 验证：实际在 Google Calendar 中看到系统自动创建的事件
