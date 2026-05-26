# v0.19.39 NPM Beta Release

## 迭代完成说明

本次执行整体 NPM beta 发布闭环，入口为 `pnpm release:beta`。发布范围按全量 public workspace beta batch 处理，不缩小到单包发布，因为 `release:report:health` 显示 `nextclaw` 及运行时依赖闭包存在未发布漂移。

本次发布结果：

- `nextclaw@beta`：`0.19.31-beta.2`
- release commit：`828495f0fd9d21c799b1d4e4730de0751e3c98d4`
- runtime workflow：<https://github.com/Peiiii/nextclaw/actions/runs/26464750813>
- runtime release：<https://github.com/Peiiii/nextclaw/releases/tag/nextclaw%400.19.31-beta.2>
- public beta manifest：`https://peiiii.github.io/nextclaw/npm-runtime-updates/beta/manifest-beta-darwin-arm64.json`

## 测试/验证/验收方式

- `pnpm release:beta -- --dry-run`：确认入口计划为全量 public workspace beta batch、推送 branch/tags 并触发 runtime channel。
- `pnpm release:beta`：完成 changeset version、release check、npm publish、registry verify、release commit/tag push、runtime workflow、release asset verify 与 public manifest verify。
- `npm view nextclaw@beta version`：返回 `0.19.31-beta.2`。
- `npm view nextclaw dist-tags --json`：确认 `beta = 0.19.31-beta.2`。
- `gh run view 26464750813 --repo Peiiii/nextclaw --json status,conclusion,url,headBranch,event`：确认 workflow `completed/success`。
- `gh release view 'nextclaw@0.19.31-beta.2' --repo Peiiii/nextclaw --json url,isPrerelease,assets`：确认四个平台 runtime zip 均已上传。
- `pnpm -C packages/nextclaw validation:npm-update -- --published-beta`：确认临时全局 prefix 安装的 `nextclaw@beta` 为 `0.19.31-beta.2`，且安装路径不是 workspace link。
- 隔离 `NEXTCLAW_HOME` 下安装 `nextclaw@0.19.28` 后执行 `update --channel beta --check --json`、`update --channel beta --download-only --json`、`update --apply --json`，确认可检查、下载并应用到 `0.19.31-beta.2`。
- 使用更新后的临时安装执行 `restart --ui-port 41632 --start-timeout 45000`，`/api/app/meta` 返回 `productVersion: 0.19.31-beta.2`。

## 发布/部署方式

本次发布通过仓库标准 beta 入口完成：

```bash
pnpm release:beta
```

该入口已自动完成 npm registry 发布、release commit、tag push、runtime update workflow 触发与 public manifest 校验。未涉及后端数据库 migration，也未涉及独立线上 API deploy。

## 用户/产品视角的验收步骤

1. 安装或升级 `nextclaw@beta`。
2. 执行 `nextclaw --version`，应显示 `0.19.31-beta.2`。
3. 执行 `nextclaw update --channel beta --check`，应能读取公网 beta manifest。
4. 执行 `nextclaw restart --ui-port <port> --start-timeout 45000`。
5. 打开 `http://127.0.0.1:<port>/api/app/meta`，确认 `productVersion` 为 `0.19.31-beta.2`。

## 可维护性总结汇总

本次主要是发布闭环，不新增业务源码能力。发布前按合同检查了 full public batch 范围，避免只发布 `nextclaw` 而遗漏运行时依赖闭包。发布过程中生成的版本、changelog、UI dist 和 tag 均由标准 release 脚本维护；未引入新的手工发布路径。

发现一个验证口径差异：`nextclaw update --channel beta` 默认会直接下载并应用；若随后再执行 `update --apply`，会因没有待应用版本而失败。最终按真实 CLI 合同改用 `--download-only` 后再 `--apply` 完成验收，并同步修正 `npm-release-contract-guard` 的分步 smoke 文案。

