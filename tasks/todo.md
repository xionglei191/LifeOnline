# 当前轮：Search/List 事实源一致性补面

## 进展
- [x] 识别搜索主路径 hero copy 仍从松散字段 `result.query` 渲染，未显式绑定服务端返回的 `filters.q` 合同；同时 `NoteList` 主列表仍回退展示 `file_name`，没有优先使用共享 `note.title`。
- [x] 在 shared/server/web 对齐 `SearchResult.filters.q` 合同，让 `SearchView` 主路径文案直接渲染服务端显式 filters。
- [x] 在 `NoteList` 主列表优先展示共享 `note.title`，仅在缺失时回退 `file_name`。
- [x] 补 web focused 回归，锁定 search view 新合同与 main list 标题事实源。
- [ ] 跑 focused server/web 验证并视情况直接提交。

---
