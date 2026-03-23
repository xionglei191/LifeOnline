# 当前轮：SearchView 主路径中文化收口

## 进展
- [x] 识别新的主路径 copy gap：`LifeOS/packages/web/src/views/SearchView.vue` 的 hero eyebrow 仍残留 `Search Console`，与最近几轮一级视图中文化口径不一致。
- [x] 在 `LifeOS/packages/web/src/views/SearchView.vue` 做最小文案修正：将 eyebrow 改为“语义检索台”，不改变 query 监听、结果刷新、WebSocket 回刷或详情选择逻辑。
- [x] 在 `LifeOS/packages/web/src/views/SearchView.test.ts` 补 focused 回归，锁定一级视图主路径展示新的中文文案，且不再回退到 `Search Console`。
- [x] 跑受影响 web 验证：`pnpm --dir "/home/xionglei/LifeOnline/LifeOS" --filter web test -- src/views/SearchView.test.ts`。

## 结果
- SearchView 一级视图主路径 copy 已进一步统一到当前中文产品口径。
- 本轮仍是新的用户可见主路径 copy gap 收口，没有继续深挖 grouped governance / settings 深链对称补强。

## 下一步建议
- 下一轮优先继续找新的 server/web/shared contract gap 或事实源一致性问题；如果暂时仍停留在主路径用户可见缺口，可继续检查 `LifeOS/packages/web/src/components/NoteDetail.vue` 是否还存在英文 badge、status、section 标题未对齐当前中文口径。

---
