# 当前轮：NoteDetail promotion projection source-id 收口

## 进展
- [x] 识别 `NoteDetail` 的 promotion projection 主路径仍在本地只按 `action.sourceNoteId === 当前 note` 二次过滤，和 shared/server 已定义的 soul-action source filter 归一化语义存在漂移。
- [x] 改为让 `NoteDetail` 同时接受通过 `sourceReintegrationId` 命中当前 note 的 soul action，避免 legacy `reint:` 身份链路下把有效 projection action 错误过滤掉。
- [x] 跑 focused web 验证并确认通过：`pnpm --dir /home/xionglei/LifeOnline/LifeOS --filter web test -- src/components/NoteDetail.test.ts src/api/client.test.ts`

## 结果
- `NoteDetail` 的 projection action 收口现在优先对齐当前 note 的 reintegration source 集，而不是把 server 已命中的 action 再次误杀在前端。
- 新增回归已锁住 legacy reintegration identity 下的主路径投射展示，继续沿新的 contract / fact-source gap 扫描即可。

---
