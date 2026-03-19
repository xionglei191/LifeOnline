# Phase 5 任务书 — 体验优化

*签发: 架构组 | 日期: 2026-03-17 | 阶段: Phase 5*

---

## 背景

Phase 0-4 + Phase 3 全部完成，系统已跑通完整闭环。Phase 5 聚焦体验打磨，让系统从"能用"走向"好用"。

---

## 当前前端状态评估

| 方面 | 状态 | 说明 |
|------|------|------|
| 移动端适配 | ⚠️ 部分完成 | 720px 断点有底部导航，但 768-1024px 平板区间缺失 |
| 隐私系统 | ✅ 已完成 | 双层（隐私模式 + PIN 锁），但 sensitive 无加密 |
| 动效 | ✅ 基础完成 | 路由过渡、面板动画，支持 prefers-reduced-motion |
| 外部集成 | ❌ 无 | 无 Google Calendar、邮件通知等 |
| 主题 | ✅ 已完成 | CSS 变量、明暗模式 |

---

## 看板组任务

### T1: 移动端适配完善 [P1]

**目标**: 让 LifeOS 在手机浏览器上有良好的使用体验

**当前已有**:
- 720px 断点：顶部导航隐藏，底部导航出现
- safe-area-inset 支持
- 部分组件有响应式样式

**需要补充**:

1. **平板断点 (768px-1024px)**:
   - 添加中间断点，优化侧边栏/内容区比例
   - Dashboard 卡片从 3 列调整为 2 列

2. **移动端交互优化**:
   - 触摸目标最小 44px（符合 WCAG）
   - 禁用 hover 状态在触摸设备上的残留（`@media (hover: hover)`）
   - 列表项增加滑动手势支持（左滑完成/右滑归档）

3. **移动端排版**:
   - 笔记详情页全屏展示（而非弹窗）
   - 搜索栏移动端全宽
   - 八维度雷达图在小屏上改为列表视图

4. **PWA 支持**（可选）:
   - 添加 `manifest.json`
   - 添加 Service Worker 基础缓存
   - 支持"添加到主屏幕"

**涉及文件**:
- `packages/web/src/App.vue`（响应式断点）
- `packages/web/src/components/DashboardOverview.vue`
- `packages/web/src/components/NoteDetail.vue`
- `packages/web/src/components/DimensionHealth.vue`

**验收标准**:
- 在一加 ACE2 Chrome 浏览器上测试，所有页面可正常使用
- 触摸目标 ≥ 44px
- 无水平滚动溢出

---

### T2: 隐私分级落地 — sensitive 加密 [P1]

**目标**: 对 `privacy: sensitive` 的笔记实现端到端加密

**当前已有**:
- 隐私模式切换（隐藏 private/sensitive 内容）
- PIN 锁（SHA-256）
- PrivacyMask 组件（遮罩展示）

**需要实现**:

1. **后端加密存储**:
   - sensitive 笔记的 content 字段在 SQLite 中加密存储
   - 使用 AES-256-GCM 加密
   - 密钥派生自用户 PIN（PBKDF2）
   - Frontmatter 明文保存（索引需要），正文加密

2. **前端解密展示**:
   - 用户输入 PIN 后，前端使用 Web Crypto API 解密
   - 解密后的内容仅在内存中，不缓存到 localStorage
   - 隐私模式下 sensitive 内容不解密

3. **API 调整**:
   - `GET /api/notes/:id` 返回加密内容时标记 `encrypted: true`
   - 新增 `POST /api/notes/:id/decrypt` 接口（接收 PIN hash）
   - 或前端直接解密（密钥不传到后端）

**注意**: Vault 文件本身不加密（Obsidian 需要读取），加密仅在 SQLite 索引层

**涉及文件**:
- `packages/server/src/indexer/indexer.ts`（索引时加密）
- `packages/server/src/routes/notes.ts`（API 调整）
- `packages/web/src/components/NoteDetail.vue`（解密展示）
- `packages/web/src/composables/usePrivacy.ts`（密钥管理）

**验收标准**:
- sensitive 笔记在 SQLite 中正文为密文
- 输入正确 PIN 后可查看原文
- 隐私模式下 sensitive 内容完全不可见

---

### T3: 动效和细节打磨 [P2]

**目标**: 提升视觉体验和交互流畅度

**改进项**:

1. **列表动画**:
   - 笔记列表加载时 stagger 入场动画（每项延迟 50ms）
   - 列表项删除/完成时的退出动画

2. **Dashboard 数据动画**:
   - 数字变化时的计数动画（如待办数从 0 滚动到 5）
   - 雷达图数据更新时的过渡动画（ECharts animation 已内置）

3. **微交互**:
   - 按钮点击涟漪效果
   - 状态切换时的图标动画（pending → done 打勾动画）
   - _Inbox 提醒横幅的呼吸灯效果

4. **页面过渡增强**:
   - 当前 route-fade 仅有 opacity，增加方向感（左右滑动）
   - 返回操作使用反向动画

**约束**:
- 所有动画 ≤ 300ms
- 尊重 `prefers-reduced-motion`（已有基础）
- 不引入额外动画库，纯 CSS + Vue transition

**验收标准**:
- 动画流畅，无卡顿
- 关闭动画偏好时所有动效消失

---

## OpenClaw 组任务

### T4: L4 审批机制 + 自动执行 [P2]

**目标**: 让 OpenClaw 具备自动执行能力，但高风险操作需要用户审批

**实现要求**:

1. **自动执行能力**:
   - 自动爬取指定网页信息并写入 Vault
   - 自动创建定期提醒文件
   - 自动归档超过 7 天的 _Inbox 文件（兜底）

2. **审批机制**:
   - 高风险操作（删除文件、批量移动、修改 sensitive 文件）需要审批
   - 审批方式: 写入 `Vault_OS/_Inbox/openclaw_approval_{timestamp}.md`
   - 用户在 LifeOS 看板上确认或拒绝
   - 超过 24 小时未审批自动取消

3. **执行日志**:
   - 所有自动执行操作记录到 `~/.openclaw/logs/lifeonline/exec.log`
   - 包含: 时间、操作类型、目标文件、结果

**验收标准**:
- 自动执行任务正常运行
- 高风险操作触发审批流程
- 日志完整可追溯

---

## 跨组任务

### T5: 外部集成 — Google Calendar 同步 [P2]

**目标**: 将 `type: schedule` 的笔记同步到 Google Calendar

**实现方案**:

1. **LifeOS 后端**:
   - 新增 `/api/integrations/gcal/sync` 接口
   - 使用 Google Calendar API
   - OAuth2 认证流程
   - 将 schedule 类型笔记的 date + due 映射为日历事件

2. **配置**:
   - 在 SettingsView 中添加 Google Calendar 连接入口
   - 支持选择同步哪些维度的 schedule

3. **双向同步**（可选，Phase 5+）:
   - Google Calendar 事件变更 → 更新 Vault 文件

**验收标准**:
- schedule 笔记能同步到 Google Calendar
- 日历中显示正确的时间和标题

---

## 优先级与执行顺序

```
T1 (移动端适配) + T2 (sensitive 加密)  ← P1，先做
         ↓
T3 (动效) + T4 (审批机制) + T5 (Google Calendar)  ← P2，后做，可并行
```

---

## 完成后

- 更新 `LifeOnline/components/status.md` 所有组件状态
- 更新 `LifeOnline/roadmap/roadmap.md` Phase 5 为已完成
- LifeOnline 系统进入日常运营阶段
