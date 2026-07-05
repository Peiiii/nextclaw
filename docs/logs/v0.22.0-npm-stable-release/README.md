# v0.22.0 NPM stable release

## 迭代完成说明

本次完成 NextClaw v0.22.0 NPM stable minor 发布闭环。发布范围为当前 workspace 内全部 `private: false` 的 public NPM 包，共 49 个包。

本次同步补充了用户可读版本说明：

- 中文：`apps/docs/zh/notes/2026-07-05-nextclaw-v0-22-0.md`
- English：`apps/docs/en/notes/2026-07-05-nextclaw-v0-22-0.md`
- 文档索引与 VitePress sidebar 已更新。

发布过程中 `pnpm release:publish` 已成功发布 48 个包，但 `@nextclaw/kernel@0.6.0` 在首次发布时遇到 registry/network `ECONNRESET`，registry 查询确认当时仍停留在 `0.5.4`。随后使用 `pnpm -C packages/nextclaw-kernel publish --access public --no-git-checks` 只补发缺失包，最终 registry 全量验证为 49/49 已发布。

## 测试/验证/验收方式

- `pnpm release:version`：通过，生成 v0.22.0 版本与 changelog。
- `pnpm -C apps/docs build`：通过，确认中英文 release note 页面可构建。
- `pnpm release:publish`：发布 48/49 个包后因 `@nextclaw/kernel@0.6.0` 网络失败返回非零退出码；其余包已成功发布。
- `pnpm -C packages/nextclaw-kernel publish --access public --no-git-checks`：通过，补发 `@nextclaw/kernel@0.6.0`。
- `pnpm release:verify:published`：通过，确认恢复批次 `@nextclaw/kernel@0.6.0` 已发布。
- 全量 registry 验证：通过，当前 workspace 49 个 public 包的本地版本均存在于 `https://registry.npmjs.org/`。
- `npm view nextclaw@0.22.0 version dist-tags dependencies --json`：通过，`latest` 指向 `0.22.0`，依赖版本为已发布的 stable 版本。
- `npm pack nextclaw@0.22.0 --json`：通过，包内包含 `dist/cli/launcher/index.js`、`dist/cli/app/index.js`、`resources/update-bundle-public.pem` 和 `ui-dist/index.html`。
- 临时目录全局安装冒烟：通过，`npm install -g --prefix <tmp> nextclaw@0.22.0` 后 `nextclaw --version` 输出 `0.22.0`，`NEXTCLAW_HOME=<tmp> nextclaw update --check --json` 返回 `status: "up-to-date"`。
- `pnpm --filter @nextclaw/docs build && pnpm dlx wrangler pages deploy apps/docs/.vitepress/dist --project-name nextclaw-docs --branch master`：通过，Cloudflare Pages 部署地址为 `https://3182737e.nextclaw-docs.pages.dev`。
- release note 线上验收：`https://docs.nextclaw.io/zh/notes/2026-07-05-nextclaw-v0-22-0` 与 `https://3182737e.nextclaw-docs.pages.dev/en/notes/2026-07-05-nextclaw-v0-22-0` 均返回 `200`，页面包含 `NextClaw v0.22.0` 与对应更新分类。

## 发布/部署方式

本次执行 NPM stable 发布，并为了提供可访问的 release note URL 部署 docs 静态站；不执行 desktop installer、runtime update channel 或 GitHub Release。

NPM 主包地址：

- `https://www.npmjs.com/package/nextclaw/v/0.22.0`

版本说明页面已写入并部署到 docs 站：

- `https://docs.nextclaw.io/zh/notes/2026-07-05-nextclaw-v0-22-0`
- `https://docs.nextclaw.io/en/notes/2026-07-05-nextclaw-v0-22-0`
- `https://nextclaw-docs.pages.dev/zh/notes/2026-07-05-nextclaw-v0-22-0`
- `https://nextclaw-docs.pages.dev/en/notes/2026-07-05-nextclaw-v0-22-0`
- 本次 Cloudflare Pages 部署地址：`https://3182737e.nextclaw-docs.pages.dev`

## 用户/产品视角的验收步骤

用户可以通过 NPM 安装或更新到本版本：

```bash
npm install -g nextclaw@0.22.0
nextclaw --version
```

期望结果：

