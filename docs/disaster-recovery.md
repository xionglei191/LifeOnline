# LifeOS 灾难恢复手册

## 1. SQLite 数据库损坏

### 检测
```bash
sqlite3 data/lifeos.db "PRAGMA integrity_check;"
# 预期输出: ok
```

### 恢复步骤
1. **停止服务**: `pm2 stop lifeos` 或终止 dev server
2. **备份损坏文件**: `cp data/lifeos.db data/lifeos.db.corrupted`
3. **尝试修复**: `sqlite3 data/lifeos.db ".recover" | sqlite3 data/lifeos-recovered.db`
4. **替换**: `mv data/lifeos-recovered.db data/lifeos.db`
5. **重索引**: 启动服务后执行 `POST /api/index` 重建 notes 表
6. **验证**: `curl http://localhost:3000/api/health`

### 预防
- 数据库 WAL 模式 (`PRAGMA journal_mode=WAL`) 已启用
- `schema_version` 表确保迁移幂等

---

## 2. R2 远端存储恢复

### 场景: 本地 Vault 丢失，需从 R2 回拉

1. **确认 R2 凭证**: 检查 `.env` 中 `R2_ACCOUNT_ID`, `R2_ACCESS_KEY`, `R2_SECRET_KEY`
2. **使用 rclone 回拉**:
   ```bash
   rclone sync r2:vault-backup /path/to/local/vault --progress
   ```
3. **重索引**: `POST /api/index`

---

## 3. File Watcher 大量并发写入

### 症状
- 日志中出现 `queue overflow` 或 `EMFILE` (too many open files)
- 部分笔记未被索引

### 处置
1. **检查队列状态**: `GET /api/index/status`
2. **提高文件打开数限制**: `ulimit -n 65536`
3. **手动触发全量重索引**: `POST /api/index`
4. **确认**: 比对 `notes` 表记录数与 Vault 目录下 `.md` 文件数

---

## 4. AI API 服务中断

### 症状
- Agent DAG 执行全部失败
- `/api/ai-usage` 显示近日 token 为 0

### 处置
1. **切换 Provider**: 通过 `PATCH /api/ai/provider` 更换 `baseUrl` 和 `model`
2. **确认配置**: `GET /api/ai/provider`
3. **测试连通性**: `POST /api/ai/provider/test`

---

## 5. 定期巡检清单

| 项目 | 命令 | 频率 |
|------|------|------|
| DB 完整性 | `PRAGMA integrity_check` | 每日 |
| 索引一致性 | 比对 notes 数 vs .md 文件数 | 每日 |
| AI 用量 | `GET /api/ai-usage?days=7` | 每周 |
| 磁盘空间 | `df -h` | 每周 |
| R2 同步 | `rclone check` | 每周 |
