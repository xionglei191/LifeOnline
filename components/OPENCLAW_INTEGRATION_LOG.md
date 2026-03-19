# OpenClaw 集成对接记录

*创建时间: 2026-03-17*

---

## Phase 2: OpenClaw 接入 ✅ 已完成

**完成日期**: 2026-03-17

### 实施内容

1. **L1: _Inbox 自动分类归档**
   - 实现文件: `lifeonline_worker.py`
   - 命令: `scan-inbox`
   - 功能: 扫描 `_Inbox/` 中的文件，通过 AI 分类后移动到对应维度目录

2. **L2: 行动项提取**
   - 命令: `scan-inbox`（集成在分类流程中）
   - 功能: 从笔记中提取行动项，生成任务文件到对应维度

3. **L3: 日报/周报自动生成**
   - 命令: `daily-report` / `weekly-report`
   - 功能: 汇总当天/本周笔记，生成报告到 `_Daily/` 和 `_Weekly/`

4. **L4: 审批机制 + 自动执行**
   - 命令: `auto-exec`
   - 配置文件: `auto_sources.json`
   - 功能:
     - 网页爬取并写入 Vault
     - 定期提醒任务生成
     - 超期 _Inbox 归档
     - 高风险操作（批量移动、删除文件、修改 sensitive）需要审批

5. **定时任务配置**
   - crontab 配置:
     ```
     */15 * * * * cd /home/xionglei/LifeOnline/components && python3 lifeonline_worker.py scan-inbox
     0 23 * * * cd /home/xionglei/LifeOnline/components && python3 lifeonline_worker.py daily-report
     30 23 * * 0 cd /home/xionglei/LifeOnline/components && python3 lifeonline_worker.py weekly-report
     0 */6 * * * cd /home/xionglei/LifeOnline/components && python3 lifeonline_worker.py auto-exec
     ```

### 关键问题与解决

**问题 1: AI 模型配置**
- 初始方案: 使用外部 Claude API
- 用户反馈: "OpenClaw的AI模型就用他本身已经配置好的就行，不需要额外新增新的模型"
- 解决方案: 改用 OpenClaw 内置模型 `openclaw agent --session-id lifeonline-worker --json`

**问题 2: 审批文件被自动分类**
- 现象: 审批文件生成时带 `dimension: growth`，被 scan-inbox 移走
- 解决方案:
  - 审批文件改用 `dimension: _inbox`
  - scan-inbox 跳过 `openclaw_approval_*.md` 文件

### 验收结果

- ✅ L1/L2 分类归档和行动项提取正常工作
- ✅ L3 日报/周报生成成功
- ✅ L4 审批机制验证通过（批量移动、删除、修改 sensitive）
- ✅ 定时任务稳定运行
- ✅ 日志体系完整（`~/.openclaw/logs/lifeonline/`）

---

## Phase A: 技能路由与迁移能力 ✅ 已完成

**完成日期**: 2026-03-17

### 需求背景

1. **技能列表整理与自动化执行**:
   - 整理 OpenClaw 当前具备的所有技能
   - 建立技能-审批映射机制
   - 当用户任务中出现技能关键词时，自动生成审批请求
   - 审批通过后按序列自动执行

2. **指令固化与系统迁移**:
   - 当前 LifeOnline 的所有配置如何持久化
   - 用户迁移系统时如何打包和转移配置

### OpenClaw 技能列表

**A. Vault 文件处理**
- 读取/解析 frontmatter
- `_Inbox` 自动分类归档
- 行动项提取并生成任务文件
- 日报/周报生成
- 超期 `_Inbox` 兜底归档

**B. 自动执行**
- 网页抓取并写入指定维度
- 定期提醒任务生成
- 审批单生成、审批状态轮询、超时取消

**C. 风险操作（已纳入审批）**
- 批量移动（超期归档批量场景）
- 删除文件
- 修改 `privacy: sensitive` 文件

**D. 调度与日志**
- cron 定时触发（scan/auto-exec/report）
- `lifeonline.log` / `error.log` / `exec.log` 全链路记录

### 实施内容

#### 1. 技能路由器与任务编排 ✅

