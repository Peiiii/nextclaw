# v0.25.14 docs deployment automation

## 迭代完成说明

- 文档发布从开发者本机 Wrangler 登录态与 `root + ssh/scp`，迁移为 GitHub Actions 的单一生产 owner。
- `master` 文档变更只构建一次，生成带 commit、内容树 SHA-256 和 workflow run URL 的不可变制品，同一 artifact 分发到 Cloudflare Pages 与阿里云私有 OSS + CDN。
- 阿里云资源由 ROS 管理：私有且禁止公共访问的版本化 OSS、国内 CDN、私有回源角色、GitHub OIDC provider、最小权限部署角色、clean URL rewrite、压缩和分层缓存均已创建并开启删除保护。
- `docs-cn-production` environment 仅允许 `master`；阿里云身份是 OIDC 换取的 30 分钟 STS，GitHub 不保存长期 AccessKey、SSH 私钥或服务器密码。
- 国内站证书由独立 workflow 每周检查；仅在不足 30 天或人工强制时通过 AliDNS DNS-01 签发并部署，私钥只存在于临时 runner。
- 删除六个 ECS/SSH/Nginx 日常发布文件和对应 package scripts；保留统一部署、纯读验证、制品回滚与证书续期入口。

## 测试/验证/验收方式

- `pnpm docs:i18n:check`：通过，81 个中英文镜像页面一致。
- `pnpm --filter @nextclaw/docs build`：通过；真实构建生成 597 个文件，发布清单内容树 SHA-256 为 `66811d580a5292c7e0d3660153d1e46fa2aadd914e4aae75c68fb2a5a5f9fe2c`（实现提交前本地样本）。
- 本地 VitePress preview 对 `/`、`/zh/`、`/zh/guide/getting-started`、`/en/`、`/en/guide/getting-started` 与 `/release-manifest.json` 均返回 200。
- 三个 workflow 通过 actionlint；三个部署脚本通过 `node --check`、ESLint 与 `git diff --check`。
- ROS `ValidateTemplate`、首次 `PreviewStack`、更新 dry-run 均通过；实际资源栈状态为 `CREATE_COMPLETE` / `UPDATE_COMPLETE`，缓存、rewrite、私有回源配置均由 CDN API 返回 `success`。
- 正式双域名制品一致性、公开 DNS CNAME、HTTPS 与自动续期 workflow 的最终结果见下方部署记录。

## 发布/部署方式

- GitHub workflow：`Docs Deploy`。触发条件为 `master` 上文档/部署合同变更或人工 `workflow_dispatch`，并发组为 `docs-production`，不取消进行中的双站发布。
- 全球站：Cloudflare Pages 项目 `nextclaw-docs`，正式域名 `https://docs.nextclaw.io`。
- 国内站：私有 OSS `nextclaw-docs-cn-prod-1835553186862551`，CDN CNAME `docs.nextclaw.net.w.kunlunaq.com`，正式域名 `https://docs.nextclaw.net`。
- 回滚：`Docs Rollback` 输入已验证 commit 与内容树 SHA-256，从 OSS `_releases/<commit>/<treeSha256>/` 读取精确制品并重新推广到两个目标，不重建旧源码。
- DNS/线上部署闭环完成后补充本次 workflow run、最终 commit 与双站验证结果。

## 用户/产品视角的验收步骤

1. 打开 `https://docs.nextclaw.io/zh/guide/getting-started` 与 `https://docs.nextclaw.net/zh/guide/getting-started`，确认页面直接可达且顶部一级导航可点击进入默认页面。
2. 分别打开两个域名的 `/release-manifest.json`，确认 `commit` 与 `treeSha256` 完全相同。
3. 检查中英文首页、快速开始页和任一带哈希静态资源均为 200；国内站 HTTP 请求应 301 到 HTTPS。
4. 在 GitHub Actions 中确认部署 job 使用 OIDC、没有 Aliyun AccessKey secret，国内发布不出现 SSH、SCP 或密码输入。
5. 人工运行 `Docs Certificate Renewal`（force=true），确认 DNS-01 记录自动创建/清理且 CDN 最终返回新证书指纹。

## 可维护性总结汇总

- 新增 owner 仅限三个 workflow、一个 ROS 资源栈和三个小型纯职责脚本；没有保留 ECS 与 OSS/CDN 两套生产发布入口。
- 正向减债：删除六个旧 ECS/SSH/Nginx 部署文件；package 脚本收敛为 workflow dispatch 与纯读 verify；双站使用同一制品和同一 manifest 真值。
- 提交前全量统计为新增 1048 行、删除 306 行；其中三个可执行部署脚本新增 186 行、旧 ECS 部署脚本删除 251 行，脚本语义净减少 65 行。
- 新增 481 行 workflow 与 304 行 IaC 是无人值守部署、制品回滚、自动证书续期和云资源 owner 所需的新运维能力，不属于非功能改动净增门槛；没有用 helper、wrapper 或兼容分支掩盖复杂度。
- maintainability guard 为 0 error、0 warning；`lint:new-code:governance` 与 governance backlog ratchet 均通过。
- 证书、部署身份和发布制品分别有明确生命周期 owner；没有长期主机凭据、静默 fallback、第二套构建或运行时探测分支。

## NPM 包发布记录

不涉及 NPM 包发布。本次修改的是文档交付基础设施与仓库 CI，不改变 NPM 包运行时、公共 API 或安装行为，因此不添加 `.changeset`。
