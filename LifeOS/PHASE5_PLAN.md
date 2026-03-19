# Phase 5 实施计划：OpenClaw 集成（AI 智能化）

## 目标

引入 AI 能力，实现自动整理归档和行动项提取，让 LifeOS 从被动记录升级为主动管理。

---

## 核心能力

### L1 能力：自动整理归档

**目标**: 识别 _Inbox 中的笔记，根据内容自动分类到对应维度目录

**输入**: _Inbox 中的未分类笔记（可能缺少完整的 frontmatter）

**输出**:
- 补全 frontmatter（dimension, type, tags 等）
- 移动到对应维度目录
- 重命名文件（按日期-标题格式）

**技术方案**:
1. 使用 Claude API 分析笔记内容
2. 提取关键信息：维度、类型、标签、优先级
3. 生成完整的 frontmatter
4. 移动文件到目标目录
5. 更新数据库索引

### L2 能力：提取行动项

**目标**: 从笔记正文中识别待办事项，自动创建 task 类型文件

**输入**: 任意笔记的正文内容

**输出**:
- 识别出的待办事项列表
- 为每个待办创建独立的 task 文件
- 设置截止日期和优先级

**技术方案**:
1. 使用 Claude API 分析正文
2. 识别待办事项（"需要"、"要做"、"计划" 等关键词）
3. 提取截止日期（"明天"、"下周五"、"3月20日" 等）
4. 推断优先级（"紧急"、"重要"、"尽快" 等）
5. 创建 task 文件并索引

### L3 能力：主动建议（可选）

**目标**: 分析用户的日程和目标，给出主动建议

**输入**:
- 近期的日程安排
- 目标完成情况
- 各维度健康分数

**输出**:
- 日程密度分析（是否过载）
- 目标进展提醒
- 维度平衡建议

**技术方案**:
1. 定期分析（每日/每周）
2. 使用 Claude API 生成建议
3. 创建 note 类型文件保存建议
4. 在仪表盘显示建议卡片

---

## 技术架构

### 1. AI 服务层

**新增目录**: `packages/server/src/ai/`

**核心模块**:
- `aiClient.ts` - Claude API 客户端封装
- `classifier.ts` - 笔记分类器（L1）
- `taskExtractor.ts` - 行动项提取器（L2）
- `advisor.ts` - 主动建议生成器（L3，可选）
- `prompts.ts` - AI prompt 模板

### 2. 文件操作层

**新增目录**: `packages/server/src/vault/`

**核心模块**:
- `fileManager.ts` - 文件移动、重命名、创建
- `frontmatterBuilder.ts` - frontmatter 生成和更新
- `pathResolver.ts` - 路径解析和验证

### 3. API 层

**新增端点**:
- `POST /api/ai/classify` - 分类单个笔记
- `POST /api/ai/classify-inbox` - 批量分类 _Inbox
- `POST /api/ai/extract-tasks` - 从笔记提取行动项
- `GET /api/ai/suggestions` - 获取主动建议

### 4. 前端界面

**新增组件**:
- `AIClassifyButton` - 一键整理按钮（SettingsView）
- `TaskExtractionPanel` - 行动项提取面板（NoteDetail）
- `SuggestionCard` - 建议卡片（DashboardView）

---

## 实施步骤

### 步骤 1: 环境准备

- [ ] 安装 @anthropic-ai/sdk
- [ ] 配置 ANTHROPIC_API_KEY 环境变量
- [ ] 创建 ai/ 和 vault/ 目录结构

### 步骤 2: AI 客户端封装

- [ ] 创建 aiClient.ts
  - initAIClient() - 初始化 Claude 客户端
  - callClaude(prompt, options) - 统一调用接口
  - 错误处理和重试机制
- [ ] 创建 prompts.ts
  - CLASSIFY_PROMPT - 分类 prompt 模板
  - EXTRACT_TASKS_PROMPT - 提取行动项 prompt 模板
  - SUGGEST_PROMPT - 生成建议 prompt 模板

### 步骤 3: 文件操作层

- [ ] 创建 fileManager.ts
  - moveFile(from, to) - 移动文件
  - renameFile(oldPath, newPath) - 重命名文件
  - createFile(path, content) - 创建文件
  - 集成 FileWatcher 触发索引
- [ ] 创建 frontmatterBuilder.ts
  - buildFrontmatter(data) - 生成 frontmatter
  - updateFrontmatter(filePath, updates) - 更新 frontmatter
  - validateFrontmatter(data) - 验证 frontmatter

### 步骤 4: L1 能力 - 自动整理归档

- [ ] 创建 classifier.ts
  - classifyNote(content) - 分析笔记内容
  - 返回：dimension, type, tags, priority
- [ ] 创建 API handler: classifyNote
  - 读取笔记内容
  - 调用 classifier
  - 生成新的 frontmatter
  - 移动文件到目标目录
  - 更新数据库
- [ ] 创建 API handler: classifyInbox
  - 扫描 _Inbox 目录
  - 批量分类所有笔记
  - 返回处理结果统计
- [ ] 前端：SettingsView 添加"一键整理 Inbox"按钮

### 步骤 5: L2 能力 - 提取行动项

- [ ] 创建 taskExtractor.ts
  - extractTasks(content) - 从正文提取待办
  - 返回：tasks 数组（title, due, priority）
- [ ] 创建 API handler: extractTasks
  - 读取笔记内容
  - 调用 taskExtractor
  - 为每个 task 创建文件
  - 更新数据库
