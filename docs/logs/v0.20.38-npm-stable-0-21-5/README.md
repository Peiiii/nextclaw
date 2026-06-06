# NextClaw NPM stable 0.21.5 release

## 迭代完成说明

本次按正式 NPM 发布路径把 NextClaw public workspace 批次发布到 npm `latest`。

关键处理：

- 从 Changesets `pre` / `beta` 模式退出，避免正式发布继续生成 beta 版本。
- 执行正式发布准备、版本生成与 npm publish。
- 发布 `nextclaw@0.21.5` 以及直接运行时依赖闭包中的 public workspace packages。
- 确认 npm registry 上 `nextclaw@latest` 已指向 `0.21.5`，`beta` 保持 `0.21.5-beta.0`。

后续闭环：

- release metadata、changelog、生成的 `ui-dist` 与 release record 已提交并推送到 `master`。
- 48 个 stable release tags 已推送到远端。
- stable NPM runtime update channel 已通过 GitHub Actions 发布到 `0.21.5`。

## 测试/验证/验收方式

已执行：

- `pnpm release:report:health`
  - 发布前：当前批次存在已发布 beta 版本，仓库其他发布健康。
  - 发布后：`Repository release health is clean.`
- `pnpm changeset pre exit`
  - 成功退出 prerelease mode。
- `pnpm release:auto:prepare`
  - 同步 published tags，无 drift。
  - 生成 full public workspace stable release changeset。
- `pnpm release:version`
  - readme 同步检查通过。
  - publish group guard 通过。
  - 生成 stable package versions 和 changelog。
- `pnpm release:publish`
  - readme 同步检查通过。
  - publish group guard 通过。
  - `release:check` 完成 batch build / tsc。
  - `changeset publish` 发布成功。
  - `release:verify:published` 确认 `published 48/48 package versions`。
- `npm view nextclaw dist-tags --json`
  - `latest: 0.21.5`
  - `beta: 0.21.5-beta.0`
- 临时 prefix 真实安装：
  - `npm install -g nextclaw@latest --prefix <temp>/prefix`
  - `<temp>/prefix/bin/nextclaw --version` 输出 `0.21.5`
  - `NEXTCLAW_HOME=<temp>/home <temp>/prefix/bin/nextclaw update --check --json` 返回 stable `up-to-date`，未依赖自定义 manifest URL 或 public key env。
- `origin/gh-pages` stable manifests 检查：
  - 当前为 `latestVersion: 0.21.5`
  - `minimumLauncherVersion: 0.18.11`
  - `hostKind: npm-runtime-bundle`
- public stable manifests 检查：
  - 当前为 `latestVersion: 0.21.5`
  - `minimumLauncherVersion: 0.18.11`
  - `hostKind: npm-runtime-bundle`
- 真实旧版升级烟测：
  - `npm install -g nextclaw@0.21.3 --prefix <temp>/prefix`
  - 初始 `nextclaw --version` 输出 `0.21.3`
  - `update --check --json` 返回 `update-available`，`availableVersion: 0.21.5`
  - `update --download-only --json` 返回 `downloaded`，`downloadedVersion: 0.21.5`
  - `update --apply --json` 返回 `restart-required`，`currentVersion: 0.21.5`
  - fresh process `nextclaw --version` 输出 `0.21.5`

## 发布/部署方式

NPM 已发布到 registry：

- dist-tag：`latest`
- 主包：`nextclaw@0.21.5`
- registry 验证：`release:verify:published` 通过，48/48 package versions 可见。

已执行：

- commit：`decc2998c chore: release npm stable 0.21.5`
- push：`master -> origin/master`
- tags：48 个 stable release tags 已推送。
- runtime workflow：`npm-runtime-update-release.yml` run `27067428239`
- workflow URL：`https://github.com/Peiiii/nextclaw/actions/runs/27067428239`
- runtime release URL：`https://github.com/Peiiii/nextclaw/releases/tag/nextclaw%400.21.5`
- release assets：
  - `nextclaw-runtime-darwin-arm64-0.21.5.zip`
  - `nextclaw-runtime-darwin-x64-0.21.5.zip`
  - `nextclaw-runtime-linux-x64-0.21.5.zip`
  - `nextclaw-runtime-win32-x64-0.21.5.zip`

## 用户/产品视角的验收步骤

已验证新用户安装路径：

```bash
npm install -g nextclaw@latest
nextclaw --version
```

