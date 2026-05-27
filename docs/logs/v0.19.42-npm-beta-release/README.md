# v0.19.42 NPM Beta Release

## 迭代完成说明

本次执行整体 NPM beta 发布闭环，入口为 `pnpm release:beta`。发布范围按全量 public workspace beta batch 处理，因为 `release:report:health` 显示上一批 beta 与当前工作区存在发布漂移，且用户要求再次整体发布 beta。

本次发布结果：

- `nextclaw@beta`：`0.19.31-beta.3`
- release commit：`25207deac25e1b38a0863f0dd1023ec8c28fa9db`
- runtime workflow：<https://github.com/Peiiii/nextclaw/actions/runs/26485152397>
- runtime release：<https://github.com/Peiiii/nextclaw/releases/tag/nextclaw%400.19.31-beta.3>
- public beta manifest：`https://peiiii.github.io/nextclaw/npm-runtime-updates/beta/manifest-beta-darwin-arm64.json`

发布前先提交了开发态 workspace package dist watcher 修复：

- `7980d3c7 chore: add workspace package dist watcher`
- 该提交移除了根 `tsconfig.base.json` 的 `customConditions: ["development"]`，避免 TypeScript 基线绕过 workspace package 的 dist/types 合同。

## 测试/验证/验收方式

- `pnpm dev:packages:build`：确认 workspace package dist/types 可按需补齐，且未产生需要单独提交的已跟踪 dist 差异。
- `node --check scripts/dev/workspace-package-dist-watcher.mjs && node --check scripts/dev/dev-runner.mjs`：通过。
- `pnpm exec eslint scripts/dev/workspace-package-dist-watcher.mjs scripts/dev/dev-runner.mjs`：通过。
- `pnpm tsc`：通过。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `pnpm release:beta -- --dry-run`：确认入口计划为全量 public workspace beta batch。
- `pnpm release:beta`：完成 changeset version、release check、npm publish、registry verify、release commit/tag push、runtime workflow、release asset verify 与 public manifest verify。
- `npm view nextclaw@beta version`：返回 `0.19.31-beta.3`。
- `npm view nextclaw dist-tags --json`：确认 `latest = 0.19.28`、`beta = 0.19.31-beta.3`。
- `gh run view 26485152397 --repo Peiiii/nextclaw --json status,conclusion,url,headBranch,event,displayTitle`：确认 workflow `completed/success`。
- `gh release view 'nextclaw@0.19.31-beta.3' --repo Peiiii/nextclaw --json url,isPrerelease,assets,tagName`：确认 release 为 prerelease，且四个平台 runtime zip 均已上传。
- `curl -fsS https://peiiii.github.io/nextclaw/npm-runtime-updates/beta/manifest-beta-darwin-arm64.json`：确认 public manifest 指向 `0.19.31-beta.3`。
- `pnpm -C packages/nextclaw validation:npm-update -- --published-beta`：确认临时全局 prefix 安装的 `nextclaw@beta` 为 `0.19.31-beta.3`，且 `@nextclaw/core` 导出可用。
- 隔离 `NEXTCLAW_HOME` 下安装 `nextclaw@0.19.28` 后执行 `update --channel beta --check --json`、`update --channel beta --download-only --json`、`update --apply --json`，确认可检查、下载并应用到 `0.19.31-beta.3`。
- 使用更新后的临时安装执行 `restart --ui-port <free-port> --start-timeout 45000`，`/api/app/meta` 返回 `productVersion: 0.19.31-beta.3`。

## 发布/部署方式

本次发布通过仓库标准 beta 入口完成：

```bash
pnpm release:beta
```

该入口已自动完成 npm registry 发布、release commit、tag push、runtime update workflow 触发与 public manifest 校验。未涉及后端数据库 migration，也未涉及独立线上 API deploy。

## 用户/产品视角的验收步骤

1. 安装或升级 `nextclaw@beta`。
2. 执行 `nextclaw --version`，应显示 `0.19.31-beta.3`。
3. 执行 `nextclaw update --channel beta --check`，应能读取公网 beta manifest。
4. 执行 `nextclaw update --channel beta --download-only` 后再执行 `nextclaw update --apply`，应能完成运行时升级。
5. 执行 `nextclaw restart --ui-port <port> --start-timeout 45000`。
6. 打开 `http://127.0.0.1:<port>/api/app/meta`，确认 `productVersion` 为 `0.19.31-beta.3`。

## 可维护性总结汇总

