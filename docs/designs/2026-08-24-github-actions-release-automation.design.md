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
5. Desktop 保持独立发布 identity 与子 workflow，但全平台 stable 由 `release.yml target=all` 在 Runtime 成功后自动创建 Draft、触发 Desktop、等待公开投影并汇总；stable Desktop 的双语说明由结构化 release-notes JSON 确定性生成，不依赖本地临时文件或 AI。

## 二、当前链路证据

已验收链路为：

```text
master push
  -> npm-release-prepare（exact SHA version/build/tsc/lint/pack artifact）
  -> release.yml target=npm|product|all [environment: npm-production]
     -> environment NPM_TOKEN
     -> npm publish prepared tarballs
     -> registry identity + cold tarball audit
     -> release commit/package tags/push
     -> target=product 时 dispatch npm-runtime-update-release
        -> Actions 四平台 Runtime bundle/GitHub Release/gh-pages manifests
        -> previous stable update smoke
```

Desktop 的五平台 installer、assets、manifest、APT 和公开验证已经由 `desktop-release.yml` 拥有；此前只有 Draft 创建、子 workflow dispatch 与 closure wait 留在本地 CLI。全平台自动化把该 CLI 移入 `release.yml` 的 Desktop job，使一次 `target=all` dispatch 在 GitHub Runner 内完成全部状态迁移。文档站继续由独立 Actions 部署。`0.43.0` 的产品与 Desktop 正式版已经分别通过这些 owner 完成生产验收。

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
workflow_dispatch(master, target=npm|product|all)
  -> preflight
     -> 确认 master/exact SHA/prepared artifact/非 Changesets pre mode
  -> publish-npm [environment: npm-production]
     -> environment NPM_TOKEN
     -> release:npm:stable
     -> registry identity + cold tarball audit
     -> release commit/package tags/atomic push
     -> NPM_READY
  -> publish-runtime（product/all 且 batch 包含 nextclaw）
     -> dispatch/wait npm-runtime-update-release
     -> GitHub Release/assets/gh-pages/public manifests
     -> previous stable update smoke
     -> NEXTCLAW_STABLE_READY
  -> publish-desktop（仅 all，且 Runtime 成功）
     -> 从结构化 release-notes JSON 生成双语 GitHub body
     -> release:desktop:stable（运行在 GitHub Runner）
     -> signing preflight -> hidden Draft -> desktop-release child workflow
     -> five-platform assets/manifests/APT/public projection closure
     -> DESKTOP_READY
  -> summarize（always）
     -> 分别报告 NPM_READY / NEXTCLAW_STABLE_READY / DESKTOP_READY / ALL_PLATFORMS_READY
