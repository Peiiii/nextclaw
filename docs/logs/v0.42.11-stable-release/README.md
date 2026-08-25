# NextClaw 0.42.3 正式版发布

## 迭代完成说明

- 本批次把 0.42.3 beta 中的上下文压缩恢复、会话目录 SQLite、Extension 持续关注、宿主诊断和其它已验收 changeset 收敛为正式版。
- 本次发布阻塞的根因不是 `better-sqlite3` 依赖本身，而是 Desktop 的两层运行时没有统一原生 ABI 合同：产品 bundle 需要 Node ABI，Electron 壳及其 seed bundle 需要 Electron 32 ABI；同时旧烟测只看 HTTP 存活，可能把 NCP agent 初始化失败误判为成功。
- 根因通过真实 DMG 冷启动、Node/Electron ABI 对照、移除原生二进制后的负向 bootstrap 验证确认；修复统一了 native staging owner，并把 Desktop readiness 切到 `/api/runtime/bootstrap-status` 的 NCP agent 状态。
- `better-sqlite3` 当前保留：系统 Node 22 的 `node:sqlite` 仍为实验能力，Electron 32 内置 Node 20.18.1 不提供 `node:sqlite`，不足以承担启动关键的会话目录。
- 稳定版发布主链路已经收敛到 GitHub Actions：核心发布负责准备、受控 NPM 发布、runtime、GitHub Release 与升级烟测；内容增强不再阻塞核心制品可用。
- 发布脚本误被 `node --test` 导入时曾触发一次远端 runtime workflow。根因是可执行脚本的直接调用判断没有排除 Node 测试上下文；通过复现导入路径和 GitHub Actions run 记录确认后，在入口增加 `NODE_TEST_CONTEXT` 防护并加入导入安全回归测试。该 workflow 已在产物构建和发布前取消，没有产生 release、runtime asset 或 channel 变更。
- Desktop 空壳 Release 的根因是把已公开的 `release.published` 事件当作跨平台构建入口：平台 build/smoke 在资产上传前失败时，GitHub 已经公开 Release identity，因而留下只有源码归档、没有下载资产的页面。该结论由 `v0.42.3-desktop.1` 至 `.4` 的 0 资产状态及对应 Actions 失败链确认；修复改为隐藏 Draft → 唯一身份 workflow dispatch → 五平台构建/烟测 → 精确核验 30 个资产 → 公开同一 Release，直接消除公开时序根因，而不是事后补链接。
- 发布关键路径原先还会先等待 `desktop-validate` 构建一批不会发布的产物，再由正式 workflow 重建五平台资产；两批 bits 不同，既浪费约 8–12 分钟，也不能增强发布证明。现已删除该平行门禁，正式 workflow 对同一批生产 artifact 完成单次 build/smoke/upload/publish，日常 CI 保持独立。
- 首次真实 Draft 验证进一步确认 GitHub 在 Draft 公开前不会创建 tag ref；以 tag dispatch 会得到 HTTP 422。发布身份现由显式 `release_target` SHA 承载，workflow 从分支入口启动后核对 Draft target、checkout SHA，并在公开后验证 tag 反向指向同一 SHA。
- Windows 便携版真实发布冒烟确认主程序、API 和 Service App 均正常，但便携分支漏设 renderer titlebar 证据开关，导致 hosted runner 无窗口句柄时无法使用已授权的 renderer fallback；该开关现对安装与便携模式统一设置。后续真实 run 又证明产品冒烟全部通过后，ephemeral runner 的残留 Electron 文件锁仍可能令临时目录删除报 `ENOTEMPTY`；清理现采用更长的有界重试，并仅将可恢复 Windows 锁错误交给 runner 收尾，避免把已通过的产品冒烟误报为发布失败。
- Windows 安装器原先在 unpacked 应用和便携版都通过冒烟后，再让 electron-builder 删除并重建同一个 `win-unpacked` 目录；残留 Electron 句柄因此会令 NSIS 阶段删除 DLL 失败。NSIS 现通过 `--prepackaged` 直接消费同一批已验证 bits，既消除重复打包和文件锁冲突，也保证安装器与冒烟对象同源。
- APT 的 GitHub Pages 镜像受 100 MiB 单文件上限约束；正式 `.deb` 保持完整，APT 专用副本只裁掉 `better-sqlite3` 随包携带但运行时不读取的 C/C++ 编译源码与 headers，保留 `better_sqlite3.node`、JS 运行库和许可证。发布投影 job 同时改为浅克隆，避免为精确拉取 gh-pages 先下载完整仓库历史。
- 发布后本地 `master` 长时间落后远程的根因，是旧 Git closure 把活跃本地主 worktree 的 `ff-only` 当作远程发布闭合前置；一旦本地已提交开发与远程发布分叉，就只能停下来等待人工 rebase。真实仓库审计确认共同基线后一侧有 7 个、本地远端另一侧有 25 个独有提交。现已把 `origin/master` 固定为发布主线 owner：协调器在隔离 worktree 合并并验证双方历史、普通 push，再安全快进本地镜像；tracked WIP 由持续运行到成功的单例 retry worker 接管，不执行 rebase、stash、reset 或 force push，也不把同步动作留给用户。

