# 当前轮：测试运行态稳定性已验证，先冻结串行基线并避免误把本地配置噪音当主线推进

## 进展
- [x] 先按 README / `vision/00-权威基线` / `vision/01-当前进度` / `CLAUDE.md` / 现有 `tasks/todo.md` 重新判断本轮是否还值得继续推进
- [x] 结论：**本轮仍值得继续，但不值得重复造轮子**；仓库里刚完成了一轮有价值的 server 测试稳定性修复，当前最合理动作是验证它是否真稳定，并把状态收口清楚
- [x] 复核最近推进链：
  - 最近两次关键提交分别是 `d075c3d fix: repair all test failures (11 → 0 when run individually)` 与 `9e7c5c3 fix: serialize server tests around shared lifecycle state`
  - 说明本轮主线已经从“补业务面”切到“先把治理/回流相关 server 测试基座跑稳”
- [x] 复核当前脏树，确认这轮 server 侧仍有两个未提交改动需要区分：
  - `LifeOS/packages/server/src/index.ts`：给 CLI 直启场景补 keepalive，防止 Node v25 在无 ref handle 情况下提前退出
  - `LifeOS/packages/server/config.json`：本地开发配置回写为 `mock-vault:3000`
- [x] 当前判断：
  - `index.ts` 改动**可能与当前运行环境兼容性有关**，但还没进入这轮主线的最小必要验证集
  - `config.json` 改动明显更像**本地环境噪音/开发态配置**，不应被写成项目主线成果
- [x] 已对上一轮“测试串行化修复”做真实复核，而不是只看提交说明

## 验证
- [x] `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server test`
  - 结果：完整跑通，`198/198` 通过
  - 价值判断：说明 `--test-concurrency=1` 这一最小修复确实把跨文件共享运行态互踩先收住了，不是只在单测粒度看起来没问题
- [x] 重点失败簇再次被全量覆盖通过：
  - reintegration accept websocket updates stay aligned with follow-up pending filters
  - reintegration accept emits reintegration-record-updated websocket event aligned with follow-up lists
  - dispatch response worker task stays aligned with websocket and follow-up worker task list
- [x] `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" check`
  - 结果：完整跑通（build + server test + smoke 全绿）
  - smoke 结论：`✓ Smoke check passed`
  - 已知环境提示：Node 版本为 `v25.8.1`，项目声明 engine 为 `>=20 <21`，因此运行中持续出现 engine warning，但本轮未构成实际失败

## 当前判断
- 当前这轮**不需要再重复做一遍“找 root cause”**：最近提交已经把核心判断收得比较准——`packages/server` 测试依赖进程级单例（server lifecycle / watcher / websocket / scheduler / process.env），并发跑时天然容易互踩。
- 在这套运行态还没被改成真正实例级隔离前，runner 串行化是当前**最小、最稳、最少副作用**的止血方案。
- 当前不宜把 `config.json` 的本地开发态改动混进正式成果描述；它更像本机方便启动的落地配置，不是联合认知体主线推进。
- 当前也不宜贸然继续扩 PR4/PR5/PR6 业务面，因为测试基线刚稳定下来，继续扩面很容易把“刚收住的基座”重新搅浑。

## 未完成项
- `LifeOS/packages/server/src/index.ts` 的 keepalive 改动还没被单独判定为：
  - 是这轮必须保留的运行时兼容性修复，还是
  - 仅服务当前 Node v25 / 本机直启方式的局部 workaround
- `LifeOS/packages/server/config.json` 仍是未提交的本地配置改动，需要在正式提交前明确排除或单独处理
- `createTestEnv()` + `startServer()` + watcher/websocket/scheduler 的进程级全局依赖还没被真正改造成实例级隔离；当前只是先用 runner 串行把测试稳定性收住

## 下一步建议
1. 现在已经具备提交“测试串行化稳定性修复”这条主线的条件
2. 提交前先做一次脏树清理判断：
   - `config.json` 默认不应混入主线提交
   - `index.ts` keepalive 只有在确认它是可复现、可解释、对当前运行基线有帮助的兼容性修复时才建议一起提交
3. 下一轮若继续推进，优先级应是：
   - 先决定是否要把 `index.ts` keepalive 收束为正式兼容性修复
   - 再看是否值得进入“server lifecycle 实例化 / 测试隔离重构”这条更深的基础设施线
   - 暂不建议立刻回到表层页面或低价值 polish
4. 后续若要真正提升并行能力，正确方向不是再堆等待时间，而是：
   - 把 server lifecycle 改成可显式创建/销毁的实例
   - 把测试对 `process.env` 的依赖收进实例边界
   - 让 websocket / watcher / scheduler 不再共享进程级单例

---
最近更新：2026-03-24 06:46 Asia/Shanghai
