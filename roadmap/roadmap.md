# LifeOnline 开发路线图

*更新: 2026-03-19*

---

## 全局进度

```
Phase 0: 协议对齐 ✅ 已完成
Phase 1: Vault_OS 建立 ✅ 已完成
Phase 1.5: 真机联调 ✅ 已完成
Phase 2: OpenClaw 接入 ✅ 已完成
Phase 4: 系统联调 ✅ 已完成
Phase 3: 灵光 App 迭代 ✅ 已完成
Phase 5: 体验优化 ✅ 已完成
Phase 6: 调度器增强 + 系统健壮性 ✅ 已完成
Phase 6.1: LifeOS 后端接替 OpenClaw 自动化职责 ✅ 已完成
Phase 6.2: OpenClaw 通用任务改造 ✅ 已完成
```

---

## Phase 0: 协议对齐 ✅ 已完成

> **目标**: 让所有组件说同一套语言
> **完成日期**: 2026-03-17

| 任务 | 涉及组件 | 状态 |
|------|---------|------|
| 灵光 Frontmatter 改造 | 灵光 App V1.46 | ✅ |
| 统一 Inbox 目录名 | 灵光 App V1.46 | ✅ |
| VoiceNoteType 映射 | 灵光 App V1.46 | ✅ |
| 文件命名规范 | 灵光 App V1.46 | ✅ |
| Vault_OS 目录建立 | LifeOS | ✅ |
| 索引器 _inbox 适配 | LifeOS + 架构组 | ✅ |
| 种子数据创建 | LifeOS | ✅ |
| 全链路验证 | 架构组 | ✅ 9 文件 0 错误 |

---

## Phase 1: Vault_OS 建立 ✅ 已完成

> **目标**: 建立真实的 Obsidian Vault 并连接 LifeOS
> **完成日期**: 2026-03-17

| 任务 | 优先级 | 状态 |
|------|--------|------|
| 创建 Vault_OS 目录结构（八维度 + _Inbox + _Daily + _Weekly） | P0 | ✅ |
| 迁移 mock-vault 数据或创建种子数据 | P1 | ✅ |
| 配置 LifeOS 指向 Vault_OS | P0 | ✅ |
| 配置 Syncthing 多设备同步 | P2 | ✅ |
| 安装 Obsidian 必要插件 | P2 | ✅ |

---

## Phase 1.5: 真机联调 ✅ 已完成

> **目标**: 验证 LifeOS 和灵光 App 在真实 Vault_OS 下的端到端流程
> **完成日期**: 2026-03-17

| 任务 | 负责组 | 优先级 | 状态 |
|------|--------|--------|------|
| LifeOS 真实 Vault 验收测试 | 看板组 | P0 | ✅ |
| 补充空维度种子数据 | 看板组 | P1 | ✅ |
| 确认实时监听链路稳定性 | 看板组 | P0 | ✅ |
| 灵光 App 真机写入测试 | 灵光组 | P0 | ✅ |
| 灵光 → LifeOS 端到端联调 | 灵光组 + 看板组 | P0 | ✅ |

---

## Phase 2: OpenClaw 接入 ✅ 已完成

> **目标**: 让 OpenClaw 成为系统的智能管家
> **完成日期**: 2026-03-17

| 任务 | 优先级 | 状态 |
|------|--------|------|
| L1: OpenClaw 监控 _Inbox + 自动分类归档 | P0 | ✅ |
| L2: 行动项提取 + 自动创建任务文件 | P0 | ✅ |
| L3: 日报自动生成 → _Daily/ | P1 | ✅ |
| L3: 周报自动生成 → _Weekly/ | P1 | ✅ |
| 定时 cron 配置 | P0 | ✅ |
| 与 LifeOS AI 功能边界划分（ADR-006） | P1 | ✅ |

---

## Phase 3: 灵光 App 迭代 ✅ 已完成

> **目标**: 增强采集能力
> **完成日期**: 2026-03-17

