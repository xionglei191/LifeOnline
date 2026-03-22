# Lessons

## 2026-03-20
- 不要把阶段汇报、plan handoff、回合切换当成自然停点。
  - 纠正规则：除非用户明确要求停止，或遇到真正高风险外部动作，否则完成一轮后必须直接进入下一轮执行。
  - 具体执行：对用户中途发言最多一句确认，然后立刻继续；不要为了“汇报一下刚做完什么”而暂停主线。

## 2026-03-23
- 对 LifeOS server 做 focused test 时，不要用 `pnpm --filter server test -- --runInBand <file>` 试图只跑单测。
  - 当前 `packages/server` 的 `test` script 是 `node --import tsx --test test/**/*.test.ts`，额外参数不会可靠地把范围缩到单文件，反而会把整套 server tests 拉起。
  - 这会把不相关的既有失败项也跑出来，并可能让测试把 `packages/server/config.json` 改成临时路径。
  - 正确做法：直接在 `LifeOS/packages/server` 下运行 `node --import tsx --test test/reintegrationApi.test.ts` 这类精确命令；跑完顺手确认 `config.json` 没有测试副作用残留。
