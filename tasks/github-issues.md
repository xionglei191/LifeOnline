# LifeOnline GitHub Issues — 代码审计结果

> 生成日期：2026-03-25  
> 基于 vision 权威基线 + error.md 审计

---

## Issue #1 — [P0] SQL 注入风险：模板字符串直接拼接到 db.prepare

**Title**: `fix(security): 消除 SQL 模板字符串拼接，改用参数化查询`  
**Labels**: `bug`, `security`, `P0-critical`

### 描述

error.md §5 指出多处使用模板字符串直接拼接变量到 `db.prepare`，存在 SQL 注入风险。

**示例**:
```typescript
// ❌ 危险
db.prepare(`SELECT * FROM notes WHERE dimension = '${dim}'`)
// ✅ 安全
db.prepare('SELECT * FROM notes WHERE dimension = ?').get(dim)
```

### 行动项
- [ ] 排查 `packages/server` 中所有 `db.prepare` 调用
- [ ] 将模板字符串替换为 `?` 占位符 + 参数绑定
- [ ] 添加 eslint 规则 `no-template-literals-in-sql`（自定义或 eslint-plugin-sql）

### 优先级
**P0 — 安全漏洞，须立即修复**

---

## Issue #2 — [P1] NoteDetail.vue 大量 `as any` 绕过类型检查（9 处）

**Title**: `refactor(web): 消除 NoteDetail.vue 中的 9 处 as any`  
**Labels**: `tech-debt`, `type-safety`, `P1-high`

### 描述

`packages/web/src/components/NoteDetail.vue` 中有 9 处 `as any`：

| 行号 | 用法 | 根因 |
|------|------|------|
| 353 | `approval_status as any` | `approval_status` 缺少字面量类型 |
| 388 | `fetchNoteById() as any` | 返回值类型不匹配 |
| 405 | `status filter as any` | 过滤器参数类型不兼容 |
| 513, 521 | `status/priority as any` (×2) | `updateNote` 参数类型过严 |
| 585, 593 | `'done' as any` (×2) | `Note.status` 未含 `'done'` 字面量 |

### 修复方向
1. 在 `@lifeos/shared` 中为 `Note.status`、`Note.priority`、`Note.approval_status` 定义字面量联合类型
2. `fetchNoteById` 返回值应为 `Note | null`
3. `fetchWorkerTasks` 过滤参数应支持 `string | undefined`

---

## Issue #3 — [P1] WorkerTaskCard.vue 大量 `as any` 访问 input 字段（10 处）

**Title**: `refactor(web): 为 WorkerTask.input 定义 discriminated union 类型`  
**Labels**: `tech-debt`, `type-safety`, `P1-high`

### 描述

`WorkerTaskCard.vue` L95–L119 共 10 处 `(input as any).xxx`。根因：`WorkerTask.input` 是 `Record<string, unknown>` 或 `any`，缺少按 `taskType` 区分的联合类型。

### 修复方向
```typescript
// @lifeos/shared
type WorkerTaskInput =
  | { taskType: 'openclaw_task'; instruction: string; outputDimension: string }
  | { taskType: 'summarize_note'; noteId: string; language?: string; maxLength?: number }
  | { taskType: 'update_persona_snapshot'; noteId: string }
  | { taskType: 'daily_report'; date: string }
  | { taskType: 'weekly_report'; weekStart: string }
  | { taskType: 'extract_tasks'; noteId: string };
```

---

## Issue #4 — [P1] Server 端 SQLite 查询结果全部为 `as any`（20+ 处）

**Title**: `refactor(server): 为所有 SQLite 查询结果定义行类型，消除 as any`  
**Labels**: `tech-debt`, `type-safety`, `P1-high`

### 描述

涉及 16+ 个文件，共 20+ 处 `.get(...) as any` / `.all(...) as any[]`。

**涉及文件**:
- `indexer.ts` (1), `insightEngine.ts` (2), `credentialStore.ts` (2)
- `executionEngine.ts` (2), `usageTracker.ts` (1), `hybridSearch.ts` (1)
- `dagExecutor.ts` (2), `shared.ts` (1), `idleProcessor.ts` (3)
- `openclawExecutor.ts` (1), `workerHandlers.ts` (1)
- `vectorSearchHandlers.ts` (2), `noteHandlers.ts` (3)
- `viewHandlers.ts` (2), `calendarConflictHandler.ts` (1), `reportExecutors.ts` (2)

### 修复方向
```typescript
// 定义行接口
interface NoteRow { id: string; title: string; content: string; /* ... */ }
// 使用类型安全查询
const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as NoteRow | undefined;
```

