# Syncthing 配置指引

*更新: 2026-03-19*

## 作用

Syncthing 负责在手机与 `192.168.31.246:/home/xionglei/Vault_OS` 之间同步主 Vault 数据。

它只负责文件同步，不负责主编排；LifeOS 负责索引与自动化，OpenClaw 仅在需要外部执行时被 LifeOS 调用。

## 当前基线

- 主 Vault：`/home/xionglei/Vault_OS`
- 运行/数据主机：`192.168.31.246`
- 电脑端 Syncthing Web UI：`http://localhost:8384`
- 共享文件夹 ID：`vault-os`

## 电脑端管理命令

```bash
systemctl --user status syncthing
systemctl --user restart syncthing
journalctl --user -u syncthing -f
xdg-open http://localhost:8384
```

## 手机端接入要点

1. 在 Syncthing Android 中添加电脑端设备
2. 共享同一个文件夹 ID：`vault-os`
3. 手机端共享目录应与灵光 App SAF 授权目录一致
4. 电脑端共享路径固定为 `/home/xionglei/Vault_OS`

## 验证

1. 在灵光 App 写入一条新内容到 `_Inbox`
2. 等待 Syncthing 同步
3. 在电脑端确认 `/home/xionglei/Vault_OS/_Inbox/` 出现对应文件
4. 再由 LifeOS 侧确认索引可见

## 约束

- 灵光 App 只负责写入 `_Inbox`
- 避免双端同时编辑同一文件
- 若发生冲突，Syncthing 会生成 `.sync-conflict` 文件而不是直接覆盖
- 当前建议以局域网同步为主，不在这里展开远程同步方案
- 本文档只保留当前运行说明，不再记录详细安装过程和历史排障流水
