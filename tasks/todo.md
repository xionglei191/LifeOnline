# 当前轮：note append/delete contract 补面

## 进展
- [x] 识别 `appendNote` / `deleteNote` 仍只返回 `void`，但 server 端两条写回已稳定返回 `success: true`；web client 还没有锁住这层 success contract。
- [x] 改为让 note append/delete 显式消费成功响应，并补 web client boundary 回归锁定两条 success 分支。
- [x] 跑 focused web 验证并确认通过：`pnpm --dir /home/xionglei/LifeOnline/LifeOS --filter web test -- src/api/client.test.ts`

## 结果
- `appendNote` 与 `deleteNote` 现在显式返回成功响应对象，不再静默吞掉 note 写回成功 contract。
- web client boundary test 已锁住两条 note 写回 success 分支，可继续扫描下一处 contract gap。

---