- [ ] 前端：NoteDetail 添加"提取行动项"按钮
- [ ] 前端：显示提取结果（创建了几个 task）

### 步骤 6: L3 能力 - 主动建议（可选）

- [ ] 创建 advisor.ts
  - analyzeDashboard(data) - 分析仪表盘数据
  - generateSuggestions() - 生成建议
- [ ] 创建 API handler: getSuggestions
  - 查询近期数据
  - 调用 advisor
  - 返回建议列表
- [ ] 前端：DashboardView 添加建议卡片
- [ ] 定时任务：每日生成建议（可选）

### 步骤 7: 测试和优化

- [ ] 创建测试笔记（_Inbox 中）
- [ ] 测试 L1 分类功能
- [ ] 测试 L2 行动项提取
- [ ] 测试 L3 主动建议（可选）
- [ ] 性能优化（缓存、批量处理）
- [ ] 错误处理完善

### 步骤 8: 文档更新

- [ ] 更新 DESIGN.md
- [ ] 更新 CHANGELOG.md
- [ ] 更新 SUMMARY.md
- [ ] 创建 AI 使用指南

---

## 关键文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `server/src/ai/aiClient.ts` | 新增 | Claude API 客户端 |
| `server/src/ai/classifier.ts` | 新增 | 笔记分类器 |
| `server/src/ai/taskExtractor.ts` | 新增 | 行动项提取器 |
| `server/src/ai/advisor.ts` | 新增 | 主动建议生成器 |
| `server/src/ai/prompts.ts` | 新增 | Prompt 模板 |
| `server/src/vault/fileManager.ts` | 新增 | 文件操作管理 |
| `server/src/vault/frontmatterBuilder.ts` | 新增 | Frontmatter 构建 |
| `server/src/api/handlers.ts` | 修改 | 新增 AI 相关 handler |
| `server/src/api/routes.ts` | 修改 | 新增 AI 路由 |
| `web/src/views/SettingsView.vue` | 修改 | 添加整理按钮 |
| `web/src/components/NoteDetail.vue` | 修改 | 添加提取按钮 |
| `web/src/views/DashboardView.vue` | 修改 | 添加建议卡片 |

---

## 技术决策

### 1. AI 模型选择：Claude API

**原因**:
- 强大的文本理解和生成能力
- 支持长上下文（适合分析完整笔记）
- API 稳定可靠
- 官方 SDK 支持

**替代方案**: OpenAI GPT-4, 本地 LLM（Ollama）

**权衡**: Claude API 需要网络连接和 API key，但效果最好

### 2. Prompt 设计：结构化输出

**原因**:
- 使用 JSON 格式输出，易于解析
- 明确字段定义，减少错误
- 支持批量处理

**示例**:
```typescript
const CLASSIFY_PROMPT = `
分析以下笔记内容，返回 JSON 格式的分类结果：

笔记内容：
{content}

返回格式：
{
  "dimension": "health|career|finance|learning|relationship|life|hobby|growth",
  "type": "schedule|task|note|record|milestone|review",
  "tags": ["标签1", "标签2"],
  "priority": "high|medium|low",
  "reasoning": "分类理由"
}
`;
```

### 3. 文件操作：原子性保证

**原因**:
- 文件移动/重命名可能失败
- 需要保证数据库和文件系统一致性

**实现**:
1. 先移动文件
2. 成功后更新数据库
3. 失败则回滚文件操作
4. 使用事务保证原子性

### 4. 错误处理：优雅降级

**原因**:
- AI API 可能失败（网络、配额、错误）
- 不应影响核心功能

**实现**:
- API 调用失败时返回友好错误
- 提供手动重试选项
- 记录错误日志供调试

---

## 性能考虑

### 1. API 调用成本

- Claude API 按 token 计费
- 优化 prompt 长度
- 批量处理减少调用次数
- 缓存分类结果（相同内容不重复调用）

### 2. 响应时间

- AI 调用可能需要 2-5 秒
- 使用异步处理，不阻塞 UI
- 显示加载状态和进度
- 支持后台批量处理

### 3. 并发控制

- 限制同时进行的 AI 调用数量
- 使用队列管理批量任务
- 避免 API 速率限制

---

## 安全考虑

### 1. API Key 管理

- 使用环境变量存储 API key
- 不提交到 git
- 前端不暴露 API key

### 2. 内容隐私

- 笔记内容发送到 Claude API
- 用户需要知情同意
- 提供选项禁用 AI 功能
- 敏感笔记（privacy: sensitive）不发送

### 3. 错误信息

- 不在前端显示完整的 API 错误
- 记录详细错误到服务器日志
- 用户只看到友好提示

---

## 验证清单

- [ ] Claude API 连接正常
- [ ] 分类功能正确识别维度和类型
- [ ] 文件成功移动到目标目录
- [ ] 数据库索引正确更新
- [ ] 行动项提取准确
- [ ] 创建的 task 文件格式正确
- [ ] 前端按钮和交互正常
- [ ] 错误处理优雅
- [ ] 性能可接受（<5s）
- [ ] 文档完整

---

## 预估工作量

- 步骤 1-3（基础设施）: 1 小时
- 步骤 4（L1 能力）: 2 小时
- 步骤 5（L2 能力）: 2 小时
- 步骤 6（L3 能力）: 1.5 小时（可选）
- 步骤 7-8（测试和文档）: 1.5 小时

**总计**: 约 6-8 小时

---

## 下一步

1. 确认是否有 ANTHROPIC_API_KEY
2. 开始实施步骤 1：环境准备
3. 创建 AI 服务层基础架构
