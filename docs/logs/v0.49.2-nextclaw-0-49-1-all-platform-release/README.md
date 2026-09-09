# NextClaw 0.49.1 全平台正式发布

## 迭代完成说明

- 2026-09-09 从冻结的远程 `master` 提交 `4a19d9f1f3a174e2ab25dd1cf82c8a3a8607dd3e` 单次 dispatch GitHub Actions `release.yml target=all`，以 patch 版本发布 `nextclaw@0.49.1` 及 workspace 依赖闭包。
- 本版明确包含聊天 Markdown LaTeX 公式支持：行内 `$...$`、独立 `$$...$$`、KaTeX 分数/根号/求和/积分/矩阵、宽公式横向滚动，以及流式未闭合独立公式的中性占位；代码、转义美元符号和 Skill 引用保持字面语义。
- parent run [34301405491](https://github.com/Peiiii/nextclaw/actions/runs/34301405491) 完成 `NPM_READY`、全平台 Node 兼容矩阵和 `NEXTCLAW_STABLE_READY`；NPM 发布闭合提交为 `6bb8ad1c3d0419b6748f172e63bcb7255a85293d`。
- Desktop 阶段在构建前被安全门拒绝：parent checkout 仍停在发布源 `4a19d9f1f`，而 NPM job 已把 `origin/master` 推进到闭合提交 `6bb8ad1c3`，因此控制脚本确认本地落后 1 个提交后退出。日志直接给出 `Current branch is behind origin/master by 1 commit(s)`，根因已完全定位。
- 恢复从闭合提交 `6bb8ad1c3` 运行同一 Desktop identity `v0.49.1-desktop.1`，复用隐藏 Draft，不重发 NPM/Runtime，也不创建替代 tag；preflight [34302634156](https://github.com/Peiiii/nextclaw/actions/runs/34302634156) 与生产 run [34302658162](https://github.com/Peiiii/nextclaw/actions/runs/34302658162) 均成功。
- 恢复直接对齐产生主线推进的闭合提交，而不是绕过 behind guard，因而修复动作针对控制面 checkout 与 release closure 的竞态根因，而非仅掩盖报错。

## 测试/验证/验收方式

- 功能合入前验证：`@nextclaw/agent-chat-ui` 314 项测试、TypeScript 检查与 package build 通过；另有 50 项聚焦 Markdown/公式测试、定向 lint、diff-only review 与治理检查通过。
- exact-SHA prebuild [34300337223](https://github.com/Peiiii/nextclaw/actions/runs/34300337223) 成功生成不可变 NPM tree/tarballs，以及 darwin-arm64、darwin-x64、linux-x64、win32-x64 Runtime 预制物；构建、签名和生命周期检查通过。
- parent run 的 NPM publish 成功；Linux、Windows、macOS arm64/x64 在 Node 20.19.0、22.19.0、24、26 的适用矩阵通过，不支持 Node 版本的明确失败 guard 通过。
- Registry 回读确认 `nextclaw@latest=0.49.1`，tarball 为 `https://registry.npmjs.org/nextclaw/-/nextclaw-0.49.1.tgz`，integrity 为 `sha512-+gw2p1t9vDel9jVBOzZhlF+/jVKWFW8uA8nEvBlNosPXpig7ySDQLnANmAtvxzd3ajQ83ffDYfWQAR07r6D3Ng==`；公式 owner 包为 `@nextclaw/agent-chat-ui@0.9.0`。
- Runtime 发布、四平台资产、旧稳定版升级验证和公开 manifest 通过；manifest 为 `latestVersion=0.49.1`、`minimumLauncherVersion=0.18.11`、`hostKind=npm-runtime-bundle`，并指向本版英文说明。
- Desktop workflow 11/11 jobs 成功；macOS arm64/x64、Windows arm64/x64、Linux x64 构建与冒烟、Draft-first 发布、五平台更新 manifest、stable APT 和公共 Pages 均闭合。Desktop 版本为 `0.0.285`。
- [中文说明](https://docs.nextclaw.io/zh/notes/2026-09-09-nextclaw-v0-49-1) 与 [English notes](https://docs.nextclaw.io/en/notes/2026-09-09-nextclaw-v0-49-1) 均返回 200；Runtime 与 Desktop GitHub Release 均为公开稳定版，正文包含中英文公式说明。

### 发布耗时

- parent dispatch：01:59:39Z；`NPM_READY` 于约 02:07:16Z 记录，约 7 分 37 秒，超过 `<60s` 目标，`time budget: missed`。其中 NPM 核心 publish step 为 5 分 45 秒，是该阶段主要瓶颈。
- Runtime job 用时 3 分 03 秒；Desktop 生产 workflow 用时 29 分 47 秒，最慢 job 为 macOS x64（19 分 23 秒），最慢 step 为 macOS build（10 分 45 秒）。
- 从首次 parent dispatch 到全平台公共 Pages 闭合共约 48 分 13 秒。后续应让 Desktop job checkout/bind 到 `desktop_target` 对应的闭合提交，或在启动控制脚本前自动快进，使 NPM 推进主线后无需人工切换恢复入口。
- `AUTOMATION_INTERVENTIONS: 1`：parent Desktop 因旧 checkout 落后闭合主线后，人工从同一 release identity 的闭合提交启动一次 Desktop 单阶段恢复；没有重复发布 NPM/Runtime。

## 发布/部署方式

- 唯一全平台入口为 `.github/workflows/release.yml target=all`，source SHA `4a19d9f1f3a174e2ab25dd1cf82c8a3a8607dd3e`；NPM release closure/Runtime/Desktop immutable target 为 `6bb8ad1c3d0419b6748f172e63bcb7255a85293d`。
- Runtime Release：[NextClaw v0.49.1](https://github.com/Peiiii/nextclaw/releases/tag/nextclaw%400.49.1)；Desktop Release：[NextClaw Desktop 0.0.285](https://github.com/Peiiii/nextclaw/releases/tag/v0.49.1-desktop.1)。
- 稳定 Runtime 与 Desktop 更新清单发布到 `gh-pages`/公共 Pages；Linux Desktop 同步发布 signed stable APT 仓库。
- 远程完成后协调器已返回 `LOCAL_MAINLINE_SYNCED`；主工作区保留用户原有未跟踪计划文件，未执行 stash、rebase、reset 或覆盖。

## 用户/产品视角的验收步骤

1. 安装或升级到 `nextclaw@0.49.1`，在聊天消息中输入 `$E=mc^2$` 与 `$$\frac{-b\pm\sqrt{b^2-4ac}}{2a}$$`，确认分别显示行内和独立公式。
2. 流式生成独立公式时，确认闭合前只显示中性省略号，闭合后再渲染 KaTeX；代码块、行内代码、`\$` 和 Skill 引用不被误判为公式。
3. 按系统从 Desktop Release 下载 macOS DMG/ZIP、Windows installer/portable 或 Linux AppImage/DEB，确认应用内 stable 更新指向 Runtime `0.49.1`、Desktop `0.0.285`。
4. Linux 用户通过 stable APT 仓库全新安装或升级，确认 candidate/installed 版本为 `0.0.285`。

## 可维护性总结汇总

- 公式能力沿现有 Markdown renderer owner 接入，没有新增平行渲染器；流式未闭合状态在渲染前规范化，保持代码与字面美元符号语义边界。
- 发布复用现有 prebuild、NPM/Runtime/Desktop single-owner workflow、Draft-first 和公共 manifest 校验，没有创建替代版本或平行发布状态机。
- 功能源码完成 diff-only maintainability 自动检查且无 findings；本次收尾只新增既有 `docs/logs/v<semver>-<slug>/README.md` 下的发布记录，planned-path preflight 通过，目录/文件角色未扩散。
- 本次没有修改发布控制面缺口；已把 checkout/closure 竞态及其唯一恢复动作完整记录，供后续由发布 owner 自动化消除。

## NPM 包发布记录

- 需要发布：聊天 Markdown 公式属于用户可见功能，按用户要求以 patch 产品版本 `nextclaw@0.49.1` 发布；公式 owner 包按 changeset 发布为 `@nextclaw/agent-chat-ui@0.9.0`。
- 已发布并完成 tags/registry 验证：`nextclaw@0.49.1`、`@nextclaw/agent-chat-ui@0.9.0`、`@nextclaw/app-runtime@0.16.4`、`@nextclaw/channel-extension-dingtalk@0.2.46`、`@nextclaw/channel-extension-discord@0.2.46`、`@nextclaw/channel-extension-email@0.2.46`、`@nextclaw/channel-extension-feishu@0.2.35`、`@nextclaw/channel-extension-qq@0.2.33`、`@nextclaw/channel-extension-slack@0.2.46`、`@nextclaw/channel-extension-telegram@0.2.46`、`@nextclaw/channel-extension-wecom@0.2.46`、`@nextclaw/channel-extension-weixin@0.2.35`、`@nextclaw/channel-extension-whatsapp@0.2.46`、`@nextclaw/client-sdk@0.12.2`、`@nextclaw/companion@0.2.59`、`@nextclaw/core@0.17.20`、`@nextclaw/desktop-extension-wechat@0.2.4`、`@nextclaw/extension-sdk@0.5.4`、`@nextclaw/harness@0.2.16`、`@nextclaw/kernel@0.17.0`、`@nextclaw/mcp@0.3.47`、`@nextclaw/ncp-agent-runtime-next@0.1.26`、`@nextclaw/ncp-agent-runtime@0.4.24`、`@nextclaw/ncp-http-agent-client@0.4.23`、`@nextclaw/ncp-http-agent-server@0.4.22`、`@nextclaw/ncp-mcp@0.2.47`、`@nextclaw/ncp-react-ui@0.3.22`、`@nextclaw/ncp-react@0.5.28`、`@nextclaw/ncp-toolkit@0.6.25`、`@nextclaw/ncp@0.11.0`、`@nextclaw/nextclaw-hermes-acp-bridge@0.3.22`、`@nextclaw/nextclaw-narp-runtime-claude-code-sdk@0.2.24`、`@nextclaw/nextclaw-narp-runtime-codex-sdk@0.2.24`、`@nextclaw/nextclaw-narp-runtime-opencode@0.2.47`、`@nextclaw/nextclaw-narp-stdio-runtime-wrapper@0.3.23`、`@nextclaw/nextclaw-ncp-runtime-adapter-hermes-http@0.3.26`、`@nextclaw/nextclaw-ncp-runtime-claude-code-sdk@0.2.24`、`@nextclaw/nextclaw-ncp-runtime-codex-sdk@0.2.23`、`@nextclaw/nextclaw-ncp-runtime-http-client@0.3.23`、`@nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.47`、`@nextclaw/remote@0.3.59`、`@nextclaw/runtime@0.4.46`、`@nextclaw/server@0.23.2`、`@nextclaw/service@0.6.5`、`@nextclaw/shared@0.5.2`、`@nextclaw/ui@0.25.1`。
- 所有 package tags 均指向 release closure `6bb8ad1c3d0419b6748f172e63bcb7255a85293d`；NPM、Runtime、Desktop、文档、GitHub Releases、稳定更新通道和 APT 均已闭合，无外部 blocker。
