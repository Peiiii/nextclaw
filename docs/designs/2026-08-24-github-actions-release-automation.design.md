# GitHub Actions 全自动发布设计

## 文档状态

- 日期：2026-08-24
- 风险：L4（NPM、Git tag、GitHub Release、签名更新渠道与恢复边界）
- 状态：Implemented；`nextclaw@0.43.0` 已完成首次正式生产验收，本次补充真实运行后的可靠性修订
- 关系：本设计把 `docs/designs/2026-08-09-stable-npm-release-automation.design.md` 的生产编排 owner 从本地 CLI 迁移到 GitHub Actions；保留 `docs/designs/2026-08-14-one-minute-npm-prepared-publish.design.md` 的 exact-commit prepared artifact 和不可逆恢复合同。真实 registry 最终一致性已经证明固定 60 秒端到端门槛不可靠，因此改为分阶段时间预算和有界可见性等待。

## 一、用户问题与可观察目标

正式发布已经由 `.github/workflows/release.yml` 主持：GitHub-hosted runner 下载 prepared artifact、使用 `npm-production` environment 的 `NPM_TOKEN` 发布、提交版本文件和 tag，并继续触发 Runtime。`nextclaw@0.43.0` 的正式运行已经闭合 NPM、Runtime、旧版本升级和主线回流。当前剩余问题不是“尚未实现 GitHub 发布”，而是发布后的 registry 可见性等待过短，以及 Desktop 本地闭环为读取单个 `gh-pages` manifest 抓取了不必要的仓库数据。

目标状态：

1. 用户在 GitHub 选择 `npm` 或 `product` 后只触发一次；正式 NPM、Git 闭环、Runtime 和验证均在 GitHub-hosted runner 完成。
2. 核心发布不调用任何大模型，AI Token 消耗为零；认证用的 GitHub/OIDC 临时凭据和签名私钥不计作 AI Token。
3. `npm` 完成点仍是 `NPM_READY`；`product` 在此基础上闭合 stable Runtime 和旧版本升级，完成点仍是 `NEXTCLAW_STABLE_READY`。
4. 高质量双语更新笔记、博客、官网与 X 内容是同一 release identity 的异步增强状态。它们可以在核心发布前准备，也可以在核心发布后补齐；失败不得重复或回滚已经成立的 NPM publish。
5. Desktop 保持独立发布对象。其跨平台构建仍完全由 Actions 执行，但 stable Desktop 继续要求增强后的双语说明，不因本次改造降低用户可见发布质量。

## 二、当前链路证据

已验收链路为：

```text
master push
  -> npm-release-prepare（exact SHA version/build/tsc/lint/pack artifact）
  -> release.yml target=npm|product [environment: npm-production]
     -> environment NPM_TOKEN
     -> npm publish prepared tarballs
     -> registry identity + cold tarball audit
     -> release commit/package tags/push
     -> target=product 时 dispatch npm-runtime-update-release
        -> Actions 四平台 Runtime bundle/GitHub Release/gh-pages manifests
        -> previous stable update smoke
```

Desktop 是“本地命令建 release identity 并等待，Actions 负责远端 preflight、多平台 installer、assets、manifest、APT 和公开验证”。文档站也已有独立 Actions 部署。`0.43.0` 的产品与 Desktop 正式版已经分别通过上述 owner 完成生产验收。

## 三、候选方案

### 方案 A：把现有本地命令原样放进一个 Actions step

优点是改动最少。缺点是仍要求 `.npmrc`、`npm whoami`，workflow 只是远程终端，本地 CLI 继续拥有生产生命周期，权限也集中在一个长 job。拒绝。

### 方案 B：用 Changesets Action 重写全部版本、打包和发布

优点是社区惯例清晰。缺点是会丢弃现有 prepared artifact、并发 tarball publisher、完整性指纹、60 秒 NPM_READY、精确恢复和 workspace protocol 审计，形成第二套发布合同。拒绝。

### 方案 C：Actions 成为生产 owner，复用现有确定性原语

新增唯一正式 workflow；NPM job 消费现有 exact-commit artifact，随后由独立 Runtime job 复用现有 Runtime closure。原有 CLI 保留为本地 dry-run、诊断和显式恢复入口。认证先使用已经真实验收的 environment token；Trusted Publishing 作为后续独立迁移，不阻塞当前自动发布。选择此方案。

## 四、权威 owner 与主链路

