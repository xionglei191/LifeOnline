# 当前轮：NoteDetail PR6 promotion 主路径治理可见性补面

## 进展
- [x] 识别主路径 `NoteDetail` 虽然已能看到 promotion outputs，但仍看不到 source note 上对应的 promotion soul action 治理状态，用户无法在主路径判断“待治理 / 待派发 / 已执行”卡在何处。
- [x] 在 `NoteDetail` 补上当前 note 的 promotion soul actions 摘要与列表，并与 reintegration/projection 同 scope 收敛。
- [x] 补 focused 回归，锁定当前 note action 可见性与 websocket 刷新后的状态更新。
- [ ] 跑 focused web 验证并视情况直接提交。

---
