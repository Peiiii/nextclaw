# GitHub Actions 全自动发布设计

## 文档状态

- 日期：2026-08-24
- 风险：L4（NPM、Git tag、GitHub Release、签名更新渠道与恢复边界）
- 状态：Design Ready，进入实现
- 关系：本设计把 `docs/designs/2026-08-09-stable-npm-release-automation.design.md` 的生产编排 owner 从本地 CLI 迁移到 GitHub Actions；`docs/designs/2026-08-14-one-minute-npm-prepared-publish.design.md` 的 exact-commit prepared artifact、60 秒 NPM_READY 和不可逆恢复合同保持不变。

## 一、用户问题与可观察目标

当前发布能力已经分别存在，但正式发布仍由本地 `release-stable.mjs` 主持：本机下载 prepared artifact、使用项目 `.npmrc` 发布、提交版本文件和 tag，再触发 Runtime 或 Desktop Actions。结果是发布动作依赖某台机器的登录状态，也让“不消耗大模型 Token 的确定性发布”和“需要大模型 Token 的公开内容生产”混在同一个完成判断里。

目标状态：

1. 用户在 GitHub 选择 `npm` 或 `product` 后只触发一次；正式 NPM、Git 闭环、Runtime 和验证均在 GitHub-hosted runner 完成。
2. 核心发布不调用任何大模型，AI Token 消耗为零；认证用的 GitHub/OIDC 临时凭据和签名私钥不计作 AI Token。
3. `npm` 完成点仍是 `NPM_READY`；`product` 在此基础上闭合 stable Runtime 和旧版本升级，完成点仍是 `NEXTCLAW_STABLE_READY`。
4. 高质量双语更新笔记、博客、官网与 X 内容是同一 release identity 的异步增强状态。它们可以在核心发布前准备，也可以在核心发布后补齐；失败不得重复或回滚已经成立的 NPM publish。
5. Desktop 保持独立发布对象。其跨平台构建仍完全由 Actions 执行，但 stable Desktop 继续要求增强后的双语说明，不因本次改造降低用户可见发布质量。

## 二、当前链路证据

现有链路为：

```text
master push
  -> npm-release-prepare（exact SHA version/build/tsc/lint/pack artifact）
  -> 本地 release:npm:stable / release:product:stable
     -> 本地 .npmrc + npm whoami
     -> npm publish prepared tarballs
     -> 本地 release commit/package tags/push
     -> 本地脚本 dispatch npm-runtime-update-release
        -> Actions 四平台 Runtime bundle/GitHub Release/gh-pages manifests
```

Desktop 已经是“本地命令建 release identity 并等待，Actions 负责远端 preflight、多平台 installer、assets、manifest、APT 和公开验证”。文档站也已有独立 Actions 部署。缺失的第一个 owner 边界是 NPM 正式 publish 与跨阶段编排，而不是构建能力。

## 三、候选方案

### 方案 A：把现有本地命令原样放进一个 Actions step

优点是改动最少。缺点是仍要求 `.npmrc`、`npm whoami`，workflow 只是远程终端，本地 CLI 继续拥有生产生命周期，权限也集中在一个长 job。拒绝。

### 方案 B：用 Changesets Action 重写全部版本、打包和发布

优点是社区惯例清晰。缺点是会丢弃现有 prepared artifact、并发 tarball publisher、完整性指纹、60 秒 NPM_READY、精确恢复和 workspace protocol 审计，形成第二套发布合同。拒绝。

### 方案 C：Actions 成为生产 owner，复用现有确定性原语

新增唯一正式 workflow；NPM job 只增加 OIDC 环境适配并消费现有 exact-commit artifact，随后由独立 Runtime job 复用现有 Runtime closure。原有 CLI 保留为本地 dry-run、诊断和显式恢复入口。选择此方案。

## 四、权威 owner 与主链路

`.github/workflows/release.yml` 是正式 stable 发布生命周期的唯一生产 owner。它只编排状态和权限，不复制 package、manifest、签名或平台构建算法：

