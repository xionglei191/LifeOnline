# Phase 5.1 数据结构变更总结

## 数据库 Schema 变更

### 新增字段（notes 表）

```sql
-- OpenClaw 审批字段
approval_status TEXT,        -- 审批状态: pending/approved/rejected
approval_operation TEXT,     -- 新格式：操作类型
approval_action TEXT,        -- 旧格式：操作类型（兼容 OpenClaw）
approval_risk TEXT,          -- 风险等级: low/medium/high
approval_scope TEXT          -- 影响范围描述
```

### 字段说明

1. **approval_status**（必需）
   - 值：`pending` | `approved` | `rejected` | `null`
   - 用途：标识笔记是否需要审批及审批状态
   - 前端判断：`approval_status != null && approval_status !== ''` 时显示审批界面

2. **approval_operation**（新格式）
   - 值：操作类型字符串，如 `delete_files`, `move_files`, `execute_command`
   - 用途：描述需要审批的操作类型

3. **approval_action**（旧格式，兼容字段）
   - 值：操作类型字符串，如 `execute_task_plan`
   - 用途：兼容 OpenClaw 旧版本生成的审批文件
   - 前端显示：`approval_operation || approval_action`

4. **approval_risk**
   - 值：`low` | `medium` | `high`
   - 用途：风险等级标识

5. **approval_scope**（可选）
   - 值：影响范围描述字符串，如 "删除2个文件"
   - 用途：详细说明操作影响范围
   - 注意：旧格式可能没有此字段

## Frontmatter 格式

### 新格式（推荐）
```yaml
---
type: note
dimension: _inbox
status: pending
approval_status: pending
approval_operation: delete_files
approval_risk: high
approval_scope: 删除2个文件
---
```

### 旧格式（兼容）
```yaml
---
type: note
dimension: _inbox
status: pending
approval_status: pending
approval_action: execute_task_plan
approval_risk: medium
approval_expires_at: 2026-03-18T18:30
---
```

## API 变更

### PATCH /api/notes/:id

**新增支持字段**：
```json
{
  "approval_status": "approved",
  "status": "done"
}
```

**行为变更**：
- 审批操作（批准/拒绝）会同时更新 `approval_status` 和 `status`
- `status` 自动设置为 `done`，从待办事项中移除

## 前端变更

### NoteDetail.vue

**审批判断逻辑**：
```typescript
const isApprovalNote = computed(() => {
  return note.value && note.value.approval_status != null && note.value.approval_status !== '';
});
```

**显示逻辑**：
```vue
<!-- 操作类型：兼容两种格式 -->
<strong>{{ note.approval_operation || note.approval_action || 'N/A' }}</strong>

<!-- 影响范围：可选显示 -->
<div v-if="note.approval_scope" class="detail-row">
  <span class="detail-label">影响范围</span>
  <strong>{{ note.approval_scope }}</strong>
</div>
```

**审批操作**：
```typescript
// 批准
await updateNote(noteId, {
  approval_status: 'approved',
  status: 'done'
});

// 拒绝
await updateNote(noteId, {
  approval_status: 'rejected',
  status: 'done'
});
```

## OpenClaw 集成建议

### 1. 推荐使用新格式

OpenClaw 生成审批文件时，建议使用新格式：

```yaml
---
approval_status: pending
approval_operation: <operation_type>
approval_risk: <low|medium|high>
approval_scope: <description>
---
```

### 2. 保持旧格式兼容

如果 OpenClaw 暂时无法升级，旧格式仍然可以正常工作：

```yaml
---
approval_status: pending
approval_action: <action_type>
approval_risk: <low|medium|high>
---
```

### 3. 审批完成后的状态

**重要**：审批完成后，笔记会被标记为 `status: done`，不再出现在待办事项中。

OpenClaw 需要注意：
- 已审批的文件不会再次出现在审批列表中
- 如需查看审批历史，筛选 `status=done` 且 `approval_status` 非空的笔记

### 4. 字段优先级

前端显示优先级：
1. `approval_operation`（新格式）
2. `approval_action`（旧格式）
3. 'N/A'（都没有）

建议 OpenClaw 逐步迁移到新格式，但不强制。

## 迁移指南

### 对于 OpenClaw

**无需立即迁移**：
- 旧格式文件可以正常显示和审批
- 系统已做兼容处理

**建议迁移步骤**：
1. 更新 OpenClaw 生成审批文件的代码
2. 使用 `approval_operation` 替代 `approval_action`
3. 添加 `approval_scope` 字段（可选但推荐）
4. 测试新格式文件在 LifeOS 中的显示

**迁移示例**：
```diff
  ---
  approval_status: pending
- approval_action: execute_task_plan
+ approval_operation: execute_task_plan
  approval_risk: medium
+ approval_scope: 执行3步任务计划
  ---
```

## 测试验证

### 验证新格式
```bash
# 创建新格式审批文件
cat > ~/Vault_OS/_Inbox/test_new_format.md << 'EOF'
---
type: note
dimension: _inbox
status: pending
approval_status: pending
approval_operation: test_operation
approval_risk: low
approval_scope: 测试范围
---
测试新格式
EOF

# 验证索引
curl -s "http://localhost:3000/api/notes" | jq '.[] | select(.file_name | contains("test_new_format"))'
```

### 验证旧格式
```bash
# 创建旧格式审批文件
cat > ~/Vault_OS/_Inbox/test_old_format.md << 'EOF'
---
type: note
dimension: _inbox
status: pending
approval_status: pending
approval_action: test_action
approval_risk: medium
---
测试旧格式
EOF

# 验证索引
curl -s "http://localhost:3000/api/notes" | jq '.[] | select(.file_name | contains("test_old_format"))'
```

## 总结

**对 OpenClaw 的影响**：
- ✅ 旧格式完全兼容，无需立即修改
- ✅ 新格式提供更好的语义和扩展性
- ✅ 审批完成后自动标记 done，避免重复审批
- ⚠️ 建议逐步迁移到新格式

**关键变更**：
1. 数据库新增 `approval_action` 字段（兼容旧格式）
2. 前端同时支持 `approval_operation` 和 `approval_action`
3. 审批完成后 `status` 自动设置为 `done`
4. `approval_scope` 为可选字段

**无需同步的内容**：
- 其他 UI 改进（预览、列表显示等）不影响数据结构
- OpenClaw 只需关注审批相关字段
