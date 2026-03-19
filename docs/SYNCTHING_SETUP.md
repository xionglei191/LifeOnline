# Syncthing 配置指引 — LifeOnline 多设备同步

*更新: 2026-03-17 | 版本: 1.0*

---

## 概述

Syncthing 是 LifeOnline 系统的多设备同步方案，负责在手机（灵光 App）和电脑（LifeOS + OpenClaw）之间实时同步 Vault_OS 数据。

**同步架构**:
```
手机 (灵光 App)  ←→  Syncthing  ←→  电脑 (Vault_OS)
     ↓                                    ↓
  SAF 写入                          LifeOS 索引
  _Inbox/                           OpenClaw 处理
```

---

## 电脑端配置 ✅ 已完成

### 安装信息

| 项目 | 值 |
|------|-----|
| **版本** | Syncthing v2.0.15 "Hafnium Hornet" |
| **安装路径** | `~/.local/bin/syncthing` |
| **配置目录** | `~/.local/state/syncthing/` |
| **Web UI** | http://localhost:8384 |
| **服务状态** | systemd 用户服务，开机自启 |

### 设备 ID

```
UPW4EJB-URGJFXY-4C5KSRC-MD2DFTI-LOMCA3R-G3JI4ED-2BOYABI-GAF2PQ5
```

**用途**: 手机端添加远程设备时需要输入此 ID

### 共享文件夹

| 文件夹 ID | 标签 | 路径 | 状态 |
|-----------|------|------|------|
| `vault-os` | Vault_OS | `/home/xionglei/Vault_OS` | ✅ 已添加 |

### 管理命令

```bash
# 查看服务状态
systemctl --user status syncthing

# 重启服务
systemctl --user restart syncthing

# 查看日志
journalctl --user -u syncthing -f

# 打开 Web UI
xdg-open http://localhost:8384
```

---

## 手机端配置 📱

### 前置条件

- ✅ 已安装 Syncthing Android（从 Google Play 或 F-Droid）
- ✅ 已安装灵光 App V1.46
- ✅ 灵光 App 已通过 SAF 授权访问某个目录（作为 Vault_OS 输出路径）

### 配置步骤

#### 1. 添加电脑端设备

1. 打开 Syncthing Android
2. 点击右上角 **+** → **添加设备**
3. 扫描二维码或手动输入设备 ID:
   ```
   UPW4EJB-URGJFXY-4C5KSRC-MD2DFTI-LOMCA3R-G3JI4ED-2BOYABI-GAF2PQ5
   ```
4. 设备名称填写: `电脑端 (Ubuntu)`
5. 点击 **保存**

#### 2. 添加共享文件夹

1. 在 Syncthing Android 主界面，点击右上角 **+** → **添加文件夹**
2. 填写配置:
   - **文件夹标签**: `Vault_OS`
   - **文件夹 ID**: `vault-os` （必须与电脑端一致）
   - **文件夹路径**: 选择灵光 App SAF 授权的目录
     - 通常是 `/storage/emulated/0/Documents/Vault_OS` 或类似路径
     - 确保此路径与灵光 App 配置中的 Obsidian 输出路径一致
3. 点击 **共享** 标签页
4. 勾选 `电脑端 (Ubuntu)`
5. 点击 **保存**

#### 3. 电脑端接受共享

1. 电脑端 Syncthing 会收到手机端的设备连接请求
2. 打开 http://localhost:8384
3. 点击 **添加设备** 通知，确认添加手机设备
4. 同样会收到 `vault-os` 文件夹共享请求，点击 **添加**
5. 确认文件夹路径为 `/home/xionglei/Vault_OS`，点击 **保存**

#### 4. 验证同步

1. 在灵光 App 上执行一次语音闪念采集
2. 确认文件写入手机本地 Vault_OS/_Inbox/
3. 观察 Syncthing Android 界面，应显示 "正在同步"
4. 等待同步完成（通常 1-5 秒）
5. 在电脑端检查:
   ```bash
   ls -lh ~/Vault_OS/_Inbox/
   ```
6. 确认新文件已出现

---

## 灵光 App 配置检查

### SAF 路径配置

确保灵光 App 的 Obsidian 输出路径与 Syncthing 手机端的共享文件夹路径一致。

