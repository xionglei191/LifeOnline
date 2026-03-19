# Phase 3 实施计划：各维度详情页

## Context

Phase 1 和 Phase 2 已完成（2026-03-16），系统现在有：
- 索引服务 + SQLite 数据库 + REST API
- 仪表盘（今日待办 + 本周重点 + 八维度健康度）
- 时间线视图（8 条维度轨道，横向滚动）
- 日历视图（月历网格 + 笔记计数）
- 笔记详情弹窗
- 路由导航（仪表盘 / 时间线 / 日历）

Phase 3 的目标是为八个维度各创建一个详情页，让用户能够深入查看每个维度的数据。

---

## 设计思路

### 维度详情页通用结构

每个维度详情页包含：

1. **顶部统计卡片** — 该维度的关键指标
   - 总笔记数
   - 待办/进行中/已完成数量
   - 健康分数（完成率）
   - 最近更新时间

2. **筛选和排序** — 工具栏
   - 按类型筛选（task/schedule/note/record/milestone/review）
   - 按状态筛选（pending/in_progress/done/cancelled）
   - 按优先级筛选（high/medium/low）
   - 按日期排序（升序/降序）

3. **笔记列表** — 卡片式展示
   - 标题 + 日期 + 状态 + 优先级
   - 点击卡片查看详情（复用 NoteDetail 组件）
   - 分页或虚拟滚动（如果数据量大）

4. **维度专属可视化**（可选，Phase 3.5）
   - 健康：运动记录折线图、体检指标雷达图
   - 事业：项目进度甘特图、技能树
   - 财务：收支柱状图、资产饼图
   - 学习：阅读进度、课程完成度
   - 关系：社交网络图、联系频率
   - 生活：家务清单、购物统计
   - 兴趣：创作作品集、娱乐时长
   - 成长：目标达成率、习惯打卡

---

## 实施步骤

### 步骤 1：创建通用维度详情组件

**新增：`packages/web/src/views/DimensionView.vue`**

通用维度详情页，接收路由参数 `dimension`，根据维度动态加载数据。

功能：
- 从路由获取 dimension 参数
- 调用 `GET /api/notes?dimension=xxx` 获取该维度的所有笔记
- 显示统计卡片（总数、待办、进行中、完成、健康分）
- 显示筛选工具栏（类型、状态、优先级）
- 显示笔记列表（卡片式）
- 点击卡片打开 NoteDetail 弹窗

### 步骤 2：更新路由配置

**修改：`packages/web/src/router.ts`**

添加维度详情页路由：
```typescript
{
  path: '/dimension/:dimension',
  name: 'dimension',
  component: () => import('./views/DimensionView.vue')
}
```

### 步骤 3：更新仪表盘维度卡片

**修改：`packages/web/src/components/DimensionHealth.vue`**

为每个维度卡片添加点击事件，跳转到对应的维度详情页：
```typescript
@click="$router.push(`/dimension/${stat.dimension}`)"
```

### 步骤 4：创建筛选工具栏组件

**新增：`packages/web/src/components/FilterBar.vue`**

通用筛选工具栏，支持：
- 类型筛选（多选）
- 状态筛选（多选）
- 优先级筛选（多选）
- 日期排序（升序/降序）
- 重置按钮

### 步骤 5：创建笔记列表组件

**新增：`packages/web/src/components/NoteList.vue`**

通用笔记列表，接收 notes 数组，渲染卡片式列表：
- 每个卡片显示：标题、日期、状态、优先级、类型
- 点击卡片触发 `@select-note` 事件
- 空状态提示（无笔记时）

### 步骤 6：创建维度统计卡片组件

**新增：`packages/web/src/components/DimensionStats.vue`**

单个维度的统计卡片，显示：
- 维度名称 + 图标
- 总笔记数
- 待办/进行中/已完成数量（带进度条）
- 健康分数（圆形进度）
- 最近更新时间

### 步骤 7：创建 composable

**新增：`packages/web/src/composables/useDimensionNotes.ts`**

管理维度笔记数据：
```typescript
export function useDimensionNotes(dimension: Ref<string>) {
  const notes = ref<Note[]>([]);
  const loading = ref(false);
  const error = ref<Error | null>(null);

  // 筛选状态
  const filters = ref({
    types: [] as string[],
    statuses: [] as string[],
    priorities: [] as string[],
    sortBy: 'date' as 'date' | 'priority',
    sortOrder: 'desc' as 'asc' | 'desc'
  });

  // 计算属性：筛选后的笔记
  const filteredNotes = computed(() => { ... });

  // 计算属性：统计数据
  const stats = computed(() => { ... });

  async function load() { ... }

  return { notes, loading, error, filters, filteredNotes, stats, load };
}
```

---

## 执行顺序

1. 创建 FilterBar 组件（步骤 4）
2. 创建 NoteList 组件（步骤 5）
3. 创建 DimensionStats 组件（步骤 6）
4. 创建 useDimensionNotes composable（步骤 7）
5. 创建 DimensionView 页面（步骤 1）
6. 更新路由配置（步骤 2）
7. 更新仪表盘维度卡片（步骤 3）
8. 端到端验证

---

## 关键文件

- `packages/web/src/views/DimensionView.vue` — 维度详情页
- `packages/web/src/components/FilterBar.vue` — 筛选工具栏
- `packages/web/src/components/NoteList.vue` — 笔记列表
- `packages/web/src/components/DimensionStats.vue` — 维度统计卡片
- `packages/web/src/composables/useDimensionNotes.ts` — 维度笔记数据管理
- `packages/web/src/router.ts` — 添加维度详情页路由
- `packages/web/src/components/DimensionHealth.vue` — 添加点击跳转

---

## 验证清单

- [ ] 从仪表盘点击维度卡片，跳转到对应维度详情页
- [ ] 维度详情页正确显示该维度的所有笔记
- [ ] 统计卡片数据正确（总数、待办、进行中、完成、健康分）
- [ ] 筛选工具栏正常工作（类型、状态、优先级）
- [ ] 排序功能正常（按日期升序/降序）
- [ ] 点击笔记卡片打开详情弹窗
- [ ] 空状态提示正常显示（无笔记时）
- [ ] 浏览器后退按钮正常工作
- [ ] URL 直接访问维度详情页正常

---

## 成功标准

- 用户可以从仪表盘点击任意维度卡片，进入该维度的详情页
- 维度详情页清晰展示该维度的所有笔记和统计信息
- 筛选和排序功能流畅，响应迅速
- 点击笔记可查看完整内容
- 代码复用性好，组件高度解耦
- 与 Phase 1/2 功能无回归

---

## Phase 3.5（可选）：维度专属可视化

如果 Phase 3 基础功能完成顺利，可以考虑为部分维度添加专属可视化：

### 健康维度
- 运动记录折线图（跑步距离、时长趋势）
- 体检指标雷达图（各项指标对比）

### 财务维度
- 收支柱状图（月度收支对比）
- 资产饼图（资产分布）

### 学习维度
- 阅读进度条（已读/在读/待读）
- 课程完成度（完成率）

### 事业维度
- 项目进度甘特图（任务时间线）
- 技能树（技能点亮状态）

**技术选型**：
- 图表库：ECharts（功能强大，中文文档完善）
- 安装：`pnpm --filter web add echarts`