```text
workflow_dispatch(master, target=npm|product)
  -> preflight
     -> 确认 master/exact SHA/prepared artifact/非 Changesets pre mode
  -> publish-npm [environment: npm-production]
     -> npm Trusted Publishing / GitHub OIDC
     -> release:npm:stable --trusted-publishing
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

## 五、OIDC 与权限边界

每个公开 NPM package 在 npmjs.com 一次性配置同一个 trusted publisher：仓库 `Peiiii/nextclaw`、workflow 文件 `release.yml`、environment `npm-production`、允许 `npm publish`。

`publish-npm` 使用 GitHub-hosted runner、Node `22.14.0+`、npm `11.5.1+` 和 `id-token: write`。OIDC 模式不执行 `npm whoami`，因为 trusted publishing 的短期凭据只服务 publish，不能用传统读接口证明身份；改为验证 GitHub OIDC 请求环境和最低 CLI 版本，真正的授权事实由首次 `npm publish <prepared-tarball>` 与 registry 反查共同证明。

权限按 job 收窄：

- preflight：`contents: read`、`actions: read`；
- publish-npm：`contents: write`、`actions: read`、`id-token: write`；
- runtime：`contents: write`、`actions: write`，使用仓库 `GITHUB_TOKEN` dispatch 既有 workflow；
- 内容增强不持有 `id-token: write`、NPM 或签名权限。

workflow 顶层默认 `permissions: {}`，禁止把 publish 权限泄漏给所有 job。stable 使用 `npm-production` environment，可由仓库设置 required reviewers；beta 或其它 channel 不在首版扩张。

## 六、核心说明与 AI 增强状态

核心更新链不能以大模型是否可用作为正确性门。Runtime manifest 首版采用以下确定性 URL 优先级：

1. 目标 commit 已存在结构化 release notes：使用其中 `links.html`；
2. 否则使用同一 `nextclaw@<version>` GitHub Release URL。

GitHub Release 在缺少结构化说明时先写入从版本、package identity 和 Changesets changelog 得出的确定性核心说明，并标记完整产品说明稍后补充。AI 后续仍通过现有 `nextclaw-release-notes`、产品博客、视觉资产和 X 流程生成内容并提交到 master；Runtime/installer 不因说明增强发生二次发布，GitHub Release 与文档页面只更新可变内容。

状态分离：

| 状态 | 含义 | 可否继续 |
|---|---|---|
| `PREPARED` | exact SHA tarball 已验证 | 可进入 publish |
| `NPM_READY` | registry、Git commit/tag、冷 tarball audit 成立 | 不可回滚，不得重复 publish |
| `CORE_RELEASED` | stable Runtime channel 和升级 smoke 成立 | 产品核心可用 |
| `CONTENT_PENDING` | 高质量双语说明/博客/官网/X 尚未闭合 | 不影响核心事实，Desktop stable 仍等待 |
| `CONTENT_READY` | 适用公开内容已闭合 | 可进入 Desktop stable 或全平台发布 |

这不是两套 release owner：内容增强消费同一版本/tag，只修改可变投影；NPM package、tag、bundle 和 manifest identity 始终由核心 workflow 冻结。

## 七、失败、恢复和并发

- workflow concurrency 使用 stable release 全局串行，`cancel-in-progress: false`，避免新触发取消正在 publish 的不可逆批次。
- prepared artifact 缺失、source SHA 不同、OIDC 环境缺失或版本不满足时在 publish 前失败。
- 部分 NPM 包已发布时继续使用 prepared manifest 的 integrity 反查：相同 identity 复用，不同 integrity 失败；禁止盲目重发。
- NPM 成功、Git 失败：从 `git` 恢复；Runtime 失败：只重跑 Runtime job或使用现有 `--resume-from runtime`，不得回到 packages。
- `GITHUB_TOKEN` 推送 release commit 不依赖 push 事件触发下游；所需 Runtime 由 owner workflow 显式 dispatch。内容提交后的 docs deploy 仍由原有 docs workflow 负责。
- workflow 只允许从 `master` 运行并绑定触发 SHA；不接受任意外部 ref 作为 publish 输入。

## 八、迁移与删除点

首版保留本地命令以支付恢复兼容成本，但删除它作为“推荐正式入口”的文档和命令路由。迁移完成后：

- 推荐 stable 发布：GitHub Actions `release.yml`；
- 本地命令：dry-run、prepared artifact 调试、历史 checkpoint recovery；
- 不新增第二个 publisher、第二份 manifest 或第二套 tag 规则；
- 不把 AI API key、模型选择或 prompt 放进核心 workflow。

真实运行前的一次性外部配置包括：为所有公开 NPM package 配置 trusted publisher、建立 `npm-production` environment，并确认 branch protection 允许 GitHub Actions bot 的原子 release commit/tag 闭环。代码无法替代这三项仓库/registry 管理事实，workflow 必须在缺失时 fail closed。

## 九、最小充分验证

1. 单元测试：OIDC 环境判定、npm/Node 最低版本、GitHub outputs、CLI `--trusted-publishing` 解析与传统 `.npmrc` 路径兼容。
2. 单元测试：结构化说明 URL 优先、GitHub Release fallback、确定性 release notes 不含 AI 调用。
3. workflow 静态验证：YAML/actionlint、最小 permissions、master guard、environment、non-cancel concurrency、OIDC 与 npm 版本、scope 条件。
4. 原有 release stable、prepared artifact、publisher、Git closure 和 Runtime manifest 定向测试全部通过。
5. 运行匹配范围的 `tsc`；本次没有 TypeScript 产品合同变化时记录不适用范围，不用 lint 冒充类型证据。
6. 运行 `release:npm:stable -- --dry-run` 和 workflow contract test；未经新的真实发布授权，不执行 npmjs publish、tag、push、Release、Runtime 或 Desktop 外部写入。

## 十、抽象审计与非目标

保留：一个 workflow owner、一个小型 Actions 环境适配模块、现有发布原语。

删除/禁止：在 YAML 重写 publisher、把 AI 内容变成核心 gate、用长期 NPM token 替代 OIDC、为每种 target 新建平行 workflow。

延后：beta trusted publishing、自动定时发布、AI provider/API 选择、完全无人审批的 stable、Desktop 在 `CONTENT_PENDING` 时降级发布。这些都有独立安全或产品质量决策，不能借本次 owner 迁移提前进入。

非目标：本次不执行真实发布，不修改 NPM package 内容语义，不改变 package 版本级别决定规则，不降低 Desktop stable 双语说明门禁，不自动发布博客或社交内容。
