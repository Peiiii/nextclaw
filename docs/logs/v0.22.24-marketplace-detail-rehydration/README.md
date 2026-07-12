# v0.22.24-marketplace-detail-rehydration

## 迭代完成说明

本次修复 Marketplace skill 详情页在浏览器刷新后只显示“详情不可用”的问题。

根因是详情正文只保存在前端 Zustand 内存 store 中，而文档浏览器会保留当前详情 URL。刷新后 URL 仍然指向原 skill，内存 entry 却已丢失，渲染层此前没有按 URL 重新取数的路径。

修复后，详情渲染器会从 `skill:<key>` / `skill-preview:<key>` URL 解析 skill key，在 entry 缺失时通过 Marketplace API 重新加载正文，并明确展示 loading、ready 和 error 状态。加载状态直接由“entry 尚未恢复”表达，只在请求完成或失败时写 store，避免一次 `loading` 写入触发 effect cleanup、把自身请求提前取消。该修复落在详情文档 owner 内，没有引入第二套路由或持久化缓存。

## 测试/验证/验收方式

- 定向测试 3 项通过：store 为空但详情 URL 存在时，先显示 skeleton，再调用 `fetchMarketplaceSkillContent` 恢复标题和正文。
- `@nextclaw/ui` TypeScript 检查、完整 ESLint、156 个测试文件与 658 项测试通过；仅保留一个 HEAD 既有的测试文件行数 warning。
- maintainability guard 无 error，`lint:new-code:governance` 与 backlog ratchet 通过。

## 发布/部署方式

本次未执行发布或部署。

这是用户可见的 UI 修复，已新增 `.changeset/marketplace-detail-refresh.md`，后续随 `@nextclaw/ui` patch 统一发布。

## 用户/产品视角的验收步骤

1. 在 Marketplace 打开任意 skill 详情。
2. 保持详情 tab 打开并刷新浏览器。
3. 预期详情区短暂显示加载骨架，随后恢复 skill 标题与 Markdown 正文。
4. 模拟请求失败时，预期显示明确的不可用说明，而不是空白内容。

## 可维护性总结汇总

- 复用了现有 Marketplace API 与 detail store，未新增平行缓存或额外 service。
- URL 继续作为可恢复身份，store 继续作为当前渲染状态，owner 边界保持清晰。
- 外部取数同步收敛到 `hooks/use-marketplace-detail-doc-entry.ts`；主展示组件从 515 行回落到 446 行，重新进入文件预算。
- 异步请求具有卸载取消保护，避免旧请求回写已离开的详情视图，同时不会被自身 store 写入误取消。
- 未新增 service、manager 或 barrel；hook 是当前 feature 内私有 owner，没有进入 `shared/`。

## NPM 包发布记录

本次未发布 NPM 包。

- `@nextclaw/ui`：patch，Marketplace skill 详情刷新恢复；待后续统一发布。
