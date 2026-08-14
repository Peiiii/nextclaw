---
name: nextclaw-npm-release
description: NextClaw NPM package 与 runtime channel 发布的专项流程 owner；用于发布 NPM、NPM 测试版、NextClaw 常规正式版及其恢复，覆盖 beta/stable、真实安装和分支回流，并按当前阶段读取一个 reference。
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
- 发布授权按对象严格分层：NPM-only 不授权 runtime、desktop、文档站、官网或 X；常规 NextClaw stable 包含 NPM 与 runtime/product closure，但不包含 desktop；全平台发布完成常规 stable 后才转交 desktop owner。
- 结构化 release notes、文档站、官网和 X 不阻塞 NPM artifact publish。它们在常规产品 stable 的 runtime/product 阶段按版本级别校验；缺失时保留已经成立的 `NPM_READY`，从对应阶段恢复，不重复 publish。
- `nextclaw` 的 stable `minor` / `major` 必须在 `docs/releases/nextclaw-v<version>.release-review.json` 中审查文档站、官网和 X 宣发：文档站/官网要么列出真实更新路径，要么明确记录 `not-needed` 原因；stable minor 必须冻结 X 账号、正文、release note URL、图片和 alt。该合同影响 `NEXTCLAW_STABLE_READY`，不影响 `NPM_READY`。
- 执行 stable minor X 帖前，先查最近一次成功 stable minor 的迭代记录并复用已经验证的 `x-bird`、Node/代理参数和回读命令；不得在已有成功路径时从通用工具重新推演。只有帖子返回 ID，并回读确认作者、正文和媒体后才算发布闭合；X 阻断时必须明确标记 social 未完成，不得对用户报告“全部完成”。

## 发布意图与完成点

- “发 NPM”、`/发布NPM`：`pnpm release:npm:stable`，只闭合 stable NPM，完成点 `NPM_READY`。
- “发 NPM beta”、`/发布NPM测试版`：`pnpm release:npm:beta`，只闭合 beta NPM，完成点 `NPM_READY (channel: beta)`。
- “发布 NextClaw 正式版”、`/发布NextClaw正式版`：`pnpm release:product:stable`，先报告 `NPM_READY`，再闭合 runtime/product，完成点 `NEXTCLAW_STABLE_READY`；desktop 明确排除。
- “发布 NextClaw 全平台版”先完成上述常规 stable，再由 Delivery 转交 desktop owner；本 skill 不直接拥有 desktop。

发布开始先报告版本变化包数、实际 NPM 上传包数、验证闭包和排除表面。每个不可逆阶段使用 checkpoint；下游失败只恢复未完成阶段。

## 默认版本级别

- 只判断产品包 `nextclaw` 的版本级别：用户明确指定时照做；未指定时由发布任务按完整未发布批次主动决定并说明，不反问用户。
- 批次包含明显的向后兼容新能力时选择 `minor`，只有修复、润色和内部调整时选择 `patch`；现有 changeset 只是输入，不替代这个整体判断。
- 其余 workspace package 不逐包做语义版本裁决，按依赖闭包和 changeset 跟随发布；确定 `minor` 后只需把一个代表性 changeset 中的 `nextclaw` bump 提升为 `minor`。

Stable NPM-only 优先 `pnpm release:npm:stable`；常规 stable 产品优先 `pnpm release:product:stable`；Beta NPM-only 优先 `pnpm release:npm:beta`。旧的 `release:stable`、`release:beta:npm` 与 full-beta `release:beta` 保留兼容；仅 channel 用 `release:beta:runtime` / `release:stable:runtime`。恢复已发布 stable 时使用 `release:stable -- --resume-from <git|runtime|install> --version <version>`，不得重复 publish。

Stable 正式发布采用 ahead-of-window prepare/publish 两阶段实现，但用户语义仍只有一个“发布 NPM”。release-bearing `master` push 后由 `npm-release-prepare` workflow 为 exact commit 自动执行 version、strict validation、pack 与 artifact 导出；delivery 在交付这类 commit 时等待 workflow artifact 成立，不能等用户发出发布命令后再做分钟级准备。用户授权发布后只执行 `pnpm release:npm:stable -- --branch <release-branch> --target-branch master`：它消费本地证明或下载 HEAD 对应成功 artifact，缺失/失效时快速失败，绝不回退旧慢链路。prepare 不写 NPM/Git；`NPM_READY` 计时包含 artifact 定位/下载、逐包 identity 验证、空缓存公网精确 payload 审计和 Git 闭环，必须真实小于 60 秒，任一分支失败都不报告完成。

任何 NPM auth/permission 结论都必须先解析并报告正式命令实际使用的 userconfig，再用同一配置运行 `npm whoami`；项目根 `.npmrc` 存在时，默认 `~/.npmrc` 的 401/404 不是 token 失效证据，禁止据此要求用户重新登录。`release:stable` 必须直接输出有效 userconfig 路径和身份；正式发布找不到显式、当前 worktree 或主 worktree 的项目 `.npmrc` 时 fail closed，禁止退回环境默认 `~/.npmrc`。publish 成功能力与 dist-tag 删除等 package-setting 强认证能力分别判断，不得混为一个“没有 NPM 权限”。

最终报告 package/version/dist-tag、workflow、manifest、真实安装证据、分支闭合和残余 WIP。
