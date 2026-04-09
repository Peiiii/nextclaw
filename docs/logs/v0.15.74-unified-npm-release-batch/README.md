# v0.15.74-unified-npm-release-batch

## 迭代完成说明（改了什么）

本次迭代将 2026-04-09 至 2026-04-10 期间已合入但尚未发布到 npm 的公开包统一完成一次批量发布，使用仓库内置 `release:auto` 生成发布批次，再通过 `release:publish` 完成发布闭环。

发布过程中，`@nextclaw/ncp-agent-runtime` 在 `packages/ncp-packages/nextclaw-ncp-agent-runtime/src/user-content.ts` 暴露一个真实的 TypeScript 收窄问题：`string | null` 被赋给 `string`。本次同步修正为类型谓词收窄，并利用 `release:check` 的 checkpoint 机制续跑发布，而不是整轮重来。

本次实际发布的包版本如下：

- `nextclaw@0.17.6`
- `@nextclaw/ui@0.12.5`
- `@nextclaw/server@0.12.3`
- `@nextclaw/core@0.12.3`
- `@nextclaw/runtime@0.2.35`
- `@nextclaw/remote@0.1.80`
- `@nextclaw/mcp@0.1.68`
- `@nextclaw/openclaw-compat@1.0.3`
- `@nextclaw/agent-chat@0.1.9`
- `@nextclaw/agent-chat-ui@0.3.2`
- `@nextclaw/feishu-core@0.2.5`
- `@nextclaw/channel-runtime@0.4.20`
- `@nextclaw/channel-plugin-dingtalk@0.2.34`
- `@nextclaw/channel-plugin-discord@0.2.34`
- `@nextclaw/channel-plugin-email@0.2.34`
- `@nextclaw/channel-plugin-mochat@0.2.34`
- `@nextclaw/channel-plugin-qq@0.2.34`
- `@nextclaw/channel-plugin-slack@0.2.34`
- `@nextclaw/channel-plugin-telegram@0.2.34`
- `@nextclaw/channel-plugin-wecom@0.2.34`
- `@nextclaw/channel-plugin-weixin@0.1.28`
- `@nextclaw/channel-plugin-whatsapp@0.2.34`
- `@nextclaw/ncp-agent-runtime@0.3.8`
- `@nextclaw/ncp-mcp@0.1.70`
- `@nextclaw/ncp-react@0.4.18`
- `@nextclaw/ncp-toolkit@0.5.3`
- `@nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk@0.1.47`
- `@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk@0.1.48`

同时完成了对应 `CHANGELOG.md`、`package.json`、`packages/nextclaw/ui-dist` 与发布 tags 的同步。

## 测试 / 验证 / 验收方式

- 发布准备与自动批次生成：
  - `PATH=/opt/homebrew/bin:$PATH NPM_CONFIG_USERCONFIG=/Users/peiwang/Projects/nextbot/.npmrc pnpm release:auto`
