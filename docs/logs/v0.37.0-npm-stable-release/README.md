# NextClaw 0.37.0 NPM Stable 发布记录

## 迭代完成说明

本次从 `master` 提交 `c2d0e91c06317e9bf8d069b238dec76caa9f1dfc` 创建隔离 release worktree，发布 NextClaw NPM stable / `latest`。批次包含会话工作台 Token 统计与缓存命中率、子会话创建入口、命令执行计时、交互式 CLI 连续输入、Web Chat 网络恢复和内嵌浏览器标签关闭交互修复。

本批次具有明确的新产品能力，因此将 `nextclaw` 从 `0.36.2` 提升为 minor `0.37.0`。确定性发布流程完成了版本化、严格 build / tsc / lint 验证、44 个 public package 发布与精确 registry 验证、44 个 Git tag、发布后公网冷安装，以及发布分支向 `master` 的历史闭合。最终状态为 `NPM_READY`，`nextclaw@latest` 已指向 `0.37.0`。

第一次正式执行在 publish 前被干净拦截：`@nextclaw/nextclaw-ncp-runtime-http-client` 的测试通过 package 自引用导入公共入口，但 clean worktree 中尚无 `dist`，package `tsconfig.json` 也缺少 self path，导致 TypeScript 无法解析模块。该次没有发生 registry mutation。修复提交 `c0c78c73d` 为 self package 补充 `src/index.ts` 映射，定向 package tsc、3 个测试和 lint 通过后重新执行完整发布，未绕过严格门禁。

## 测试/验证/验收方式

- `pnpm release:npm:stable -- --branch codex/release-npm-stable-20260814-c2d0e91c`
  - clean release worktree：通过
  - strict build / tsc / lint closure：通过
  - publish checkpoint：44 个 public package
  - registry verification：44/44 精确 `pkg@version` 可见
  - release commit：`e115d68c9d33fad09a16c64355cb78d131bea439`
  - package tags：44/44 已推送
- `npm view nextclaw@0.37.0 version --json`：返回 `0.37.0`。
- `npm view nextclaw dist-tags --json`：`latest` 返回 `0.37.0`。
- Published install：从公开 registry 在临时 prefix 精确安装 `nextclaw@0.37.0` 成功。
- Installed runtime：`nextclaw --version` 返回 `0.37.0`；app entry、launcher entry、update public key、embedded UI 全部存在。
- HTTP runtime self type 修复定向验证：package tsc 通过，3 个测试通过，lint 0 error；保留 2 个既有 warning。
- Branch closure：发布内容通过 merge commit `8aa46463f5e6bdbbbbb36ad6be2673fd0ddf89d5` 合入本地 `master`，同时保留发布期间 `master` 新增的 AI telemetry 提交。

## 发布/部署方式

- 发布对象：NPM stable / `latest`。
- 执行分支：`codex/release-npm-stable-20260814-c2d0e91c`。
- Release commit：`e115d68c9d33fad09a16c64355cb78d131bea439`。
- 目标分支：本地 `master` 与 `origin/master`。
- 发布产物：44 个 NPM package、44 个对应 Git tag，以及与源码同批构建的 `packages/nextclaw/ui-dist`。
- 不包含：stable runtime channel、desktop installer、docs site、website 和 X 发布。

## 用户/产品视角的验收步骤

1. 运行 `npm view nextclaw@latest version`，应返回 `0.37.0`。
2. 在临时 prefix 执行 `npm install -g nextclaw@0.37.0 --prefix <temp>`。
3. 运行 `<temp>/bin/nextclaw --version`，应返回 `0.37.0`。
4. 打开会话工作台：概览底部应显示 Token 用量；按模型可查看输入、输出、缓存输入、总量和缓存命中率。
5. 打开子会话管理页：应能从“新建子会话”入口创建继承当前上下文的新会话。
6. 运行命令工具：执行中应持续显示耗时，成功、失败或取消后冻结耗时，刷新后仍可恢复。
7. 本次只验收 NPM 安装入口；runtime update channel 和 desktop 不属于完成范围。