| 任务 | 优先级 | 状态 |
|------|--------|------|
| 大模型 Prompt 统一升级（PromptTemplates.kt） | P1 | ✅ |
| Frontmatter 生成健壮性修复 | P1 | ✅ |
| YouTube 字幕抓取 | P2 | ✅ |
| 长链接深度解析增强 | P2 | ✅ |
| TileService 快捷面板 | P2 | ✅ |

---

## Phase 4: 系统联调 ✅ 已完成

> **目标**: 全链路跑通
> **完成日期**: 2026-03-17

| 任务 | 优先级 | 状态 |
|------|--------|------|
| 灵光 → Vault_OS → OpenClaw 整理 → LifeOS 展示 | P0 | ✅ |
| 看板操作 → Vault 写回 → OpenClaw 感知 | P0 | ✅ |
| OpenClaw 自动执行 → 结果写入 Vault → 看板展示 | P1 | ✅ |
| 多设备同步压力测试 | P2 | ⬜ |

---

## Phase 5: 体验优化 ✅ 已完成

> **目标**: 打磨系统体验
> **完成日期**: 2026-03-17

| 任务 | 优先级 | 状态 |
|------|--------|------|
| LifeOS 移动端适配 | P1 | ✅ |
| LifeOS 动效和细节打磨 | P2 | ✅ |
| 隐私分级落地（sensitive 加密） | P1 | ✅ |
| 外部集成（Google Calendar、邮件通知） | P2 | ⬜ |
| L4: OpenClaw 审批机制 + 自动执行 | P2 | ✅ |

---

## Phase 5.1: 问题修复 ✅ 已完成

> **目标**: 修复用户反馈的三个问题 + T5 外部集成
> **完成日期**: 2026-03-17

| 任务 | 优先级 | 状态 |
|------|--------|------|
| 问题 1: 审批功能不可见 | P0 | ✅ |
| 问题 2: 本周重点显示优化 | P1 | ✅ |
| 问题 3: 时间线预览窗口位置 | P1 | ✅ |
| T5: Google Calendar 同步 | P2 | ⬜ |

---

## Phase B: OpenClaw 增强 ✅ 已完成

> **目标**: 提升 OpenClaw 核心能力
> **完成日期**: 2026-03-17

| 任务 | 优先级 | 状态 |
|------|--------|------|
| 语义判定层（避免误触发） | P1 | ✅ |
| 任务回滚机制 | P1 | ✅ |
| 版本校验与兼容性检查 | P1 | ✅ |
| 语义门控分析工具 | P2 | ✅ |
| "小熊同学"主动式 AI 管家 | P0 | ✅ |
| 审批格式迁移（双写策略） | P1 | ✅ |

---

## Phase 6.2: OpenClaw 通用任务改造 ✅ 已完成

> **目标**: 将 OpenClaw 从固定新闻采集任务升级为通用自然语言任务执行器
> **完成日期**: 2026-03-19

| 任务 | 优先级 | 状态 |
|------|--------|------|
| `collect_trending_news` → `openclaw_task` 类型替换 | P0 | ✅ |
| 输入模型改为 `instruction` + `outputDimension` | P0 | ✅ |
| 数据库 CHECK 约束与历史记录迁移 | P0 | ✅ |
| OpenClaw Client 改为 `/tasks/execute` 通用端点 | P0 | ✅ |
| Worker 结果持久化改为通用 Markdown 落地 | P1 | ✅ |
| API 验证逻辑适配 `openclaw_task` | P1 | ✅ |
| 设置页外部执行任务改为通用指令输入 | P1 | ✅ |
| 定时任务表单支持 OpenClaw 通用任务 | P1 | ✅ |
| 端到端验证（tsc + vite build） | P0 | ✅ |

---


