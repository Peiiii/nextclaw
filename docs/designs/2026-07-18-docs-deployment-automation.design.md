# NextClaw 双文档站无人值守部署设计

## 背景

当前文档站虽然已有仓库脚本，但例行发布仍依赖开发者本机状态：全球站使用本机登录的 Wrangler，国内镜像使用 `root + ssh/scp`，一次发布会建立多次 SSH 连接并反复要求输入服务器密码。

这只能称为“脚本辅助的人工发布”，不能称为自动部署。用户需要的不是把密码换一种保存方式，而是让提交后的构建、鉴权、双站发布、验证和回滚形成无人值守、可审计、可复现的单一路径。

本设计属于 `docs/designs`：它已经形成稳定的部署 owner、身份合同、制品流、迁移边界和验收标准；不是待办清单，也不是已完成迭代记录。

## 实施状态（2026-07-18）

- GitHub Actions 的 build-once、双站部署、制品回滚和证书续期 workflow 已实现。
- 阿里云 ROS 已创建并接管私有 OSS、CDN、OIDC provider、最小权限部署角色与私有 OSS 回源角色；资源栈开启删除保护。
- `docs-cn-production` environment 只允许 `master`，部署身份由 GitHub OIDC 换取 30 分钟 STS，不保存阿里云 AccessKey。
- CDN 已启用私有回源、clean URL rewrite、HTTPS 强制跳转、Brotli/Gzip、页面短缓存和哈希资源一年缓存；发布只精确刷新页面 URL。
- HTTPS 首次迁移复用了现网证书；后续由每周检查、30 天续期窗口的 DNS-01 workflow 自动签发和部署，证书私钥只存在于临时 runner。
- 旧 ECS/SSH 日常部署入口已从仓库删除；正式 DNS 切换与线上双域名验收结果进入本次迭代记录。

## 当前事实与分层根因

### 现象层

- 国内发布会在 `ssh`、两次 `scp` 和最终远程命令阶段反复询问 `root` 密码。
- 发布只能由持有服务器密码、Cloudflare 本机登录态和当前工作区的人完成。
- 命令退出成功不等于双站已经消费同一份可追踪制品。

### 直接触发层

- `docs-mirror-runner.mjs` 直接继承终端执行 `ssh/scp`，没有非交互认证合同。
- `docs-mirror-config.mjs` 默认远端身份是 `root`。
- `deploy-docs-to-ecs.mjs` 在远端执行 `rm -rf <site-root>/*` 后解包，并为静态内容 reload Nginx。
- `package.json` 的文档部署入口直接从本机 build 后调用云 CLI 或 SSH，没有仓库级文档部署 workflow。

### 生成路径层

此前只完成了 config、runner、bootstrap、deploy、verify 的脚本职责拆分，却把“谁拥有生产身份、制品如何跨目标复用、如何在干净 runner 重现”留给了操作者。本机登录态因此成为事实上的部署 owner。

实施前，GitHub 仓库已有 production environment 与 Cloudflare Pages 凭据，但没有文档部署 workflow；阿里云侧也没有面向该 workflow 的 OIDC provider 与文档部署 RAM role。当前这些缺口已经按本设计闭合。

### 防线缺口层

- 没有“生产部署不得读取 stdin/TTY”的验收门。
- 没有 GitHub OIDC、短期 STS 和最小权限 RAM role。
- 没有带 commit 与内容指纹的发布清单，双站一致性只能靠页面抽查。
- 没有制品级回滚合同；当前恢复依赖重新构建或再次登录服务器。
- 没有阻止例行部署继续走个人机器和长期主机凭据的规则。

### 系统性原因

纯静态 VitePress 站点被当成可变服务器目录发布，导致系统同时承担 ECS 登录、root 权限、Nginx、文件切换和个人凭据管理。正确的长期 owner 应是托管静态基础设施与仓库 CI，而不是一台需要人工登录的 ECS。

## 核心判断

命中的设计原则：

