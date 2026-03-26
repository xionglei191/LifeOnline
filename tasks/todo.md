# 缺陷修复计划：远程服务器没有启动

## 背景现象
用户反馈“远程服务器没有启动”。需要排查远程服务（可能是前端提到的 246 服务器）的运行状态、部署脚本或最近的代码更改是否导致了启动崩溃。

## 排查与修复步骤
- [x] **环境摸底**：排查本项目中涉及“远程服务器”的配置（如 package.json 部署脚本、服务端部署流程等）。
- [x] **日志定位**：查看服务器或部署脚本的报错日志，定位服务崩溃或无法拉起的根本原因。
- [x] **问题修复**：针对日志指出的错误（编译失败、端口占用、配置缺失等）修复问题。
- [x] **验证重启**：确认修复后，服务端可以正常部署并启动。
- [x] **教训复盘**：将本次崩溃根因与防范策略同步到 `tasks/lessons.md`。

---

# 缺陷修复计划：运维页面调用 OpenClaw 失败

## 背景现象
在“运维页面”(OpsView)发起“外部执行任务”(OpenClaw task)指令后，未能成功调用 OpenClaw 执行，需要打通指令发送到 OpenClaw 反馈结果的完整链路。

## 排查与修复步骤

### 1. 前端链路排查与修复
- [ ] **定位入口**：检查 `OpsView.vue` 中如何提交“外部执行任务”。确认表单提交时，是否正确调用了对应的后端 API 接口，Payload 格式是否合法。
- [ ] **API 适配**：检查 `packages/web/src/api/client.ts`，验证相关的网络请求配置。

### 2. 后端接收与分发排查
- [ ] **任务创建**：检查后端接收到请求后，是否成功在 SQLite `worker_tasks` 表中创建了一条 `actionType = 'openclaw_task'` 的任务记录。
- [ ] **任务防呆校验**：确保创建任务时字段齐全，无 `any` 引发的错误隐患。

### 3. OpenClaw 执行器排查与修复
- [ ] **执行引擎**：检查 `openclawExecutor.ts`。确认执行器是否正确拉起并执行了任务。
- [ ] **Client 调用**：深入检查 `openclawClient.ts`。验证对 OpenClaw 外部服务发起的 HTTP 请求格式、Endpoint 和鉴权（如 `CLAW_HOST` 等环境变量）是否正确配置。
- [ ] **回调与结果回填**：检查当 OpenClaw 完成指令后，系统如何接收反馈并将结果持久化更新到对应的任务记录。

### 4. 验证环节
- [x] 本地启动 `pnpm dev` 服务并开启日志。
- [x] 在 Web 界面触发一次测试指令，确认日志流转：Web -> Server API -> Executor -> Client -> 回收结果。
- [x] 运行 `pnpm check` (如 `tsc --noEmit`)，保证全链路类型安全无告警。

## 总结与经验沉淀
- [x] 确认完成整改后，将问题根因及防雷策略同步补充至 `tasks/lessons.md`。

### 结果复盘
- **同步/异步兼容修复**：去除了 OpenClaw Payload 中的冗余参数 `outputDimension`，避免严苛参数校验导致的 422 错误。
- **超时上限拓展**：将 `fetch` 超时从 30s 提升到 10分钟（`600000ms`），兼容耗时较长的外部推理、爬虫等长耗时任务，保障任务不会被异常终止。
- **异步回调架构 (Webhook)**：取消长轮询，改为立刻返回 `ASYNC_YIELD`。LifeOS 暴露了 `POST /api/webhooks/openclaw-callback`。
- **接口纠正与降维打击集成法**：查阅 OpenClaw 官方代码后纠正了虚假的 `/tasks/execute` 端点，对齐为原生 `POST /hooks/agent`。直接通过系统级 Prompt 指令令 OpenClaw Agent 自行使用原生 Curl/HTTP 工具回传分析结果至 LifeOS 回调端点，避免了开发繁重的专用插件。

# 机器免疫隔离计划：阻断“自激振荡”反馈循环

## 背景现象
自动化任务（如 `persist_continuity_markdown` 写入、OpenClaw 回调写入 assets）产生的文件入库时，被 `parser.ts` 强制将不认识的 `type` 回退为 `note`，导致 `postIndexPersonaTrigger.ts` 将这些机器产物误认为是用户自己写的笔记，进而**再次触发 LLM 认知分析 -> 再次生成待办/物理动作 -> 循环产生垃圾审批卡片**。

## 修复步骤

### 1. 拦截解析器的类型强制转换
- [x] 修改 `packages/server/src/indexer/parser.ts`，扩展 `VALID_VALUES.type`，增加机器文件类型（如 `continuity_insight`, `system_report`, `agent_report` 等），防止合法的隔离类型被降维成普通的 `note`。

### 2. 构建认知触发免疫门控（Immunity Gate）
- [x] 修改 `packages/server/src/soul/postIndexPersonaTrigger.ts` 的 `shouldAnalyze` 函数，追加文件路径隔离名单（忽略包含 `/assets/`, `/soul/continuity/`, `/system/` 等目录的文件）。
- [x] 在 `shouldAnalyze` 函数中追加类型隔离名单（忽略 `type` 不是普通 `note` 或带有机器标识的 `source` 的文件）。

### 3. 本地编译与拦截验证
- [x] 运行 `pnpm check` 验证代码安全。
- [x] 在 `tasks/lessons.md` 中补充关于 AI 反馈循环治理（防止 Agent 自激振荡）的高级架构教训。

# 治理监控优化计划：隐藏巨型证据日志

## 背景现象
投射分析（Projection Analysis）面板在呈现 Event Nodes和 Continuity Records时，会将巨型的原始证据 JSON 铺设在面板上，导致页面可读性极差且拉长了滚动条。

## 增量优化步骤
- [x] **隐藏默认输出**：在 `PromotionProjectionPanel.vue` 引入 `expandedEvidenceIds` 状态，改为默认隐藏，点击后展开。
- [x] **视觉层级梳理**：通过增加细微的 Toggle 按钮，提升“判定说明 (Explanation)” 的优先级位置。
