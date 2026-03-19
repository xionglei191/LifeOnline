# 组件状态总览

*更新: 2026-03-19*

## 当前组件矩阵

| 组件 | 当前角色 | 主路径 / 主机 | 当前状态 | 参考文档 |
|------|-----------|----------------|----------|----------|
| LingGuangCatcher | 输入端 | `LifeOnline/LingGuangCatcher` | ✅ 可用 | [LingGuangCatcher README](../LingGuangCatcher/README.md) |
| Vault_OS | 主数据源 | `/home/xionglei/Vault_OS` on `192.168.31.246` | ✅ 使用中 | [LifeOS 当前总结](../LifeOS/SUMMARY.md) |
| OpenClaw | 外部执行器 | `192.168.31.246` / `~/.openclaw` | ✅ 按需调用 | [系统架构](../architecture/system.md) |
| LifeOS | 控制核心 + Web 控制台 | `/home/xionglei/LifeOnline/LifeOS` | ✅ 可用 | [LifeOS README](../LifeOS/README.md) |

## 当前统一边界

- LifeOS backend 是当前控制核心
- OpenClaw 只在 LifeOS 明确发起任务时被调用
- Vault 是唯一事实源
- worker task 是统一自动化执行单元
- 更具体的运行基线见 [LifeOS 当前总结](../LifeOS/SUMMARY.md)

## 维护规则

- 这里仅保留当前角色、路径、状态三类信息
- 详细架构看 [architecture/system.md](../architecture/system.md)
- 运行基线看 [LifeOS/SUMMARY.md](../LifeOS/SUMMARY.md)
- 不再在此记录 phase 历史、问题修复过程或测试报告
