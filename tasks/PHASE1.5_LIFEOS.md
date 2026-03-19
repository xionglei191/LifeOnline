# LifeOS 看板组任务书 — Phase 1.5 真机联调

*签发: 架构组 | 日期: 2026-03-17 | 阶段: Phase 1.5*

---

## 背景

Phase 0 协议对齐和 Phase 1 Vault_OS 建立已完成。LifeOS 已具备 `_inbox` 维度支持、`VAULT_PATH=~/Vault_OS` 配置能力、Dashboard _Inbox 提醒横幅等功能。现在需要在真实 Vault_OS 环境下完成验收，并为 Phase 2 OpenClaw 接入做好准备。

---

## 任务清单

### T1: 真实 Vault 启动验收 [P0]

**目标**: 确认 LifeOS 在指向真实 Vault_OS 时功能正常

**步骤**:
1. 使用 `VAULT_PATH=~/Vault_OS pnpm dev` 启动 LifeOS
2. 验证以下功能点：
   - [ ] Dashboard 正确展示已有的 8 个种子文件
   - [ ] _Inbox 提醒横幅显示 2 条待处理笔记
   - [ ] 八维度雷达图正确渲染（有数据的维度应有分值）
   - [ ] 时间线视图正常展示
   - [ ] 全文搜索能检索到种子数据
   - [ ] 维度详情页筛选功能正常

**验收标准**: 所有功能点通过，截图记录

---

### T2: 补充空维度种子数据 [P1]

**目标**: 让八维度雷达图有完整数据展示

当前空维度: `财务(finance)`、`关系(relationship)`、`生活(life)`、`兴趣(hobby)`

**要求**:
- 每个空维度补充 1-2 个种子文件
- 严格遵守 Frontmatter 协议 v1.0（参见 `protocols/frontmatter.md`）
- 文件命名遵守 `{source}_{type}_{YYYY-MM-DD}_{HHmmss}.md` 规范
- source 统一使用 `desktop`
- 写入对应的维度目录（如 `Vault_OS/财务/`）

**种子数据建议**:

| 维度 | 文件名 | type | 内容建议 |
|------|--------|------|---------|
| 财务 | `desktop_record_2026-03-17_100000.md` | record | 3月消费记录汇总 |
| 财务 | `desktop_task_2026-03-17_100500.md` | task | 制定Q2储蓄计划 |
| 关系 | `desktop_note_2026-03-17_101000.md` | note | 周末家庭聚餐安排 |
| 关系 | `desktop_schedule_2026-03-17_101500.md` | schedule | 老友下周约饭 |
| 生活 | `desktop_task_2026-03-17_102000.md` | task | 换季衣物整理 |
| 生活 | `desktop_record_2026-03-17_102500.md` | record | 家居清洁计划 |
| 兴趣 | `desktop_note_2026-03-17_103000.md` | note | 摄影构图学习笔记 |
| 兴趣 | `desktop_record_2026-03-17_103500.md` | record | 本周观影记录 |

**验收标准**: 索引后八维度均有数据，雷达图完整

---

### T3: 实时监听链路稳定性验证 [P0]

**目标**: 确认 chokidar + WebSocket 在真实 Vault_OS 下稳定工作

**步骤**:
1. LifeOS 运行状态下，手动在 `Vault_OS/_Inbox/` 创建一个新 .md 文件
2. 观察：
   - [ ] chokidar 是否在 ~300ms 内检测到文件变更
   - [ ] SQLite 索引是否自动更新
   - [ ] WebSocket 是否推送更新到前端
   - [ ] Dashboard _Inbox 计数是否实时 +1
3. 删除测试文件，确认索引同步移除

**验收标准**: 文件变更后 Dashboard 实时刷新，无需手动刷新页面

---

### T4: 为 Phase 2 OpenClaw 对接做准备 [P1]

**目标**: 确认看板侧已准备好接收 OpenClaw 的写入

**确认项**:
- [ ] OpenClaw 将文件从 `_Inbox/` 移动到维度目录时，索引器能正确处理（旧索引删除 + 新索引创建）
- [ ] OpenClaw 修改文件 Frontmatter（如 dimension 从 `_inbox` 改为 `career`）后，看板能正确反映变更
- [ ] 如发现问题，记录到 `LifeOS/ISSUES.md` 并通知架构组

**验收标准**: 模拟 OpenClaw 的文件操作（移动 + 修改），看板正确响应

---

## 协议参考

- Frontmatter 协议: `LifeOnline/protocols/frontmatter.md`
- 文件命名规范: `LifeOnline/protocols/naming.md`
- 八维度定义: `LifeOnline/protocols/dimensions.md`
- 系统架构: `LifeOnline/architecture/system.md`

## 完成后

- 更新 `LifeOnline/components/status.md` 中 LifeOS 看板的状态
- 通知架构组验收结果
