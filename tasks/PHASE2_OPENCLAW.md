# OpenClaw 组任务书 — Phase 2 智能管家接入

*签发: 架构组 | 日期: 2026-03-17 | 阶段: Phase 2*

---

## 背景

Phase 0-1.5 已完成协议对齐、Vault_OS 建立和真机联调。当前 `Vault_OS/_Inbox/` 中已有灵光 App 采集的真实数据（9+ 条笔记），等待 OpenClaw 自动整理。Phase 2 的目标是让 OpenClaw 成为系统的智能管家，自动完成分类归档、行动项提取、日报周报生成等任务。

---

## 任务清单

### T1: L1 能力 — _Inbox 自动分类归档 [P0]

**目标**: OpenClaw 监控 `_Inbox/`，自动将笔记分类到八维度目录

**实现要求**:

1. **监控机制**:
   - 使用文件系统监听（如 Python `watchdog`）或定时扫描（每 5 分钟）
   - 监控路径: `/home/xionglei/Vault_OS/_Inbox/`
   - 触发条件: 检测到 `.md` 文件且 Frontmatter 中 `dimension: _inbox`

2. **分类逻辑**:
   - 读取文件内容（Frontmatter + Markdown 正文）
   - 调用 AI API（Claude/Gemini/OpenAI）分析内容
   - 根据八维度定义（参见 `LifeOnline/protocols/dimensions.md`）判断最合适的维度
   - Prompt 参考:
     ```
     你是 LifeOnline 系统的分类助手。根据以下笔记内容，判断它属于八维度中的哪一个：

     八维度定义：
     - health（健康）: 运动、睡眠、饮食、体检、心理
     - career（事业）: 工作任务、项目、职业规划、技能
     - finance（财务）: 收支、投资、资产、财务目标
     - learning（学习）: 阅读、课程、知识、认知升级
     - relationship（关系）: 家人、朋友、人脉、社交
     - life（生活）: 家务、购物、出行、居住
     - hobby（兴趣）: 爱好、创作、娱乐、旅行
     - growth（成长）: 目标、习惯、里程碑、反思

     笔记内容：
     {content}

     请只返回维度的英文 key（如 health），不要解释。
     ```

3. **归档操作**:
   - 修改文件 Frontmatter 中的 `dimension` 字段（从 `_inbox` 改为目标维度）
   - 移动文件到对应维度目录（如 `Vault_OS/健康/`）
   - 在文件末尾追加归档记录:
     ```markdown
     ---
     *[OpenClaw] 已从 _Inbox 归档到 {维度} 维度 ({timestamp})*
     ```
   - 更新 `updated` 字段为当前时间

4. **错误处理**:
   - 如果 AI 返回无效维度，默认归档到 `growth`（成长）
   - 如果文件格式不符合协议，记录到日志但不处理
   - 如果移动文件失败，保留在 `_Inbox/` 并记录错误

**验收标准**:
- 手动在 `_Inbox/` 放入测试文件，OpenClaw 在 5 分钟内自动分类并移动
- 分类准确率 ≥ 80%（抽检 10 个文件）
- LifeOS Dashboard 实时感知文件移动（_Inbox 计数 -1，目标维度计数 +1）

---

### T2: L2 能力 — 行动项提取 + 自动创建任务文件 [P0]

**目标**: 从笔记中提取待办事项，自动创建独立的任务文件

**实现要求**:

1. **触发时机**:
   - 在 T1 分类归档时，同步分析笔记内容
   - 或作为独立任务，定期扫描所有维度目录中 `type: note` 的文件

2. **提取逻辑**:
   - 调用 AI API 分析笔记，识别明确的行动项
   - Prompt 参考:
     ```
     从以下笔记中提取所有明确的待办事项（action items）。

     要求：
     - 只提取需要执行的具体行动，不要提取想法或观察
     - 每个行动项用一行描述，格式: "- {行动描述}"
     - 如果有截止时间，标注在行动后: "- {行动描述} (due: YYYY-MM-DD)"
     - 如果没有行动项，返回 "无"

     笔记内容：
     {content}
     ```

3. **任务文件创建**:
   - 为每个提取的行动项创建独立的 `.md` 文件
   - 文件名: `openclaw_task_{YYYY-MM-DD}_{HHmmss}.md`
   - Frontmatter:
     ```yaml
     type: task
     dimension: {继承原笔记的维度}
     status: pending
     priority: medium
     privacy: {继承原笔记的隐私级别}
     date: {当前日期}
     due: {如果 AI 提取到截止时间}
     tags: [自动提取]
     source: openclaw
     created: {当前时间}
     ```
   - 正文:
     ```markdown
     ## {行动描述}

     **来源笔记**: [[{原笔记文件名}]]

     ---
     *[OpenClaw] 自动提取自笔记 ({timestamp})*
     ```

4. **原笔记标记**:
   - 在原笔记末尾追加:
     ```markdown
     ---
     *[OpenClaw] 已提取 {N} 个行动项 ({timestamp})*
     ```