- `nextclaw --version` 输出 `0.22.0`。
- `nextclaw update --check --json` 可正常执行，NPM runtime bundle 识别为 stable channel。
- 用户可在 release note 中看到本期聊天任务流、内容预览、夜间主题、附件/图片和运行时诊断相关更新。

## 可维护性总结汇总

本次是发布与文档留痕任务，不涉及新的源码行为改造。发布 notes 按真实变更聚类，不把内部讨论过程写入用户-facing 内容；内部异常与恢复过程只记录在本迭代日志中。

可维护性影响：

- 保持发布说明、docs index、package changelog 与 NPM registry 状态一致。
- 没有新增运行时抽象、长期分支或平行实现。
- `ui-dist` 构建产物随发布版本更新，属于 NPM 主包发布产物。
- 未运行源码级 `post-edit-maintainability-review`，原因是本次没有新增或重构源码逻辑；验证重点是发布闭环和 registry/install smoke。

## NPM 包发布记录

需要发布，原因：用户要求发布一个 stable minor，并在澄清后要求将所有 public NPM 包一次性发布。

发布结果：49/49 已发布到 NPM registry。

已发布包：

- `@nextclaw/companion@0.2.0`
- `@nextclaw/aigen@0.2.0`
- `@nextclaw/browser-connector@0.3.0`
- `nextclaw@0.22.0`
- `@nextclaw/agent-chat@0.3.0`
- `@nextclaw/agent-chat-ui@0.6.0`
- `@nextclaw/app-runtime@0.9.0`
- `@nextclaw/app-sdk@0.3.0`
- `@nextclaw/client-sdk@0.5.0`
- `@nextclaw/core@0.15.0`
- `@nextclaw/extension-sdk@0.3.0`
- `@nextclaw/nextclaw-hermes-acp-bridge@0.3.0`
- `@nextclaw/kernel@0.6.0`
- `@nextclaw/mcp@0.3.0`
- `@nextclaw/nextclaw-narp-stdio-runtime-wrapper@0.3.0`
- `@nextclaw/nextclaw-ncp-runtime-adapter-hermes-http@0.3.0`
- `@nextclaw/nextclaw-ncp-runtime-http-client@0.3.0`
- `@nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.0`
- `@nextclaw/remote@0.3.0`
- `@nextclaw/runtime@0.4.0`
- `@nextclaw/server@0.15.0`
- `@nextclaw/service@0.3.0`
- `@nextclaw/shared@0.4.0`
- `@nextclaw/ui@0.15.0`
- `@nextclaw/channel-extension-dingtalk@0.2.0`
- `@nextclaw/channel-extension-discord@0.2.0`
- `@nextclaw/channel-extension-email@0.2.0`
- `@nextclaw/channel-extension-feishu@0.2.0`
- `@nextclaw/channel-extension-qq@0.2.0`
- `@nextclaw/channel-extension-slack@0.2.0`
- `@nextclaw/channel-extension-telegram@0.2.0`
- `@nextclaw/channel-extension-wecom@0.2.0`
- `@nextclaw/channel-extension-weixin@0.2.0`
- `@nextclaw/channel-extension-whatsapp@0.2.0`
- `@nextclaw/feishu-core@0.3.0`
- `@nextclaw/nextclaw-narp-runtime-claude-code-sdk@0.2.0`
- `@nextclaw/nextclaw-narp-runtime-codex-sdk@0.2.0`
- `@nextclaw/nextclaw-narp-runtime-opencode@0.2.0`
- `@nextclaw/nextclaw-ncp-runtime-claude-code-sdk@0.2.0`
- `@nextclaw/nextclaw-ncp-runtime-codex-sdk@0.2.0`
- `@nextclaw/ncp@0.7.0`
- `@nextclaw/ncp-agent-runtime@0.4.0`
- `@nextclaw/ncp-agent-runtime-next@0.1.0`
- `@nextclaw/ncp-http-agent-client@0.4.0`
- `@nextclaw/ncp-http-agent-server@0.4.0`
- `@nextclaw/ncp-mcp@0.2.0`
- `@nextclaw/ncp-react@0.5.0`
- `@nextclaw/ncp-react-ui@0.3.0`
- `@nextclaw/ncp-toolkit@0.6.0`

外部阻塞：无。首次批量发布中的 `@nextclaw/kernel@0.6.0` 网络失败已通过单包补发恢复。
