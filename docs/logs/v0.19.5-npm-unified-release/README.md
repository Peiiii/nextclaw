# v0.19.5 NPM 统一发布

## 迭代完成说明

- 执行一次全量 public workspace NPM 统一发布，覆盖 47 个 public 包。
- 本次发布将 `nextclaw` 从 `0.19.20` 提升到 `0.19.21`，并同步提升相关 workspace 包 patch 版本。
- 发布过程中 `@nextclaw/channel-extension-qq@0.1.1` 首次 registry verify 出现短暂可见性延迟；后续确认 package access 为 public、dist-tag 为 `latest: 0.1.1`，并补跑验证通过。
- 根因：首次失败不是源码或构建问题，而是 npm registry 对新 scoped package 的可见性/索引状态短暂不一致；单包重发返回 `403 already published`，证明版本已进入 registry，等待后全量验证通过。
- 本次修正当前任务中的具体错误：按用户要求从小 batch 改为全量 public workspace batch，而不是只发布当前可见改动包。

## 测试/验证/验收方式

- `pnpm release:version`：通过，生成全量 release metadata。
- `pnpm release:publish`：执行 README sync/check、release group guard、全量 release check、changeset publish。
- `pnpm release:check`：47 个 public batch 包 build/tsc 通过；第二次发布重试复用 checkpoint 缓存。
- `pnpm release:verify:published`：补跑通过，确认 `published 47/47 package versions`。
- `npm view nextclaw version`：返回 `0.19.21`。
- `npm dist-tag ls @nextclaw/channel-extension-qq`：返回 `latest: 0.1.1`。

## 发布/部署方式

- 发布入口：`pnpm release:publish`。
- 发布 registry：`https://registry.npmjs.org/`。
- dist-tag：`latest`。
- 本次不涉及数据库 migration、远程服务 deploy 或桌面安装包发布。
- 本次未触发 NPM runtime update channel；该链路不属于当前稳定 NPM 包统一发布脚本的自动步骤。

## 用户/产品视角的验收步骤

- 用户可通过 `npm install -g nextclaw@latest` 获取 `nextclaw@0.19.21`。
- 运行 `nextclaw --version` 应显示 `0.19.21`。
- QQ channel extension 已作为独立 NPM 包发布为 `@nextclaw/channel-extension-qq@0.1.1`。

## 可维护性总结汇总

- 本次主要是发布 metadata、版本号和 changelog 变更，不新增运行时代码。
- 代码实现维护性不适用；相关源码验证由 release check 的 build/tsc 覆盖。
- 本次流程教训：用户明确要求“整体/统一/全部发布”时，必须按全量 public workspace batch 处理；不能停留在当前 changeset 小 batch。
- 发布后 registry verify 不应因单个新包短暂索引延迟就误判为源码发布失败；需要结合 `dist-tag`、access status、重发返回和补跑 verify 作最终判断。

## NPM 包发布记录

- 需要发布：是。原因是用户明确要求 NPM 统一全量发布。
- 发布范围：全量 public workspace batch，共 47 个包。
- 核心版本：
  - `nextclaw@0.19.21`
  - `@nextclaw/core@0.12.20`
  - `@nextclaw/kernel@0.1.9`
  - `@nextclaw/service@0.1.12`
  - `@nextclaw/server@0.12.20`
  - `@nextclaw/ui@0.12.29`
  - `@nextclaw/channel-extension-qq@0.1.1`
- 发布状态：已发布到 npm registry，并通过 `pnpm release:verify:published` 确认 47/47 package versions。
- 外部阻塞：首次发布前 npm token 状态判断有误；重试后发布成功。`@nextclaw/channel-extension-qq` 出现短暂 registry verify 延迟，补跑验证后关闭。