- `single-fact-owner`：一次构建产物是双站唯一发布事实。
- `complete-owner`：GitHub Actions workflow 拥有构建、发布编排和结果收口，不把关键步骤留给操作者。
- `boundary-only-defense`：云身份只在 CI 到云 API 的真实边界处理，脚本内部不猜测或兜底个人登录态。
- `no-compatibility-by-default`：目标链路稳定后删除 ECS 日常发布入口，不长期保留两套生产 owner。
- `cqs-pure-read`：线上 verify 只读、可重复，不顺手上传、刷新或修复状态。
- `simplest-shape-first`：静态站回到 OSS + CDN，不为保留 ECS 再造 SSH key、跳板机或部署 agent。

## 方案比较

| 方案 | 无人值守 | 最小权限与审计 | 运行维护 | 回滚 | 结论 |
| --- | --- | --- | --- | --- | --- |
| GitHub Secret 保存 root SSH 私钥 | 可以 | 长期主机凭据，权限面过大 | 继续维护 ECS/Nginx/SSH | 需自建 | 拒绝作为长期方案 |
| GitHub OIDC + ECS 云助手 | 可以 | 短期身份、命令可审计 | 仍维护 ECS/Nginx/目录切换 | 可做 release symlink | 仅当 CDN 迁移受外部条件阻塞时作为短期桥接 |
| GitHub OIDC + 私有 OSS + CDN | 可以 | 短期 STS、资源级 RAM 权限 | 无服务器登录与 Nginx 发布面 | OSS 版本与发布制品可回退 | 推荐目标方案 |
| Cloudflare 与阿里云各自独立构建 | 可以 | 取决于平台 | 两套构建环境 | 平台各自回滚 | 拒绝；无法证明双站同一制品 |

最优目标不是“给 SSH 配 key”，而是删除日常 SSH 发布面：GitHub Actions 只构建一次，同一份不可变制品分别发布到 Cloudflare Pages 和阿里云 OSS + CDN。

## 推荐架构

```text
master 上的文档相关提交
  |
  v
GitHub Actions: validate + build once
  |
  +--> docs-dist-<commit> + release-manifest.json
         |
         +--> Cloudflare Pages direct upload
         |      https://docs.nextclaw.io
         |
         +--> GitHub OIDC -> Aliyun RAM role -> private OSS -> CDN
                https://docs.nextclaw.net
  |
  v
只读双站验证：commit、内容指纹、关键路由和资源一致
```

### Owner 边界

- `.github/workflows/docs-deploy.yml`：生产部署唯一编排 owner；负责触发、并发控制、构建制品、两个部署 job 和最终验证。
- `infra/docs-delivery/`：阿里云静态托管基础设施 owner；声明 OSS、版本控制、生命周期、CDN、HTTPS 行为、URL rewrite、缓存、OIDC provider、RAM role 与最小权限策略。
- `.github/workflows/docs-certificate-renewal.yml`：国内站证书生命周期 owner；用同一 OIDC role 完成 DNS-01、证书部署和边缘证书指纹验证。
- `scripts/deploy/docs/verify-docs-deployment.mjs`：纯读验证 owner；接收期望 commit 和内容指纹，验证两个正式域名。
- `release-manifest.json`：发布事实；至少包含 commit、内容树 SHA-256、构建时间和 workflow run URL。
- `apps/docs`：仍是唯一内容源；不新增国内版文档源码。

现有 `nextclaw-net-docs-mirror` 下的 SSH runner、ECS bootstrap、Nginx 模板和日常 deploy 脚本只服务迁移前链路，完成切流和观察期后删除。

## 身份与权限合同

### GitHub 到阿里云

- workflow 仅授予 `contents: read` 与 `id-token: write`。
- 使用阿里云官方 `configure-aliyun-credentials-action`，实现时固定到审核过的 commit SHA，不跟随可变分支。
- GitHub OIDC subject 精确绑定当前仓库和 `docs-cn-production` environment；environment 自身只接受 `master` 部署，避免分支或 fork 获取生产身份。
- RAM role 只允许目标 OSS bucket 的读取、写入、列举与生命周期更新、CDN 刷新与证书部署，以及证书 DNS-01 所需的四个 AliDNS API；不授予 ECS、SSH、RAM 管理或其他 bucket 写权限。
- STS session 使用短时有效期，session name 包含 workflow run id，便于 ActionTrail 追踪。
- ROS 负责 OIDC provider 的基线资源合同；阿里云 ROS 不支持原地更新 `Fingerprints`，证书链轮换时必须先用 IMS `AddFingerprintToOIDCProvider` 增加新指纹、验证工作流成功后再考虑删除旧指纹。该动作属于低频身份引导，不得改回长期 AccessKey 或服务器密码。

