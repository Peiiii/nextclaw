# v0.44.9 Portable Runtime

## 迭代完成说明

- 在现有 App Package、Panel App、Service App 和 Service Action 主链内加入 Rust-first Portable Runtime：WASM Component 由共享 Wasmtime runner 执行，没有新增平行应用类型或第二套安装体系。
- 内置「日常小工具箱」以今日清单、灵感便签、专注小钟和联系人整理四个普通用户可理解的场景，覆盖结构化持久数据、Resident 后台事件、Provider/Consumer 组合、权限授权，以及 Panel 与 Agent 对同一 Action contract 的复用。
- runner 成为 NextClaw 产品资源；本地构建、源码安装与 source runtime 会同步构建宿主 runner，不要求开发者手工设置路径。构建合同覆盖 macOS arm64/x64、Linux arm64/x64 和 Windows x64，CI 在 macOS arm64、Linux x64、Windows x64 原生构建并运行测试。
- 安装、启停、runner 异常退出后的依赖顺序恢复、卸载保留数据与显式清除数据链路已经闭合；安装物化失败会清理新建版本目录，不阻塞后续合法安装。
- `nextclaw app check`、`app dev` 和 `app call` 复用同一 Portable Runtime contract；中英文用户文档分别说明功能、使用、权限与数据，开发者文档说明运行模型、Service App 开发和 contract。
- 新增实验性的验收契约 skill，仅在大型、多阶段或低监督完整交付任务中条件加载，用于防止执行切片被误报为最终完成；它不替代生命周期阶段 owner。

## 测试/验证/验收方式

- 7 个受影响 TypeScript workspace package 的 `tsc` 全部通过：`@nextclaw/app-runtime`、`@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/client-sdk`、`@nextclaw/ui`、`@nextclaw/service`、`nextclaw`。
- App Runtime、Kernel、Server、UI 和 CLI 的 13 个定向测试文件通过，共 96 个测试；覆盖安装失败清理、manifest、Action/Tool、持久状态、Resident 恢复、Provider 调用、权限拒绝、API、UI 和分发解析。
- Portable Runtime 构建合同 7 个 Node 测试通过；`cargo fmt --check`、release runner build、5 个 guest Component build 和 `cargo test --release` 通过。
- `pnpm docs:i18n:check` 通过，确认 137 组中英文镜像页面；VitePress 生产构建通过。
- `git diff --check`、导航配置 ESLint 和 changeset 状态检查通过。

## 发布/部署方式

- 本次提交包含用户可见功能 changeset；NPM 包版本仍进入统一发布批次，不在本次文档部署中单独发布。
- 文档随本提交进入 `master` 后由 `docs-deploy.yml` 构建一次不可变产物，并部署到 Cloudflare Pages 与国内 OSS/CDN；workflow 最后校验两个生产域名报告相同 commit 与 tree hash。
- Portable Runtime 跨平台原生构建合同由 `portable-runtime-validate.yml` 在 `master` 上验证，不把本机 macOS 构建冒充 Linux/Windows 实机证据。

## 用户/产品视角的验收步骤

1. 在应用列表启用「日常小工具箱」，分别打开今日清单、灵感便签、专注小钟和联系人整理。
2. 新增清单与便签，刷新或重启后确认数据仍在；关闭专注面板后等待一段时间，再打开确认后台状态继续推进。
3. 在联系人整理中输入格式混乱的信息，确认 Consumer 经宿主调用 Provider 得到规范化结果；移除授权时应看到明确拒绝，而不是静默成功。
4. 在 Agent 会话要求查询或新增清单，确认 Agent 调用与 Panel 相同的 Service Action，并能读取同一份持久数据。
5. 使用 `nextclaw app check/dev/call` 检查、运行和调用 Portable Service；停止并恢复 runner 后，确认持久数据和 Resident 状态能够恢复。
6. 阅读用户文档了解功能和数据语义，阅读开发者文档了解 Rust/WASM Component contract、runner 结构与当前边界。

## 可维护性总结汇总

- Portable Runtime 复用现有 App、Kernel、Service Action、授权与数据 owner；新增 runner 只拥有 Component 执行和通用 host capability，避免产生第二套产品语义。
- Panel、Agent 与 CLI 复用公共 Action contract；Provider/Consumer 调用经过宿主权限边界，没有为四个示例场景增加专用宿主 API。
- runner 发现、组件生命周期和恢复分别收敛到明确 service owner；安装合同提取为共享纯函数，减少安装与校验分支漂移。
- 验收契约 skill 保持独立、条件加载且可删除，只在 lifecycle 和质量收敛入口增加最小路由，不把专项方法复制进常驻规则。
- 当前仍明确保留的产品边界包括 Secret、Blob/file、长任务进度/取消、流式事件、Component 到模型/Agent 的出站调用，以及生产级 CPU/内存隔离；这些未被兜底或文档包装成已实现能力。

## NPM 包发布记录

- 需要后续统一发布，changeset：`.changeset/portable-runtime-local-mvp.md`。
- minor：`@nextclaw/app-runtime`、`@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/client-sdk`、`@nextclaw/ui`、`@nextclaw/service`、`nextclaw`。
- 当前状态：待统一发布；本次只提交源码、测试、资源、文档和 CI，并部署用户文档，不执行 NPM 或 Desktop 发布。
