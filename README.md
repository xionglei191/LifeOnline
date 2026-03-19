# LifeOnline

LifeOnline 是当前总仓库，统一承载两个业务子项目：

- `LifeOS/`：控制核心，负责索引、任务、调度、写回与 Web 控制台
- `LingGuangCatcher/`：Android 端输入应用，负责采集灵感与外部信息

## 当前部署现实

- `LifeOS` backend 是当前控制核心
- `LingGuangCatcher` 是输入端
- 运行基线与主机/路径信息统一维护在 [LifeOS 当前总结](LifeOS/SUMMARY.md)
- 当前这台新电脑主要用于开发、测试和代码同步

## 当前保留的主文档

- [仓库入口](README.md)
- [系统架构](architecture/system.md)
- [数据流](architecture/data-flow.md)
- [Frontmatter 协议](protocols/frontmatter.md)
- [命名协议](protocols/naming.md)
- [维度协议](protocols/dimensions.md)
- [架构决策记录](decisions/adr.md)
- [LifeOS README](LifeOS/README.md)
- [LifeOS 当前总结](LifeOS/SUMMARY.md)
- [LingGuangCatcher README](LingGuangCatcher/README.md)
- [Syncthing 运行说明](docs/SYNCTHING_SETUP.md)

除以上文档外，原则上不长期保留 phase/task/test/migration/devlog 类文档。

## 仓库结构

```text
LifeOnline/
  LifeOS/
  LingGuangCatcher/
  architecture/
  protocols/
  decisions/
  components/
  docs/
```

## 开发入口

### LifeOS

```bash
cd LifeOS
nvm use
pnpm install --frozen-lockfile
pnpm check
pnpm dev
```

### LingGuangCatcher

```bash
cd LingGuangCatcher
./gradlew assembleDebug
```

## 文档规范

### 长期保留的文档类型
- README
- architecture docs
- protocol/spec docs
- ADR
- 当前 runbook / ops guide
- 当前 summary / status

### 原则上不长期保留的文档类型
- phase 计划
- task 任务书
- 测试结果报告
- 单次修复记录
- issue 过程记录
- migration 过程日志
- integration log
- devlog

### 新文档创建规则
新增文档前必须能回答：
1. 它是否解决长期稳定问题？
2. 为什么不能直接补到现有 README / architecture / protocol / ADR 中？
3. 谁维护它？
4. 什么时候删？

如果回答不清楚，就不应该新建文档。

## 运行边界

- 不把主 Vault 迁移到新电脑；新电脑只承担开发与代码同步职责
- `.claude/` 保持各机器本地独立，不做跨机器同步
- 具体运行路径、主 Vault 和端口信息统一以 [LifeOS 当前总结](LifeOS/SUMMARY.md) 为准
