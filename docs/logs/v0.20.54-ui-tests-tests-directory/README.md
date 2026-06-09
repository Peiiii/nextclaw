# UI 测试目录归拢

## 迭代完成说明

本次将 `packages/nextclaw-ui/src` 下的 UI 测试统一迁移到最近职责目录的 `__tests__/` 子目录，避免测试文件继续与生产实现文件平铺混杂。

- 迁移范围：`packages/nextclaw-ui/src` 下原本不在 `__tests__/` 的 `119` 个 `*.test.*` 文件。
- 迁移规则：保留原职责目录，只在原目录下新增或复用 `__tests__/`，例如 `features/chat/utils/foo.test.ts` 迁移为 `features/chat/utils/__tests__/foo.test.ts`。
- 导入调整：随迁移统一将测试文件内相对导入加深一层；不改变测试语义。
- 额外同步：当前工作区已有 chat MVP 解耦 WIP 使部分测试 mock 落后于生产 query contract，本次为受影响测试补齐 `useProviders` / `useProviderTemplates` mock，并补齐 `syncVisibleWorkspaceSelection` 的类型守卫，保证迁移后完整 UI test suite 可运行。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ui tsc`
  - 结果：通过。
- `pnpm -C packages/nextclaw-ui exec vitest run src/shared/components/__tests__/model-config.test.tsx src/shared/components/config/__tests__/providers-list.test.tsx src/features/agents/components/__tests__/agents-page.test.tsx src/features/chat/hooks/__tests__/use-ncp-chat-page-data.test.tsx src/features/chat/components/conversation/__tests__/chat-conversation-panel.test.tsx`
  - 结果：通过，`5` 个测试文件、`30` 个测试通过。
- `pnpm -C packages/nextclaw-ui test`
  - 结果：通过，`120` 个测试文件、`503` 个测试通过。
- `pnpm -C packages/nextclaw-ui lint`
  - 结果：通过，退出码 `0`；仍有历史 warning，但没有 error。
- `pnpm lint:new-code:governance`
  - 结果：通过。
- `pnpm check:governance-backlog-ratchet`
  - 结果：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths <本次测试迁移文件>`
  - 结果：通过；测试迁移范围内非测试代码净增 `0`。
- `rg --files packages/nextclaw-ui/src | rg '(\\.test\\.|\\.spec\\.)' | rg -v '/__tests__/'`
  - 结果：无输出，说明 UI 测试文件已全部进入 `__tests__/`。

完整工作区级 `--non-feature` maintainability guard 当前仍会被同批 chat MVP 解耦 WIP 的非测试净增阻塞；本次测试目录迁移范围本身不增加非测试代码。

## 发布/部署方式

本次是内部测试目录结构治理，不涉及部署、migration、runtime update channel、桌面安装包或线上冒烟。

## 用户/产品视角的验收步骤

不涉及用户可见产品行为变更。面向开发者的验收标准是：

1. UI 测试文件全部位于最近职责目录的 `__tests__/` 下。
2. UI package 的 TypeScript、全量 Vitest、ESLint 与新代码治理检查通过。
3. 后续新增 UI 测试可以沿用同一目录模式，不再继续污染生产实现目录。

## 可维护性总结汇总

- 本次正向减债动作：职责目录清理。
- 非测试代码增减：测试迁移范围内净增 `0`；当前完整工作区 diff 另含同批 chat MVP 解耦 WIP，需由该批次独立闭合非测试净增。
- 目录组织：测试专用文件从生产职责目录平铺层移入 `__tests__/`，与当前 `file-organization-governance` 中“新增测试默认优先放入 `__tests__/`”保持一致。
- 保留债务：部分大测试文件仍接近文件预算，例如 chat conversation / ncp chat thread / chat message utils 测试；后续扩展这些文件时应优先抽 fixture 与 builder。

## NPM 包发布记录

不涉及 NPM 包发布；本次不需要 changeset。
