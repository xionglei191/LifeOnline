# LifeOnline 项目管理与开发组沟通机制

> 起草日期：2026-03-24
> 状态：**正式生效**（用户已确认三组并行方案）

---

## 一、角色定义

### 项目经理（PM）
- **载体**：专门的 AI 会话，负责宏观管控
- **职责**：
  - 维护 `vision/` 目录下全部文档
  - 审计进度、同步口径
  - 制定各组任务优先级
  - 编写和下发分组任务单（`tasks/todo.md`）
  - 协调跨组依赖与冲突仲裁
  - 复盘和归档

### 🔵 A 组 — 认知深化组（Soul Depth）
- **载体**：独立 AI 会话
- **负责区域**：
  - `packages/server/src/soul/` 全部 18 个模块
  - `packages/server/src/workers/feedbackReintegration.ts`
  - `packages/server/src/workers/continuityIntegrator.ts`
- **职责**：认知对象深化、新 actionType 实现、回流机制增强
- **禁止触碰**：`packages/web/` 下的任何文件 | `packages/shared/src/` 类型定义

### 🟢 B 组 — 治理产品化组（Governance UX）
- **载体**：独立 AI 会话
- **负责区域**：
  - `packages/web/src/views/GovernanceView.vue`
  - `packages/web/src/views/SoulActionDetailView.vue`
  - `packages/web/src/components/SoulAction*.vue`
  - `packages/web/src/components/PromotionProjectionPanel.vue`
  - `packages/web/src/api/client.ts`（仅 governance 相关 API 调用）
- **职责**：治理 UI 增强、Detail 页面、UX 提升
- **禁止触碰**：`packages/server/src/soul/` 核心逻辑 | `packages/server/src/db/schema.ts`

### 🔴 C 组 — 基础设施与稳定性组（Infra & Stability）
- **载体**：独立 AI 会话
- **负责区域**：
  - `packages/shared/src/` 全部类型文件
  - `packages/server/src/db/schema.ts` + `client.ts`
  - `packages/server/src/infra/`
  - `packages/server/src/integrations/`
  - `packages/server/test/`
  - `scripts/` + `services/`
- **职责**：技术债务收口、类型统一、基础设施验证、测试覆盖、部署运维
- **禁止触碰**：`packages/server/src/soul/` 业务逻辑 | `packages/web/src/views/` 页面逻辑

---

## 二、任务交接机制

### 2.1 任务下发流程

```
PM 复盘进度
  ↓
PM 编写分组任务单 → tasks/todo.md
  ↓
用户确认任务优先级
  ↓
用户启动对应组的 AI 会话
  ↓
DEV 读取 tasks/todo.md 中本组任务
  ↓
DEV 按任务执行
  ↓
DEV 完成后，在 tasks/todo.md 标记完成
  ↓
PM 下次复盘时验证
```

### 2.2 任务单格式（`tasks/todo.md`）

```markdown
# LifeOnline 开发任务

## 当前迭代：Sprint-YYYY-MM-DD

### 🔵 A 组 — 认知深化组
- [ ] 任务描述
  - 目标 / 关键文件 / 完成标准 / 验证方式

### 🟢 B 组 — 治理产品化组
- [ ] 任务描述

### 🔴 C 组 — 基础设施组
- [ ] 任务描述
```

### 2.3 完成标记
- `[ ]` — 待做
- `[/]` — 进行中
- `[x]` — 已完成
- `[!]` — 阻塞（需 PM 或用户介入）

---

## 三、冲突防控规则

### 3.1 共享层（shared）修改权
- **只有 C 组** 有权修改 `packages/shared/src/` 的类型定义
- A 组 / B 组如需新增类型，提需求给 PM，PM 安排 C 组实施
- C 组修改 shared 后，需在 tasks/todo.md 注明变更

### 3.2 API 层修改权
- **新增 soul API**：A 组可增加 `handlers/governanceHandlers.ts` 中的新 handler
- **新增 infra API**：C 组负责
- **修改已有 API**：需 PM 协调
- B 组只消费 API，不修改 server 端 handler

### 3.3 Schema 修改权
- **只有 C 组** 有权修改 `db/schema.ts` 和 `db/client.ts`
- A 组如需新增表/列，提需求给 PM → PM 安排 C 组

### 3.4 编译验证
- **所有组提交前必须**：`npx tsc --noEmit` 通过
- **推荐**：本机 dev 调试确认无误后再 commit

---

## 四、文件职责划分

| 文件/目录 | 谁写 | 谁读 | 用途 |
|---|---|---|---|
| `vision/00-权威基线/` | PM 审计 | 全组 | 方向性基线，不轻易修改 |
| `vision/01-当前进度/` | PM 更新 | 全组 | 进度对齐底板 |
| `vision/02-历史草案/` | PM 管理 | PM | 版本存档 |
| `vision/03-讨论纪要/` | PM 编写 | 全组 + 用户 | 沟通记录 |
| `tasks/todo.md` | PM 编写 → 各组更新 | 全组 | 任务交接物（核心） |
| `tasks/lessons.md` | 各组更新 → PM 审核 | 全组 | 教训沉淀 |
| `CLAUDE.md` | PM/C 组 | 全组 | 开发环境上下文 |

---

## 五、进度同步节奏

### 5.1 日常节奏
- **各组每次会话结束时**：在 `tasks/todo.md` 标记完成项
- **PM 复盘时**：审计各组状态，同步更新 `vision/01-当前进度/`

### 5.2 阶段性节奏
- **每完成一个 Sprint**：PM 更新进度简表
- **每达成一个 PR 里程碑**：PM 更新正式任务书
- **每次重大决策**：PM 写入沟通纪要

---

## 六、各组会话启动 Checklist

每组启动新会话时，应按以下顺序读取：

1. `CLAUDE.md` — 环境上下文
2. `tasks/lessons.md` — 历史教训
3. `tasks/todo.md` — 当前任务（只看**本组标记**的任务）
4. `vision/01-当前进度/LifeOnline 第一阶段项目进度简表（快速查看版）.md` — 进度对齐
5. `vision/01-当前进度/LifeOnline 三开发组并行方案.md` — 本组边界规则

---

## 七、跨组依赖处理

当一个组的任务依赖另一个组时：

1. 在 `tasks/todo.md` 中标注 `[!] 阻塞：依赖 X 组完成 YYY`
2. PM 协调优先级
3. 被依赖组优先完成阻塞任务
4. 用户也可直接在两个会话之间传递上下文

---

## 八、升级条件（需用户决策）

1. 蓝图认知对象定义需要修改
2. PR 顺序需要调整
3. 新增蓝图外的 actionType
4. 架构边界变更
5. 引入新技术栈
6. 删除已有功能
7. 组间边界需要调整

---

## 九、当前适用的约束

1. **编译先行**：`npx tsc --noEmit` 通过后才能部署
2. **保守口径**：不把最小落地写成完整产品化系统
3. **review-backed**：高阈值动作必须经过治理链
4. **骨架优先**：增强联合认知体骨架的工作优于表层修补
5. **各组不越界**：严格按负责区域工作
