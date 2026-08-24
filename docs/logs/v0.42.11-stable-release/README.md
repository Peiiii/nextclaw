# NextClaw 0.42.3 正式版发布

## 迭代完成说明

- 本批次把 0.42.3 beta 中的上下文压缩恢复、会话目录 SQLite、Extension 持续关注、宿主诊断和其它已验收 changeset 收敛为正式版。
- 本次发布阻塞的根因不是 `better-sqlite3` 依赖本身，而是 Desktop 的两层运行时没有统一原生 ABI 合同：产品 bundle 需要 Node ABI，Electron 壳及其 seed bundle 需要 Electron 32 ABI；同时旧烟测只看 HTTP 存活，可能把 NCP agent 初始化失败误判为成功。
- 根因通过真实 DMG 冷启动、Node/Electron ABI 对照、移除原生二进制后的负向 bootstrap 验证确认；修复统一了 native staging owner，并把 Desktop readiness 切到 `/api/runtime/bootstrap-status` 的 NCP agent 状态。
- `better-sqlite3` 当前保留：系统 Node 22 的 `node:sqlite` 仍为实验能力，Electron 32 内置 Node 20.18.1 不提供 `node:sqlite`，不足以承担启动关键的会话目录。
- Desktop 空壳 Release 的根因是把已公开的 `release.published` 事件当作跨平台构建入口：平台 build/smoke 在资产上传前失败时，GitHub 已经公开 Release identity，因而留下只有源码归档、没有下载资产的页面。该结论由 `v0.42.3-desktop.1` 至 `.4` 的 0 资产状态及对应 Actions 失败链确认；修复改为隐藏 Draft → 唯一身份 workflow dispatch → 五平台构建/烟测 → 精确核验 30 个资产 → 公开同一 Release，直接消除公开时序根因，而不是事后补链接。
- 发布关键路径原先还会先等待 `desktop-validate` 构建一批不会发布的产物，再由正式 workflow 重建五平台资产；两批 bits 不同，既浪费约 8–12 分钟，也不能增强发布证明。现已删除该平行门禁，正式 workflow 对同一批生产 artifact 完成单次 build/smoke/upload/publish，日常 CI 保持独立。

## 测试/验证/验收方式

- 上下文压缩定向验证 157 项通过；SQLite 迁移、损坏索引、缺记录与并发写入测试通过。
- NPM runtime 自动更新真实链路从 0.42.3 beta 基线下载、切换并重启候选版本成功。
- macOS arm64 完整 DMG 打包验证通过：353.4 MB DMG、27.0 MB seed bundle、395 个 runtime 文件、51 个 plugin 文件、manifest 签名、SQLite 原生文件与命令入口均通过。
- 真实 Desktop GUI 在 11.8 秒内完成窗口和 NCP agent readiness；移走临时 bundle 的 `better_sqlite3.node` 后，壳保持存活但 `ncpAgent.state=error`，证明新 readiness 门不会误判。
- Desktop/Core/Server TypeScript、相关测试、脚本语法、lint、`git diff --check` 均通过；Windows/Ubuntu 安装器由发布 CI 补齐平台实机验证。
- Desktop 原子公开修复通过 actionlint、13 项发布合同测试、ESLint、脚本语法、diff-only 治理与稳定发布 dry-run；真实隐藏 Draft 的临时资产上传状态为 `uploaded` 且大小非零，删除后恢复 0 资产。未登录公开 API 对 `.1` 至 `.4` 均返回 404；既有完整 stable Release `v0.42.2-desktop.1` 精确匹配 30 个资产。
- Desktop 单次构建合同由发布测试证明：CLI 只做身份/签名 preflight，正式 workflow 内五平台 build、安装/启动冒烟、artifact upload 与 Draft 公开形成同一 run；发布 dry-run 不再等待 `desktop-validate`。

## 发布/部署方式

- 先从 beta prerelease 模式退出并发布 NPM stable 包、runtime channel、Git tags 与 GitHub Release。
- 再发布 Desktop stable 的 macOS、Windows、Linux/AppImage 与 APT 产物，更新签名 manifest 和下载页。
- 所有发布完成后回读 NPM dist-tag、GitHub Release、Desktop update manifest、APT metadata 与公开下载 URL；发布状态将在本记录中补齐。
- Desktop 后续只允许显式触发：CLI 先创建隐藏 Draft，并以 release tag 和唯一 dispatch id 触发 Actions；构建失败或取消只保留不可公开的 Draft，完整资产核验通过后才公开。此次修复本身不创建新的 Desktop Release。

## 用户/产品视角的验收步骤