**检查方法**:
1. 打开灵光 App
2. 进入 **设置** → **Obsidian 集成**
3. 查看 **Vault 路径**，应显示类似:
   ```
   /storage/emulated/0/Documents/Vault_OS
   ```
4. 此路径必须与 Syncthing Android 中 `vault-os` 文件夹的路径完全一致

**如果不一致**:
- 方案 A: 修改灵光 App 的 SAF 路径，重新授权到 Syncthing 的共享目录
- 方案 B: 修改 Syncthing 的共享文件夹路径，指向灵光 App 当前的输出目录

---

## 同步策略

### 文件类型

Syncthing 会同步 Vault_OS 下的所有文件:
- `.md` Markdown 文件（笔记内容）
- `.jpg` `.png` 图片文件（灵光拍照）
- `.obsidian/` Obsidian 配置（可选）

### 冲突处理

如果电脑端和手机端同时修改同一文件，Syncthing 会:
1. 保留最新版本
2. 将冲突版本重命名为 `filename.sync-conflict-{timestamp}.md`
3. 不会丢失任何数据

**建议**:
- 灵光 App 只写入 `_Inbox/`，不修改已归档文件
- 电脑端（LifeOS + OpenClaw）负责整理和归档
- 避免双端同时编辑同一文件

### 性能优化

**手机端**:
- 建议在 Syncthing Android 设置中启用 **仅 Wi-Fi 同步**（节省流量）
- 或允许移动数据，但设置流量限制

**电脑端**:
- Syncthing 默认配置已优化，无需调整

---

## 故障排查

### 问题 1: 手机端无法连接电脑端

**症状**: Syncthing Android 显示 "未连接" 或 "离线"

**排查**:
1. 确认手机和电脑在同一局域网（同一 Wi-Fi）
2. 检查电脑端 Syncthing 服务是否运行:
   ```bash
   systemctl --user status syncthing
   ```
3. 检查防火墙是否阻止 Syncthing 端口（默认 22000）
4. 尝试重启双端 Syncthing

### 问题 2: 文件同步延迟

**症状**: 灵光写入后，电脑端 5 秒以上才出现文件

**排查**:
1. 检查 Syncthing Android 是否在后台被系统杀死
   - 进入手机 **设置** → **应用** → **Syncthing**
   - 关闭 **电池优化**，允许后台运行
2. 检查网络质量（Wi-Fi 信号强度）
3. 查看 Syncthing 日志，确认无错误

### 问题 3: 文件未同步

**症状**: 灵光写入后，Syncthing 显示 "已同步"，但电脑端无文件

**排查**:
1. 确认双端文件夹 ID 一致（都是 `vault-os`）
2. 确认双端路径正确:
   - 手机: 灵光 App SAF 授权路径
   - 电脑: `/home/xionglei/Vault_OS`
3. 检查文件权限，确保 Syncthing 有读写权限
4. 尝试在手机端手动创建测试文件:
   ```
   Vault_OS/_Inbox/test.md
   ```
   观察是否同步到电脑

---

## 安全建议

### 局域网同步

当前配置为局域网同步（手机和电脑在同一 Wi-Fi）:
- ✅ 数据不经过云端，隐私安全
- ✅ 同步速度快
- ⚠️ 需要双端在同一网络

### 远程同步（可选）

如需在外网访问（如手机在外，电脑在家），需配置:
1. 电脑端开启 Syncthing 中继服务器
2. 或配置端口转发（需路由器支持）
3. 或使用 Syncthing Discovery 服务器

**不推荐**: 远程同步会增加延迟和安全风险，LifeOnline 设计为本地优先系统。

---

## 验收清单

配置完成后，逐项验证:

- [ ] 电脑端 Syncthing 服务运行正常
- [ ] 手机端 Syncthing 显示 "已连接"
- [ ] 双端设备互相识别
- [ ] `vault-os` 文件夹双端共享成功
- [ ] 灵光 App 写入测试文件，电脑端 5 秒内出现
- [ ] LifeOS Dashboard 实时感知新文件（_Inbox 计数 +1）
- [ ] 电脑端修改文件，手机端同步更新

**全部通过后，Phase 1.5 灵光组 T2 联调可以开始。**

---

## 参考资料

- Syncthing 官方文档: https://docs.syncthing.net/
- Syncthing Android: https://github.com/syncthing/syncthing-android
- LifeOnline 架构文档: `LifeOnline/architecture/system.md`
