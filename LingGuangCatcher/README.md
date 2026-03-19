# LingGuangCatcher

LingGuangCatcher 是 LifeOnline 中的 Android 输入端，负责把语音、图片、链接等信息快速沉淀为符合协议的 Markdown，并写入主 Vault。

## 当前定位

- 角色：输入端
- 仓库路径：`LifeOnline/LingGuangCatcher`
- 输出目标：`Vault_OS/_Inbox/`
- 与主系统关系：只负责采集与落盘，不承担主编排职责

## 当前能力

- 语音闪念
- 拍照与多模态信息提取
- 链接/网页内容采集
- 离线队列与后台重试
- 通过 SAF 写入 Obsidian Vault
- Frontmatter 对齐 LifeOS 协议
- `_Inbox` 目录规范与命名规范对齐

## 开发环境

### 前置要求
- Android Studio
- JDK 17
- Android SDK 34

### 构建

```bash
./gradlew assembleDebug
```

## 文档入口

- 仓库级架构基线：[`../README.md`](../README.md)
- 协议：[`../protocols/frontmatter.md`](../protocols/frontmatter.md)
- 命名规范：[`../protocols/naming.md`](../protocols/naming.md)
- LifeOS 当前基线：[`../LifeOS/SUMMARY.md`](../LifeOS/SUMMARY.md)

## 约束

- 输入端只负责采集、整理和写入 `_Inbox`
- 主 Vault 以 `192.168.31.246:/home/xionglei/Vault_OS` 为准
- 不在此文档记录 phase 历史、临时修复过程或开发日志
