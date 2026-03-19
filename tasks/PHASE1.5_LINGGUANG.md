# 灵光 APP 组任务书 — Phase 1.5 真机联调

*签发: 架构组 | 日期: 2026-03-17 | 阶段: Phase 1.5*

---

## 背景

灵光 App V1.46 已完成 Frontmatter 协议对齐，包括：标准 Frontmatter 格式、`_Inbox` 目录名统一、VoiceNoteType → type/dimension 映射、文件命名规范。现在需要在真机上验证与真实 Vault_OS 的端到端写入流程，并与 LifeOS 看板联调。

---

## 任务清单

### T1: 真机写入验证 [P0]

**目标**: 确认灵光 App 在一加 ACE2 上能正确写入 Vault_OS/_Inbox/

**测试用例**:

| # | 场景 | 操作 | 预期结果 |
|---|------|------|---------|
| 1 | 语音闪念 | 录制一段语音，等待 AI 整理完成 | 生成 `lingguang_note_2026-03-17_{HHmmss}.md`，写入 `_Inbox/` |
| 2 | 视觉萃取 | 拍摄一张照片，等待 Vision API 处理 | 生成 `lingguang_note_2026-03-17_{HHmmss}.md` + 同名 `.jpg` |
| 3 | 信息漏斗 | 从浏览器分享一个链接到灵光 | 生成 `lingguang_note_2026-03-17_{HHmmss}.md`，含链接摘要 |
| 4 | 离线场景 | 关闭网络，录制语音，恢复网络 | WorkManager 后台同步，文件最终写入 `_Inbox/` |

**逐项检查**:
- [ ] 文件写入路径: `Vault_OS/_Inbox/`（不是旧的 `00_Inbox`）
- [ ] 文件名格式: `lingguang_{type}_{YYYY-MM-DD}_{HHmmss}.md`
- [ ] Frontmatter 必填字段完整:
  ```yaml
  type: note          # 或 task/record 等
  dimension: _inbox   # 灵光端固定写 _inbox
  status: pending
  privacy: private
  date: 2026-03-17
  source: lingguang
  created: 2026-03-17T{HH}:{mm}
  ```
- [ ] tags 字段不带 `#` 前缀
- [ ] Markdown 正文内容完整，AI 整理结果可读

**验收标准**: 4 个测试用例全部通过，每个用例保留生成的文件作为证据

---

### T2: 与 LifeOS 看板端到端联调 [P0]

**前置条件**: 看板组 T1（真实 Vault 启动验收）已完成

**步骤**:
1. 确保 LifeOS 已启动并指向 `~/Vault_OS`
2. 在灵光 App 上执行一次语音闪念采集
3. 观察 LifeOS Dashboard：
   - [ ] _Inbox 提醒横幅计数实时 +1
   - [ ] 新笔记出现在时间线视图
   - [ ] 点击可查看完整内容
   - [ ] Frontmatter 字段在看板中正确解析（type、dimension、status、tags 等）
4. 在 LifeOS 看板上对该笔记执行操作：
   - [ ] 修改 status 为 `done`，确认 Vault 文件同步更新
   - [ ] 追加备注，确认 Vault 文件内容追加

**验收标准**: 灵光采集 → LifeOS 实时展示 → 看板操作写回 Vault，全链路畅通

---

### T3: Frontmatter 一致性抽检 [P1]

**目标**: 确保灵光生成的文件 100% 符合协议

**方法**:
- 收集 T1 中生成的所有测试文件
- 逐个对照 `LifeOnline/protocols/frontmatter.md` 检查
- 重点关注：
  - [ ] `dimension` 值是否为 `_inbox`（灵光端不做分类）
  - [ ] `source` 值是否为 `lingguang`
  - [ ] `created` 格式是否为 `YYYY-MM-DDTHH:mm`（不含秒）
  - [ ] `date` 格式是否为 `YYYY-MM-DD`
  - [ ] `tags` 是否为数组格式 `[tag1, tag2]`，不带 `#`
  - [ ] 无多余的非协议字段

**如发现不一致**:
- 记录到 `LingGuangCatcher/ISSUES.md`
- 标注严重程度（P0 阻塞 / P1 需修复 / P2 建议优化）
- 通知架构组

**验收标准**: 所有文件通过协议一致性检查，或已记录问题并有修复计划

---

### T4: Phase 3 预研 — Prompt 优化方向评估 [P2]

**目标**: 为 Phase 3 的 Prompt 优化做前期调研

**调研内容**:
- [ ] 收集当前 AI 整理的典型输出样本（语音、视觉、链接各 3-5 个）
- [ ] 评估当前 Prompt 的不足之处：
  - 标签提取准确性如何？
  - 内容整理的结构化程度如何？
  - 是否有信息丢失或过度加工？
- [ ] 初步整理优化方向，形成简要报告

**产出**: `LingGuangCatcher/docs/prompt-optimization-research.md`

**注意**: 此任务为预研性质，不阻塞 Phase 1.5 验收

---

## 协议参考

- Frontmatter 协议: `LifeOnline/protocols/frontmatter.md`
- 文件命名规范: `LifeOnline/protocols/naming.md`
- 八维度定义: `LifeOnline/protocols/dimensions.md`
- 系统架构: `LifeOnline/architecture/system.md`

## 完成后

- 更新 `LifeOnline/components/status.md` 中灵光 App 的状态
- 将 T1 测试文件保留在 `Vault_OS/_Inbox/` 中作为联调数据
- 通知架构组验收结果