### GitHub 到 Cloudflare

- Cloudflare Pages 复用仓库现有 `production` environment 中的 account id 与 API token，部署命令固定到 `nextclaw-docs` 项目；后续轮换 token 时应继续保持仅该项目所需权限。
- token 不进入仓库、产物或日志；指定轮换 owner 和失效检查。
- 本机 Wrangler 登录只允许明确声明的应急人工发布，不能再作为例行生产合同或“自动部署”证明。

## 阿里云静态托管合同

- 使用私有 OSS bucket，开启 versioning，并用 lifecycle 清理过期历史版本与旧发布制品。
- CDN 以 OSS Domain 作为源站，使用同账户 STS 授权回源；不把 bucket 改成 public-read。
- 不依赖 OSS 静态网站默认首页。CDN origin rewrite 显式保持现有 VitePress URL：
  - `/` 回源 `/index.html`；
  - 以 `/` 结尾的路径回源同目录 `index.html`；
  - 不含扩展名的页面路径回源同名 `.html`；
  - 带扩展名的静态资源路径保持不变。
- 内容哈希资源使用长缓存和 `immutable`；HTML、健康文件与发布清单使用短缓存或强制 revalidate。
- `/release-manifest.json` 同时承担轻量健康探针与发布身份合同，不再维护重复的 `/health` 对象。

## 构建与发布数据流

1. PR 只执行 i18n、类型、lint、build 和 artifact integrity 检查，不触发生产发布。
2. 文档相关改动合入 `master` 后自动触发；`workflow_dispatch` 只用于重跑指定 commit 或显式回滚。
3. build job 在干净 runner 安装锁定依赖，刷新文档所需指标，构建一次 `dist`，生成内容树指纹和 `release-manifest.json`，上传 GitHub artifact。
4. 全球与国内 deploy job 只下载该 artifact，不重新 checkout 后 build。
5. 国内站先上传内容哈希资源，再上传 HTML 与发布清单；旧哈希资源至少保留一个 HTML 缓存窗口，避免新旧页面引用断裂。
6. CDN 精确刷新 HTML 对应的公开 URL、健康文件与发布清单；内容哈希资源不做全量 purge。
7. final verify job 必须看到两个正式域名的 commit 与内容指纹都等于本次 artifact，并验证中英文入口、关键页面和静态资源。

生产部署 concurrency 固定为单通道，`cancel-in-progress: false`。新的文档发布排队等待，不能在一个目标已更新后取消整批 workflow，减少双站短暂漂移。

## 失败与回滚

- 任一目标失败时 workflow 保持失败，不把单站成功表述为整批成功，也不静默切换到个人机器或 SSH。
- 同一 commit 的失败 job 可以重跑，并继续消费原 artifact。
- 每次发布把完整制品保存在私有 OSS 的 `_releases/<commit>/<treeSha256>/` 内容身份路径；显式 rollback workflow 选择已验证的 commit + 内容树指纹，重新推广该制品，不重新构建旧源码。
- OSS versioning 是误删/误覆盖的第二恢复层，不代替制品级回滚入口。
- 不做自动回滚：跨两个云目标的自动反向修改可能扩大故障；失败必须可见，由操作者选择重跑或回滚到明确 commit。

## 迁移与旧路径删除