建议按包创建统一的 `dbTypes.ts` 文件集中管理所有行类型。

---

## Issue #5 — [P1] `WebhookCallPayload.body` 使用 `any` 类型

**Title**: `refactor(shared): 将 WebhookCallPayload.body 从 any 改为 unknown`  
**Labels**: `tech-debt`, `type-safety`, `P1-high`

### 描述

`packages/shared/src/physicalActionTypes.ts` L57:
```typescript
// ❌ 当前
body?: any;
// ✅ 修复
body?: Record<string, unknown> | string;
```

此类型通过 `dagTypes.ts` 的 `DagNode.payload` 和 `PhysicalActionStep.payload` 传播到 DAG 系统。

---

## Issue #6 — [P2] WorkerTaskPanel.vue 两处 `as any` 用于过滤参数

**Title**: `refactor(web): 修复 WorkerTaskPanel 过滤参数类型`  
**Labels**: `tech-debt`, `type-safety`, `P2-medium`

### 描述

`WorkerTaskPanel.vue` L146–147:
```typescript
status: (workerFilterStatus.value || undefined) as any,
taskType: (workerFilterTaskType.value || undefined) as any,
```

### 修复方向
修改 `fetchWorkerTasks` 参数类型，使 `status` 和 `taskType` 支持 `string | undefined`，消除 `as any`。

---

## Issue #7 — [P2] FilterBar.vue `as any` 动态赋值

**Title**: `refactor(web): 修复 FilterBar 动态 key 赋值类型`  
**Labels**: `tech-debt`, `type-safety`, `P2-medium`

### 描述

`FilterBar.vue` L175: `(filters.value as any)[key] = value;`

### 修复方向
使用类型安全的索引签名或 `Record` 类型：
```typescript
const update = { ...filters.value, [key]: value } as FilterState;
filters.value = update;
```

---

## Issue #8 — [P2] VoiceCapture.vue `window as any` 用于 SpeechRecognition

**Title**: `refactor(web): 为 SpeechRecognition 添加全局类型声明`  
**Labels**: `tech-debt`, `type-safety`, `P2-medium`

### 描述

L53: `(window as any).SpeechRecognition || (window as any).webkitSpeechRecognition`

### 修复方向
安装 `@nicolo-ribaudo/chokidar-2` or 添加自定义 `.d.ts`：
```typescript
// src/types/speech.d.ts
interface Window {
  SpeechRecognition?: typeof SpeechRecognition;
  webkitSpeechRecognition?: typeof SpeechRecognition;
}
```

---

## Issue #9 — [P2] CreateNoteFab.vue `form.value as any` 绕过表单类型

**Title**: `refactor(web): 修复 CreateNoteFab 表单类型`  
**Labels**: `tech-debt`, `type-safety`, `P2-medium`

### 描述

L102: `createNote(form.value as any)`

### 修复方向
定义表单类型使其匹配 `createNote` 的参数接口 `CreateNotePayload`。

---

## Issue #10 — [P2] NoteDetail.vue watch 链可优化

**Title**: `perf(web): 简化 NoteDetail watch 链`  
**Labels**: `performance`, `refactor`, `P2-medium`

### 描述

L474 + L476 存在 watch 链：
```typescript
watch(() => props.noteId, (id) => { currentNoteId.value = id; });  // L474
watch(currentNoteId, async (id) => { /* 加载数据 */ });            // L476
```

当前设计用于支持组件内跳转（`openRelatedWorkerOutput`），是合理的。但若内部跳转移除，可合并为单一 `watch`。

### 建议
保持当前设计，但添加注释说明设计意图，方便后续维护。

---

## Issue #11 — [P2] DimensionCharts.vue `watch` 使用 `deep: true` 监听大数组

**Title**: `perf(web): DimensionCharts 移除 deep watch，改用浅比较`  
**Labels**: `performance`, `P2-medium`

### 描述

L167: `watch(() => [props.notes, activeTab.value], renderChart, { deep: true })`

对 `notes` 数组做深度监听会在每次任何 note 属性变化时触发 chart 重绘。

### 修复方向
```typescript
// 用 notes.length 代替深度监听
watch(() => [props.notes.length, activeTab.value], renderChart);
```

---

## Issue #12 — [P2] NoteDetail.vue 拉取 100 条 BrainstormSessions 后客户端过滤

**Title**: `perf(web/server): BrainstormSessions 添加 sourceNoteId 服务端过滤`  
**Labels**: `performance`, `P2-medium`

### 描述

