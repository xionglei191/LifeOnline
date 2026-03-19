# Phase 5.1 预览功能增强

## 修改内容

### 1. 时间线悬停预览（NotePreview.vue）

**多条记录显示增强**：
- 标题：优先显示 `title` 字段，fallback 到文件名
- 内容摘要：显示前 80 字符，最多 2 行
- 样式：次要颜色，左侧缩进，文本截断

**代码变更**：
```vue
<span class="multi-title">{{ n.title || n.file_name.replace('.md', '') }}</span>
<p v-if="n.content" class="multi-content">{{ truncate(n.content, 80) }}</p>
```

### 2. 时间线点击列表（TimelineTrack.vue - Picker）

**多选列表增强**：
- 状态点：显示 pending/in_progress/done/cancelled
- 标题：优先显示 title
- 内容摘要：80 字符，2 行
- 元数据：类型 + 日期

**布局**：
```
[●] 标题
    内容摘要...
    [类型] [日期]
```

**样式调整**：
- 宽度：320-420px
- 每项高度：自适应（约 80-100px）
- hover 效果：背景色 + 边框高亮

### 3. 日历视图预览（CalendarGrid.vue）

**新增功能**：
- 鼠标悬停日期单元格显示预览
- 使用 NotePreview 组件
- 智能定位（避免超出视口）

**事件绑定**：
```vue
@mouseenter="day.count > 0 ? onCellEnter(day, $event) : null"
@mouseleave="onCellLeave"
```

**位置计算**：
- 估算预览高度：单条 200px，多条 90px/条，最大 500px
- 优先显示在鼠标右侧，超出则左侧
- 检查下边界，超出则向上调整

### 4. 预览窗口定位优化（TimelineTrack.vue）

**智能边界检测**：
```typescript
// 右边界：超出则显示在左侧
if (x + previewWidth > window.innerWidth) {
  x = e.clientX - previewWidth - 16;
}

// 下边界：超出则向上调整
if (y + previewHeight > window.innerHeight - 20) {
  y = window.innerHeight - previewHeight - 20;
}
```

**高度估算调整**：
- 单条记录：200px
- 多条记录：90px × 条数，最大 500px

## 效果

### 时间线预览
- ✅ 悬停显示内容摘要
- ✅ 不会被遮挡（智能定位）
- ✅ 多条记录易于区分

### 时间线列表
- ✅ 点击后显示详细列表
- ✅ 每条记录显示标题 + 摘要
- ✅ 状态点 + 元数据

### 日历视图
- ✅ 悬停日期显示笔记预览
- ✅ 多条记录显示前 5 条
- ✅ 智能定位不超出视口

## 用户体验提升

1. **信息密度**：从只显示文件名 → 显示标题 + 内容摘要
2. **可区分性**：17 条记录不再难以区分，内容摘要提供上下文
3. **一致性**：时间线、列表、日历使用统一的预览样式
4. **可用性**：智能定位确保预览始终可见