| 日期 | 里程碑 |
|------|--------|
| 2026-03-14 | 灵光 App V1.0 基础架构完成 |
| 2026-03-15 | 灵光 App V1.40 UI 现代化完成 |
| 2026-03-16 | 灵光 App V1.45 发布 |
| 2026-03-16 | LifeOS Phase 7 完成，系统达到生产可用 |
| 2026-03-17 | LifeOnline 整体架构规划完成 |
| 2026-03-17 | Phase 0 协议对齐完成 |
| 2026-03-17 | Phase 1 Vault_OS 建立完成 |
| 2026-03-17 | Syncthing 多设备同步配置完成（v2.0.15，双端配对） |
| 2026-03-17 | Phase 1.5 真机联调完成（灵光 App ↔ Syncthing ↔ LifeOS 全链路打通） |
| 2026-03-17 | Phase 2 OpenClaw 接入完成（L1/L2/L3 + 定时任务 + ADR-006） |
| 2026-03-17 | Phase 4 系统联调通过（三条链路全部验证通过） |
| 2026-03-17 | Phase 3 灵光 App V1.48 迭代完成（Prompt 统一、YouTube 字幕、TileService） |
| 2026-03-17 | Phase 5 体验优化完成（移动端适配、sensitive 加密、动效打磨） |
| 2026-03-17 | Phase 5.1 问题修复完成（审批 UI、本周重点、时间线预览） |
| 2026-03-17 | Phase B OpenClaw 增强完成（语义判定、回滚机制、版本校验） |
| 2026-03-17 | "小熊同学"主动式 AI 管家上线（触发词检测、WhatsApp 集成） |
| 2026-03-17 | 审批格式迁移完成（双写策略，兼容新旧格式） |
| 2026-03-17 | LifeOnline 系统初始化提交（git 仓库建立） |
| 2026-03-18 | Phase 6 调度器增强完成（立即执行、失败追踪、Dashboard 健康卡片） |
| 2026-03-19 | Phase 6.2 OpenClaw 通用任务改造完成（openclaw_task + 自然语言指令 + 通用执行端点） |

---

## Phase 6: 调度器增强 + 系统健壮性 ✅ 已完成

> **目标**: 修复定时任务 Bug、增加调试能力、健康监控集成 Dashboard
> **完成日期**: 2026-03-18

| 任务 | 优先级 | 状态 |
|------|--------|------|
| 修复 summarize_note 定时任务创建 Bug（隐藏不适用选项） | P0 | ✅ |
| 定时任务"立即执行"按钮 | P1 | ✅ |
| 调度失败追踪（consecutive_failures + last_error） | P1 | ✅ |
| Dashboard 定时任务健康状态卡片 | P1 | ✅ |
| 设置页 schedule 列表显示失败信息 | P2 | ✅ |

---

## Phase 6.1: LifeOS 后端接替 OpenClaw 自动化职责 ✅ 已完成

> **目标**: LifeOS 后端直接调用 Claude AI 完成 Inbox 分类、日报、周报，不再依赖 OpenClaw
> **完成日期**: 2026-03-18

| 任务 | 优先级 | 状态 |
|------|--------|------|
| 扩展类型定义（classify_inbox / daily_report / weekly_report） | P0 | ✅ |
| 数据库 CHECK 约束扩展 + 迁移逻辑 | P0 | ✅ |
| AI Prompt 模板（日报 / 周报） | P0 | ✅ |
| frontmatterBuilder 参数化（source / worker / workerTaskType） | P1 | ✅ |
| classify_inbox Worker（读取 _Inbox → AI 分类 → 移动 → 提取任务） | P0 | ✅ |
| daily_report Worker（SQLite 统计 → Claude 生成总结 → _Daily/） | P0 | ✅ |
| weekly_report Worker（SQLite 统计 → Claude 生成总结 → _Weekly/） | P0 | ✅ |
| API 验证逻辑扩展 | P1 | ✅ |
| 前端 UI 适配（定时任务表单 4 种类型、筛选下拉、taskTypeLabel） | P1 | ✅ |
| 端到端验证（3 种任务类型全部 succeeded） | P0 | ✅ |
