# Phase 4 实施计划：实时索引 + 真实 Vault 连接

## Context

Phase 1-3.5 已完成（2026-03-16），系统核心功能已成型。当前使用 mock-vault 作为数据源，需要支持连接用户真实的 Obsidian Vault，并实现文件变更的实时监听。

---

## 目标

Phase 4 聚焦于让系统真正可用：

1. **实时索引** — 监听 vault 文件变更，自动更新数据库
2. **Vault 配置** — 支持用户配置自己的 vault 路径
3. **配置持久化** — 保存配置到文件或数据库
4. **Vault 验证** — 验证路径是否为有效的 vault
5. **WebSocket 通知** — 实时推送更新到前端

---

## 实施步骤

### 步骤 1：安装文件监听库

**安装 chokidar**（更稳定的文件监听库）

```bash
pnpm --filter server add chokidar
```

### 步骤 2：创建文件监听服务

**新增：`packages/server/src/watcher/fileWatcher.ts`**

功能：
- 使用 chokidar 监听 vault 目录
- 监听 .md 文件的 add/change/unlink 事件
- 触发增量索引（只处理变更的文件）
- 发送 WebSocket 通知

```typescript
import chokidar from 'chokidar';
import { indexFile, deleteFile } from '../indexer/indexer.js';

export class FileWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private vaultPath: string;

  constructor(vaultPath: string) {
    this.vaultPath = vaultPath;
  }

  start() {
    this.watcher = chokidar.watch(`${this.vaultPath}/**/*.md`, {
      ignored: /(^|[\/\\])\../,
      persistent: true,
      ignoreInitial: true,
    });

    this.watcher
      .on('add', (path) => this.handleFileAdd(path))
      .on('change', (path) => this.handleFileChange(path))
      .on('unlink', (path) => this.handleFileDelete(path));
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
    }
  }

  private async handleFileAdd(path: string) {
    console.log(`File added: ${path}`);
    await indexFile(path);
    // TODO: 发送 WebSocket 通知
  }

  private async handleFileChange(path: string) {
    console.log(`File changed: ${path}`);
    await indexFile(path);
    // TODO: 发送 WebSocket 通知
  }

  private async handleFileDelete(path: string) {
    console.log(`File deleted: ${path}`);
    await deleteFile(path);
    // TODO: 发送 WebSocket 通知
  }
}
```

### 步骤 3：重构索引服务

**修改：`packages/server/src/indexer/indexer.ts`**

将索引逻辑拆分为：
- `indexVault(vaultPath)` - 全量索引（现有功能）
- `indexFile(filePath)` - 单文件索引（新增）
- `deleteFile(filePath)` - 删除文件记录（新增）

```typescript
// 单文件索引
export async function indexFile(filePath: string): Promise<void> {
  const db = await getDb();
  const content = await fs.readFile(filePath, 'utf-8');
  const parsed = matter(content);

  // 验证 frontmatter
  // 插入或更新数据库
}

// 删除文件记录
export async function deleteFile(filePath: string): Promise<void> {
  const db = await getDb();
  db.exec(`DELETE FROM notes WHERE file_path = '${filePath}'`);
}
```

### 步骤 4：创建配置管理服务

**新增：`packages/server/src/config/configManager.ts`**

功能：
- 读取配置文件（.env 或 config.json）
- 保存配置
- 验证 vault 路径

```typescript
import fs from 'fs/promises';
import path from 'path';

interface Config {
  vaultPath: string;
  port: number;
}

const CONFIG_FILE = path.join(process.cwd(), 'config.json');

export async function loadConfig(): Promise<Config> {
  try {
    const content = await fs.readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    // 返回默认配置
    return {
      vaultPath: process.env.VAULT_PATH || '../../mock-vault',
      port: 3000,
    };
  }
}

export async function saveConfig(config: Config): Promise<void> {
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export async function validateVaultPath(vaultPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(vaultPath);
    if (!stat.isDirectory()) return false;

    // 检查是否包含 .md 文件
    const files = await fs.readdir(vaultPath);
    return files.some(f => f.endsWith('.md'));
  } catch (e) {
    return false;
  }
}
```

### 步骤 5：添加配置 API

**修改：`packages/server/src/api/handlers.ts`**

新增配置相关的 handler：

```typescript
// GET /api/config
export async function getConfig(req: Request, res: Response): Promise<void> {
  const config = await loadConfig();
  res.json(config);
}

// POST /api/config
export async function updateConfig(req: Request, res: Response): Promise<void> {
  const { vaultPath } = req.body;

  // 验证路径
  const isValid = await validateVaultPath(vaultPath);
  if (!isValid) {
    res.status(400).json({ error: 'Invalid vault path' });
    return;
  }

  // 保存配置
  await saveConfig({ vaultPath, port: 3000 });

  // 重新索引
  await indexVault(vaultPath);

  // 重启文件监听
  restartWatcher(vaultPath);

  res.json({ success: true });
}
```

**修改：`packages/server/src/api/routes.ts`**

```typescript
router.get('/config', getConfig);
router.post('/config', updateConfig);
```

