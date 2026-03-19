# LifeOnline 迁移指南（Phase A）

## 需要持久化的核心内容

- `components/lifeonline_worker.py`
- `components/task_router.py`
- `components/auto_sources.json`
- `components/skill_map.json`
- 用户 crontab（LifeOnline 定时任务）
- （可选）`~/.openclaw/logs/lifeonline/` 日志与状态
- 业务数据：`/home/xionglei/Vault_OS/`

## 导出

```bash
python3 /home/xionglei/LifeOnline/components/lifeonline_migrate.py export --with-logs
```

可指定输出路径：

```bash
python3 /home/xionglei/LifeOnline/components/lifeonline_migrate.py export --out /tmp/lifeonline_export.tar.gz --with-logs
```

## 导入

```bash
python3 /home/xionglei/LifeOnline/components/lifeonline_migrate.py import --archive /tmp/lifeonline_export.tar.gz
```

不覆盖 crontab：

```bash
python3 /home/xionglei/LifeOnline/components/lifeonline_migrate.py import --archive /tmp/lifeonline_export.tar.gz --no-crontab
```

## 版本与兼容性

- 导出包 `manifest.json` 包含：`toolVersion`、`schemaVersion`、`compat`
- 导入时会做主版本兼容检查（schema major）
- 若不兼容会中止并提示先升级迁移工具

## 审批单字段兼容策略（Phase 5.1）

采用双写策略，生成审批单时同时写入：
- 新字段：`approval_operation`
- 旧字段：`approval_action`
- 可选范围：`approval_scope`

前端优先读取 `approval_operation`，缺失时回退 `approval_action`。
历史旧审批单仍可继续处理。

## 导出包结构

- `lifeonline_export/components/*`
- `lifeonline_export/crontab_lifeonline.txt`
- `lifeonline_export/manifest.json`
- `lifeonline_export/logs_lifeonline/*`（仅 `--with-logs`）

## 审批单字段兼容策略（Phase 5.1）

当前采用双写策略：

- 新字段：`approval_operation`（推荐）
- 旧字段：`approval_action`（兼容保留）
- 可选字段：`approval_scope`（影响范围说明）

读取优先级建议：
1. `approval_operation`
2. `approval_action`

审批结束后（approved/rejected/cancelled），审批单会自动置为：
- `status: done`

## 迁移后检查

1. `python3 components/lifeonline_worker.py auto-exec`
2. `python3 components/lifeonline_worker.py scan-inbox`
3. `crontab -l` 确认定时任务存在
4. 检查日志目录 `~/.openclaw/logs/lifeonline/`