期望结果：

```text
0.21.5
```

已验证默认 stable update check 不需要额外 env：

```bash
NEXTCLAW_HOME="$(mktemp -d)" nextclaw update --check --json
```

当前结果：

- 新安装态 `hostVersion/currentVersion` 为 `0.21.5`。
- public stable runtime channel 为 `0.21.5`。
- 旧正式安装 `0.21.3` 可通过 stable update channel 下载并应用 `0.21.5`。

## 可维护性总结汇总

本次是发布与 release metadata 变更，不是源码功能实现。

- 代码实现可维护性评估：不适用，未手写业务源码改动。
- 生成产物：`release:check` 重新生成了 package `dist` 与 `packages/nextclaw/ui-dist`；其中 `ui-dist` 当前在工作区体现为 hash asset 替换。
- release metadata：Changesets 消费了既有 changesets，生成 package versions 与 changelog。
- 当前 release metadata 已提交并推送；本记录后续更新用于补齐 runtime channel 闭环事实。

## NPM 包发布记录

本次已完成正式 NPM 发布。发布批次共 48 个 package versions：

- `nextclaw@0.21.5`
- `@nextclaw/agent-chat@0.2.10`
- `@nextclaw/agent-chat-ui@0.4.10`
- `@nextclaw/aigen@0.1.2`
- `@nextclaw/app-runtime@0.8.10`
- `@nextclaw/app-sdk@0.2.10`
- `@nextclaw/channel-extension-dingtalk@0.1.15`
- `@nextclaw/channel-extension-discord@0.1.15`
- `@nextclaw/channel-extension-email@0.1.15`
- `@nextclaw/channel-extension-feishu@0.1.22`
- `@nextclaw/channel-extension-qq@0.1.19`
- `@nextclaw/channel-extension-slack@0.1.15`
- `@nextclaw/channel-extension-telegram@0.1.15`
- `@nextclaw/channel-extension-wecom@0.1.15`
- `@nextclaw/channel-extension-weixin@0.1.26`
- `@nextclaw/channel-extension-whatsapp@0.1.15`
- `@nextclaw/client-sdk@0.4.0`
- `@nextclaw/companion@0.1.28`
- `@nextclaw/core@0.14.1`
- `@nextclaw/extension-sdk@0.2.11`
- `@nextclaw/feishu-core@0.2.31`
- `@nextclaw/kernel@0.4.1`
- `@nextclaw/mcp@0.2.11`
- `@nextclaw/ncp@0.6.0`
- `@nextclaw/ncp-agent-runtime@0.3.41`
- `@nextclaw/ncp-agent-runtime-next@0.0.13`
- `@nextclaw/ncp-http-agent-client@0.3.42`
- `@nextclaw/ncp-http-agent-server@0.3.42`
- `@nextclaw/ncp-mcp@0.1.106`
- `@nextclaw/ncp-react@0.4.50`
- `@nextclaw/ncp-react-ui@0.2.42`
- `@nextclaw/ncp-toolkit@0.5.35`
- `@nextclaw/nextclaw-hermes-acp-bridge@0.2.10`
- `@nextclaw/nextclaw-narp-runtime-claude-code-sdk@0.1.28`
- `@nextclaw/nextclaw-narp-runtime-codex-sdk@0.1.29`
- `@nextclaw/nextclaw-narp-runtime-opencode@0.1.9`
- `@nextclaw/nextclaw-narp-stdio-runtime-wrapper@0.2.10`
- `@nextclaw/nextclaw-ncp-runtime-adapter-hermes-http@0.2.10`
- `@nextclaw/nextclaw-ncp-runtime-claude-code-sdk@0.1.52`
- `@nextclaw/nextclaw-ncp-runtime-codex-sdk@0.1.51`
- `@nextclaw/nextclaw-ncp-runtime-http-client@0.2.10`
- `@nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.10`
- `@nextclaw/remote@0.2.11`
- `@nextclaw/runtime@0.3.11`
- `@nextclaw/server@0.14.1`
- `@nextclaw/service@0.2.11`
- `@nextclaw/shared@0.2.10`
- `@nextclaw/ui@0.13.11`

发布状态：

- npm registry：已发布。
- `latest` dist-tag：已指向 `nextclaw@0.21.5`。
- release health：干净。
- stable runtime channel：已更新到 `0.21.5`，workflow success，public manifests 已验证。
