# Phase 3.5 实施计划：搜索功能 + 体验优化

## Context

Phase 1-3 已完成（2026-03-16），系统核心功能已成型：
- 索引服务 + 数据库 + API
- 仪表盘 + 时间线 + 日历
- 8 个维度详情页 + 筛选排序

在进入 Phase 4（OpenClaw AI 集成）之前，先完善一些基础功能，提升用户体验。

---

## 目标

Phase 3.5 聚焦于基础功能完善和体验优化：

1. **全文搜索** — 在所有笔记中搜索关键词
2. **搜索结果页** — 展示搜索结果，支持高亮
3. **全局搜索框** — 在导航栏添加搜索入口
4. **快捷键支持** — Cmd/Ctrl + K 唤起搜索
5. **搜索历史** — 记录最近搜索（localStorage）

---

## 实施步骤

### 步骤 1：后端搜索 API

**新增：`GET /api/search?q=关键词`**

功能：
- 在 notes 表中搜索 file_name 和 content 字段
- 使用 SQLite 的 LIKE 查询
- 返回匹配的笔记列表
- 支持分页（limit + offset）

**修改：`packages/server/src/api/handlers.ts`**

```typescript
export async function searchNotes(req: Request, res: Response): Promise<void> {
  try {
    const { q, limit = 50, offset = 0 } = req.query;
    if (!q) {
      res.status(400).json({ error: 'query parameter required' });
      return;
    }

    const db = await getDb();
    const keyword = `%${q}%`;

    const result = db.exec(`
      SELECT * FROM notes
      WHERE file_name LIKE ? OR content LIKE ?
      ORDER BY date DESC
      LIMIT ? OFFSET ?
    `, [keyword, keyword, limit, offset]);

    const notes = rowsToObjects(result).map(parseNote);
    res.json({ notes, total: notes.length, query: q });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
}
```

**修改：`packages/server/src/api/routes.ts`**

```typescript
router.get('/search', searchNotes);
```

### 步骤 2：前端搜索 API 客户端

**修改：`packages/web/src/api/client.ts`**

```typescript
export interface SearchResult {
  notes: Note[];
  total: number;
  query: string;
}

export async function searchNotes(query: string, limit = 50, offset = 0): Promise<SearchResult> {
  const params = new URLSearchParams({ q: query, limit: String(limit), offset: String(offset) });
  const res = await fetch(`${API_BASE}/search?${params}`);
  if (!res.ok) throw new Error('Failed to search notes');
  return res.json();
}
```

### 步骤 3：创建搜索结果页

**新增：`packages/web/src/views/SearchView.vue`**

功能：
- 从 URL query 参数获取搜索关键词
- 调用搜索 API
- 显示搜索结果列表（复用 NoteList 组件）
- 显示搜索统计（找到 X 条结果）
- 关键词高亮显示
- 空结果提示

### 步骤 4：创建全局搜索框组件

**新增：`packages/web/src/components/SearchBar.vue`**

功能：
- 输入框 + 搜索按钮
- 支持 Enter 键提交
- 支持 Escape 键清空
- 搜索历史下拉列表（最近 5 条）
- 点击历史项快速搜索

### 步骤 5：更新导航栏

**修改：`packages/web/src/App.vue`**

在导航栏右侧添加搜索框：
```vue
<header>
  <h1>LifeOS</h1>
  <nav>
    <router-link to="/">仪表盘</router-link>
    <router-link to="/timeline">时间线</router-link>
    <router-link to="/calendar">日历</router-link>
  </nav>
  <SearchBar />
</header>
```

### 步骤 6：添加快捷键支持

**新增：`packages/web/src/composables/useKeyboard.ts`**

功能：
- 监听 Cmd/Ctrl + K 快捷键
- 唤起搜索框并聚焦
- 监听 Escape 键关闭搜索

### 步骤 7：搜索历史管理

**新增：`packages/web/src/composables/useSearchHistory.ts`**

功能：
- 使用 localStorage 存储搜索历史
- 最多保存 10 条
- 提供添加、获取、清空方法

### 步骤 8：更新路由

**修改：`packages/web/src/router.ts`**

```typescript
{
  path: '/search',
  name: 'search',
  component: () => import('./views/SearchView.vue')
}
```

---

## 执行顺序

1. 后端搜索 API（步骤 1）
2. 前端搜索 API 客户端（步骤 2）
3. 搜索历史 composable（步骤 7）
4. 全局搜索框组件（步骤 4）
5. 搜索结果页（步骤 3）
6. 快捷键支持（步骤 6）
7. 更新导航栏（步骤 5）
8. 更新路由（步骤 8）
9. 端到端验证

---

## 关键文件

- `packages/server/src/api/handlers.ts` — 新增 searchNotes handler
- `packages/server/src/api/routes.ts` — 注册搜索路由
- `packages/web/src/api/client.ts` — 新增 searchNotes 函数
- `packages/web/src/views/SearchView.vue` — 搜索结果页
- `packages/web/src/components/SearchBar.vue` — 全局搜索框
- `packages/web/src/composables/useSearchHistory.ts` — 搜索历史管理
- `packages/web/src/composables/useKeyboard.ts` — 快捷键支持
- `packages/web/src/App.vue` — 添加搜索框到导航栏
- `packages/web/src/router.ts` — 添加搜索路由

---

## 验证清单

- [ ] 搜索 API 正常响应（返回匹配的笔记）
- [ ] 搜索框输入关键词，按 Enter 跳转到搜索结果页
- [ ] 搜索结果页正确显示匹配的笔记
- [ ] 搜索统计正确（找到 X 条结果）
- [ ] 点击搜索结果卡片打开详情弹窗
- [ ] 搜索历史正常保存和显示
- [ ] 点击历史项快速搜索
- [ ] Cmd/Ctrl + K 快捷键唤起搜索框
- [ ] Escape 键清空搜索框
- [ ] 空搜索结果提示正常显示

---

## 成功标准

- 用户可以在任意页面通过搜索框或快捷键搜索笔记
- 搜索结果准确，响应迅速（<100ms）
- 搜索历史方便用户快速重复搜索
- 搜索体验流畅，符合用户习惯
- 与现有功能无冲突

---

## 可选增强（Phase 3.6）

如果 Phase 3.5 完成顺利，可以考虑：

### 高级搜索
- 支持多关键词搜索（AND/OR 逻辑）
- 支持字段搜索（title:关键词、tag:标签）
- 支持日期范围搜索（date:2026-03-01..2026-03-31）

### 搜索结果优化
- 关键词高亮显示
- 搜索结果摘要（显示匹配上下文）
- 按相关度排序

### 搜索建议
- 输入时显示搜索建议（自动补全）
- 显示热门搜索词

---

## 技术选型

### 搜索实现
- 使用 SQLite LIKE 查询（简单，性能足够）
- 如果未来需要更强大的搜索，可以考虑：
  - SQLite FTS5（全文搜索扩展）
  - Elasticsearch（独立搜索引擎）
  - MeiliSearch（轻量级搜索引擎）

### 快捷键库
- 不引入额外库，使用原生 addEventListener
- 监听 keydown 事件，判断 metaKey/ctrlKey + key

### 搜索历史存储
- localStorage（简单，无需后端）
- 最多保存 10 条，超出后删除最旧的