**新增文件**:
- `/home/xionglei/LifeOnline/components/task_router.py`
- `/home/xionglei/LifeOnline/components/skill_map.json`

**已实现能力**:
- 可配置关键词 → 技能映射（`skill_map.json`）
- 从用户文本生成结构化任务计划（JSON）
- 可直接生成审批单（`--submit`）
- 审批单 action 使用：`execute_task_plan`
- 审批文件写入 `_Inbox/openclaw_approval_*.md`，`dimension: _inbox`

**示例**:
```bash
python3 task_router.py plan --text "爬取这个网页并归档到学习维度，同时提醒我复盘" --url "https://docs.openclaw.ai" --submit
```

输出包含:
- `plan.steps`（web_scrape / archive_to_dimension / create_reminder）
- `approvalFile`（审批文件路径）

#### 2. 审批后自动执行 ✅

**改造文件**:
- `/home/xionglei/LifeOnline/components/lifeonline_worker.py`

**新增能力**:
- 新增执行器：`execute_task_plan(plan)`
- 审批处理 `process_approvals()` 扩展支持：
  - `execute_task_plan`
  - `archive_old_inbox` / `delete_files` / `modify_sensitive`（保留）
- 按步骤顺序执行，单步失败即中断
- 每步写入 `exec.log`（start/ok/failed/aborted）

**日志验证**:
`~/.openclaw/logs/lifeonline/exec.log` 中记录:
- `task_plan start steps=3`
- `task_plan_step 1:web_scrape start/ok`
- `task_plan_step 2:archive_to_dimension start/ok`
- `task_plan_step 3:create_reminder start/ok`
- `task_plan completed`
- `approval ... executed`

#### 3. 迁移脚本 ✅

**新增文件**:
- `/home/xionglei/LifeOnline/components/lifeonline_migrate.py`
- `/home/xionglei/LifeOnline/README_MIGRATION.md`

**已实现命令**:

导出:
```bash
python3 lifeonline_migrate.py export --out <tar.gz> --with-logs
```

导入:
```bash
python3 lifeonline_migrate.py import --archive <tar.gz>
```

可选不覆盖 crontab:
```bash
--no-crontab
```

**导出包内容**:
- `components/lifeonline_worker.py`
- `components/task_router.py`
- `components/auto_sources.json`
- `components/skill_map.json`
- `README_MIGRATION.md`
- `crontab_lifeonline.txt`
- `manifest.json`
- （可选）`logs_lifeonline/*`

**需要持久化的核心对象**:
- 代码与配置: `lifeonline_worker.py`, `auto_sources.json`, `task_router.py`, `skill_map.json`
- 调度: 用户 crontab（含 LifeOnline 任务）
- 运行日志与状态（可选）: `~/.openclaw/logs/lifeonline/`
- 业务数据: `/home/xionglei/Vault_OS/`（最关键）

### Phase A.1: 小增强 ✅

**完成日期**: 2026-03-17

**增强内容**:

1. **--dry-run 参数**:
   - 只生成计划，不提交审批
   - 即使同时传了 `--submit` 也以 dry-run 为准

2. **--require-url-for-scrape 校验**:
   - 如果任务包含爬取但没有 URL，直接报错退出（退出码 2）
   - 避免无效审批进入流程

**测试结果**:
- ✅ dry-run 模式不生成审批文件
- ✅ 缺少 URL 时正确报错
- ✅ 提供 URL 后可正常提交审批

### 验收结果

- ✅ `py_compile` 通过（worker/task_router/migrate）
- ✅ task_router 生成计划与审批单成功
- ✅ 审批通过后 task plan 自动顺序执行成功
- ✅ exec.log 全链路记录成功
- ✅ migrate export/import 成功（含归档内容校验）
- ✅ dry-run 和 URL 校验功能正常

---

## 后续计划

### Phase B（增强，待定）

1. 语义判定 - 避免关键词误触发
2. 任务回滚 - 失败步骤补偿机制
3. 版本校验 - manifest 兼容性检查
4. 迁移操作手册文档化

---

---

## 2026-03-17 - Phase B 增强完成