## 测试/验证/验收方式

- 上下文压缩定向验证 157 项通过；SQLite 迁移、损坏索引、缺记录与并发写入测试通过。
- NPM runtime 自动更新真实链路从 0.42.3 beta 基线下载、切换并重启候选版本成功。
- macOS arm64 完整 DMG 打包验证通过：353.4 MB DMG、27.0 MB seed bundle、395 个 runtime 文件、51 个 plugin 文件、manifest 签名、SQLite 原生文件与命令入口均通过。
- 真实 Desktop GUI 在 11.8 秒内完成窗口和 NCP agent readiness；移走临时 bundle 的 `better_sqlite3.node` 后，壳保持存活但 `ncpAgent.state=error`，证明新 readiness 门不会误判。
- Desktop/Core/Server TypeScript、相关测试、脚本语法、lint、`git diff --check` 均通过；Windows/Ubuntu 安装器由发布 CI 补齐平台实机验证。
- Desktop 原子公开修复通过 actionlint、13 项发布合同测试、ESLint、脚本语法、diff-only 治理与稳定发布 dry-run；真实隐藏 Draft 的临时资产上传状态为 `uploaded` 且大小非零，删除后恢复 0 资产。未登录公开 API 对 `.1` 至 `.4` 均返回 404；既有完整 stable Release `v0.42.2-desktop.1` 精确匹配 30 个资产。
- Desktop 单次构建合同由发布测试证明：CLI 只做身份/签名 preflight，正式 workflow 内五平台 build、安装/启动冒烟、artifact upload 与 Draft 公开形成同一 run；发布 dry-run 不再等待 `desktop-validate`。
- 主线自动对账通过 25 项发布回归，其中 7 项专门覆盖已同步幂等、分叉隔离合并、并发远端 push 后重新验证、tracked/staged WIP 不变、未跟踪文件保留、retry worker 自动续跑/单例复用和语义冲突隔离；脚本语法、定向 ESLint、新代码治理、skill 渐进加载、治理 backlog、diff check 均通过。真实仓库幂等复验输出 `LOCAL_MAINLINE_SYNCED`，`master...origin/master=0/0`，总耗时 4.296 秒，最慢阶段为网络 fetch 3.815 秒，既有未跟踪设计稿保持原样。

## 发布/部署方式

- NPM stable 的 44 个 package 已发布并逐包回读，`nextclaw@latest=0.42.3`；Runtime stable Release、4 个非空资产、更新通道和旧版本升级验证已闭合。
- Desktop stable 已发布为 `v0.42.3-desktop.5`：macOS、Windows、Linux/AppImage、portable、signed bundle/manifest 共 30 个非空资产，五平台构建与安装/启动冒烟全部通过。
- stable update manifests 与 Linux APT 已公开回读；APT `nextclaw-desktop` 为 `0.0.266`，fresh install 与 upgrade 冒烟通过。此前 `.1` 至 `.4` 的 0 资产空壳经复核后已删除。
- Desktop 后续只允许显式触发：CLI 先创建隐藏 Draft，并以 release tag 和唯一 dispatch id 触发 Actions；构建失败或取消只保留不可公开的 Draft，完整资产核验通过后才公开。此次修复本身不创建新的 Desktop Release。
- 后续正式 NPM、Runtime、Desktop、全平台发布和向远程 `master` 写入的 Delivery 都在远程完成门后自动调用 `pnpm release:reconcile:mainline`。输出采用 `nextclaw.release-mainline-reconciliation/v1`，逐阶段记录起止、耗时、重试、初始/最终 SHA 和最慢阶段；此次自动化修复不发布新的 NPM、Runtime 或 Desktop identity。

## 用户/产品视角的验收步骤

1. 从 NPM `latest` 安装或升级到 0.42.3，确认已有会话自动迁移并且压缩长会话不再因 summary 截断中断。
2. 从官网下载 Desktop 正式版并首次启动，确认无需额外安装 Python、编译器或 SQLite 依赖即可打开会话页。
3. 在 Desktop 中创建和刷新会话，确认 SQLite 会话目录正常工作；并确认更新检查指向 stable channel。
4. 打开 Extension 与持续关注页面，确认外部事件能以事件卡片进入会话时间线。
5. 在 Windows/Linux/macOS 的公开下载入口分别确认安装包可下载，版本与 update manifest 一致。
6. 打开 GitHub Releases，确认任何公开 Desktop Release 都同时具备完整 30 资产集合；构建失败版本不得出现在公开列表。
7. 发布或交付完成后检查机器可读对账状态：正常空闲工作区应为 `LOCAL_MAINLINE_SYNCED`；开发现场存在 tracked WIP 时应为 `LOCAL_WORKTREE_RETRYING`，并由同一 PID 的后台 worker 在现场解除后自动变为同步，无需手工 pull/rebase。