本次发布前的主要代码变化是开发态 workspace package dist watcher，目标是把 workspace package 的 dist/types freshness 收敛到显式 watcher/build 入口，而不是让根 TypeScript 基线通过 `customConditions` 直接解析跨包源码。这样保留了 package 边界的 dist/types 合同，也让 `pnpm tsc` 继续覆盖真实消费路径。

可维护性检查结果：

- `post-edit-maintainability-guard` 已运行，检查通过。
- 新增 watcher 脚本为 404 行，接近 500 行预算，已记录为后续拆分观察点。
- 本次非测试代码净增较大，原因是新增开发工具能力；发布本身生成的版本、changelog、UI dist 和 tag 均由标准 release 脚本维护。
- 未发现需要新增平行发布路径或手工 runtime channel 操作。

## NPM 包发布记录

需要发布，原因是用户要求再次整体 NPM beta 发布，且 release health 显示 public workspace beta batch 存在未发布漂移。

已发布 batch 共 46 个 public workspace 包，版本为：

- `nextclaw@0.19.31-beta.3`
- `@nextclaw/agent-chat@0.1.23-beta.3`
- `@nextclaw/agent-chat-ui@0.3.25-beta.3`
- `@nextclaw/app-runtime@0.7.13-beta.3`
- `@nextclaw/app-sdk@0.1.13-beta.3`
- `@nextclaw/channel-extension-dingtalk@0.1.1-beta.3`
- `@nextclaw/channel-extension-discord@0.1.1-beta.3`
- `@nextclaw/channel-extension-email@0.1.1-beta.3`
- `@nextclaw/channel-extension-feishu@0.1.9-beta.3`
- `@nextclaw/channel-extension-qq@0.1.6-beta.3`
- `@nextclaw/channel-extension-slack@0.1.1-beta.3`
- `@nextclaw/channel-extension-telegram@0.1.1-beta.3`
- `@nextclaw/channel-extension-wecom@0.1.1-beta.3`
- `@nextclaw/channel-extension-weixin@0.1.12-beta.3`
- `@nextclaw/channel-extension-whatsapp@0.1.1-beta.3`
- `@nextclaw/client-sdk@0.1.14-beta.3`
- `@nextclaw/companion@0.1.14-beta.3`
- `@nextclaw/core@0.12.25-beta.3`
- `@nextclaw/extension-sdk@0.1.12-beta.3`
- `@nextclaw/feishu-core@0.2.19-beta.3`
- `@nextclaw/kernel@0.1.15-beta.3`
- `@nextclaw/mcp@0.1.90-beta.3`
- `@nextclaw/ncp@0.5.18-beta.3`
- `@nextclaw/ncp-agent-runtime@0.3.29-beta.3`
- `@nextclaw/ncp-agent-runtime-next@0.0.1-beta.3`
- `@nextclaw/ncp-http-agent-client@0.3.30-beta.3`
- `@nextclaw/ncp-http-agent-server@0.3.30-beta.3`
- `@nextclaw/ncp-mcp@0.1.92-beta.3`
- `@nextclaw/ncp-react@0.4.38-beta.3`
- `@nextclaw/ncp-react-ui@0.2.30-beta.3`
- `@nextclaw/ncp-toolkit@0.5.23-beta.3`
- `@nextclaw/nextclaw-hermes-acp-bridge@0.1.17-beta.3`
- `@nextclaw/nextclaw-narp-runtime-claude-code-sdk@0.1.15-beta.3`
- `@nextclaw/nextclaw-narp-runtime-codex-sdk@0.1.16-beta.3`
- `@nextclaw/nextclaw-narp-stdio-runtime-wrapper@0.1.12-beta.3`
- `@nextclaw/nextclaw-ncp-runtime-adapter-hermes-http@0.1.18-beta.3`
- `@nextclaw/nextclaw-ncp-runtime-claude-code-sdk@0.1.40-beta.3`
- `@nextclaw/nextclaw-ncp-runtime-codex-sdk@0.1.39-beta.3`
- `@nextclaw/nextclaw-ncp-runtime-http-client@0.1.17-beta.3`
- `@nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.18-beta.3`
- `@nextclaw/remote@0.1.103-beta.3`
- `@nextclaw/runtime@0.2.57-beta.3`
- `@nextclaw/server@0.12.26-beta.3`
- `@nextclaw/service@0.1.18-beta.3`
- `@nextclaw/shared@0.1.12-beta.3`
- `@nextclaw/ui@0.12.35-beta.3`

发布后 `release:verify:published` 确认 registry 上 46/46 个 package version 均可见。`nextclaw` dist-tag 当前为 `latest = 0.19.28`、`beta = 0.19.31-beta.3`。
