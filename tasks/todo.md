# LifeOnline 开发任务

## 当前迭代：Sprint-2026-03-24

> 下发人：项目经理 | 下发日期：2026-03-24
> 基于：项目经理复盘结论

### P0 — 技术债务收口
- [ ] 统一 `SoulActionKind` 定义
  - 目标：消除 server 和 shared 中 `SoulActionKind` 的重复定义
  - 关键文件：`LifeOS/packages/server/src/soul/types.ts`, `LifeOS/packages/shared/src/soulActionTypes.ts`
  - 完成标准：仅在 `@lifeos/shared` 中定义一次，server 端 re-export
  - 验证方式：`npx tsc --noEmit` 全量通过

### P1 — `ask_followup_question` 前端交互 UI
- [ ] 补全 `ask_followup_question` 的前端交互面
  - 目标：后端 `answerFollowupHandler` 已就绪，需要在 GovernanceView 中增加追问交互 UI
  - 关键文件：`LifeOS/packages/web/src/views/GovernanceView.vue`, `LifeOS/packages/web/src/api/client.ts`
  - 完成标准：用户可以在治理面板中看到追问类 SoulAction，并直接回答
  - 验证方式：页面可交互、POST 请求成功

### P2 — SoulAction Detail 独立页面
- [ ] 创建 SoulAction 生命周期详情页
  - 目标：单条动作变成可审计对象，展示 source → reason → governance → execution → outcome → reintegration
  - 关键文件：新建 `LifeOS/packages/web/src/views/SoulActionDetailView.vue`
  - 完成标准：路由可达、数据完整展示
  - 验证方式：从治理面板点击进入详情页

### P3 — 评估 `persist_continuity_markdown`
- [ ] 评估 Vault 写入能力实现路径
  - 目标：开始实现 `persist_continuity_markdown` actionType
  - 关键文件：`LifeOS/packages/server/src/soul/soulActionDispatcher.ts`
  - 完成标准：设计方案已对齐
  - 验证方式：PM 审核