`.github/workflows/release.yml` 是正式 stable 发布生命周期的唯一生产 owner。它只编排状态和权限，不复制 package、manifest、签名或平台构建算法：

```text
workflow_dispatch(master, target=npm|product)
  -> preflight
     -> 确认 master/exact SHA/prepared artifact/非 Changesets pre mode
  -> publish-npm [environment: npm-production]
     -> environment NPM_TOKEN
     -> release:npm:stable
     -> registry identity + cold tarball audit
     -> release commit/package tags/atomic push
     -> NPM_READY
  -> publish-runtime（仅 product 且 batch 包含 nextclaw）
     -> dispatch/wait npm-runtime-update-release
     -> GitHub Release/assets/gh-pages/public manifests
     -> previous stable update smoke
     -> NEXTCLAW_STABLE_READY
  -> summarize（always）
     -> 分别报告 CORE_RELEASED / CONTENT_PENDING|CONTENT_READY
```

脚本职责保持如下：

- `prepared-npm-release*`：prepared batch 和 tarball identity owner。
- `prepared-npm-publisher`：幂等 publish 与 registry verification owner。
- `release-stable-git`：release commit、package tag 和 branch closure owner。
- `npm-runtime-update-release`：Runtime bundle、GitHub Release assets 和公开 channel owner。
- `release.yml`：正式生产阶段顺序、job 权限、environment 审批和最终状态 owner。

本地 `release:npm:stable` / `release:product:stable` 不删除，避免破坏恢复能力；文档与项目命令把普通正式发布入口改为 GitHub Actions，本地直发只保留为 recovery/诊断路径。

## 五、认证与权限边界

当前生产合同是 `npm-production` environment 中的受控 `NPM_TOKEN`。这仍然是“通过 GitHub 发布 NPM”：publisher 在 GitHub-hosted runner 内执行，本机 `.npmrc` 只可用于显式恢复，不能被 workflow 自动读取。`nextclaw@0.43.0` 已用此合同完成 43 个公开包的真实发布和 registry identity 验证。

GitHub secret 无法通过只读 API 证明未来的 `npm publish` 权限，因此不增加伪“权限预检”。正式门禁是：environment 存在、exact artifact 匹配、首次缺失 tarball publish 成功，以及随后 registry identity/integrity/latest 回读一致。Token 轮换后必须由一次真实 prepared publish 验收；错误认证在任何 Git/tag/Runtime 写入前失败。

Trusted Publishing 是可选的后续认证迁移，不是 GitHub 自动发布的前置条件。迁移时所有公开 package 必须绑定同一个仓库、workflow 和 environment，并用真实 canary publish 验收后再在同一变更中切换 `id-token: write`；不得在 package 配置不完整时移除已验收 token 路径。

权限按 job 收窄：

- preflight：`contents: read`、`actions: read`；
- publish-npm：`contents: write`、`actions: read`，NPM secret 只注入 publish step；
- runtime：`contents: write`、`actions: write`，使用仓库 `GITHUB_TOKEN` dispatch 既有 workflow；
- 内容增强不持有 NPM 或签名权限。

workflow 顶层默认 `permissions: {}`，禁止把 publish 权限泄漏给所有 job。stable 使用 `npm-production` environment，可由仓库设置 required reviewers；beta 或其它 channel 不在首版扩张。

## 六、核心说明与 AI 增强状态

核心更新链不能以大模型是否可用作为正确性门。Runtime manifest 首版采用以下确定性 URL 优先级：

1. 目标 commit 已存在结构化 release notes：使用其中 `links.html`；
2. 否则使用同一 `nextclaw@<version>` GitHub Release URL。

GitHub Release 在缺少结构化说明时先写入从版本、package identity 和 Changesets changelog 得出的确定性核心说明，并标记完整产品说明稍后补充。AI 后续仍通过现有 `nextclaw-release-notes`、产品博客、视觉资产和 X 流程生成内容并提交到 master；Runtime/installer 不因说明增强发生二次发布，GitHub Release 与文档页面只更新可变内容。

状态分离：

| 状态              | 含义                                            | 可否继续                              |
| ----------------- | ----------------------------------------------- | ------------------------------------- |
| `PREPARED`        | exact SHA tarball 已验证                        | 可进入 publish                        |
| `NPM_READY`       | registry、Git commit/tag、冷 tarball audit 成立 | 不可回滚，不得重复 publish            |
| `CORE_RELEASED`   | stable Runtime channel 和升级 smoke 成立        | 产品核心可用                          |
| `CONTENT_PENDING` | 高质量双语说明/博客/官网/X 尚未闭合             | 不影响核心事实，Desktop stable 仍等待 |
| `CONTENT_READY`   | 适用公开内容已闭合                              | 可进入 Desktop stable 或全平台发布    |

