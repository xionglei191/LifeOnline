# LifeOnline API Specification

> 更新日期：2026-03-24
> 版本：v1.0.0-Sprint4

本文档定义了 LifeOS 认知层（Soul）的 RESTful API 规范，主要包含以下核心认知对象：

1. **Cognitive Health**
2. **Brainstorm Sessions**
3. **Soul Actions**
4. **Reintegration Records**
5. **Persona Snapshots**
6. **Timeline & Calendar (EventNodes / ContinuityRecords)**

所有的响应都封装在标准 `ApiResponse<T>` 接口格式中：
```json
{
  "data": { ... }
}
// 错误情况下为
{
  "error": "..."
}
```

---

## 1. Cognitive Health

### `GET /api/cognitive-health`

获取 5 大认知对象的底层统计数据与健康指标。用于 Dashboard。

**Response (200 OK):**
```json
{
  "generatedAt": "2026-03-24T14:30:00.000Z",
  "objects": [
    {
      "name": "brainstorm_sessions",
      "total": 150,
      "recent24h": 5,
      "distilledRatio": 0.35,
      "pendingReview": null,
      "successRate": null,
      "latestUpdatedAt": "2026-03-24T14:20:00.000Z"
    },
    {
      "name": "soul_actions",
      "total": 520,
      "recent24h": null,
      "distilledRatio": null,
      "pendingReview": 12,
      "successRate": 0.88,
      "latestUpdatedAt": "2026-03-24T14:15:00.000Z"
    }
    // ... reintegration_records, event_nodes, continuity_records
  ]
}
```

---

## 2. Brainstorm Sessions

### `GET /api/brainstorm-sessions`

获取脑暴/认知提炼会话列表。

**Query Params:**
- `limit`: (可选) number, 默认 50
- `offset`: (可选) number, 默认 0
- `status`: (可选) `analyzing` | `distilled`

**Response (200 OK):**
```json
{
  "sessions": [
    {
      "id": "brainstorm:note_xxx",
      "sourceNoteId": "note_xxx",
      "rawInputPreview": "最近在重构...",
      "themes": ["架构重构"],
      "emotionalTone": "平和中性",
      "extractedQuestions": ["持久化瓶颈如何解决？"],
      "ambiguityPoints": [],
      "distilledInsights": ["[execution: extract_tasks] 已提取任务：调研 Vector DB"],
      "suggestedActionKinds": ["extract_tasks"],
      "actionability": 0.85,
      "continuitySignals": [],
      "status": "distilled",
      "createdAt": "2026-03-24...",
      "updatedAt": "2026-03-24..."
    }
  ],
  "total": 150
}
```

### `GET /api/brainstorm-sessions/:id`

获取单个会话的详细信息，包含与之关联的 SoulActions。

**Response (200 OK):**
```json
{
  "session": { /*...BrainstormSession...*/ },
  "soulActions": [ { /*...SoulAction...*/ } ]
}
```

### `GET /api/brainstorm-sessions/:id/related`

获取存在主题交集的关联 Sessions（P3 新增跨笔记关联能力）。

**Query Params:**
- `limit`: (可选) number, 默认 5, 最大 20

**Response (200 OK):**
```json
{
  "sourceId": "brainstorm:note_xxx",
  "sourceThemes": ["架构重构"],
  "related": [
    {
      "session": { /*...BrainstormSession...*/ },
      "sharedThemeCount": 1,
      "sharedThemes": ["架构重构"]
    }
  ]
}
```

---

## 3. Soul Actions

### `GET /api/soul-actions`

拉取系统推算的智能任务列表。

**Query Params:**
- `governanceStatus`: `pending_review` | `approved` | `rejected`
- `executionStatus`: `succeeded` | `failed` | `not_dispatched`
- `sourceNoteId`: 按触发笔记筛选

### `POST /api/soul-actions/:id/review`

人工治理（Approve/Reject）或系统干预（Gate）。

**Request Body:**
```json
{
  "decision": "approved", // 或者 "rejected"
  "reason": "用户手动放行"
}
```

### `POST /api/soul-actions/:id/execute`

手动触发某一决议的立即执行。后台入队 WorkerTask。

**Response (200 OK):**
```json
{
  "dispatched": true,
  "reason": "approved soul action dispatched through worker host",
  "workerTaskId": "WT-123",
  "executionSummary": {
    "operation": "enqueued"
  }
}
```

---

## 4. Reintegration Records

### `GET /api/reintegration-records`

获取 WorkerTask 执行后的“待回流确认”列表（通常携带建议方案或提取物）。

### `POST /api/reintegration-records/:id/review`

接受或拒绝对事实数据的提取（如：插入待办事项、更新日历）。

**Request Body:**
```json
{
  "decision": "accepted",
  "reason": "确认该日期的待办"
}
```

---

## 5. Persona Snapshots

### `GET /api/persona-snapshots/:sourceNoteId`

获取关于某篇笔记的用户人格分析切片。

**Response (200 OK):**
```json
{
  "snapshot": {
    "id": "persona:note_xxx",
    "sourceNoteId": "note_xxx",
    "summary": "表现出对工作流效率的长期关注，近期焦点在底层重构",
    "snapshot": {
      "sourceNoteTitle": "2026-03-24 日志",
      "summary": "表现出对工作流的长期关注",
      "updatedAt": "..."
    }
  }
}
```

---

## 6. Timeline & Calendar

### `GET /api/timeline`

获取 `EventNodes` 和 `ContinuityRecords` 以时间轴聚合的表现层。

**Query Params:**
- `start`: ISO string
- `end`: ISO string

### `GET /api/calendar`

获取按天折叠的数据总览。

**Query Params:**
- `year`: "2026"
- `month`: "3"
