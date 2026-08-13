---
name: nextclaw-npm-release
description: NextClaw NPM package 与 runtime channel 发布的专项流程 owner；覆盖 beta/stable、隔离 worktree、真实安装验证和分支回流，并按当前阶段读取一个 reference。
---

# NextClaw NPM Release

## 阶段路由

- 版本范围、changeset、依赖闭包、registry 发布：读取 [Package 发布](references/package-release.md)。
- beta/stable runtime bundle、manifest、Pages：读取 [Runtime channel](references/runtime-channel.md)。
- 验证真实 `nextclaw@beta/latest` 安装与 update：读取 [Published install](references/published-install-validation.md)。
- 隔离 worktree、release branch 与 master 回流：读取 [分支闭合](references/branch-closure.md)。
- 用户要求统一 beta 发布闭环：读取 [Beta 发布](references/beta-release.md)。
- 已提交发布范围必须与当前 WIP 隔离：读取 [隔离 Worktree](references/isolated-worktree.md)。

一次只读取当前阶段。Desktop installer/DMG 由 desktop release skill 拥有。

## 永久合同

- 使用仓库 release flow，不以包目录 raw `npm publish` 作为默认路径。
- `nextclaw` 是已发布 workspace 依赖闭包和嵌入 UI/runtime 产物的产品包，不只看自身版本。
- 发布包必须包含 launcher/app entries 和 `resources/update-bundle-public.pem`。
- NPM runtime manifest 使用 `hostKind: npm-runtime-bundle`，兼容 floor 来自 `packages/nextclaw/npm-runtime-compatibility.json`，只有 launcher 合同破坏才提高。
- Registry、runtime channel、release notes、分支/记录回流和生成物清理按用户授权范围形成一个闭环。
- `nextclaw` 的 stable `minor` / `major` 发布必须在 `docs/releases/nextclaw-v<version>.release-review.json` 中审查文档站、官网和 X 宣发：文档站/官网要么列出真实更新路径，要么明确记录 `not-needed` 原因；stable minor 必须提前冻结 X 账号、正文、release note URL、图片和 alt，`release:stable` 在 publish 前做确定性校验。
- 执行 stable minor X 帖前，先查最近一次成功 stable minor 的迭代记录并复用已经验证的 `x-bird`、Node/代理参数和回读命令；不得在已有成功路径时从通用工具重新推演。只有帖子返回 ID，并回读确认作者、正文和媒体后才算发布闭合；X 阻断时必须明确标记 social 未完成，不得对用户报告“全部完成”。

## 默认版本级别

- 只判断产品包 `nextclaw` 的版本级别：用户明确指定时照做；未指定时由发布任务按完整未发布批次主动决定并说明，不反问用户。
- 批次包含明显的向后兼容新能力时选择 `minor`，只有修复、润色和内部调整时选择 `patch`；现有 changeset 只是输入，不替代这个整体判断。
- 其余 workspace package 不逐包做语义版本裁决，按依赖闭包和 changeset 跟随发布；确定 `minor` 后只需把一个代表性 changeset 中的 `nextclaw` bump 提升为 `minor`。

Stable 完整闭环优先 `pnpm release:stable`；Beta 优先 `pnpm release:beta`。仅 beta NPM 用 `release:beta:npm`，仅 channel 用 `release:beta:runtime` / `release:stable:runtime`。恢复已发布 stable 时使用 `release:stable -- --resume-from <git|runtime|install> --version <version>`，不得重复 publish。

最终报告 package/version/dist-tag、workflow、manifest、真实安装证据、分支闭合和残余 WIP。
