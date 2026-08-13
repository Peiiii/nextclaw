# NPM Package 发布

1. 用与发布命令相同的 npm config 验证 auth；项目私有 `.npmrc` 存在时显式设置 `NPM_CONFIG_USERCONFIG`。隔离 worktree 的 401 必须先核对主/隔离配置来源，不把“配置未继承”误判为 token 失效。
2. `pnpm release:sync-readmes`、`release:check-readmes`、`release:check:health`。
3. 根据用户安装入口和 workspace 依赖确定闭包；`@nextclaw/ui` 变化会影响 `nextclaw` 嵌入产物。严格检查在干净环境构建发布包的完整 workspace 依赖闭包，但只把 Changesets 发布包写入 checkpoint/tag/publish。窄发布必须证明排除依赖已按精确版本发布并通过 packed install。
4. 使用 `release:auto:changeset`/changeset、`release:version` 与经过 strict checkpoint 的 publish；release notes owner 属于后续产品 closure，不是 NPM artifact 前置门禁。
5. `pnpm release:verify:published` 和 `npm view ... dist-tags --json` 验证 registry；首发短暂 404 先按同一 npm config 重试。
6. 发布后检查每个 worktree 的 generated artifacts；应提交的进入发布记录，其余恢复/清理，不把 hash churn 留给用户。

stable NPM-only 使用 `pnpm release:npm:stable`：它在不可逆 publish 前冻结 release plan，验证 auth、branch、public key、依赖闭包和 artifact，随后完成 strict check、registry、release commit/tag/push 与精确版本冷安装；release notes、runtime、文档站、官网、X 和 desktop 不在该入口范围。达到后报告 `NPM_READY`。

常规 stable 产品使用 `pnpm release:product:stable`。它复用同一 package 主链路，在 `NPM_READY` 后才校验结构化 release notes 与 release surface review，再闭合 stable runtime 和旧版本升级。先用对应入口的 `--dry-run` 审计；发布后失败按输出的 `--resume-from git|runtime|install` 精确续跑，不重新执行 package publish。

Agent 执行正式发布时默认把完整 stdout/stderr 写入临时日志，只向会话回传阶段、耗时、包数、最终摘要和失败附近的有限行；禁止把数万行 build/lint 输出整体送入上下文。日志保留到闭环完成，失败恢复仍使用原 checkpoint，不靠截断输出猜阶段。

严格检查的 checkpoint 必须区分“会被 tag/publish 的 package”和“只为依赖闭包构建的 validation support package”。两者都可以按输入 fingerprint 复用成功 build，但只有前者进入 package tags 与 registry 发布事实。

真实升级验证若 `curl` 可访问公开 manifest、Node `fetch` 却持续 `ECONNRESET`，先检查运行环境是否依赖 `HTTP_PROXY`/`HTTPS_PROXY`。嵌入式 Node 24+ 使用 `NODE_USE_ENV_PROXY=1` 重跑 install checkpoint；这只让真实用户链路采用既有出网代理，不替换 manifest、公钥或发布物。

`nextclaw` 的 workspace runtime API、UI 产物或公共 package 有未发布语义变化时，必须纳入同批；不能用 CLI 版本号或复制的 ui-dist 证明运行依赖闭包正确。
