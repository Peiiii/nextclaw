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

- 正式发布同时交付产物与自动化闭环；用结构化时序/依赖图找 critical path、错误等待和无效串行/重复，超预算须修 owner、补合同并沿同 identity/recovery 验证。报告总/NPM_READY 耗时、瓶颈、优化和干预数；dispatch/准备/只读不计，非零时逐项写问题→修复。
- 使用仓库 release flow，不以包目录 raw `npm publish` 作为默认路径。
- 正式发布只 dispatch 一次 parent；Actions 独立闭合构建、发布、传播、真实升级验证、终态与 Git 回流，任何观察者在线都不是完成条件。
- 只调用 owning entry；下游 exact-stage 幂等恢复，禁止重发 identity。
- 验证拓扑按净收益选择：比较根因置信度、focused/failed-job 与全矩阵耗时、重现稳定性和风险，选最低成本的有效层。平台适配、spawn、临时清理、artifact/recovery state 机在反复/高成本/不确定时须有可单模块或单 job 运行的入口和唯一失败映射；高置信度微修可直接 failed-only job。
- 全矩阵只作新 identity 的最终准入；stable recovery 只重跑未证明/失败/cancelled cell，同 tag 完整成功证据可复用。复用源由 Actions 用 tag 与 source ancestry 校验，禁止 AI 拼 matrix 命令或重发 NPM。
- dispatch 前审计同 workflow 队列；旧 SHA 经核对后取消。随后立即取得 run ID、target、head SHA。
- Actions 可等待 child；Agent 不参与状态迁移，只对 parent 有界等待并读最终 summary，禁止轮询、逐 step 监控或 `gh run watch`。成功 job 不读日志；异常只读失败附近。
- `nextclaw` 是已发布 workspace 依赖闭包和嵌入 UI/runtime 产物的产品包，不只看自身版本。
- 发布包必须包含 launcher/app entries 和 `resources/update-bundle-public.pem`。
- NPM runtime manifest 使用 `hostKind: npm-runtime-bundle`，兼容 floor 来自 `packages/nextclaw/npm-runtime-compatibility.json`，只有 launcher 合同破坏才提高。
- 发布授权按对象严格分层：NPM-only 不授权 runtime、desktop、文档站、官网或 X；常规 NextClaw stable 包含 NPM 与 runtime/product closure，但不包含 desktop；全平台发布完成常规 stable 后才转交 desktop owner。
- `target=npm|product` 可报 `CONTENT_READY|CONTENT_PENDING`，内容不阻塞核心 NPM/Runtime；仅 `target=all` 首次 NPM 前验证结构化说明。stable `minor/major` 由 `docs/releases/nextclaw-v<version>.release-review.json` 审查文档站、官网和 X，只影响内容状态，不回退核心完成点。
- stable minor X 帖复用最近成功迭代已验证的 `x-bird`、Node/代理参数和回读命令；返回 ID 并回读作者、正文、媒体才闭合，阻断时标 `CONTENT_PENDING`。

## 发布意图与完成点

完成点只关闭发布子目标。active contract 下映射 stable acceptance IDs 并向 lifecycle 返回 `acceptance_updates`、`parent_status`；`NPM_READY`、`NEXTCLAW_STABLE_READY`、版本或 tag 不能完成 parent-goal。

- “发 NPM”、`/发布NPM`：dispatch `release.yml` 的 `target=npm`，只闭合 stable NPM，完成点 `NPM_READY`。
- “发 NPM beta”、`/发布NPM测试版`：`pnpm release:npm:beta`，只闭合 beta NPM，完成点 `NPM_READY (channel: beta)`。
- “发布 NextClaw 正式版”、`/发布NextClaw正式版`：一次 dispatch `release.yml target=product`，完成点 `NEXTCLAW_STABLE_READY`；desktop 排除。
- “发布 NextClaw 全平台版”：一次 dispatch `target=all`，父 workflow 再调用 desktop owner，完成点 `ALL_PLATFORMS_READY`。

发布开始先报告 `EXISTING_RELEASE_PATH`，再报告版本变化包数、上传包数、验证闭包和排除表面：

- 读取正式 owner `.github/workflows/release.yml`，按实际 environment、secret 和 publish command 判断入口与认证，禁止从旧文档、记忆或迁移方案反推现状。
- 用 `gh run list --workflow release.yml --status success --limit 1` 查最近成功 run；已有生产证据时复用同一 workflow、认证和恢复合同，只有实证失效才讨论重建或迁移。
- 用 `npm view`、`gh release view` 和公开 manifest 判断 identity；已成立阶段只恢复/复用，不得重发。
- 输出 workflow、observed auth mode、latest successful run URL、reusable、evidence gap。远端暂不可读只标 gap，不得把未知说成未实现。

每个不可逆阶段使用 checkpoint；下游失败只恢复未完成阶段。

## 默认版本级别

- 只判断产品包 `nextclaw` 的版本级别：用户明确指定时照做；未指定时由发布任务按完整未发布批次主动决定并说明，不反问用户。
- 批次包含明显的向后兼容新能力时选择 `minor`，只有修复、润色和内部调整时选择 `patch`；现有 changeset 只是输入，不替代这个整体判断。
- 其余 workspace package 不逐包做语义版本裁决，按依赖闭包和 changeset 跟随发布；确定 `minor` 后只需把一个代表性 changeset 中的 `nextclaw` bump 提升为 `minor`。

Stable NPM-only、常规产品与全平台正式入口统一为 GitHub Actions `release.yml`，分别使用 `target=npm|product|all`；Beta NPM-only 仍使用 `pnpm release:npm:beta`。本地 `release:npm:stable`、`release:product:stable`、旧 `release:stable`、`release:beta:npm` 与 full-beta `release:beta` 保留为 dry-run、诊断、兼容和恢复原语；仅 channel 用 `release:beta:runtime` / `release:stable:runtime`。恢复已发布 stable 时使用 `release:stable -- --resume-from <git|runtime|install> --version <version>`，不得重复 publish。

Stable prepare/promotion 在 `master` push 预生成 exact versioned NPM tree 与四平台 Runtime；`release.yml` 只消费匹配 source/version 的产物，缺失时 fail closed。Promotion 预算两分钟，超时复盘但不加人工分支。

Stable 只使用已验收的认证路径，当前为 `npm-production` environment 的 `NPM_TOKEN`。Trusted Publishing 必须在全部包完成配置、canary publish 和 registry identity 验证后单独切换；传统 token 诊断先确认实际 userconfig，再用同一配置验证，不能把错误配置的 401/404 当作权限结论。

“通过 GitHub Actions 发布”不等于“使用 OIDC/Trusted Publishing 认证”。两者分别从 workflow 取证；不得因 Trusted Publishing 未迁移而误判 GitHub 发布未实现。

最终报告 package/version/dist-tag、workflow、manifest、真实安装证据、分支闭合和残余 WIP。