这不是两套 release owner：内容增强消费同一版本/tag，只修改可变投影；NPM package、tag、bundle 和 manifest identity 始终由核心 workflow 冻结。

## 七、失败、恢复和并发

- workflow concurrency 使用 stable release 全局串行，`cancel-in-progress: false`，避免新触发取消正在 publish 的不可逆批次。
- prepared artifact 缺失、source SHA 不同、environment secret 缺失或认证失败时在 Git/tag/Runtime 写入前失败。
- 部分 NPM 包已发布时继续使用 prepared manifest 的 integrity 反查：相同 identity 复用，不同 integrity 失败；禁止盲目重发。
- publish 上传完成后只轮询 registry identity，不再调用 `npm publish`。轮询采用有界退避，允许 npm registry 的短暂最终一致性；等待预算耗尽后明确列出仍缺失或冲突的 package，由同一 workflow failed-job rerun 从 identity precheck 恢复。
- NPM 成功、Git 失败：从 `git` 恢复；Runtime 失败：只重跑 Runtime job或使用现有 `--resume-from runtime`，不得回到 packages。
- `GITHUB_TOKEN` 推送 release commit 不依赖 push 事件触发下游；所需 Runtime 由 owner workflow 显式 dispatch。内容提交后的 docs deploy 仍由原有 docs workflow 负责。
- workflow 只允许从 `master` 运行并绑定触发 SHA；不接受任意外部 ref 作为 publish 输入。

## 八、迁移与删除点

首版保留本地命令以支付恢复兼容成本，但删除它作为“推荐正式入口”的文档和命令路由。迁移完成后：

- 推荐 stable 发布：GitHub Actions `release.yml`；
- 本地命令：dry-run、prepared artifact 调试、历史 checkpoint recovery；
- 不新增第二个 publisher、第二份 manifest 或第二套 tag 规则；
- 不把 AI API key、模型选择或 prompt 放进核心 workflow。

生产外部配置包括：建立 `npm-production` environment、写入可发布且 bypass 2FA 的 granular token，并确认 branch protection 允许 GitHub Actions bot 的原子 release commit/tag 闭环。后续若迁移 Trusted Publishing，再一次性完成 package trust 配置并经真实 canary 验收；它不改变 workflow owner。

## 九、最小充分验证

1. 单元测试：GitHub outputs、token workflow 合同、传统 `.npmrc` 恢复路径兼容。
2. 单元测试：结构化说明 URL 优先、GitHub Release fallback、确定性 release notes 不含 AI 调用。
3. workflow 静态验证：YAML/actionlint、最小 permissions、master guard、environment、non-cancel concurrency、secret 注入范围和 scope 条件。
4. 原有 release stable、prepared artifact、publisher、Git closure 和 Runtime manifest 定向测试全部通过。
5. 运行匹配范围的 `tsc`；本次没有 TypeScript 产品合同变化时记录不适用范围，不用 lint 冒充类型证据。
6. 运行 `release:npm:stable -- --dry-run` 和 workflow contract test；生产验收以 `nextclaw@0.43.0` 正式 run、registry 43/43 identity、Runtime Release 和旧版本升级 smoke 为准。
7. NPM 时间观测拆分为 precheck、upload、registry verify；Desktop 输出 workflow wall time、每个 job duration 和 slowest step。Desktop 本地闭环的 manifest 与 APT 源事实通过 raw GitHub 单文件 URL 读取，再独立读取 Pages 公网投影；禁止为这两个文件 fetch 仓库。

## 十、抽象审计与非目标

保留：一个 workflow owner、一个小型 Actions 环境适配模块、现有发布原语。

删除/禁止：在 YAML 重写 publisher、把 AI 内容变成核心 gate、为每种 target 新建平行 workflow、因 registry 暂时不可见而重复 publish。

延后：Trusted Publishing 迁移、beta 认证迁移、自动定时发布、AI provider/API 选择、Desktop 在 `CONTENT_PENDING` 时降级发布。这些都有独立安全或产品质量决策，不能借本次可靠性修订提前进入。

非目标：本次不修改 NPM package 内容语义，不改变 package 版本级别决定规则，不降低 Desktop stable 双语说明门禁。
