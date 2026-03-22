# 当前轮：PR6 projection default visibility 收口

## 进展
- [x] 识别 projection 面板默认跟随 `pending_review` reintegration filter，导致真实已落地 PR6 projections 被隐藏的主路径缺口。
- [x] 改为按 accepted + 当前已规划 promotion 的 reintegration ids 计算 projection scope，不再被 review filter 误伤。
- [x] accept / manual plan 后立即刷新 projection 面板，并补回归锁定默认可见性。
- [x] 跑 focused web 验证并确认通过。
- [ ] 如果验证稳定，清理并提交这轮改动。

---