NoteDetail.vue L418:
```typescript
const bs = await fetchBrainstormSessions(100);
relatedBrainstormSessions.value = bs.sessions.filter(s => s.sourceNoteId === sourceNoteId);
```

拉取 100 条再客户端过滤，浪费带宽。API Spec (`GET /api/brainstorm-sessions`) 未定义 `sourceNoteId` 参数，但应添加。

### 修复方向
1. Server: 在 `brainstormHandlers.ts` 添加 `sourceNoteId` query 参数支持
2. Client: `fetchBrainstormSessions({ sourceNoteId })` 按需拉取

---

## Issue #13 — [P2] API 响应信封不一致

**Title**: `fix(server): 统一所有 API 响应为 ApiResponse\<T\> 信封格式`  
**Labels**: `api`, `spec-compliance`, `P2-medium`

### 描述

API Spec 规定所有响应使用 `{ data: T }` 封装（错误时 `{ error: string }`），但部分 handler 直接返回原始对象。

### 行动项
- [ ] 审计所有 `res.json()` 调用
- [ ] 不符合信封格式的统一包裹为 `{ data: result }`
- [ ] 错误响应统一为 `{ error: message }`

---

## Issue #14 — [P2] API 处理器缺少查询参数验证

**Title**: `feat(server): 为 API 处理器添加查询参数验证`  
**Labels**: `api`, `spec-compliance`, `robustness`, `P2-medium`

### 描述

`soulActionHandlers.ts`、`timelineHandler.ts`、`calendarHandler.ts` 等使用原始 query 值而无验证。

### 修复方向
- 引入 `zod` 进行 schema 验证
- 或使用手动类型检查 + 错误返回

---

## Issue #15 — [P2] 空值检查缺失

**Title**: `fix(web): 为可选字段添加 null/undefined 安全检查`  
**Labels**: `bug`, `robustness`, `P2-medium`

### 描述

error.md §6 指出代码中缺少对可选字段的 null/undefined 检查，存在运行时 crash 风险。

### 行动项
- [ ] 排查前端组件中所有 `.value?.xxx` 访问模式
- [ ] 确保所有可选字段在使用前做安全判断
- [ ] 优先修复 `note.value?.approval_status` 等高频访问路径

---

## Issue #16 — [P3] CI 增强：添加 `lint` 和 `tsc --noEmit` 检查步骤

**Title**: `ci: 在 CI 中加入 lint + typecheck 检查，防止类型回退`  
**Labels**: `ci`, `dx`, `P3-low`

### 描述

当前 CI (`.github/workflows/lifeos-check.yml`) 仅执行 `pnpm check` = `build && test && smoke`。缺少静态分析。

**当前状态**:
- 所有 3 个 package 均**无 `lint` 脚本**
- 项目**无 ESLint 配置文件**
- CI 不执行类型检查（`tsc --noEmit`）

### 行动项

**Phase A — ESLint 配置**:
- [ ] 安装 `eslint`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`
- [ ] Web 包追加 `eslint-plugin-vue`
- [ ] 创建 `LifeOS/eslint.config.mjs`（flat config）
- [ ] 各包 `package.json` 添加 `"lint": "eslint src --ext .ts,.vue"`

**Phase B — TypeCheck 脚本**:
- [ ] 各包 `package.json` 添加 `"typecheck": "tsc --noEmit"`

**Phase C — CI 集成**:
- [ ] 根 `package.json` 添加 `"lint": "pnpm -r lint"`, `"typecheck": "pnpm -r typecheck"`
- [ ] CI workflow 添加步骤：
```yaml
- name: Lint
  run: pnpm lint

- name: Type check
  run: pnpm typecheck
```
- [ ] 更新 `"check"` 为 `"pnpm lint && pnpm typecheck && pnpm build && pnpm test && pnpm smoke"`

---

## Issue #17 — [P3] 测试文件中使用 `as any` 进行 mock

**Title**: `refactor(server): 改进测试 mock 类型安全`  
**Labels**: `tech-debt`, `testing`, `P3-low`

### 描述

测试文件中因 mock 需要使用 `as any` 绕过类型。优先级低，但可通过以下方式改善：
- 定义 `TestFactory` 函数返回正确类型的 mock 对象
- 使用 `Partial<T>` + spread 而非 `as any`

---

## 汇总统计

| 优先级 | 数量 | 类别 |
|--------|------|------|
| P0 | 1 | 安全（SQL 注入） |
| P1 | 4 | 类型安全（`as any` 集中治理） |
| P2 | 10 | 性能 + API 合规 + 类型改进 |
| P3 | 2 | CI + 测试改进 |
| **合计** | **17** | |