**需求**:
- 语义判定（避免关键词误触发）
- 任务回滚机制（失败自动回滚）
- 版本校验与兼容性检查

**实施内容**:

### 1. 语义判定层
- 在 `task_router.py` 中新增语义门控
- 关键词命中后，AI 二次判定是否为可执行指令
- 置信度低于阈值（默认 0.7）则拒绝生成审批
- 新增 `semantic_gate.log` 记录所有判定（pass/reject）

### 2. 任务回滚机制
- 在 `lifeonline_worker.py` 的 `execute_task_plan()` 增加 checkpoint/rollback 栈
- 每步成功后记录可回滚数据
- 任一步失败时逆序回滚已执行步骤
- 支持回滚：web_scrape、create_reminder、archive_to_dimension、delete_file、modify_sensitive

### 3. 版本校验
- `lifeonline_migrate.py` 增加版本规范（toolVersion、schemaVersion、compat）
- import 时执行兼容检查，主版本不兼容直接报错
- `README_MIGRATION.md` 补充版本兼容说明

### 4. Phase B.1 增强
- 审批单增加语义判定信息（semantic_confidence、semantic_reason、semantic_threshold）
- Frontmatter 和正文都展示语义门控审计信息

### 5. 语义门控分析工具
- 新增 `semantic_report.py` 分析工具
- 支持基础统计、置信度分析、拦截理由分析、阈值建议
- 支持时间范围查询（最近 N 天或指定日期范围）

**涉及文件**:
- `/home/xionglei/LifeOnline/components/task_router.py`
- `/home/xionglei/LifeOnline/components/lifeonline_worker.py`
- `/home/xionglei/LifeOnline/components/lifeonline_migrate.py`
- `/home/xionglei/LifeOnline/components/semantic_report.py`
- `/home/xionglei/LifeOnline/README_MIGRATION.md`

**验收结果**:
- ✅ 语义判定能正确区分"学习讨论"和"执行指令"
- ✅ 回滚机制能正确清理已执行步骤的副作用
- ✅ 版本校验能正确拦截不兼容版本
- ✅ 审批单包含完整的语义判定信息
- ✅ 分析工具能生成完整的统计报告

---

## 2026-03-17 - "小熊同学"主动式 AI 管家

**需求**:
- 用户在笔记中呼唤"小熊同学"时，OpenClaw 主动识别并执行任务
- 信息不清楚时通过 WhatsApp 主动提问
- 用户回复后自动补全参数并继续执行

**实施内容**:

### 1. 触发词配置
- 创建 `trigger_aliases.json`
- 支持多个别名：小熊同学、小熊、熊同学、bear
- 支持大小写不敏感

### 2. scan-inbox 增强
- 在 scan 流程中增加触发词检测
- 检测到触发词后提取命令文本
- 调用 task_router 解析命令

### 3. 智能分流
- 信息完整 → 直接生成审批单
- 信息不清楚 → 通过 WhatsApp 主动提问 + 创建 pending query
- 新增 `pending_queries.json` 管理待补充上下文队列

### 4. 回复闭环
- 用户通过 `小熊同学 回复 q_xxx: <补充信息>` 回复
- 系统关联 pending_query_id
- 合并原命令 + 补充信息
- 重新调用 task_router 生成审批

### 5. 审计追踪
- 新增 `query_followup.log` 记录提问-回复-补全链路
- `exec.log` 记录完整流程（bear_trigger、whatsapp_question、bear_reply）

**涉及文件**:
- `/home/xionglei/LifeOnline/components/trigger_aliases.json`（新增）
- `/home/xionglei/LifeOnline/components/pending_queries.json`（新增）
- `/home/xionglei/LifeOnline/components/lifeonline_worker.py`（修改）
- `~/.openclaw/logs/lifeonline/query_followup.log`（新增）

**验收结果**:
- ✅ 触发词检测成功
- ✅ 命令信息不完整时创建 pending query
- ✅ 用户回复后成功关联并生成审批单
- ✅ 完整流程记录到日志

