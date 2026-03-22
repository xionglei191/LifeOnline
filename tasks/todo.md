# 当前轮：server test config isolation 收口

## 进展
- [x] 识别 server 测试通过改写仓库 `packages/server/config.json` 运行，遇到中断会污染 working tree 的真实风险。
- [x] 为 configManager 补可注入 config path，并让 test helper 自动创建临时 config 文件。
- [x] 把 reintegration/config lifecycle 测试切到临时 config，不再改写仓库配置文件。
- [x] 跑 focused server 验证并确认通过。
- [ ] 如果验证稳定，清理并提交这轮改动。

## 备注
- 这一轮目标是根治测试副作用，不再依赖手动恢复仓库 `config.json`。

---