## NPM 包发布记录

需要发布，原因是用户要求整体 NPM beta 发布，且 release health 显示多个 public workspace 包存在未发布漂移。

已发布 batch 共 46 个 public workspace 包，版本为：

- `nextclaw@0.19.31-beta.2`
- `@nextclaw/agent-chat@0.1.23-beta.2`
- `@nextclaw/agent-chat-ui@0.3.25-beta.2`
- `@nextclaw/app-runtime@0.7.13-beta.2`
- `@nextclaw/app-sdk@0.1.13-beta.2`
- `@nextclaw/channel-extension-dingtalk@0.1.1-beta.2`
- `@nextclaw/channel-extension-discord@0.1.1-beta.2`
- `@nextclaw/channel-extension-email@0.1.1-beta.2`
- `@nextclaw/channel-extension-feishu@0.1.9-beta.2`
- `@nextclaw/channel-extension-qq@0.1.6-beta.2`
- `@nextclaw/channel-extension-slack@0.1.1-beta.2`
- `@nextclaw/channel-extension-telegram@0.1.1-beta.2`
- `@nextclaw/channel-extension-wecom@0.1.1-beta.2`
- `@nextclaw/channel-extension-weixin@0.1.12-beta.2`
- `@nextclaw/channel-extension-whatsapp@0.1.1-beta.2`
- `@nextclaw/client-sdk@0.1.14-beta.2`
- `@nextclaw/companion@0.1.14-beta.2`
- `@nextclaw/core@0.12.25-beta.2`
- `@nextclaw/extension-sdk@0.1.12-beta.2`
- `@nextclaw/feishu-core@0.2.19-beta.2`
- `@nextclaw/kernel@0.1.15-beta.2`
- `@nextclaw/mcp@0.1.90-beta.2`
- `@nextclaw/ncp@0.5.18-beta.2`
- `@nextclaw/ncp-agent-runtime@0.3.29-beta.2`
- `@nextclaw/ncp-agent-runtime-next@0.0.1-beta.2`
- `@nextclaw/ncp-http-agent-client@0.3.30-beta.2`
- `@nextclaw/ncp-http-agent-server@0.3.30-beta.2`
- `@nextclaw/ncp-mcp@0.1.92-beta.2`
- `@nextclaw/ncp-react@0.4.38-beta.2`
- `@nextclaw/ncp-react-ui@0.2.30-beta.2`
- `@nextclaw/ncp-toolkit@0.5.23-beta.2`
- `@nextclaw/nextclaw-hermes-acp-bridge@0.1.17-beta.2`
- `@nextclaw/nextclaw-narp-runtime-claude-code-sdk@0.1.15-beta.2`
- `@nextclaw/nextclaw-narp-runtime-codex-sdk@0.1.16-beta.2`
- `@nextclaw/nextclaw-narp-stdio-runtime-wrapper@0.1.12-beta.2`
- `@nextclaw/nextclaw-ncp-runtime-adapter-hermes-http@0.1.18-beta.2`
- `@nextclaw/nextclaw-ncp-runtime-claude-code-sdk@0.1.40-beta.2`
- `@nextclaw/nextclaw-ncp-runtime-codex-sdk@0.1.39-beta.2`
- `@nextclaw/nextclaw-ncp-runtime-http-client@0.1.17-beta.2`
- `@nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.18-beta.2`
- `@nextclaw/remote@0.1.103-beta.2`
- `@nextclaw/runtime@0.2.57-beta.2`
- `@nextclaw/server@0.12.26-beta.2`
- `@nextclaw/service@0.1.18-beta.2`
- `@nextclaw/shared@0.1.12-beta.2`
- `@nextclaw/ui@0.12.35-beta.2`

发布后 `release:verify:published` 确认 registry 上 46/46 个 package version 均可见。`nextclaw` dist-tag 当前为 `latest = 0.19.28`、`beta = 0.19.31-beta.2`。