**使用示例**:
```markdown
小熊同学，帮我爬取这个网页并归档到学习维度。
```
如果缺少 URL，OpenClaw 会通过 WhatsApp 提问，用户回复后自动继续执行。

---

## 2026-03-17 - 审批格式迁移（双写策略）

**需求**:
- 看板组完成 Phase 5.1，数据格式有变更
- 需要迁移到新格式：approval_operation 替代 approval_action
- 新增 approval_scope 字段描述影响范围

**实施内容**:

### 1. 双写策略
- 同时写入 approval_operation 和 approval_action（兼容新旧系统）
- 新增 approval_scope 字段（如"执行2步任务计划"）
- 审批完成后同时更新 approval_status 和 status: done

### 2. 修改文件
- `lifeonline_worker.py` - write_approval() 函数改造
- `task_router.py` - write_approval_for_plan() 函数改造
- `README_MIGRATION.md` - 更新审批单格式说明

### 3. 新格式示例
```yaml
---
approval_status: pending
approval_operation: execute_task_plan  # 新字段
approval_action: execute_task_plan     # 旧字段（兼容）
approval_risk: medium
approval_scope: 执行2步任务计划        # 新字段
task_name: 任务名称
task_description: 任务详细描述
expected_result: 预期结果
semantic_confidence: 0.8234
semantic_reason: 判定理由
semantic_threshold: 0.7
---
```

**涉及文件**:
- `/home/xionglei/LifeOnline/components/lifeonline_worker.py`
- `/home/xionglei/LifeOnline/components/task_router.py`
- `/home/xionglei/LifeOnline/README_MIGRATION.md`

**验收结果**:
- ✅ 新格式审批单生成成功（包含双写字段）
- ✅ 旧格式兼容性验证通过
- ✅ 测试文件：`openclaw_approval_2026-03-17_205750_137706.md`

**兼容性说明**:
- 前端优先读取 approval_operation，缺失则回退 approval_action
- approval_scope 为可选字段，旧格式无此字段也能正常显示
- 历史旧格式审批单仍然可以正常处理

---

## 2026-03-17 - 审批单人性化改进

**需求**:
- 审批单缺少人性化表述，用户难以理解任务内容
- 需要增加任务名称、任务内容、预期结果等字段

**实施内容**:

1. **改造 lifeonline_worker.py**:
   - 增强 `write_approval()` 函数
   - Frontmatter 新增字段：`task_name`, `task_description`, `expected_result`
   - 正文新增"任务信息"区块

2. **改造 task_router.py**:
   - `write_approval_for_plan()` 同步改造
   - 正文展示任务信息 + 执行风险信息
   - 保留技术载荷供审计/自动执行使用

**新审批单格式示例**:
```markdown
---
task_name: 爬取这个网页并归档到学习维度
task_description: 根据用户指令生成自动任务计划，共 2 步：web_scrape -> archive_to_dimension
expected_result: 审批通过后按步骤自动执行；任一步失败则中断并记录日志。
approval_status: pending
approval_action: execute_task_plan
approval_risk: medium
---

## OpenClaw 审批请求

### 任务信息
- 任务名称: 爬取这个网页并归档到学习维度
- 任务内容: 根据用户指令生成自动任务计划，共 2 步
- 预期结果: 审批通过后按步骤自动执行

### 执行与风险
- 操作类型: execute_task_plan
- 风险等级: medium
- 影响范围: 步骤数=2
```

**涉及文件**:
- `/home/xionglei/LifeOnline/components/lifeonline_worker.py`
- `/home/xionglei/LifeOnline/components/task_router.py`

**验收结果**:
- ✅ 审批单包含人性化字段
- ✅ Frontmatter 和正文都展示任务信息
- ✅ 保留技术载荷供自动执行使用
- ✅ 新生成的审批单都采用新格式

**说明**:
- 旧审批单是历史文件，不会自动回写新字段
- 新生成的审批单都会采用新格式

---

## 对接记录模板

### [日期] - [任务名称]

**需求**:
-

**实施内容**:
-

**涉及文件**:
-

**验收结果**:
-

**问题与解决**:
-

---

*本文档持续更新，记录所有与 OpenClaw 的对接工作*
