# Phase 5.1 问题修复完成报告

## 问题1：审批功能不可见 [P0] ✅

**修复内容**：
1. 数据库 schema 添加审批字段：
   - approval_status TEXT
   - approval_operation TEXT
   - approval_risk TEXT
   - approval_scope TEXT

2. 后端 indexer 提取审批字段：
   - parser.ts 修改 ParseResult 类型支持额外字段
   - indexer.ts 在 upsertNote 中提取并存储审批字段

3. 前端 NoteDetail.vue 审批界面：
   - isApprovalNote computed 检测 approval_status 字段
   - 审批卡片显示操作类型、风险等级、影响范围、状态、过期时间
   - 批准/拒绝按钮调用 updateNote API
   - 完整样式支持（approval-card, btn-approve, btn-reject）

**验证**：
```bash
curl "http://localhost:3000/api/notes?dimension=_inbox" | jq '.[] | select(.file_name | contains("approval")) | {file_name, approval_status, approval_operation, approval_risk}'
```

---

## 问题2：本周重点显示优化 [P1] ✅

**修复内容**：
1. 数据库 schema 添加 title 列：
   - title TEXT

2. 后端 indexer 提取标题：
   - extractTitle() 函数提取 Markdown 第一个 ## 标题
   - fallback：使用正文前 50 字符
   - 在加密前提取 title（避免提取加密内容）

3. 前端 WeeklyHighlights.vue 显示优化：
   - 优先显示 title
   - 文件名作为副标题（0.85em，淡色）

**验证**：
```bash
curl http://localhost:3000/api/dashboard | jq '.weeklyHighlights[:3] | .[] | {title, file_name}'
```

---

## 问题3：时间线预览窗口位置 [P1] ✅

**修复内容**：
- NotePreview.vue 移除 clamp 约束
- 恢复跟随鼠标的原始行为
- 添加 max-height: calc(100vh - 100px) 防止超出视口
- 添加 overflow-y: auto 支持长内容滚动

**说明**：
预览窗口现在紧靠鼠标位置，符合常规交互习惯。

---

## 文件变更清单

**后端**：
- packages/server/src/db/schema.ts — 添加 title 和审批字段
- packages/server/src/indexer/indexer.ts — 提取 title 和审批字段
- packages/server/src/indexer/parser.ts — 支持额外字段

**前端**：
- packages/web/src/components/NoteDetail.vue — 审批界面
- packages/web/src/components/WeeklyHighlights.vue — title 显示
- packages/web/src/components/NotePreview.vue — 位置优化

---

## 测试文件

创建了测试审批文件：
- ~/Vault_OS/_Inbox/test_approval.md

包含完整的审批字段，可用于验证审批功能。

---

## BUG 修复：非审批项显示审批界面

**问题**：
所有笔记都显示审批界面，因为 `'approval_status' in note.value` 对所有笔记返回 true（字段存在但值为 null）。

**修复**：
```typescript
const isApprovalNote = computed(() => {
  return note.value && note.value.approval_status != null && note.value.approval_status !== '';
});
```

现在只有 approval_status 有实际值的笔记才显示审批界面。

---

## BUG 修复：审批后状态回退

**问题**：
点击"批准"后，approval_status 又回到 pending 状态。

**原因**：
后端 updateNote API 只支持更新 status、priority、tags，不支持 approval_status。

**修复**：
在 handlers.ts 的 updateNote 函数中添加 approval_status 支持：
```typescript
const { status, priority, tags, approval_status } = req.body;
// ...
if (approval_status !== undefined) updates.approval_status = approval_status;
```

**验证**：
- 创建测试审批文件（approval_status: pending）
- 点击批准按钮
- 文件 Frontmatter 更新为 approval_status: approved
- 数据库同步更新
- 前端显示"审批已批准/拒绝"状态

---

## 功能增强：审批完成自动标记 done

**需求**：
审批完成后应该标记为 done 状态，从待办事项中移除。

**实现**：
修改 NoteDetail.vue 的审批操作：
- handleApprove: 同时更新 approval_status='approved' 和 status='done'
- handleReject: 同时更新 approval_status='rejected' 和 status='done'

**效果**：
- 批准/拒绝审批后，笔记自动标记为完成
- 不再出现在 Dashboard 的待办事项中
- 不再出现在本周重点追踪中（如果是 high priority）
- 审批历史可通过筛选 status=done 查看

---

## BUG 修复：OpenClaw 旧格式审批文件不显示审批界面

**问题**：
文件 `openclaw_approval_2026-03-17_183036_003884.md` 使用旧格式：
- `approval_action` 而不是 `approval_operation`
- 没有 `approval_scope` 字段

导致审批字段未被索引，前端不显示审批界面。

**修复**：

1. **数据库 schema** 添加 `approval_action` 列：
```sql
ALTER TABLE notes ADD COLUMN approval_action TEXT;
```

2. **后端 indexer** 同时提取两种格式：
```typescript
frontmatter.approval_operation || null,
frontmatter.approval_action || null,
```

3. **前端显示** 兼容两种格式：
```vue
<strong>{{ note.approval_operation || note.approval_action || 'N/A' }}</strong>
```

4. **approval_scope** 改为可选显示：
```vue
<div v-if="note.approval_scope" class="detail-row">
  <span class="detail-label">影响范围</span>
  <strong>{{ note.approval_scope }}</strong>
</div>
```

**兼容性**：
- 新格式：approval_operation + approval_scope
- 旧格式：approval_action（无 approval_scope）
- 两种格式都能正确显示审批界面

**测试**：
```bash
# 旧格式文件已正确索引
curl "http://localhost:3000/api/notes" | jq '.[] | select(.file_name | contains("openclaw_approval_2026-03-17_183036_003884")) | {approval_status, approval_action, approval_risk}'
```

输出：
```json
{
  "approval_status": "pending",
  "approval_action": "execute_task_plan",
  "approval_risk": "medium"
}
```