- 发布失败后的定点修复验证：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime tsc`
- 正式发布续跑：
  - `PATH=/opt/homebrew/bin:$PATH NPM_CONFIG_USERCONFIG=/Users/peiwang/Projects/nextbot/.npmrc pnpm release:publish`
- 线上版本回查：
  - `PATH=/opt/homebrew/bin:$PATH npm view nextclaw version` -> `0.17.6`
  - `PATH=/opt/homebrew/bin:$PATH npm view @nextclaw/ui version` -> `0.12.5`
  - `PATH=/opt/homebrew/bin:$PATH npm view @nextclaw/server version` -> `0.12.3`
  - `PATH=/opt/homebrew/bin:$PATH npm view @nextclaw/core version` -> `0.12.3`
- 非仓库目录 CLI 冒烟：
  - `tmpdir=$(mktemp -d /tmp/nextclaw-release-smoke.XXXXXX) && NEXTCLAW_HOME="$tmpdir/home" PATH=/opt/homebrew/bin:$PATH pnpm dlx nextclaw@0.17.6 --help && rm -rf "$tmpdir"`
  - 观察点：CLI 成功输出命令帮助和子命令列表。
- 可维护性守卫：
  - `PATH=/opt/homebrew/bin:$PATH pnpm lint:maintainability:guard`
  - 结果：通过；保留 1 条既有目录平铺 warning，位于 `packages/ncp-packages/nextclaw-ncp-agent-runtime/src`，本次未新增该债务。

说明：`release:publish` 已内置执行本批次包的 `build`、`tsc`、`changeset publish`、registry verify 与 tag 收口。

## 发布 / 部署方式

- npm 发布：
  1. `PATH=/opt/homebrew/bin:$PATH NPM_CONFIG_USERCONFIG=/Users/peiwang/Projects/nextbot/.npmrc pnpm release:auto`
  2. 若中途遇到单点校验失败，先修复失败包，再执行 `PATH=/opt/homebrew/bin:$PATH NPM_CONFIG_USERCONFIG=/Users/peiwang/Projects/nextbot/.npmrc pnpm release:publish`
- 远程 migration：不适用，本次不涉及后端数据库 schema 变更
- 服务部署：不适用，本次仅执行 npm 包发布，不包含 Cloudflare / worker / server 独立部署

## 用户/产品视角的验收步骤

1. 在 npm registry 查看 `nextclaw` 最新版本，确认已显示 `0.17.6`。
2. 在 npm registry 查看 `@nextclaw/ui`、`@nextclaw/server`、`@nextclaw/core` 最新版本，确认分别显示 `0.12.5`、`0.12.3`、`0.12.3`。
3. 在任意非仓库临时目录执行 `pnpm dlx nextclaw@0.17.6 --help`。
4. 确认 CLI 可正常安装并输出完整命令列表。
5. 若业务侧依赖 channel/runtime/NCP 相关包，安装本次新版本并确认依赖解析无缺包或版本冲突。

## 可维护性总结汇总

- 长期目标对齐 / 可维护性推进：
  - 本次不是新增功能开发，而是把仓库中已经形成的用户价值统一推送到 npm，避免“仓库状态、包版本、用户可安装版本”继续漂移，符合 NextClaw 作为统一入口产品对交付一致性和可获取性的要求。
  - 顺手推进的一小步是修掉 `@nextclaw/ncp-agent-runtime` 中真实存在的类型收窄错误，避免发布流程长期依赖“等下次有人碰到再修”。
- 是否已尽最大努力优化可维护性：
  - 是。本次优先复用仓库既有 `release:auto` / `release:publish` 流程完成闭环，没有新增额外发布脚本或旁路流程；唯一源代码修改是让类型系统与现有逻辑真实一致。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：
  - 是。源代码侧没有新增补丁式分支，只把 `isModelReachableImageUrl` 改为类型谓词，并在调用处复用已有值完成显式收窄。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：
  - 运行时代码仅净增极少量类型收窄相关行数；本次主要净增来自版本号、changelog 与 `ui-dist` 构建产物，属于发布闭环的最小必要同步。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：
  - 是。本次未新增新的发布抽象或运行时层级；类型修复留在原 helper 边界内完成，没有引入新的 helper/service。
- 目录结构与文件组织是否满足当前项目治理要求：
  - 部分满足。`docs/logs` 迭代目录符合治理要求；但 `packages/ncp-packages/nextclaw-ncp-agent-runtime/src` 仍存在既有目录平铺 warning，本次未继续恶化，下一步应按职责拆出更清晰的子目录边界。
  - 是否基于独立于实现阶段的 `post-edit-maintainability-review` 填写：
  - 是。结论如下：
  - 可维护性复核结论：保留债务经说明接受
  - 本次顺手减债：是
  - 代码增减报告：
    - 新增：1361 行
    - 删除：115 行
    - 净增：+1246 行
  - 非测试代码增减报告：
    - 新增：1361 行
    - 删除：115 行
    - 净增：+1246 行
  - 可维护性总结：no maintainability findings。净增几乎全部来自版本号、changelog、发布记录与 `ui-dist` 构建产物同步；唯一源代码调整是 `user-content.ts` 的类型谓词收窄修正。唯一保留的维护性债务是 `packages/ncp-packages/nextclaw-ncp-agent-runtime/src` 的既有目录平铺 warning，本次没有继续放大，后续应在非发布类迭代中拆分目录边界。
