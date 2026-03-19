# Phase 4 系统联调任务书

*签发: 架构组 | 日期: 2026-03-17 | 阶段: Phase 4*

---

## 联调链路

### 链路 1: 灵光 → OpenClaw → LifeOS（采集到展示全自动）
### 链路 2: LifeOS 操作 → Vault 写回
### 链路 3: OpenClaw 自动生成 → LifeOS 展示

---

## 验收用例

### TC-1: 全链路自动化（链路 1）
1. 灵光 App 采集一条语音闪念
2. Syncthing 同步到电脑端 _Inbox
3. OpenClaw 5 分钟内自动分类归档
4. LifeOS Dashboard 实时展示归档后的笔记

### TC-2: 看板操作写回（链路 2）
1. 在 LifeOS 上将一条笔记 status 改为 done
2. 确认 Vault 文件 Frontmatter 同步更新
3. 在 LifeOS 上追加备注
4. 确认 Vault 文件正文追加

### TC-3: OpenClaw 生成感知（链路 3）
1. 手动触发 OpenClaw 日报生成
2. 确认 _Daily 中出现日报文件
3. LifeOS Dashboard 实时展示日报
