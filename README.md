# LifeOnline

LifeOnline 现在是总仓库，统一承载两个业务子项目：

- `LifeOS/`：Web 看板、索引、任务与 AI 设置中心
- `LingGuangCatcher/`：Android 端灵感采集应用

## 仓库结构

```text
LifeOnline/
  LifeOS/
  LingGuangCatcher/
```

## 开发入口

### LifeOS

```bash
cd LifeOS
pnpm install
pnpm dev
```

### LingGuangCatcher

```bash
cd LingGuangCatcher
./gradlew assembleDebug
```

## 迁移说明

- 本次保留的是两个子项目的当前代码快照，不保留原子仓库 git 历史。
- 旧根仓库内容已移到仓库外备份目录：`/home/xionglei/LifeOnline_root_backup_20260319`
- `Vault_OS` 仍继续使用现有绝对路径 `~/Vault_OS` / `/home/xionglei/Vault_OS`
