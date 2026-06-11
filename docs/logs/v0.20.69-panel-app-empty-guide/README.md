# Panel Apps 空态引导

## 迭代完成说明

- 为 Panel Apps 列表增加首次空态引导，只在总列表确实为 0 时展示。
- 空态说明 Panel Apps 的用途、两种创建入口：让 NextClaw 生成，或把 `*.panel.html` / `*.panel` 应用放进 panels 目录。
- 将“让 NextClaw 帮你生成”升级为可点击入口：点击后进入 chat，并预填一个创建“个人任务看板”示例 Panel App 的 prompt。
- 新增 `ChatDraftIntentManager` 作为跨页面草稿意图 owner；Panel Apps 只发起草稿意图，ChatPage 挂载后消费并调用 chat presenter 写入输入框、聚焦 composer。
- 将“筛选结果为空”和“新用户一个应用都没有”分开：已有应用但收藏/最近打开为空时，显示普通空结果，不误导为首次引导。
- 补齐中英文 i18n 文案，并新增组件测试锁定首次空态、示例 prompt 点击与筛选空态分支。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/ui exec vitest run src/features/panel-apps/components/__tests__/panel-apps-list.test.tsx`
  - 结果：通过，1 个测试文件、2 个测试通过。
- `pnpm --filter @nextclaw/ui test -- panel-apps-list.test.tsx`
  - 结果：通过，1 个测试文件、3 个测试通过。
- `pnpm --filter @nextclaw/ui exec eslint src/features/panel-apps/components/panel-apps-list.tsx src/features/panel-apps/components/__tests__/panel-apps-list.test.tsx`
  - 结果：通过。
- `pnpm --filter @nextclaw/ui tsc`
  - 结果：通过。
- `pnpm --filter @nextclaw/ui build`
  - 结果：通过；保留 Vite 既有 large chunk warning，不是本次阻塞。
- `pnpm --filter @nextclaw/ui lint`
  - 结果：通过；存在 32 个历史 warning，均不在本次触达文件。
- `curl -fsS -o /tmp/nextclaw-ui-smoke.html -w '%{http_code}\n' http://127.0.0.1:5174/`
  - 结果：返回 `200`。
- `curl -fsS 'http://127.0.0.1:5174/src/features/panel-apps/components/panel-apps-list.tsx' | rg -n "panelAppsExamplePrompt|useNavigate|chatDraftIntentManager"`
  - 结果：通过，Vite dev server 能转换 Panel Apps 空态模块并暴露示例 prompt 入口调用。
- `curl -fsS 'http://127.0.0.1:5174/src/features/chat/pages/ncp-chat-page.tsx' | rg -n "useChatDraftIntentConsumer|chatDraftIntentManager|startAgentCreationDraft"`
  - 结果：通过，Vite dev server 能转换 ChatPage，并能看到草稿 intent 消费链路。
- Chrome DevTools 浏览器点击冒烟：
  - 结果：未执行；当前 Chrome DevTools MCP profile 被已有浏览器进程占用。已用组件测试和 Vite HTTP smoke 替代验证。
- `pnpm lint:new-code:governance`
  - 结果：通过。
- `pnpm check:governance-backlog-ratchet`
  - 结果：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-ui/src/features/panel-apps/components/panel-apps-list.tsx packages/nextclaw-ui/src/features/panel-apps/components/__tests__/panel-apps-list.test.tsx packages/nextclaw-ui/src/shared/lib/i18n/locales/zh-CN/doc-browser.json packages/nextclaw-ui/src/shared/lib/i18n/locales/en-US/doc-browser.json`
  - 结果：通过，无可维护性问题。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-ui/src/app/presenters/app.presenter.ts packages/nextclaw-ui/src/features/chat/index.ts packages/nextclaw-ui/src/features/chat/managers/chat-draft-intent.manager.ts packages/nextclaw-ui/src/features/chat/pages/ncp-chat-page.tsx packages/nextclaw-ui/src/features/panel-apps/components/panel-apps-list.tsx packages/nextclaw-ui/src/features/panel-apps/components/__tests__/panel-apps-list.test.tsx packages/nextclaw-ui/src/shared/lib/i18n/locales/en-US/doc-browser.json packages/nextclaw-ui/src/shared/lib/i18n/locales/zh-CN/doc-browser.json`
  - 结果：通过，无可维护性问题；本次源码 scoped 口径总代码 `+130 / -2 / net +128`，非测试 `+107 / -2 / net +105`。
- `git diff --check`
  - 结果：通过。
- `pnpm clean:generated`
  - 结果：上一轮提交前通过，生成产物保持 clean；本轮跟进未重新清理，当前工作区另有 `packages/nextclaw/ui-dist` dev watch 产物变更，未纳入本次源码交付。
- `pnpm release:notes:check`
  - 结果：命令不存在；已按 release notes skill 手工判断并新增 `.changeset/panel-app-empty-guide.md`。

## 发布/部署方式

- 本次未执行发布或部署。
- 不涉及数据库 migration。
- 不涉及线上 smoke。
- 已新增 `.changeset/panel-app-empty-guide.md`，后续随统一 NPM 发布进入 `@nextclaw/ui` patch 变更说明。

## 用户/产品视角的验收步骤

- 打开右侧 Apps / Panel Apps 入口，且 workspace 中没有任何 panel app。
- 确认页面展示“创建你的第一个面板应用 / Create your first panel app”引导、创建方式和 panels 目录。
- 点击“生成示例面板应用 / Create sample panel app”，确认进入 chat，并在输入框预填示例 Panel App 开发 prompt。
- 新增一个 panel app 后刷新，确认列表展示应用卡片，不再展示首次引导。
- 在已有应用但当前筛选分类为空时，确认只显示“当前分类暂无面板应用 / No panel apps in this view”。

## 可维护性总结汇总

- 本次是新增用户可见能力，不按非功能改动的非测试净增 `<= 0` 硬门槛处理。
- scoped maintainability guard：
  - 结果：通过；当前源码 scoped 口径总代码 `+130 / -2 / net +128`，非测试 `+107 / -2 / net +105`，无可维护性 findings。
- 按本次源码 git diff 触达文件口径：总计约 `+130 / -2 / net +128`；其中新增/扩展测试 `+23`，非测试与 i18n约 `+107 / -2 / net +105`。
- 可维护性复核结论：通过。
- 本次顺手减债：是。将跨页面“填入 chat prompt”的动作收敛成 `ChatDraftIntentManager` 意图通道，避免 Panel Apps 直接写 chat store；同时继续保持首次空态与筛选空态的语义分支。
- no maintainability findings。空态 UI 保持在 Panel Apps feature 组件内，没有新增全局组件、后端接口、自动创建路径或平行 owner；示例 prompt 的消费归 ChatPage / ChatPresenter 链路，后续如果多个页面都需要同类 first-use guide，再评估是否沉到 shared empty-state primitive。

## NPM 包发布记录

- 涉及包：`@nextclaw/ui`。
- 发布状态：未发布。
- 后续处理：随下一次统一 NPM 发布批次发布 patch；changeset 已更新为“空态引导 + 示例 prompt action”。
