# 当前轮：测试运行态稳定性优先，先收 server 单例/环境变量导致的回归抖动

## 进展
- [x] 先按 README / `vision/00-权威基线` / `vision/01-当前进度` / `CLAUDE.md` / 现有 `tasks/todo.md` 重新判断本轮是否还值得继续推进
- [x] 结论：值得继续，但优先级应落在 `LifeOS/packages/server` 测试基座稳定性，而不是继续扩业务面
- [x] 复核三个已知失败点的价值与可验证性：两项 accept websocket 超时 + 一项 execution-status 过滤偶发 `EADDRINUSE`
- [x] 先做最小复现：
  - 三个目标用例分别单跑，均稳定通过
  - `test/reintegrationApi.test.ts` 整文件运行，`43/43` 通过
- [x] 由此确认：当前问题更像是**全量运行时的跨文件共享状态串扰**，而不是这三个用例自身的业务 contract 已坏
- [x] 收束 root cause：
  - `packages/server` 测试大量依赖 `createTestEnv()` 写入 `process.env.{VAULT_PATH,DB_PATH,PORT,LIFEOS_CONFIG_PATH}`
  - `src/index.ts` 的 `startServer()/stopServer()`、watcher、websocket、scheduler 都是**进程级单例**
  - 一旦测试文件并发运行，就会出现“别的测试改了 env / 抢了 server 生命周期 / 切走了配置路径”的情况，表现为 websocket 事件等不到、以及端口占用类噪音
- [x] 已做本轮最小根因修复：
  - 将 `LifeOS/packages/server/package.json` 的测试命令改为 `node --import tsx --test --test-concurrency=1 test/**/*.test.ts`
  - 目的不是加等待，而是让当前这套基于进程级单例的 server 测试在 runner 层避免并发互踩

## 验证
- [x] 单跑：
  - `cd "/home/xionglei/LifeOnline/LifeOS/packages/server" && node --import tsx --test --test-name-pattern "reintegration accept websocket updates stay aligned with follow-up pending filters for grouped settings refresh" test/reintegrationApi.test.ts`
  - 结果：通过
- [x] 单跑：
  - `cd "/home/xionglei/LifeOnline/LifeOS/packages/server" && node --import tsx --test --test-name-pattern "reintegration accept emits reintegration-record-updated websocket event aligned with follow-up lists" test/reintegrationApi.test.ts`
  - 结果：通过
- [x] 单跑：
  - `cd "/home/xionglei/LifeOnline/LifeOS/packages/server" && node --import tsx --test --test-name-pattern "execution-status filter stays aligned when grouped actions converge to the same dispatched state" test/reintegrationApi.test.ts`
  - 结果：通过
- [x] 扩大一层：
  - `cd "/home/xionglei/LifeOnline/LifeOS/packages/server" && node --import tsx --test test/reintegrationApi.test.ts`
  - 结果：`43/43` 通过
- [x] 扩大到当前最小必要全量：
  - `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter server test`
  - 结果：`198/198` 通过

## 当前判断
- 当前最有价值的收口不是继续改 websocket 用例本身，而是先承认并约束现状：这套 server 测试尚未具备“跨文件并发共享进程也能完全隔离”的能力。
- 在没有把 `startServer()` 重构成真正可多实例、且不再依赖全局 env 之前，runner 串行是当前最干净、最可验证、最小破坏的稳定性修复。
- 三个已知失败点目前都更像是该根因的症状，不再优先判定为业务逻辑缺口。

## 未完成项
- 还没扩大到 `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" check`
- 还没把 `createTestEnv()` + `startServer()` 的进程级全局依赖改造成真正实例级隔离
- 还没确认 `LifeOS/packages/server/config.json` 的本地修改是否为本轮必须保留内容

## 下一步建议
1. 在当前串行化稳定基线下，再决定是否需要重跑 `pnpm --dir "/home/xionglei/LifeOnline/LifeOS" check`
2. 后续若还要进一步提升速度/并行度，方向应是：
   - 把 server lifecycle 从进程级单例改成可显式创建/销毁的实例
   - 让测试不再依赖共享 `process.env`
   - 把 websocket / watcher / scheduler 初始化收进实例边界
3. 若未来再次出现端口冲突，不要先怀疑业务逻辑，优先排查并发测试是否又引入了共享运行态

---
最近更新：2026-03-24 03:14 Asia/Shanghai