## 可维护性总结汇总

- Sharp 与 SQLite 的 Desktop 原生依赖复制、目标平台解析和 Electron prebuild 统一由 `prepare-native-app-resources.mjs` 负责，产品 bundle 和壳打包不再各维护一份列表。
- Desktop 只通过 Core/Kernel 轻量公共子入口加载宿主诊断和自动更新常量，避免主进程启动前加载完整依赖图；Core 子入口同时提供 ESM 与 CJS 合同。
- 自动维护性检查最终为 0 error；6 个 warning 均为既有目录/文件预算或接近预算信号。超预算的 `desktop-package-verify.mjs` 本次相对基线净减 2 行，并完成跨模块主观复核，无开放 finding。
- 本次没有新增无收益 adapter、fallback 或并行状态 owner；新增增长集中在原生 ABI 合同、负向发布门与跨平台烟测。
- Desktop 发布修复 Review 首次阻断了继续增长的 505 行主 CLI；GitHub Draft 生命周期拆到单一 owner 后，主文件降至 487 行。最终自动检查 0 error、1 个接近预算 warning，主观复核无开放 finding；唯一 dispatch 身份同时消除了同 tag 重试串 run 的异步风险。
- 主线对账只新增一个协调 owner 和一个遥测/进程工具模块，没有引入数据库、通用队列或第二份发布状态；核心脚本经职责拆分后为 390 行。最终维护性检查 0 error、1 个既有桌面编排文件接近 500 行预算的 warning；新增 9 行仅连接独立 owner，主观复核无开放 finding。

## NPM 包发布记录

- 需要发布：是。原因是本批次包含用户可见 bugfix、公共 SDK/运行时合同和 Desktop 正式版依赖的产品 bundle。
- 待统一发布的精确包集合：`nextclaw`、`@nextclaw/app-runtime`、`@nextclaw/channel-extension-dingtalk`、`@nextclaw/channel-extension-discord`、`@nextclaw/channel-extension-email`、`@nextclaw/channel-extension-feishu`、`@nextclaw/channel-extension-qq`、`@nextclaw/channel-extension-slack`、`@nextclaw/channel-extension-telegram`、`@nextclaw/channel-extension-wecom`、`@nextclaw/channel-extension-weixin`、`@nextclaw/channel-extension-whatsapp`、`@nextclaw/client-sdk`、`@nextclaw/companion`、`@nextclaw/core`、`@nextclaw/extension-sdk`、`@nextclaw/harness`、`@nextclaw/kernel`、`@nextclaw/mcp`、`@nextclaw/ncp-agent-runtime-next`、`@nextclaw/ncp-agent-runtime`、`@nextclaw/ncp-http-agent-client`、`@nextclaw/ncp-http-agent-server`、`@nextclaw/ncp-mcp`、`@nextclaw/ncp-react-ui`、`@nextclaw/ncp-react`、`@nextclaw/ncp-toolkit`、`@nextclaw/ncp`、`@nextclaw/nextclaw-hermes-acp-bridge`、`@nextclaw/nextclaw-narp-runtime-claude-code-sdk`、`@nextclaw/nextclaw-narp-runtime-codex-sdk`、`@nextclaw/nextclaw-narp-runtime-opencode`、`@nextclaw/nextclaw-narp-stdio-runtime-wrapper`、`@nextclaw/nextclaw-ncp-runtime-adapter-hermes-http`、`@nextclaw/nextclaw-ncp-runtime-claude-code-sdk`、`@nextclaw/nextclaw-ncp-runtime-codex-sdk`、`@nextclaw/nextclaw-ncp-runtime-http-client`、`@nextclaw/nextclaw-ncp-runtime-stdio-client`、`@nextclaw/remote`、`@nextclaw/runtime`、`@nextclaw/server`、`@nextclaw/service`、`@nextclaw/shared`、`@nextclaw/ui`。
- 当前状态：上述 44 个 package 的 stable 版本已发布并完成 registry 回读；`nextclaw@latest=0.42.3`，`beta=0.42.3-beta.0`。Runtime GitHub Release 为 `nextclaw@0.42.3`，Desktop Release 为 `v0.42.3-desktop.5`。
- Desktop 原子公开修复不涉及额外 NPM 包发布或版本 bump。
- 主线自动对账属于内部发布基础设施，不涉及额外 NPM 包发布、changeset 或版本 bump。

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
