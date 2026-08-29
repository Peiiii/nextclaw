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
- 正式发布默认低 Token 全自动闭环：一次意图判断和 dispatch 后，由 Actions 完成构建、发布、验证与 Git 回流；AI 不在本地重复编排。
- 完整跨平台矩阵只作最终准入，不作调试。失败先用本地定向、失败步骤/单平台或最终产物实机验证；合同通过后再跑完整矩阵，复用成功产物和已发布 identity。
- dispatch 前审计同 workflow 的 queued/in-progress run；旧 SHA 的失效队列经精确核对后取消。dispatch 后必须立即取得新 run ID、target 与 head SHA；没有这组证据就不算已触发。
- 等待使用产品 wait/automation 或至少两分钟一次的有界状态检查；禁止 `nohup` 等无法确认结果的 fire-and-forget，也不使用持续刷新的 `gh run watch`。状态未变化时不分析、不播报。
- 成功 job 不读日志；失败或异常时只读失败步骤附近的最小日志。最终一次性报告 identity、状态和验证证据。
- `nextclaw` 是已发布 workspace 依赖闭包和嵌入 UI/runtime 产物的产品包，不只看自身版本。
- 发布包必须包含 launcher/app entries 和 `resources/update-bundle-public.pem`。
- NPM runtime manifest 使用 `hostKind: npm-runtime-bundle`，兼容 floor 来自 `packages/nextclaw/npm-runtime-compatibility.json`，只有 launcher 合同破坏才提高。
- 发布授权按对象严格分层：NPM-only 不授权 runtime、desktop、文档站、官网或 X；常规 NextClaw stable 包含 NPM 与 runtime/product closure，但不包含 desktop；全平台发布完成常规 stable 后才转交 desktop owner。
- `target=npm` 可独立报告 `CONTENT_READY|CONTENT_PENDING`；`target=product|all` 必须在首次 NPM publish 前验证结构化说明和适用内容合同，且 `all` 的 closure commit 必须携带 Desktop 所需说明。发布后只更新可变说明投影，不重复产物 identity。
- `nextclaw` 的 stable `minor` / `major` 必须在 `docs/releases/nextclaw-v<version>.release-review.json` 中审查文档站、官网和 X 宣发：文档站/官网要么列出真实更新路径，要么明确记录 `not-needed` 原因；stable minor 必须冻结 X 账号、正文、release note URL、图片和 alt。该合同影响 `CONTENT_READY`，不回退已经成立的 `NPM_READY` 或 `NEXTCLAW_STABLE_READY`。
- 执行 stable minor X 帖前，先查最近一次成功 stable minor 的迭代记录并复用已经验证的 `x-bird`、Node/代理参数和回读命令；不得在已有成功路径时从通用工具重新推演。只有帖子返回 ID，并回读确认作者、正文和媒体后才算内容闭合；X 阻断时必须明确标记 `CONTENT_PENDING`，不得对用户报告内容“全部完成”。

## 发布意图与完成点

- “发 NPM”、`/发布NPM`：dispatch `release.yml` 的 `target=npm`，只闭合 stable NPM，完成点 `NPM_READY`。
- “发 NPM beta”、`/发布NPM测试版`：`pnpm release:npm:beta`，只闭合 beta NPM，完成点 `NPM_READY (channel: beta)`。
- “发布 NextClaw 正式版”、`/发布NextClaw正式版`：dispatch `release.yml` 的 `target=product`，先报告 `NPM_READY`，再闭合 runtime/product，完成点 `NEXTCLAW_STABLE_READY`；desktop 明确排除。
- “发布 NextClaw 全平台版”单次 dispatch `release.yml` 的 `target=all`；父 workflow 在常规 stable 成功后调用 desktop owner，最终报告 `ALL_PLATFORMS_READY`。Delivery 只触发和监控，不在本地编排阶段。

发布开始先报告 `EXISTING_RELEASE_PATH`，再报告版本变化包数、上传包数、验证闭包和排除表面：

- 读取正式 owner `.github/workflows/release.yml`，按实际 environment、secret 和 publish command 判断入口与认证，禁止从旧文档、记忆或迁移方案反推现状。
- 用 `gh run list --workflow release.yml --status success --limit 1` 查最近成功 run；已有生产证据时复用同一 workflow、认证和恢复合同，只有实证失效才讨论重建或迁移。
- 用 `npm view`、`gh release view` 和公开 manifest 判断目标 identity；已成立阶段只恢复/复用，不得重发。
- 输出 workflow、observed auth mode、latest successful run URL、reusable、evidence gap。远端暂不可读只标 gap，不得把未知说成未实现。

每个不可逆阶段使用 checkpoint；下游失败只恢复未完成阶段。

## 默认版本级别

- 只判断产品包 `nextclaw` 的版本级别：用户明确指定时照做；未指定时由发布任务按完整未发布批次主动决定并说明，不反问用户。
- 批次包含明显的向后兼容新能力时选择 `minor`，只有修复、润色和内部调整时选择 `patch`；现有 changeset 只是输入，不替代这个整体判断。
- 其余 workspace package 不逐包做语义版本裁决，按依赖闭包和 changeset 跟随发布；确定 `minor` 后只需把一个代表性 changeset 中的 `nextclaw` bump 提升为 `minor`。

Stable NPM-only、常规产品与全平台正式入口统一为 GitHub Actions `release.yml`，分别使用 `target=npm|product|all`；Beta NPM-only 仍使用 `pnpm release:npm:beta`。本地 `release:npm:stable`、`release:product:stable`、旧 `release:stable`、`release:beta:npm` 与 full-beta `release:beta` 保留为 dry-run、诊断、兼容和恢复原语；仅 channel 用 `release:beta:runtime` / `release:stable:runtime`。恢复已发布 stable 时使用 `release:stable -- --resume-from <git|runtime|install> --version <version>`，不得重复 publish。

Stable 正式发布采用 prepare/publish 两阶段，但用户语义仍只有一次发布。release-bearing `master` push 由 `npm-release-prepare` 为 exact commit 提前生成不可变 artifact；授权后 `release.yml` 只消费匹配 artifact，缺失时快速失败且不回退慢链路。`NPM_READY` 仍以 registry identity、公开 payload 与 Git 闭环为准；性能超时只进入复盘，不诱发重复发布。

Stable 只使用已验收的认证路径，当前为 `npm-production` environment 的 `NPM_TOKEN`。Trusted Publishing 必须在全部包完成配置、canary publish 和 registry identity 验证后单独切换；传统 token 诊断先确认实际 userconfig，再用同一配置验证，不能把错误配置的 401/404 当作权限结论。

“通过 GitHub Actions 发布”不等于“使用 OIDC/Trusted Publishing 认证”。两者分别从 workflow 取证；不得因 Trusted Publishing 未迁移而误判 GitHub 发布未实现。

最终报告 package/version/dist-tag、workflow、manifest、真实安装证据、分支闭合和残余 WIP。
