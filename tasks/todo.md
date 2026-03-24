# LifeOnline 开发任务

## 当前迭代：Sprint-2026-03-24

> 下发人：项目经理 | 下发日期：2026-03-24
> 模式：三组并行（A 认知深化 / B 治理产品化 / C 基础设施）

---

### 🔴 C 组 — 基础设施与稳定性

#### Sprint 1 ✅ | Sprint 2 ✅ | Sprint 3 ✅

<details>
<summary>已完成任务（点击展开）</summary>

**Sprint 1**
- [x] P0：统一 SoulActionKind 定义
- [x] P3：R2 凭据配置与实际冷存储验证
- [x] P2：测试覆盖增强

**Sprint 2**
- [x] P2：部署流水线一键化
- [x] P2：R2 冷存储读回验证 + 清理
- [x] P3：错误监控与日志结构化

**Sprint 3**
- [x] P2：WebSocket 心跳与断线重连健壮性
- [x] P2：索引队列并发控制与错误恢复
- [x] P3：health check API (`/api/health`)

</details>

#### Sprint 4 — 收官冲刺（新任务）

- [ ] **P1：端到端集成测试**
  - 目标：编写覆盖"笔记写入 → 索引 → 认知分析 → SoulAction 生成 → Gate 决策 → 执行 → 回流"全链路的集成测试
  - 关键文件：`packages/server/test/` (新增 integration.test.ts)
  - 完成标准：一条测试可以走通从笔记到认知回流的完整生命周期
  - 验证：`npm test` 中包含 integration 测试且通过

- [ ] **P2：生产环境配置加固**
  - 目标：将敏感凭据从 systemd Environment 迁移到 .env 文件，添加 CORS 白名单配置
  - 关键文件：`services/lifeos-server.service`, `packages/server/src/api/server.ts`
  - 完成标准：凭据不再明文写在 systemd unit 中
  - 验证：部署后服务正常启动

- [ ] **P3：数据备份策略**
  - 目标：SQLite 数据文件定时备份至本地 + R2（每日一次）
  - 关键文件：`scripts/backup.sh` (新建), `r2Client.ts`
  - 完成标准：crontab 定时备份 + R2 有最近一次备份
  - 验证：手动触发备份脚本确认可用

---

### 🟢 B 组 — 治理产品化

#### Sprint 1 ✅ | Sprint 2 ✅ | Sprint 3 ✅

<details>
<summary>已完成任务（点击展开）</summary>

**Sprint 1**
- [x] P3：治理面板 UX 提升 (GovernanceView 组件拆分)
- [x] P2：SoulAction Detail 页面增强
- [x] P2：追问交互 UI 优化

**Sprint 2**
- [x] P1：Dashboard 主页产品化
- [x] P2：OpsView 运维中心组件拆分
- [x] P3：NoteDetail 认知增强展示

**Sprint 3**
- [x] P1：全局时序线与事件流展示 (EventsView)
- [x] P2：全局搜索页增强
- [x] P3：移动端 PWA 与快捷指令支持预研

</details>

#### Sprint 4 — 收官冲刺（新任务）

- [ ] **P1：全局 UI 一致性审查与暗色主题完善**
  - 目标：确保所有新增页面（Events / Dashboard / NoteDetail 认知区域）在暗色与亮色主题下样式统一
  - 关键文件：`packages/web/src/assets/` (全局 CSS), 各 View/Component
  - 完成标准：暗色/亮色模式切换时无硬编码颜色、无白色闪块
  - 验证：浏览器截图对比两种模式

- [ ] **P2：前端错误边界与空状态优化**
  - 目标：为所有核心页面增加 ErrorBoundary 和空状态提示（Empty State），避免无数据时白屏
  - 关键文件：`packages/web/src/components/` (StateDisplay, ErrorBoundary)
  - 完成标准：每个核心页面在无数据时有友好提示，API 错误时有回退 UI
  - 验证：断开后端后前端不白屏

- [ ] **P3：页面加载性能优化**
  - 目标：对 DashboardOverview (778行) 等大组件进行懒加载拆分，优化首屏加载
  - 关键文件：`packages/web/src/router/`
  - 完成标准：路由级 lazy import，首屏 bundle < 200KB
  - 验证：Vite build 输出的 chunk 分析

---

### 🔵 A 组 — 认知深化

#### Sprint 1 ✅ | Sprint 2 ✅ | Sprint 3 ✅

<details>
<summary>已完成任务（点击展开）</summary>

**Sprint 1**
- [x] P2：BrainstormSession 深度提炼（distilled 阶段）
- [x] P2：连续性模式识别增强
- [x] P3：Gate 学习机制增强

**Sprint 2**
- [x] P1：interventionGate 接入 Gate 学习
- [x] P2：认知分析质量提升（Prompt 调优）
- [x] P3：BrainstormSession 跨笔记关联

**Sprint 3**
- [x] P1：Reintegration 深层回流（PR5 深化）
- [x] P2：SoulAction 执行结果反馈闭环
- [x] P3：认知对象健康度评估 API

</details>

#### Sprint 4 — 收官冲刺（新任务）

- [ ] **P1：认知管线全链路验证与文档化**
  - 目标：绘制真实数据流图，确认 persona → brainstorm → gate → dispatch → reintegration 的完整路径无断裂
  - 关键文件：`vision/01-当前进度/` (更新控制流程图)
  - 完成标准：以一条真实笔记为案例，trace 完整认知链路并文档化
  - 验证：文档中有真实数据的全链路截图

- [ ] **P2：认知对象 API 文档与接口规范**
  - 目标：为 5 个核心认知对象的 CRUD API 编写 OpenAPI 规范文档
  - 关键文件：`vision/` (新增 API-spec.md)
  - 完成标准：所有 soul 相关 API endpoints 有入参/出参/示例
  - 验证：文档覆盖所有 soul API routes

- [ ] **P3：第二阶段蓝图草案**
  - 目标：基于第一阶段的完成成果，撰写第二阶段的技术蓝图初稿
  - 关键文件：`vision/02-权威基线/` (新增)
  - 完成标准：明确第二阶段的 3-5 个核心方向和初步技术选型
  - 验证：PM 审阅并确认方向
