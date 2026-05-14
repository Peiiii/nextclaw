# v0.18.47-runtime-settings-i18n

## 迭代完成说明

本次迭代修复设置页中“路由与运行时”页面的国际化缺口。根因是运行时配置页同时存在两类英文来源：组件里的硬编码英文文案，以及直接使用后端 `uiHints` 英文 label/help 覆盖前端语言环境。

已完成：

- 运行时配置页固定文案统一走前端 `t()`。
- 移除运行时配置页对后端英文 `uiHints` 展示文案的依赖。
- 补齐运行时入口、私聊范围、对端类型、保存校验错误等中英文文案。
- 补齐运行时服务控制卡片里由 API 返回的英文 `message`、`managementHint` 与 `reasonIfUnavailable` 的中文展示映射。
- 将 `runtime-control.ts` 重命名为合规的 `runtime-control-labels.utils.ts`，避免继续触达旧命名债务。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/ui test -- src/features/system-status/components/runtime-control-card.test.tsx src/features/system-status/pages/runtime-config-page.test.tsx`
  - 结果：通过，覆盖英文保存路径、中文运行时设置文案展示、服务控制卡片 API 英文消息本地化。
- `pnpm --filter @nextclaw/ui tsc`
  - 结果：通过。
- `pnpm --filter @nextclaw/ui exec eslint <本次触达文件>`
  - 结果：0 error，保留 5 个既有 props destructuring warning。
- `pnpm --filter @nextclaw/ui lint`
  - 结果：失败，阻塞来自既有无关文件，包括 chat、doc-browser、旧测试与 shared api types 的 lint error。
- `pnpm lint:new-code:governance`
  - 结果：通过。
- `pnpm check:governance-backlog-ratchet`
  - 结果：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths <本次触达文件>`
  - 结果：通过；提示 `i18n/index.ts` 仍是既有超预算文件，但本次没有继续增长。

## 发布/部署方式

不涉及发布、部署、数据库 migration 或远程服务变更。若后续需要把这次 UI 修复发给用户，按现有 NextClaw 前端/NPM 发布流程统一发布。

## 用户/产品视角的验收步骤

1. 将 UI 语言切换为中文。
2. 打开设置里的“路由与运行时”页面。
3. 检查运行时入口、启用开关、配置 JSON、添加/删除运行时入口、私聊范围和对端类型等文案。
4. 点击保存前构造缺失运行时入口 ID、重复入口 ID 或非对象 JSON 配置等错误。
5. 验收标准：中文界面不再展示这些运行时设置区域的英文固定文案或英文校验错误。

## 可维护性总结汇总

本次使用 `post-edit-maintainability-review` 做收尾复核。代码增减为总计 `+306 / -311 / -5`，非测试代码 `+279 / -296 / -17`。正向减债动作是删除运行时页对后端英文 `uiHints` 的展示依赖，并把新增运行时文案放入更明确的运行时 i18n 分片；不是通过压缩代码行数达成。

遗留债务：`packages/nextclaw-ui/src/shared/lib/i18n/index.ts` 仍超过文件预算，但本次没有增长，后续应继续把大型混合 i18n 表拆到领域分片。

## NPM 包发布记录

不涉及 NPM 包发布。
