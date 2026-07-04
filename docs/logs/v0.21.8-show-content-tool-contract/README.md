# v0.21.8 show content tool contract split

## 迭代完成说明

本轮将模型可见的 `show_content` 宽工具拆成三个窄工具：`show_file`、`show_url`、`show_panel_app`。根因是原工具把 `path` / `url` / `appId` 藏在 `payload: { type: "object", additionalProperties: true }` 里，只靠 description 约束模型；DeepSeek 能猜对不代表合同正确，MiniMax 在不强约束时会更容易漏填或填错嵌套参数。

新的工具 schema 把关键字段提升为各自工具的顶层 required properties，并设置 `additionalProperties: false`。`show_content` 暂时不再从 kernel provider 暴露；内部仍复用同一个 `ui.show-content` 事件和 `showContent` result action，避免新增 UI 打开链路。

同步更新 native prompt context、`nextclaw-app-creator` / `panel-app-creator` builtin skills，以及 chat tool card 解析：新会话使用新工具名；历史消息里的 `show_content` 工具卡仍可展示，避免旧会话回看断裂。

后续扩展：`show_url` 不再只是“把 URL 塞进 iframe”的弱展示入口，而是明确打开右侧 DocBrowser 的 browser/content tab。普通 HTTP/HTTPS URL 会带地址栏、刷新、后退/前进、外部打开等轻量浏览器控制；Vite、Next.js、Storybook 等本地 dev server 应使用 `show_url(url, placement="side_panel")` 展示运行中的页面，静态 HTML 文件才使用 `show_file(path, viewer="rendered")`。

## 测试/验证/验收方式

- `packages/nextclaw-kernel`: `./node_modules/.bin/vitest run src/tools/show-content.tools.test.ts src/contributions/context-provider/providers/context-provider-contract.provider.test.ts`
- `packages/nextclaw-ui`: `./node_modules/.bin/vitest run src/features/chat/features/message/utils/__tests__/chat-message-show-content-tool-card.utils.test.ts`
- `packages/nextclaw-ui`: `./node_modules/.bin/vitest run src/features/chat/managers/__tests__/chat-ui.manager.test.ts src/shared/components/doc-browser/__tests__/doc-browser.test.tsx`
- `packages/nextclaw-core`: `./node_modules/.bin/vitest run src/features/agent/features/tests/skills.test.ts`
- `packages/nextclaw-kernel`: `./node_modules/.bin/tsc -p tsconfig.json`
- `packages/nextclaw-core`: `./node_modules/.bin/tsc -p tsconfig.json`
- `packages/nextclaw-ui`: `./node_modules/.bin/tsc --noEmit`
- touched-file ESLint: `./node_modules/.bin/eslint <本轮触达 TS 文件>`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths <本轮触达文件>`
- `node scripts/governance/checks/lint-new-code-governance.mjs -- <本轮触达文件>`
- `node scripts/governance/backlog/check-governance-backlog-ratchet.mjs`
- `git diff --check -- <本轮触达文件>`
- MiniMax-M3 直连 Chat Completions smoke：`show_file` 8/8 顶层 `path`，`payload` 0；`show_panel_app` 8/8 顶层 `appId`，`payload` 0；`show_url` 4/4 顶层 `url`，`payload` 0。

说明：根目录 `pnpm --filter ... test` 在本机先被 pnpm v11 dependency status / ignored builds 阻断，本轮改用各 package 的本地 binary 执行同等定向验证。

## 发布/部署方式

本轮未执行发布、部署或 NPM publish。已添加独立 changeset，后续统一 NPM 发版需要纳入：

- `@nextclaw/kernel`
- `@nextclaw/core`
- `@nextclaw/ui`

## 用户/产品视角的验收步骤

1. 新会话需要展示本地文件时，agent 应调用 `show_file`，参数顶层包含 `path`，可选 `viewer` / `placement`。
2. 新会话需要展示 URL 时，agent 应调用 `show_url`，参数顶层包含 `url`。
3. 新会话需要展示 Panel App 时，agent 应调用 `show_panel_app`，参数顶层包含 `appId`，可选 `placement="inline"` 或 `"side_panel"`。
4. provider 暴露工具列表中不再出现 `show_content`。
5. 历史消息中已有 `show_content` tool result 仍能解析成 chat tool card。
6. 本地开发时，agent 启动 dev server 后调用 `show_url` 打开 `http://localhost:<port>` 或 `http://127.0.0.1:<port>`，右侧显示 browser/content tab，可使用地址栏、刷新、后退/前进和系统浏览器打开。

## 可维护性总结汇总

- 本轮没有新增第二套 UI display pipeline，只把模型可见 contract 拆窄，执行后仍落到既有 `ui.show-content` 事件 owner。
- kernel provider 从单个宽工具改为 spec 驱动的三个窄工具，避免三套重复 class，同时保留每个工具独立 schema。
- browser/content tab 复用既有 `DocBrowserManager`、`DocBrowser` iframe 和全局 active-history owner，没有在 chat workspace file preview 内新增平行浏览器状态。
- browser/content follow-up 维护性守卫通过：总增减 `+320 / -187 / net +133`，非测试 `+273 / -187 / net +86`。这是新增用户能力导致的必要增长；保留 warning 为 `doc-browser.tsx` 已接近 500 行预算，下一步继续扩展浏览器能力时应优先拆出 address/iframe chrome。
- `post-edit-maintainability-guard --non-feature` 通过：非测试代码净增为 `-1`；保留 warning 是既有 `context-provider/providers` 目录预算例外，本轮未增加该目录文件数。
- `post-edit-maintainability-review` 判断：这是合同修复和可预测行为改造，不是新功能堆叠；核心取舍是牺牲一个万能工具的表面简洁，换取模型执行的结构确定性。

## NPM 包发布记录

本轮未发布 NPM 包。当前状态：待统一发布。
