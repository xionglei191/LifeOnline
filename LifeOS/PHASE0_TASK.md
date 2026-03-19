# Phase 0 任务书：Vault_OS 建立与索引适配

> **签发**: LifeOnline 架构组
> **接收**: LifeOS 看板开发组
> **日期**: 2026-03-17
> **关联**: [LifeOnline 系统架构](/home/xionglei/LifeOnline/architecture/system.md)

---

## 背景

LifeOS 看板当前使用 `mock-vault` 作为数据源。为实现 LifeOnline 大系统联调，需要：
1. 建立真实的 `Vault_OS` 目录结构
2. 确保索引器能正确处理 `_inbox` 维度
3. 支持灵光 App 输出的标准 Frontmatter 文件
4. 明确与 OpenClaw 的职责边界

---

## 改造任务

### 任务 1: 创建 Vault_OS 目录结构 🔴 P0

**位置**: `~/Vault_OS/`（用户 home 目录下）

```bash
mkdir -p ~/Vault_OS/{_Inbox,_Daily,_Weekly,_Templates}
mkdir -p ~/Vault_OS/{健康,事业,财务,学习,关系,生活,兴趣,成长}
```

创建 `_Templates/note.md` 模板文件：

```markdown
---
type: note
dimension: _inbox
status: pending
priority: medium
privacy: private
date: {{date}}
tags: []
source: desktop
created: {{datetime}}
---

```

---

### 任务 2: 索引器适配 `_inbox` 维度 🔴 P0

**文件**: `packages/shared/src/types.ts`

检查 `Dimension` 类型定义，确保包含 `_inbox`：

```typescript
// 确保 dimension 枚举/类型包含 _inbox
type Dimension = 
  | 'health' | 'career' | 'finance' | 'learning'
  | 'relationship' | 'life' | 'hobby' | 'growth'
  | '_inbox';  // 新增
```

**文件**: `packages/server/src/indexer/` 相关文件

- 确保 frontmatter 解析器接受 `_inbox` 作为合法 dimension
- 确保 `_inbox` 维度的笔记在各 API 中可正常查询

---

### 任务 3: 配置 Vault 路径切换 🔴 P0

**文件**: 环境变量或 `packages/server/src/` 配置相关

使 LifeOS 可以指向真实的 `Vault_OS`：
- 设置 `VAULT_PATH=~/Vault_OS`
- 确保文件监听 (chokidar) 指向新路径
- 确保索引服务指向新路径

如果当前通过 Web 设置页面配置 Vault 路径，确认该功能可正常工作。

---

### 任务 4: 创建种子数据 🟡 P1

在 `Vault_OS` 中创建若干标准 Frontmatter 的示例文件，验证索引正常：

**`Vault_OS/_Inbox/lingguang_note_2026-03-17_110000.md`**:
```markdown
---
type: note
dimension: _inbox
status: pending
priority: medium
privacy: private
date: 2026-03-17
tags: [测试, 灵光]
source: lingguang
created: 2026-03-17T11:00
---

## 💡 灵感闪现

这是一条来自灵光 App 的测试笔记，用于验证 LifeOS 索引器的兼容性。
```

**`Vault_OS/事业/desktop_task_2026-03-17_090000.md`**:
```markdown
---
type: task
dimension: career
status: pending
priority: high
privacy: private
date: 2026-03-17
due: 2026-03-20
tags: [项目, 开发]
source: desktop
created: 2026-03-17T09:00
---

## 📝 完成 LifeOnline Phase 0 协议对齐

### 待办
- [ ] 灵光 App Frontmatter 改造
- [ ] Vault_OS 目录建立
- [ ] 全链路联调验证
```

额外创建 3-5 个覆盖不同维度、不同类型的文件。

---

### 任务 5: Dashboard `_inbox` 维度展示 🟡 P1

确保看板首页和维度页面可以正确展示 `_inbox` 的数据：

- Dashboard 的八维度健康卡片区域需要考虑是否展示 `_inbox`（建议以特殊样式展示，提示"有 N 条待整理"）
- 维度详情页支持 `/dimension/_inbox` 路由
- 或者在首页增加一个 `_Inbox` 提醒区域

具体 UI 设计由看板组自行决定，核心要求是 **_Inbox 中的数据对用户可见且可操作**。

---

### 任务 6: 明确与 OpenClaw 的 AI 职责边界 🟢 P2

**当前状态**: LifeOS Phase 5 已内置 AI 分类（classify-inbox）和行动项提取（extract-tasks）

**调整方向**:
- LifeOS 保留 `classify-inbox` 和 `extract-tasks` 的 API 和 UI，作为**手动触发**入口
- OpenClaw 未来将承担**定时自动**分类和提取的职责
- 两者通过 Vault 文件系统解耦，不需要直接 API 通信
- 本任务仅需在 DESIGN.md 中记录该决策，代码暂不改动

---

## 验收标准

1. ✅ `Vault_OS` 目录结构创建完成（八维度 + _Inbox + _Daily + _Weekly + _Templates）
2. ✅ LifeOS 可配置指向 `Vault_OS` 并正常启动
3. ✅ 索引器正确解析 `dimension: _inbox` 的文件
4. ✅ 种子数据在仪表盘、时间线、日历中正常展示
5. ✅ `_Inbox` 中的数据在看板上可见且可操作
6. ✅ 现有功能无回归

---

## 预估工作量

| 任务 | 预估 |
|------|------|
| 任务 1: Vault_OS 创建 | 0.5 小时 |
| 任务 2: 索引器适配 | 0.5 小时 |
| 任务 3: 路径配置 | 0.5 小时 |
| 任务 4: 种子数据 | 0.5 小时 |
| 任务 5: Dashboard 适配 | 1 小时 |
| 测试验证 | 0.5 小时 |
| **总计** | **~3 小时** |

---

## 完成后反馈

完成后请更新以下文件并通知架构组：
1. 更新 `DESIGN.md` 记录 Phase 0 改造
2. 更新 `STATUS.md` 记录新状态
3. 反馈到 `/home/xionglei/LifeOnline/components/status.md` 更新看板组件状态