**验收标准**:
- 从包含待办事项的笔记中成功提取并创建任务文件
- 任务文件 Frontmatter 符合协议
- LifeOS Dashboard 能正确展示新创建的任务

---

### T3: L3 能力 — 日报自动生成 [P1]

**目标**: 每天晚上 23:00 自动生成当日总结报告

**实现要求**:

1. **定时触发**:
   - 使用 cron 或 OpenClaw 内置调度器
   - 执行时间: 每天 23:00

2. **数据收集**:
   - 扫描当天所有维度目录中 `date: {今天}` 的文件
   - 统计:
     - 新增笔记数（按维度分组）
     - 完成任务数（`status: done`）
     - 未完成任务数（`status: pending` 或 `in_progress`）
     - 重要里程碑（`type: milestone`）

3. **AI 生成总结**:
   - 调用 AI API 生成自然语言总结
   - Prompt 参考:
     ```
     根据以下数据，生成今天的生活总结（200 字以内）：

     今日数据：
     - 健康: {N} 条记录
     - 事业: {N} 条记录
     - ...
     - 完成任务: {N} 个
     - 未完成任务: {N} 个
     - 里程碑: {列表}

     要求：
     - 突出今天的亮点和成就
     - 简洁、积极、有温度
     - 不要流水账
     ```

4. **日报文件**:
   - 文件名: `openclaw_review_{YYYY-MM-DD}_230000.md`
   - 保存路径: `Vault_OS/_Daily/`
   - Frontmatter:
     ```yaml
     type: review
     dimension: growth
     status: done
     privacy: private
     date: {今天}
     tags: [日报, 自动生成]
     source: openclaw
     created: {当前时间}
     ```
   - 正文:
     ```markdown
     # {YYYY-MM-DD} 日报

     {AI 生成的总结}

     ## 今日数据

     | 维度 | 新增 | 完成 |
     |------|------|------|
     | 健康 | {N} | {N} |
     | 事业 | {N} | {N} |
     | ... | ... | ... |

     ## 今日里程碑

     {列表}

     ---
     *[OpenClaw] 自动生成 ({timestamp})*
     ```

**验收标准**:
- 23:00 后在 `_Daily/` 中出现当日日报文件
- 日报内容准确反映当天数据
- LifeOS Dashboard 能展示日报

---

### T4: L3 能力 — 周报自动生成 [P1]

**目标**: 每周日晚上 23:30 自动生成本周总结报告

**实现要求**:

与 T3 类似，但数据范围为本周（周一到周日），保存到 `Vault_OS/_Weekly/`，文件名格式 `openclaw_review_{YYYY-WW}_233000.md`（WW 为周数）。

**验收标准**:
- 每周日 23:30 后在 `_Weekly/` 中出现本周周报文件
- 周报内容准确反映本周数据

---

### T5: 定时任务配置 [P0]

**目标**: 配置 OpenClaw 的定时任务调度

**要求**:
- T1 _Inbox 监控: 每 5 分钟扫描一次，或使用文件系统监听实时触发
- T3 日报生成: 每天 23:00
- T4 周报生成: 每周日 23:30

**实现方式**:
- 使用 OpenClaw 内置的 cron 功能（如果支持）
- 或使用系统 crontab
- 或编写独立的调度脚本

**验收标准**:
- 定时任务稳定运行，不遗漏
- 日志记录每次执行结果

---

### T6: 与 LifeOS AI 功能边界划分 [P1]

**目标**: 明确 OpenClaw 和 LifeOS 的 AI 功能分工

**当前状态**:
- LifeOS 有手动触发的 AI 整理功能（分类 + 行动项提取）
- OpenClaw 将提供自动化的同类功能

**建议方案**:
- **OpenClaw**: 主力，自动化处理，无需用户干预
- **LifeOS**: 备用，手动触发，用于 OpenClaw 分类错误时的人工修正

**需要确认**:
- LifeOS 的 AI 功能是否保留？
- 如果保留，如何避免重复处理？
- 是否需要在 LifeOS 中添加 "撤销 OpenClaw 分类" 功能？

**产出**: 在 `LifeOnline/decisions/` 中创建 ADR-006，记录决策

---

## 技术参考

### Vault_OS 路径
```
/home/xionglei/Vault_OS/
```

### 协议文档
- Frontmatter 协议: `LifeOnline/protocols/frontmatter.md`
- 八维度定义: `LifeOnline/protocols/dimensions.md`
- 文件命名规范: `LifeOnline/protocols/naming.md`

### OpenClaw 配置
- 配置目录: `~/.openclaw/`
- 可执行文件: `/home/linuxbrew/.linuxbrew/bin/openclaw`

### AI API
- 优先使用 Claude API（与 LifeOS 保持一致）
- 备选: Gemini API、OpenAI API

### 文件操作注意事项
- 修改 Frontmatter 时保持 YAML 格式正确
- 移动文件后，Syncthing 会自动同步到手机端
- LifeOS 的 chokidar 会自动感知文件变更并更新索引

---

## 完成后

- 更新 `LifeOnline/components/status.md` 中 OpenClaw 的状态
- 通知架构组验收结果
- 准备进入 Phase 4 系统联调
