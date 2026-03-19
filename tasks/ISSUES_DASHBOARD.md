# LifeOS 看板问题清单

*记录时间: 2026-03-17*

---

## 问题 1: 审批功能不可见 [P0]

**现象**:
- OpenClaw 生成的审批文件（`openclaw_approval_*.md`）在看板中无法审批
- 用户看不到 `approval_status` 字段

**期望**:
- 审批文件在看板中有专门的审批界面
- 显示审批详情（操作类型、风险等级、影响范围）
- 提供"批准"/"拒绝"按钮，点击后修改 Frontmatter 的 `approval_status` 字段

**涉及文件**:
- `packages/web/src/components/NoteDetail.vue` — 笔记详情组件
- 可能需要新建 `ApprovalCard.vue` 组件

**技术方案**:
- 检测 Frontmatter 中是否有 `approval_status` 字段
- 如果有，渲染审批卡片而非普通笔记详情
- 审批操作调用 API: `PATCH /api/notes/:id` 修改 `approval_status`

---

## 问题 2: 本周重点追踪显示不合理 [P1]

**现象**:
- Dashboard 的"本周重点追踪"只显示文件名
- 文件名（如 `openclaw_task_2026-03-17_161329_1.md`）对用户无意义
- 看不到实际的任务内容

**期望**:
- 主要显示任务标题/内容（从 Markdown 正文的 `## 标题` 提取）
- 文件名作为次要信息，字体缩小，放在下方或右侧
- 类似格式：
  ```
  整理产品改进点并归档到对应维度
  openclaw_task_2026-03-17_161329_1.md
  ```

**涉及文件**:
- `packages/web/src/components/WeeklyHighlights.vue` — 本周重点组件
- 后端可能需要在索引时提取标题字段

**技术方案**:
- 后端索引器提取 Markdown 第一个 `##` 标题作为 `title` 字段
- 前端优先显示 `title`，文件名作为副标题

---

## 问题 3: 时间线预览窗口位置固定导致遮挡 [P1]

**现象**:
- 时间线视图（TimelineView）的预览窗口位置固定
- 当滚动查看下方时间线时，预览窗口跑到屏幕下端，看不到

**期望**:
- 预览窗口应该"吸附"在可视区域内
- 或者改为浮动窗口，跟随滚动位置
- 或者使用 `position: sticky` 让预览窗口始终在视口内

**涉及文件**:
- `packages/web/src/views/TimelineView.vue` — 时间线视图
- `packages/web/src/components/NotePreview.vue` — 预览组件（如果有）

**技术方案**:
- 方案 A: 使用 `position: sticky; top: 80px;` 让预览窗口吸附在顶部
- 方案 B: 监听滚动事件，动态调整预览窗口位置
- 方案 C: 改为模态弹窗，点击时间线项时弹出

---

## 优先级

| 问题 | 优先级 | 原因 |
|------|--------|------|
| 问题 1 | P0 | 审批功能完全不可用，阻塞 OpenClaw L4 能力 |
| 问题 2 | P1 | 影响用户体验，但有 workaround（点进去看详情） |
| 问题 3 | P1 | 影响时间线视图的可用性 |

---

## 下一步

等看板组完成 Phase 5 T1/T2/T3/T5 后，将这三个问题作为 Phase 5.1 补丁任务下发。
