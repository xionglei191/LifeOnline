# 看板组任务书 — Phase 5.1 问题修复 + T5

*签发: 架构组 | 日期: 2026-03-17 | 阶段: Phase 5.1*

---

## 背景

Phase 5 T1/T2/T3 已完成验收。现在处理三个已发现的问题 + T5 外部集成任务。

---

## 问题修复（优先）

### 问题 1: 审批功能不可见 [P0]

**现象**:
- OpenClaw 生成的审批文件（`openclaw_approval_*.md`）在看板中无法审批
- 用户看不到 `approval_status` 字段，无法批准/拒绝

**期望**:
- 审批文件在看板中有专门的审批界面
- 显示审批详情（操作类型、风险等级、影响范围、载荷）
- 提供"批准"/"拒绝"按钮

**实现方案**:

1. **检测审批文件**:
   - 在 `NoteDetail.vue` 中检测 Frontmatter 是否有 `approval_status` 字段
   - 如果有，渲染审批卡片而非普通笔记详情

2. **审批卡片 UI**:
   ```
   ┌─────────────────────────────────────┐
   │ 🔔 OpenClaw 审批请求                │
   ├─────────────────────────────────────┤
   │ 操作类型: delete_files              │
   │ 风险等级: critical                  │
   │ 影响范围: 删除文件 1 个             │
   │ 原因: 测试删除审批                  │
   │ 载荷: {"paths": [...]}              │
   │                                     │
   │ 状态: pending                       │
   │ 过期时间: 2026-03-18 17:34          │
   ├─────────────────────────────────────┤
   │ [✅ 批准]  [❌ 拒绝]                │
   └─────────────────────────────────────┘
   ```

3. **审批操作**:
   - 点击"批准"按钮 → 调用 `PATCH /api/notes/:id` 修改 `approval_status: approved`
   - 点击"拒绝"按钮 → 修改 `approval_status: rejected`
   - 操作后刷新笔记详情

**涉及文件**:
- `packages/web/src/components/NoteDetail.vue`
- 可选: 新建 `packages/web/src/components/ApprovalCard.vue`

**验收标准**:
- 打开审批文件，能看到审批界面
- 点击批准/拒绝后，Frontmatter 的 `approval_status` 字段正确更新
- OpenClaw 能感知审批结果并执行相应操作

---

### 问题 2: 本周重点追踪显示不合理 [P1]

**现象**:
- Dashboard 的"本周重点追踪"只显示文件名
- 文件名（如 `openclaw_task_2026-03-17_161329_1.md`）对用户无意义

**期望**:
- 主要显示任务标题/内容（从 Markdown 正文的 `## 标题` 提取）
- 文件名作为次要信息，字体缩小

**实现方案**:

1. **后端索引器提取标题**:
   - 在 `indexer.ts` 的 `parseNote()` 中提取 Markdown 第一个 `##` 标题
   - 存储为 `title` 字段到 SQLite
   - 如果没有 `##` 标题，使用正文前 50 字符作为 fallback

2. **前端显示调整**:
   - `WeeklyHighlights.vue` 优先显示 `note.title`
   - 文件名作为副标题，字体缩小到 0.85em，颜色变淡

**涉及文件**:
- `packages/server/src/indexer/indexer.ts` — 提取标题逻辑
- `packages/server/src/indexer/parser.ts` — 添加 title 字段到类型定义
- `packages/web/src/components/WeeklyHighlights.vue` — UI 调整

**验收标准**:
- 本周重点显示任务标题而非文件名
- 文件名作为副标题显示

---

### 问题 3: 时间线预览窗口位置固定 [P1]

**现象**:
- 时间线视图的预览窗口位置固定
- 滚动查看下方时间线时，预览窗口跑到屏幕下端

**期望**:
- 预览窗口"吸附"在可视区域内，始终可见

**实现方案**:

使用 `position: sticky` 让预览窗口吸附在顶部：

```css
.note-preview {
  position: sticky;
  top: 80px; /* 顶部导航栏高度 + 间距 */
  align-self: flex-start;
}
```

**涉及文件**:
- `packages/web/src/views/TimelineView.vue`

**验收标准**:
- 滚动时间线时，预览窗口始终在视口内
- 切换不同时间线项时，预览内容正确更新

---

## T5: Google Calendar 同步 [P2]

**目标**: 将 `type: schedule` 的笔记同步到 Google Calendar

**实现方案**:

1. **后端 Google Calendar API 集成**:
   - 安装依赖: `npm install googleapis`
   - 新增 `/api/integrations/gcal/auth` — OAuth2 认证流程
   - 新增 `/api/integrations/gcal/sync` — 同步 schedule 笔记到日历
   - 使用 Google Calendar API v3

2. **OAuth2 认证流程**:
   - 用户点击"连接 Google Calendar"
   - 跳转到 Google OAuth2 授权页面
   - 授权后回调到 `/api/integrations/gcal/callback`
   - 存储 access_token 和 refresh_token 到 SQLite

3. **同步逻辑**:
   - 扫描所有 `type: schedule` 的笔记
   - 将 `date` + `due` 映射为日历事件的开始/结束时间
   - 事件标题: 笔记的第一个 `##` 标题
   - 事件描述: 笔记正文
   - 事件颜色: 根据 dimension 映射（health=绿色、career=蓝色等）

4. **前端配置界面**:
   - 在 `SettingsView.vue` 添加"外部集成"区域
   - Google Calendar 连接状态显示
   - "连接"/"断开"按钮
   - 同步维度选择（可选择同步哪些维度的 schedule）

**涉及文件**:
- `packages/server/src/routes/integrations.ts` — 新建路由
- `packages/server/src/services/gcal.ts` — Google Calendar 服务
- `packages/web/src/views/SettingsView.vue` — 配置界面

**验收标准**:
- 用户能成功连接 Google Calendar
- schedule 笔记能同步到 Google Calendar
- 日历中显示正确的时间和标题

**注意**: 需要在 Google Cloud Console 创建 OAuth2 凭据

---

## 优先级

```
问题 1 (审批功能) [P0] ← 最优先，阻塞 OpenClaw L4
问题 2 (本周重点) [P1] + 问题 3 (时间线预览) [P1] ← 次优先
T5 (Google Calendar) [P2] ← 最后
```

---

## 完成后

- 更新 `LifeOnline/roadmap/roadmap.md` Phase 5 为已完成
- 通知架构组验收
