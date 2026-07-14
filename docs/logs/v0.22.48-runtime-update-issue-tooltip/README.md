# v0.22.48 Runtime Update Issue Tooltip

## 迭代完成说明

- 修复版本号旁更新异常感叹号缺少可见说明的问题。
- 根因是更新 snapshot 已包含阻塞原因、诊断信息和恢复命令，但 `RuntimeUpdateIssueIcon` 只把这些信息写入浏览器原生 `title`，没有通过产品内 tooltip 展示。
- 修前通过当前 `v0.22.3` UI 回放 `blocked` snapshot，确认 hover 1.2 秒后页面可见诊断文本仍为 0；修后使用同一 snapshot 确认完整提示可见。
- 修复落在状态展示 owner `BrandHeader`，统一复用现有 Tooltip primitive，同时删除版本号手写 hover state，没有在 API、store 或下游增加兜底路径。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/ui test -- brand-header.test.tsx`：4 个定向测试通过。
- `pnpm --filter @nextclaw/ui tsc`：通过。
- `pnpm --filter @nextclaw/ui lint`：0 error；保留 1 个与本次无关的既有 cron 复杂度 warning。
- `pnpm local:runtime`：完成当前源码构建；运行中的源码实例复用了 `http://127.0.0.1:18888` 健康监听。
- 浏览器同链路回放：hover 后 `role=tooltip` 可见，包含更新状态、根因、原始诊断和恢复命令；键盘聚焦时同一提示可见。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`：覆盖本次触达的 `BrandHeader` 源码与定向测试。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `pnpm clean:generated && pnpm check:generated-clean`：生成产物已恢复并确认干净。

## 发布/部署方式

- 本次代码与交付记录随本提交一并入库；未部署、未发布。
- 已添加 `@nextclaw/ui` patch changeset，随下一次统一 NPM 发布进入用户版本说明。

## 用户/产品视角的验收步骤

1. 让 runtime update 状态进入 `blocked` 或 `failed`。
2. 将鼠标停在版本号右侧的感叹号上，确认浮层展示异常类型、原因和可用的恢复信息。
3. 使用键盘聚焦感叹号，确认同一浮层可见且焦点状态清晰。
4. 确认感叹号附近没有额外常驻错误文案，正常状态下也不会出现异常提示。

## 可维护性总结汇总

- 已使用 `post-edit-maintainability-review` 复核；tooltip 修复删除手写 hover state 和原生 `title` 路径，复用共享 Tooltip primitive。
- 生产源码增加 34 行、删除 34 行，语义净增为 0；测试增加 17 行、删除 7 行，用真实 `role=tooltip` 行为替代原生 `title` 断言。
- `BrandHeader` 仍是状态展示 owner；未新增 service、manager、helper、barrel 或平行交互路径。

## NPM 包发布记录

- `@nextclaw/ui`：仓库当前版本 `0.15.4`；本次新增 patch changeset，尚未发布，待统一发布。
- 其它 NPM 包：本次没有直接源码变更，不涉及单独发布。