1. 从 NPM `latest` 安装或升级到 0.42.3，确认已有会话自动迁移并且压缩长会话不再因 summary 截断中断。
2. 从官网下载 Desktop 正式版并首次启动，确认无需额外安装 Python、编译器或 SQLite 依赖即可打开会话页。
3. 在 Desktop 中创建和刷新会话，确认 SQLite 会话目录正常工作；并确认更新检查指向 stable channel。
4. 打开 Extension 与持续关注页面，确认外部事件能以事件卡片进入会话时间线。
5. 在 Windows/Linux/macOS 的公开下载入口分别确认安装包可下载，版本与 update manifest 一致。
6. 打开 GitHub Releases，确认任何公开 Desktop Release 都同时具备完整 30 资产集合；构建失败版本不得出现在公开列表。

## 可维护性总结汇总

- Sharp 与 SQLite 的 Desktop 原生依赖复制、目标平台解析和 Electron prebuild 统一由 `prepare-native-app-resources.mjs` 负责，产品 bundle 和壳打包不再各维护一份列表。
- Desktop 只通过 Core/Kernel 轻量公共子入口加载宿主诊断和自动更新常量，避免主进程启动前加载完整依赖图；Core 子入口同时提供 ESM 与 CJS 合同。
- 自动维护性检查最终为 0 error；6 个 warning 均为既有目录/文件预算或接近预算信号。超预算的 `desktop-package-verify.mjs` 本次相对基线净减 2 行，并完成跨模块主观复核，无开放 finding。
- 本次没有新增无收益 adapter、fallback 或并行状态 owner；新增增长集中在原生 ABI 合同、负向发布门与跨平台烟测。
- Desktop 发布修复 Review 首次阻断了继续增长的 505 行主 CLI；GitHub Draft 生命周期拆到单一 owner 后，主文件降至 487 行。最终自动检查 0 error、1 个接近预算 warning，主观复核无开放 finding；唯一 dispatch 身份同时消除了同 tag 重试串 run 的异步风险。

## NPM 包发布记录

- 需要发布：是。原因是本批次包含用户可见 bugfix、公共 SDK/运行时合同和 Desktop 正式版依赖的产品 bundle。
- 待统一发布的精确包集合：`nextclaw`、`@nextclaw/app-runtime`、`@nextclaw/channel-extension-dingtalk`、`@nextclaw/channel-extension-discord`、`@nextclaw/channel-extension-email`、`@nextclaw/channel-extension-feishu`、`@nextclaw/channel-extension-qq`、`@nextclaw/channel-extension-slack`、`@nextclaw/channel-extension-telegram`、`@nextclaw/channel-extension-wecom`、`@nextclaw/channel-extension-weixin`、`@nextclaw/channel-extension-whatsapp`、`@nextclaw/client-sdk`、`@nextclaw/companion`、`@nextclaw/core`、`@nextclaw/extension-sdk`、`@nextclaw/harness`、`@nextclaw/kernel`、`@nextclaw/mcp`、`@nextclaw/ncp-agent-runtime-next`、`@nextclaw/ncp-agent-runtime`、`@nextclaw/ncp-http-agent-client`、`@nextclaw/ncp-http-agent-server`、`@nextclaw/ncp-mcp`、`@nextclaw/ncp-react-ui`、`@nextclaw/ncp-react`、`@nextclaw/ncp-toolkit`、`@nextclaw/ncp`、`@nextclaw/nextclaw-hermes-acp-bridge`、`@nextclaw/nextclaw-narp-runtime-claude-code-sdk`、`@nextclaw/nextclaw-narp-runtime-codex-sdk`、`@nextclaw/nextclaw-narp-runtime-opencode`、`@nextclaw/nextclaw-narp-stdio-runtime-wrapper`、`@nextclaw/nextclaw-ncp-runtime-adapter-hermes-http`、`@nextclaw/nextclaw-ncp-runtime-claude-code-sdk`、`@nextclaw/nextclaw-ncp-runtime-codex-sdk`、`@nextclaw/nextclaw-ncp-runtime-http-client`、`@nextclaw/nextclaw-ncp-runtime-stdio-client`、`@nextclaw/remote`、`@nextclaw/runtime`、`@nextclaw/server`、`@nextclaw/service`、`@nextclaw/shared`、`@nextclaw/ui`。
- 当前状态：上述包的 `beta` 版本已发布，stable/`latest` 待本次统一发布；发布后在此处补充精确版本与公开回读结果。
- Desktop 原子公开修复不涉及额外 NPM 包发布或版本 bump。

## 红区触达与减债记录

### scripts/desktop/desktop-package-verify.mjs

- 本次是否减债：是。
- 说明：删除重复的 Sharp 平台依赖表，改为复用 Desktop native staging owner；文件相对基线净减 2 行。
- 下一步拆分缝：若后续继续增长，将产物静态合同与平台安装烟测拆为独立验证模块。

### apps/desktop/src/main.ts

- 本次是否减债：是。
- 说明：把 Kernel/Core 根入口替换为轻量公共子入口，降低冷启动依赖图与 CommonJS/ESM 边界风险。
- 下一步拆分缝：保持 main 只负责生命周期装配，新增宿主能力继续下沉到现有 manager/service owner。

发布过程观测见 [工作记录](work/working-notes.md)。