## 可维护性总结汇总

- NPM-only 发布在隔离 worktree 中完成，没有把主工作区生成噪音混入 release batch。
- `nextclaw-ncp-runtime-http-client` 的公共入口现在由 package 自身 tsconfig 解析，clean checkout 不再隐式依赖已有 `dist`，TypeScript 验证与发布构建使用同一源码 owner。
- 会话 Token 数据沿既有 session usage 主链路展示，并按模型聚合；子会话创建复用侧边会话的上下文继承链路，没有新增平行创建协议。
- 发布版本、CHANGELOG、tag、registry 精确验证、冷安装和分支闭环均由既有 release automation 完成，没有手工修改 registry dist-tag 或跳过验证。
- 新增发布记录路径 `docs/logs/v0.37.0-npm-stable-release/README.md` 已在编辑前通过 planned-path governance preflight。

## NPM 包发布记录

以下 44 个 package 已发布并通过精确 registry 验证：

- `@nextclaw/agent-chat-ui@0.6.25`
- `@nextclaw/agent-chat@0.3.14`
- `@nextclaw/channel-extension-dingtalk@0.2.27`
- `@nextclaw/channel-extension-discord@0.2.27`
- `@nextclaw/channel-extension-email@0.2.27`
- `@nextclaw/channel-extension-feishu@0.2.25`
- `@nextclaw/channel-extension-qq@0.2.24`
- `@nextclaw/channel-extension-slack@0.2.27`
- `@nextclaw/channel-extension-telegram@0.2.27`
- `@nextclaw/channel-extension-wecom@0.2.27`
- `@nextclaw/channel-extension-weixin@0.2.25`
- `@nextclaw/channel-extension-whatsapp@0.2.27`
- `@nextclaw/client-sdk@0.6.2`
- `@nextclaw/companion@0.2.32`
- `@nextclaw/core@0.17.1`
- `@nextclaw/extension-sdk@0.3.24`
- `@nextclaw/kernel@0.8.2`
- `@nextclaw/mcp@0.3.28`
- `@nextclaw/ncp-agent-runtime-next@0.1.18`
- `@nextclaw/ncp-agent-runtime@0.4.18`
- `@nextclaw/ncp-http-agent-client@0.4.18`
- `@nextclaw/ncp-http-agent-server@0.4.18`
- `@nextclaw/ncp-mcp@0.2.28`
- `@nextclaw/ncp-react-ui@0.3.18`
- `@nextclaw/ncp-react@0.5.22`
- `@nextclaw/ncp-toolkit@0.6.20`
- `@nextclaw/ncp@0.8.0`
- `@nextclaw/nextclaw-hermes-acp-bridge@0.3.18`
- `@nextclaw/nextclaw-narp-runtime-claude-code-sdk@0.2.20`
- `@nextclaw/nextclaw-narp-runtime-codex-sdk@0.2.20`
- `@nextclaw/nextclaw-narp-runtime-opencode@0.2.28`
- `@nextclaw/nextclaw-narp-stdio-runtime-wrapper@0.3.19`
- `@nextclaw/nextclaw-ncp-runtime-adapter-hermes-http@0.3.19`
- `@nextclaw/nextclaw-ncp-runtime-claude-code-sdk@0.2.20`
- `@nextclaw/nextclaw-ncp-runtime-codex-sdk@0.2.19`
- `@nextclaw/nextclaw-ncp-runtime-http-client@0.3.18`
- `@nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.28`
- `@nextclaw/remote@0.3.32`
- `@nextclaw/runtime@0.4.27`
- `@nextclaw/server@0.16.2`
- `@nextclaw/service@0.3.35`
- `@nextclaw/shared@0.4.24`
- `@nextclaw/ui@0.17.2`
- `nextclaw@0.37.0`

发布状态：全部已发布；`nextclaw@latest` 为 `0.37.0`；无待发布 package；无残余 registry blocker。