1. 用 IaC 创建独立私有 bucket、CDN、OIDC provider、RAM role 和缓存/rewrite 配置，不先修改现网 DNS。
2. 通过 CDN CNAME 定向解析验证 clean URL、缓存、HTTPS、中文访问、同制品指纹和无交互 workflow。
3. 将 `docs.nextclaw.net` 从 ECS A 记录切换为 CDN CNAME，并执行公开 DNS、证书、路由与制品一致性验证。
4. 冻结 ECS 日常 deploy 入口；旧主机只作为短期基础设施回退，不再作为仓库发布 owner。
5. 删除 `deploy:docs:cn:bootstrap`、`deploy:docs:cn`、`deploy:docs:cn:full` 及 SSH/ECS/Nginx 发布脚本；保留统一 workflow dispatch、证书续期、rollback 与双站 verify 入口。

如果备案、证书或 CDN 审核形成真实外部阻塞，才允许用“GitHub OIDC + ECS 云助手 + release 目录原子 symlink”作为有删除日期的桥接；不新增 SSH key 方案。

## 验收标准

### 自动化合同

- 从全新 GitHub runner 发布时全程不读取 stdin、不需要 TTY、不依赖开发者机器登录态。
- 日常 workflow、package script 和 deploy code 中不再出现 `root@`、`ssh`、`scp` 或 ECS 站点目录 `rm -rf`。
- 阿里云凭据是 OIDC 换取的短期 STS；GitHub 没有长期 Aliyun AccessKey Secret。
- 权限审计证明 deploy role 无 ECS、RAM 管理和其他 bucket 写权限。

### 制品与行为

- 两个 deploy job 下载同一个 GitHub artifact，构建只发生一次。
- 两个正式域名的 `release-manifest.json` 返回相同 commit 与内容树 SHA-256。
- 关键中英文路由、无扩展名路由、目录路由、静态资源和 `/release-manifest.json` 均返回预期内容。
- 同一 workflow 中任一目标失败时，整体结论为失败或部分发布，不得输出“部署完成”。
- rollback 到上一已验证 release identity 后，两个域名重新报告该 commit 与内容树指纹，且不触发源码重建。

### 工程验证

- workflow YAML 通过 actionlint。
- 新增脚本通过 `node --check`、ESLint、定向测试和相关 `tsc`。
- IaC 通过 format、validate 与 plan；plan 中不得出现仓库外资源的意外修改。
- `pnpm lint:new-code:governance`、backlog ratchet 和 post-edit maintainability guard/review 通过。

## 非目标

- 不在本轮销毁仍承载其他职责的 ECS；移除的是文档日常发布依赖，不擅自扩大基础设施删除范围。
- 不把全球站和国内站合并到同一云厂商；目标是一份制品与统一发布 owner，而不是单一供应商。
- 不为部署失败增加客户端运行时探测或静默 fallback。
- 不把服务器密码、SSH 私钥或长期阿里云 AccessKey 保存到 GitHub Secrets。

## 实际实施顺序

1. 实现 build-once artifact、release manifest、纯读双站 verifier、部署与 rollback workflow。
2. 用 ROS 建立 OIDC、最小权限 RAM、私有 OSS、CDN、缓存与 rewrite；用现网证书完成 HTTPS 引导。
3. 增加 OIDC + AliDNS DNS-01 的自动证书续期，消除上传证书到期后的人工操作。
4. 推送后先由 workflow 向两端发布同一制品，再定向验证 CDN CNAME，最后切换正式 DNS 并重跑公开双站验收。

## 依据

- GitHub 官方 OIDC 文档：`https://docs.github.com/en/actions/reference/security/oidc`
- 阿里云官方 GitHub OIDC Action：`https://github.com/aliyun/configure-aliyun-credentials-action`
- 阿里云 RAM role 与临时 STS：`https://help.aliyun.com/en/ram/user-guide/ram-role-overview`
- 阿里云 CDN 私有 OSS 回源：`https://help.aliyun.com/en/cdn/user-guide/grant-alibaba-cloud-cdn-access-permissions-on-private-oss-buckets`
- 阿里云 CDN origin path rewrite：`https://help.aliyun.com/en/cdn/user-guide/rewrite-urls-in-back-to-origin-requests`
- 阿里云 OSS versioning：`https://help.aliyun.com/en/oss/user-guide/overview-78/`