```

脚本职责保持如下：

- `prepared-npm-release*`：prepared batch 和 tarball identity owner。
- `prepared-npm-publisher`：幂等 publish 与 registry verification owner。
- `release-stable-git`：release commit、package tag 和 branch closure owner。
- `npm-runtime-update-release`：Runtime bundle、GitHub Release assets 和公开 channel owner。
- `release.yml`：正式生产阶段顺序、job 权限、environment 审批和最终状态 owner。
- `release-desktop`：Desktop Draft、子 workflow correlation 与 closure owner；本地和 Actions 入口复用同一脚本，不再由 AI 拼接阶段。

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

### 2026-08-30 内容门禁漂移修正

`0.46.0` 首次 `target=product` 自动发布在任何 NPM 写入前失败：workflow 把 `--require-product-artifacts` 同时施加给 `product` 和 `all`，而 exact-commit preparation 只准备 package/Runtime artifact，不负责调用 AI 或人工生成新版本的双语说明。结果是核心发布重新依赖值守者补文件，违反本节的 `CONTENT_PENDING` 状态和“核心更新链不能以大模型是否可用作为正确性门”。

门禁恢复为单一、可观察的边界：

- `target=npm` 与 `target=product` 允许 `CONTENT_PENDING`；缺少结构化 JSON 时复用 `release-core-notes` 的确定性 GitHub Release fallback，NPM、Runtime 和真实升级验证继续无人值守闭环；
- `target=all` 仍在首次 package publish 前要求完整结构化说明和适用 surface review，因为 Desktop update manifest 与公开 Release 必须消费同一份双语说明；
- `CONTENT_PENDING` 只表示可变内容投影未闭合，不得伪装成 `CONTENT_READY`，也不得触发 NPM/Runtime 重发；
- 静态 workflow 合同测试锁定这个分界，禁止再次用 `target != npm` 扩大内容硬门。

### 2026-08-30 Prepared artifact 等待边界修正

`0.46.0` 的第二次 `target=product` run 证明了一条新的性能/自治缺口：发布器在 exact-SHA 的 NPM artifact 已上传并完成后，调用 `gh run watch` 等待整个 `npm-release-prepare` 父 run；该父 run 还在并行预热四平台 Runtime。因此 NPM publish 被与它没有依赖关系的 macOS/Windows Runtime 构建阻塞，`NPM_READY` 无法优先形成。

等待 owner 收窄到唯一真实依赖：同一 prepare run 的 `prepare exact-commit NPM artifact` job。发布器只读取该 job 的结构化完成状态；成功后以有界重试下载同名 artifact，吸收 GitHub artifact 的短暂一致性延迟。Runtime prewarm 继续并行，不再是 NPM publish 的等待条件。job 失败或有界下载耗尽时，才 dispatch/恢复同一 source identity 的 exact prepare；不会重复 NPM 包或等待 parent workflow 的其它矩阵。

这条合同的可观察指标是：`NPM_READY` 的 critical path 只包含 NPM artifact job、artifact 下载、publish、registry/Git/install closure；四平台 Runtime 只属于后续 Runtime closure。单元测试锁定“active parent + successful NPM artifact job 立即消费”和“download propagation retry”，并禁止重新引入 `gh run watch`。

## 七、失败、恢复和并发

- workflow concurrency 使用 stable release 全局串行，`cancel-in-progress: false`，避免新触发取消正在 publish 的不可逆批次。
- prepared artifact 缺失、source SHA 不同、environment secret 缺失或认证失败时在 Git/tag/Runtime 写入前失败。
- 部分 NPM 包已发布时继续使用 prepared manifest 的 integrity 反查：相同 identity 复用，不同 integrity 失败；禁止盲目重发。
- publish 上传完成后只轮询 registry identity，不再调用 `npm publish`。轮询采用有界退避，允许 npm registry 的短暂最终一致性；等待预算耗尽后明确列出仍缺失或冲突的 package，由同一 workflow failed-job rerun 从 identity precheck 恢复。
- NPM 成功、Git 失败：从 `git` 恢复；Runtime 失败：只重跑 Runtime job或使用现有 `--resume-from runtime`，不得回到 packages。
- `GITHUB_TOKEN` 推送 release commit 不依赖 push 事件触发下游；所需 Runtime 由 owner workflow 显式 dispatch。内容提交后的 docs deploy 仍由原有 docs workflow 负责。
- workflow 只允许从 `master` 运行并绑定触发 SHA；不接受任意外部 ref 作为 publish 输入。

## 八、迁移与删除点

保留本地命令以支付诊断和恢复兼容成本，但删除它作为“全平台正式发布编排 owner”的文档和命令路由。迁移完成后：

- 推荐 stable 发布：GitHub Actions `release.yml`；
- 推荐全平台 stable：同一 workflow 的 `target=all`，不再由 AI 顺序触发 product 与 desktop；
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
8. workflow 合同测试证明 `all` 只在 Runtime 成功后运行 Desktop job，GitHub Runner 使用 closure commit、`actions:write` / `contents:write`，最终 summary 对缺少任一状态 fail closed。
9. Desktop notes 测试证明显式 `--notes-file` 与结构化 JSON 生成路径都满足中文在前、英文在后、绝对文档链接和无 frontmatter/commit noise 合同。

## 十、抽象审计与非目标

保留：一个 workflow owner、一个小型 Actions 环境适配模块、现有发布原语。

删除/禁止：在 YAML 重写 publisher、把 AI 内容变成核心 gate、为每种 target 新建平行 workflow、因 registry 暂时不可见而重复 publish。

延后：Trusted Publishing 迁移、beta 认证迁移、自动定时发布、AI provider/API 选择、Desktop 在 `CONTENT_PENDING` 时降级发布。这些都有独立安全或产品质量决策，不能借本次可靠性修订提前进入。

非目标：本次不修改 NPM package 内容语义，不改变 package 版本级别决定规则，不降低 Desktop stable 双语说明门禁。

## 十二、全平台单次 Actions 编排

### 能力缺口

用户的“全自动发布”语义是一次 GitHub Actions dispatch 后无人介入，而不是 AI 在本地依次调用两个发布器。此前 NPM/Runtime 与 Desktop 各自自动化，但缺少一个拥有跨阶段状态机的 Actions 外层 owner；AI/Delivery 成了不可观测且不可复用的隐式编排层。

### 选择与边界

选择扩展现有 `release.yml`，不创建第三个 full-release workflow：

- `npm` 保持只发布 NPM；`product` 保持 NPM + Runtime；`all` 复用前两段后追加 Desktop；
- Desktop job checkout `publish-npm.outputs.closure_commit`，显式绑定 `master` 和 exact SHA；
- Desktop job 调用现有 `release:desktop:stable` 并允许跳过重复的本地 package verify，因为 child workflow 本身执行正式五平台 build/smoke，且上游 prepared artifact 已完成 package gate；
- `release-desktop` 在未提供 `--notes-file` 时只允许从 exact target 的 `apps/docs/public/release-notes/nextclaw-v<version>.json` 生成双语正文。JSON 缺失、版本不匹配、任一语言摘要/链接缺失时 fail closed；显式 notes file 继续作为 standalone/recovery 入口；
- 父 workflow 只编排状态；Desktop 产物仍由 `desktop-release.yml` 单一构建，禁止父 workflow 预构建另一批 installer；
- failed-job rerun 复用成功的 NPM/Runtime outputs；重新 dispatch 时 publisher 按既有 identity/integrity 幂等恢复，不重复不可变产物。

### 状态与权限

```text
target=npm     -> NPM_READY
target=product -> NPM_READY -> NEXTCLAW_STABLE_READY
target=all     -> NPM_READY -> NEXTCLAW_STABLE_READY -> DESKTOP_READY -> ALL_PLATFORMS_READY
```

Desktop job 只获得 `actions:write`（dispatch child workflows）和 `contents:write`（Draft/Release）；不接收 `NPM_TOKEN` 或 Desktop signing key。签名 secret 继续只存在于 Desktop preflight/build child workflows。`all` batch 不含 `nextclaw`、Runtime 失败或 Desktop closure 未成立时，summary 必须返回失败，不能以部分成功报告全平台完成。

父子等待采用显式层级预算，避免旧的 25 分钟 CLI 等待与最近一次 24 分钟 Desktop run 几乎贴线：child workflow 的 Draft/build/assets/publication/channel/APT 分别使用 5/45/15/10/15/25 分钟 job timeout，CLI 最长观察 child 120 分钟，父 Desktop job 最长 150 分钟。正常耗时仍由 `nextclaw.desktop-release/v1` 的 wall/job/slowest-step 事实衡量；任一等待预算耗尽时取消精确 child run 并保留可恢复 identity，禁止父 run 失败后子 run 继续推进不可逆公开。

### 抽象审计

保留现有 `release.yml`、`release-desktop.mjs` 和 Desktop child workflow；新增的唯一状态是 `target=all`。结构化 notes 生成是现有 JSON owner 的一个纯函数 consumer，不建立 content service 或第二份 release-note schema。删除的是 AI/本地 Delivery 对全平台阶段顺序的所有权；standalone Desktop 命令只保留窄发布与恢复价值。

## 十一、Reuse-first 主链路感知合同

### 事故证据与不变量

`nextclaw@0.43.0` 已由 `release.yml` 使用 `npm-production/NPM_TOKEN` 完成真实生产发布，但命令总表仍残留“workflow 通过 OIDC”的旧描述。执行者从该 consumer 进入后，把尚未迁移的 Trusted Publishing 误判成“GitHub 发布尚未实现”，重复调查并尝试替换已经跑通的主链路。

必须成立的不变量是：讨论发布实现、认证故障或迁移前，先证明仓库当前已经如何发布；一个可选认证方案未配置，不得推翻已有 workflow 和成功 run 已经证明的发布能力。

### 单一事实链路

正式执行事实仍只归 `.github/workflows/release.yml`。发布 skill 和项目命令不再独立声明候选实现，而是按以下顺序建立 `EXISTING_RELEASE_PATH`：

1. 读取 workflow 的 environment、secret 注入和 publish command，区分执行宿主与认证模式；
2. 查询最近一次 successful `release.yml` run，证明该合同是否经过真实生产验收；
3. 对目标版本读取 NPM identity、GitHub Release 和 manifest，识别已经成立的不可变阶段；
4. 默认复用已证明路径，只对缺失阶段执行或恢复；远端查询失败记为 evidence gap，不把未知降格成不存在；
5. 只有 workflow/run/产物证据证明现行路径失效，才进入修复或 Trusted Publishing 迁移设计。

不新增 capability registry、第二个 preflight service 或复制 workflow 的配置文件。现有 `release-action-environment.test.mjs` 同时锁定 workflow、release skill 和命令总表的认证合同；任一投影再次写成 OIDC、硬 60 秒门槛或遗漏 reuse-first 探测时，CI 直接失败。

### 验证标准

- workflow 继续证明 `npm-production`、`secrets.NPM_TOKEN` 且没有 `id-token: write` / `--trusted-publishing`；
- NPM release skill 每次 stable 命中都要求输出 `EXISTING_RELEASE_PATH` 和最近成功 run；
- `/发布NPM`、`/发布NextClaw正式版`、全平台组合入口复用同一证据门；
- 静态合同测试阻止 workflow、skill 和命令再次漂移；
- 本修复不改变生产 workflow、NPM identity、认证 secret 或发布权限。
