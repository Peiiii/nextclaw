# NPM Package 发布

1. Stable 正式入口使用 GitHub Actions 中已经真实验收的认证路径；当前通过 `npm-production` environment 的受控 `NPM_TOKEN` 发布，并按实际 npm config 验证 auth。Trusted Publishing 迁移必须单独执行：逐 package 配置精确 repository/workflow，记录配置清单，以真实 canary publish 验证而不是以“保存成功”代替，并在全部发布包通过后才切换正式 workflow；OIDC 路径不运行不受支持的 `npm whoami`。项目私有 `.npmrc` 存在时显式设置 `NPM_CONFIG_USERCONFIG`，隔离 worktree的 401 必须先核对主/隔离配置来源。
2. `pnpm release:sync-readmes`、`release:check-readmes`、`release:check:health`。
3. 根据用户安装入口和 workspace 依赖确定闭包；`@nextclaw/ui` 变化会影响 `nextclaw` 嵌入产物。严格检查在干净环境构建发布包的完整 workspace 依赖闭包，但只把 Changesets 发布包写入 checkpoint/tag/publish。窄发布必须证明排除依赖已按精确版本发布并通过 packed install。
4. 使用 `release:auto:changeset`/changeset、`release:version` 与经过 strict checkpoint 的 publish；release notes owner 属于后续产品 closure，不是 NPM artifact 前置门禁。
5. `pnpm release:verify:published` 和 `npm view ... dist-tags --json` 验证 registry；首发短暂 404 先按同一 npm config 重试。
6. 发布后检查每个 worktree 的 generated artifacts；应提交的进入发布记录，其余恢复/清理，不把 hash churn 留给用户。
7. 每次正式 stable 发布都保留命令输出的 artifact、package、Git/install 与 package 子阶段计时，并在对应迭代记录写入总耗时和最慢阶段；单次超过 60 秒或连续 3 次超过 45 秒时进入发布性能复盘。超时必须在 `NPM_READY` 事实摘要中输出 `time budget: missed` 和同一份阶段计时，但不返回非零；只有 identity、integrity、dist-tag、Git 或安装事实失败才阻止完成。

stable NPM-only 的用户入口仍是“发布 NPM”。分钟级 version、strict check、artifact audit 和不可变 tarball 准备由 `npm-release-prepare` workflow 在 release-bearing `master` push 后提前完成；delivery 交付该 commit 时等待 exact-commit artifact 成立。用户授权后 dispatch `release.yml` 的 `target=npm`，正式 job 只定位/下载 HEAD 对应 artifact、通过当前已验收的 `npm-production` environment token 并发首次上传、逐包 version/integrity/latest registry 验证、release commit/tag 与远端 master 闭合，以及空缓存公网精确 tarball/payload 审计。缺少或失效 artifact 时快速失败，不回退重建。release notes、runtime、完整依赖安装/升级、文档站、官网、X 和 desktop 不在 NPM-only 完成点范围。artifact 下载也计入 wall time；所有事实门禁通过即报告 `NPM_READY`，并独立报告是否达到 60 秒性能目标。

常规 stable 产品 dispatch `release.yml` 的 `target=product`。它复用同一 package 主链路，在 `NPM_READY` 后闭合 stable runtime 和旧版本升级；结构化 release notes 与 release surface review 作为同一版本的 `CONTENT_READY|CONTENT_PENDING` 独立报告，不阻塞核心 Runtime。先用本地 `pnpm release:product:stable -- --dry-run` 审计；发布后失败按 workflow 失败 job 或现有 `--resume-from git|runtime|install` 精确续跑，不重新执行 package publish。

Agent 执行正式发布时默认把完整 stdout/stderr 写入临时日志，只向会话回传阶段、耗时、包数、最终摘要和失败附近的有限行；禁止把数万行 build/lint 输出整体送入上下文。日志保留到闭环完成，失败恢复仍使用原 checkpoint，不靠截断输出猜阶段。

严格检查的 checkpoint 必须区分“会被 tag/publish 的 package”和“只为依赖闭包构建的 validation support package”。两者都可以按输入 fingerprint 复用成功 build，但只有前者进入 package tags 与 registry 发布事实。

真实升级验证若 `curl` 可访问公开 manifest、Node `fetch` 却持续 `ECONNRESET`，先检查运行环境是否依赖 `HTTP_PROXY`/`HTTPS_PROXY`。嵌入式 Node 24+ 使用 `NODE_USE_ENV_PROXY=1` 重跑 install checkpoint；这只让真实用户链路采用既有出网代理，不替换 manifest、公钥或发布物。

`nextclaw` 的 workspace runtime API、UI 产物或公共 package 有未发布语义变化时，必须纳入同批；不能用 CLI 版本号或复制的 ui-dist 证明运行依赖闭包正确。
