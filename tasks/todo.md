# 当前轮：Dashboard today todos priority ordering 收口

## 进展
- [x] 确认 `LifeOS/packages/server/src/api/handlers.ts` 的 dashboard `todayTodos` 仍按 `priority DESC` 做字符串排序；对于 shared `high / medium / low` 语义，这会让首页主路径存在把 `medium` / `low` 排到 `high` 前面的真实风险。
- [x] 在 `LifeOS/packages/server/src/api/handlers.ts` 把 today todos 排序改成显式语义优先级（high > medium > low > fallback），并保留同优先级下 `created ASC` 的稳定次序。
- [x] 在 `LifeOS/packages/server/test/configLifecycle.test.ts` 增加 focused API 回归，锁定 `/api/dashboard` 的 `todayTodos` 会按 shared priority 语义顺序返回，而不是按字符串偶然顺序。
- [x] 跑 focused 验证：新增断言 `dashboard today todos sort by semantic priority before created time` 已通过；但 `test/configLifecycle.test.ts` 整命令仍被既有失败 `updating config treats equivalent vault paths as unchanged after normalization` 拉红。

## 结果
- dashboard 首页 today todos 现在会把真正更重要的 high priority 任务放在前面，减少首页主路径对优先级的误导。
- server 输出顺序与 shared priority 语义一致，避免 web 再各自兜底或重排同一事实。

## 下一步建议
- 下一轮优先看 dimension hero 是否仍有 canonical fact 被本地重算覆盖，例如直接投射 server `health_score` 而不是在 web 端重复推导。

---
