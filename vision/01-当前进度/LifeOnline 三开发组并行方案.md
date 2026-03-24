# LifeOnline 三开发组并行方案（草案）

> 起草日期：2026-03-24
> 状态：**待讨论确认**

---

## 一、可行性判断

**结论：可行，但需要明确边界规则。**

当前代码库有清晰的模块分层：

```text
LifeOS/
├── packages/shared/src/    ← 共享层（10 个类型文件）
├── packages/server/src/
│   ├── soul/               ← 认知内核（18 个文件）
│   ├── workers/            ← 执行调度
│   ├── api/                ← API 路由与 handlers
│   ├── db/                 ← 数据库 schema & client
│   ├── infra/              ← R2 等基础设施
│   ├── integrations/       ← OpenClaw 等外部集成
│   ├── vault/              ← 内容事实源
│   └── ai/ indexer/ ...    ← 其他
└── packages/web/src/
    ├── views/              ← 15 个视图页面
    ├── components/         ← 39 个组件
    └── api/                ← 前端 API client
```

这种分层结构天然支持 3 组并行，关键是**谁动 shared 层**需要有明确规则。

---

## 二、三组划分方案

### 🔵 A 组 — 认知深化组（Soul Depth）

**负责区域**：
- `packages/server/src/soul/` 全部 18 个模块
- `packages/server/src/workers/feedbackReintegration.ts`
- `packages/server/src/workers/continuityIntegrator.ts`

**当前可安排任务**：
- BrainstormSession 深度提炼（distilled 阶段）
- 连续性模式识别增强
- Gate 学习机制优化
- 新 actionType 设计与实现

**不可触碰**：
- `packages/web/` 下的任何文件
- `packages/server/src/api/` 路由（除新增 soul 相关接口）

---

### 🟢 B 组 — 治理产品化组（Governance UX）

**负责区域**：
- `packages/web/src/views/GovernanceView.vue`
- `packages/web/src/views/SoulActionDetailView.vue`
- `packages/web/src/components/SoulActionGovernancePanel.vue`
- `packages/web/src/components/PromotionProjectionPanel.vue`
- `packages/web/src/api/client.ts`（仅 governance 相关 API 调用）

**当前可安排任务**：
- SoulAction Detail 页面增强
- BrainstormSession 展示面增强
- 追问交互 UI 优化
- 治理面板 UX 提升（分组、筛选、批量操作）

**不可触碰**：
- `packages/server/src/soul/` 的核心逻辑
- `packages/server/src/db/schema.ts`

---

### 🔴 C 组 — 基础设施与稳定性组（Infra & Stability）

**负责区域**：
- `packages/server/src/infra/` （R2 等）
- `packages/server/src/integrations/` （OpenClaw 等）
- `packages/server/src/db/schema.ts` + `client.ts`
- `packages/server/test/`
- `packages/shared/src/` （类型统一、技术债务）
- `scripts/` + `services/` （部署运维）

**当前可安排任务**：
- P0 技术债务：`SoulActionKind` 统一定义
- R2 凭据配置与实际验证
- 测试覆盖增强
- 部署脚本优化
- schema 迁移健壮性

**不可触碰**：
- `packages/server/src/soul/` 的业务逻辑
- `packages/web/src/views/` 的页面逻辑

---

## 三、冲突防控规则

### 3.1 共享层（shared）修改规则
- **只有 C 组** 有权修改 `packages/shared/src/` 的类型定义
- A 组 / B 组 如需新增类型，**先提需求给 C 组**或提需求给 PM
- C 组修改 shared 后，需通知 A/B 组同步

### 3.2 API 层修改规则
- **新增 API**：A 组（soul 相关）、C 组（infra 相关）
- **修改已有 API**：需 PM 协调
- B 组只消费 API，不修改 server 端 handler

### 3.3 Schema 修改规则
- **只有 C 组** 有权修改 `db/schema.ts` 和 `db/client.ts`
- A 组如需新增表/列，提需求给 C 组
- 避免多组同时改 schema 导致冲突

### 3.4 分支策略
- 各组在独立功能分支上工作
- 合并前需编译验证：`npx tsc --noEmit`
- PM 负责协调合并顺序

---

## 四、典型 Sprint 任务分配示例

以当前 Sprint 为例：

| 组 | 任务 | 优先级 |
|---|---|---|
| C 组 | 统一 `SoulActionKind` 重复定义 | P0 |
| C 组 | R2 凭据配置与实际冷存储验证 | P3 |
| B 组 | SoulAction Detail 页面增强 | P2 |
| B 组 | 追问交互 UI 增强 | P1 |
| A 组 | BrainstormSession 深度提炼（distilled 阶段） | P2 |
| A 组 | 连续性模式识别增强 | P2 |

---

## 五、PM 协调机制

```text
PM
├── 每次 Sprint 开始 → 写 tasks/todo.md，标注分组
├── 各组按分工执行
├── 各组完成后 → 在 tasks/todo.md 标记
├── PM 复盘 → 验证 + 更新进度文档
└── 冲突仲裁 → PM 即时协调
```

### 关键约束
1. **各组不越界**：严格按负责区域工作
2. **shared 改动需提前通知**：C 组改 shared 前通知 A/B 组
3. **编译先行**：每个组提交前必须 `npx tsc --noEmit` 通过
4. **文档同步**：PM 负责保持 vision/ 文档与代码同步

---

## 六、风险评估

| 风险 | 概率 | 影响 | 应对 |
|---|---|---|---|
| shared 类型冲突 | 中 | 高 | C 组垄断 shared 修改权 |
| schema 并发修改 | 低 | 高 | C 组垄断 schema 修改权 |
| GovernanceView 过大 | 中 | 中 | B 组优先拆分组件 |
| 三组节奏不同步 | 中 | 低 | PM 每 Sprint 对齐 |

---

> 待用户确认后，PM 将按此方案更新 tasks/todo.md 并分组下发任务。