### 步骤 6：集成文件监听到服务器

**修改：`packages/server/src/index.ts`**

```typescript
import { FileWatcher } from './watcher/fileWatcher.js';
import { loadConfig } from './config/configManager.js';

let watcher: FileWatcher | null = null;

async function startServer() {
  const config = await loadConfig();

  // 启动 Express 服务器
  app.listen(config.port, () => {
    console.log(`Server running on http://localhost:${config.port}`);
  });

  // 启动文件监听
  watcher = new FileWatcher(config.vaultPath);
  watcher.start();
  console.log(`Watching vault: ${config.vaultPath}`);
}

// 优雅关闭
process.on('SIGINT', () => {
  if (watcher) {
    watcher.stop();
  }
  process.exit(0);
});
```

### 步骤 7：创建配置页面

**新增：`packages/web/src/views/SettingsView.vue`**

功能：
- 显示当前 vault 路径
- 输入框修改 vault 路径
- 验证按钮（验证路径有效性）
- 保存按钮（保存配置并重新索引）
- 显示索引状态

### 步骤 8：添加配置 API 客户端

**修改：`packages/web/src/api/client.ts`**

```typescript
export interface Config {
  vaultPath: string;
  port: number;
}

export async function fetchConfig(): Promise<Config> {
  const res = await fetch(`${API_BASE}/config`);
  if (!res.ok) throw new Error('Failed to fetch config');
  return res.json();
}

export async function updateConfig(vaultPath: string): Promise<void> {
  const res = await fetch(`${API_BASE}/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vaultPath }),
  });
  if (!res.ok) throw new Error('Failed to update config');
}
```

### 步骤 9：更新导航栏

**修改：`packages/web/src/App.vue`**

在导航栏添加设置链接：

```vue
<nav>
  <router-link to="/">仪表盘</router-link>
  <router-link to="/timeline">时间线</router-link>
  <router-link to="/calendar">日历</router-link>
  <router-link to="/settings">设置</router-link>
</nav>
```

### 步骤 10：更新路由

**修改：`packages/web/src/router.ts`**

```typescript
{
  path: '/settings',
  name: 'settings',
  component: () => import('./views/SettingsView.vue')
}
```

---

## 执行顺序

1. 安装 chokidar（步骤 1）
2. 创建配置管理服务（步骤 4）
3. 重构索引服务（步骤 3）
4. 创建文件监听服务（步骤 2）
5. 添加配置 API（步骤 5）
6. 集成文件监听到服务器（步骤 6）
7. 创建配置页面（步骤 7）
8. 添加配置 API 客户端（步骤 8）
9. 更新导航栏（步骤 9）
10. 更新路由（步骤 10）
11. 端到端验证

---

## 关键文件

- `packages/server/src/watcher/fileWatcher.ts` — 文件监听服务
- `packages/server/src/config/configManager.ts` — 配置管理
- `packages/server/src/indexer/indexer.ts` — 重构索引逻辑
- `packages/server/src/api/handlers.ts` — 新增配置 API
- `packages/server/src/index.ts` — 集成文件监听
- `packages/web/src/views/SettingsView.vue` — 设置页面
- `packages/web/src/api/client.ts` — 配置 API 客户端

---

## 验证清单

- [ ] chokidar 正常安装
- [ ] 文件监听服务正常启动
- [ ] 添加文件触发索引
- [ ] 修改文件触发更新
- [ ] 删除文件触发删除
- [ ] 配置 API 正常响应
- [ ] 设置页面正常显示
- [ ] 修改 vault 路径后重新索引
- [ ] 路径验证正常工作
- [ ] 配置持久化正常

---

## 成功标准

- 用户可以在设置页面配置自己的 Obsidian Vault 路径
- 系统自动监听文件变更，实时更新数据库
- 配置保存后下次启动自动加载
- 文件监听稳定，不会遗漏变更
- 性能良好，不影响系统响应速度

---

## 技术选型

### 文件监听：chokidar
- **原因**: 比 Node.js 原生 fs.watch 更稳定
- **优势**: 跨平台兼容性好，API 简洁
- **性能**: 轻量级，资源占用低

### 配置存储：JSON 文件
- **原因**: 简单直观，易于编辑
- **位置**: 项目根目录 config.json
- **备选**: 也可以使用 .env 文件或数据库

### 增量索引
- **策略**: 只处理变更的文件，不重新索引整个 vault
- **性能**: 单文件索引 <50ms，远快于全量索引

---

## 可选增强（Phase 4.5）

如果 Phase 4 完成顺利，可以考虑：

### WebSocket 实时通知
- 使用 socket.io 或 ws 库
- 文件变更时推送通知到前端
- 前端自动刷新数据

### 多 Vault 支持
- 支持配置多个 vault
- 切换 vault 功能
- 每个 vault 独立的数据库

### 索引队列
- 使用队列处理大量文件变更
- 避免并发索引导致的性能问题
- 显示索引进度

### 错误恢复
- 文件监听异常时自动重启
- 索引失败时记录错误日志
- 提供手动重新索引功能
