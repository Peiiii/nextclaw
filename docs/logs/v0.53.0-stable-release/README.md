# NextClaw v0.53.0 全平台正式发布

## 迭代完成说明

- 2026-09-11 完成 `nextclaw@0.53.0` 稳定版全平台发布：NPM、四平台 Portable Runtime、macOS / Windows / Linux Desktop、stable update channel、APT、GitHub Release、文档站中英文发布说明与博客、X 官宣全部闭环。
- 产品发布提交为 `831264fcd10daab0c9e37b768c31a0c2e982aea2`，正式产品 Release 为 [`nextclaw@0.53.0`](https://github.com/Peiiii/nextclaw/releases/tag/nextclaw%400.53.0)，桌面 Release 为 [`v0.53.0-desktop.1`](https://github.com/Peiiii/nextclaw/releases/tag/v0.53.0-desktop.1)。
- 中英文[发布说明](https://docs.nextclaw.io/zh/notes/2026-09-11-nextclaw-v0-53-0)与[产品博客](https://docs.nextclaw.io/zh/blog/2026-09-11-self-management-restart-continuity)已在线；X 官宣已由维护者账号发布并回读确认：<https://x.com/i/status/2098199429530731000>。
- 发布主流程首次运行 [`34539942465`](https://github.com/Peiiii/nextclaw/actions/runs/34539942465) 已完成 NPM 与 Runtime，但 Desktop 在发布提交推进远端 `master` 后仍把 workflow dispatch SHA 当作 branch bind 基准，因本地分支落后一个提交而失败。
- 根因修复提交 `0c54dbb9e` 将非恢复 Desktop checkout 固定到 NPM closure commit，并让本地 `master` 绑定实际 checkout HEAD；恢复流程继续使用原始 recovery SHA，同时 Desktop builder 仍消费不可变 `desktop_target`。恢复运行 [`34541952826`](https://github.com/Peiiii/nextclaw/actions/runs/34541952826) 复用已有 NPM、Runtime 和隐藏 Desktop Draft，未创建重复版本或 tag，最终成功公开完整 Desktop Release。

## 测试、验证与验收方式

- 发布前 `pnpm release:summary -- --strict` 与 `pnpm release:product:stable -- --dry-run --require-product-artifacts` 通过；精确提交 prepare run `34538753060` 成功生成 NPM prepared artifact 和 darwin-arm64、darwin-x64、linux-x64、win32-x64 Runtime 产物。
- 正式 NPM 流程完成发布后安装、CLI、Runtime 更新与旧稳定版升级验证；兼容矩阵覆盖 Linux、Windows、macOS arm64/x64 以及 Node 20.19、22.19、24、26，并验证不支持的 Node 版本会明确失败。
- Desktop 恢复发布完成 macOS arm64/x64、Windows x64/arm64、Linux x64 构建及安装/启动冒烟；31 个资产在公开前完成闭合校验。
- 发布控制面修复通过 42 项 release/runtime/desktop recovery 定向测试、15 项受影响文件测试、ESLint、actionlint、`pnpm lint:new-code:governance`、backlog ratchet、`git diff --check` 与 diff-only maintainability guard；自动检查为 0 error、0 warning，主观 Review 无 findings。
- 线上核验：中英文发布说明、中英文博客、结构化 release notes、5 个 stable Desktop manifest 与 APT Packages 索引均返回 HTTP 200；Linux x64 manifest 指向 `0.53.0` 与 `v0.53.0-desktop.1`。
- NPM registry 回读确认 `nextclaw@latest = 0.53.0`，integrity 为 `sha512-3lglFM9vozGsBB42WOlY8GqR5uG4BEVosvE00MF5PFXXTjhVhVcxZd5oJLCy2y2dzDik8h7lMXLypy6V9tAnVg==`。
- 发布配图与最近 5 次 minor release 图做了重复度比较；最终工作台实景在主题匹配、可辨识度、信息层级、构图、可读性、品牌一致性六项分别为 `5/5/4/4/4/4`。针对最低项的定向迭代是收敛官宣正文与 alt text，只解释画面真实可见的会话、可视化结果和项目预览，不扩写截图无法证明的重启状态；回读确认正文、作者和单张图片均正确。

## 发布与部署方式

- 通过统一 `release.yml target=all` 发布稳定版；首次正式运行发布 NPM 与 Runtime，随后因 Desktop 控制面缺陷失败。
- 修复后沿同一 `0.53.0` / `v0.53.0-desktop.1` 身份执行恢复运行；恢复检测复用已经发布的不可变产物，只重新闭合 Desktop 与最终状态汇总。
- GitHub Pages 投影 stable Desktop manifest 与 APT 索引；文档站从 `master` 发布中英文 release notes、博客和结构化 JSON。
- 发布链路观察耗时：首次正式运行从 22:57:46 UTC 到 Desktop 失败约 18 分 06 秒；恢复运行从 23:23:45 UTC 到全部成功约 29 分 33 秒；从首次 dispatch 到最终闭合共 55 分 32 秒。恢复链路最长步骤为 Desktop 五平台构建与冒烟，约 23 分 56 秒。
- `AUTOMATION_INTERVENTIONS: 1`：按单一根因计数，人工介入一次，用于修复 Desktop checkout / branch bind 控制面并触发同身份恢复；没有手工上传或替换发布资产。

## 用户与产品视角的验收步骤

1. 打开中英文发布说明，确认 `0.53.0` 的统一工作台、会话重启续接、移动端会话操作和 Resident inbox 资源保护均有用户可理解的说明。
2. 使用 `npm install -g nextclaw@latest`，确认安装版本为 `0.53.0`，CLI 能启动并发现 stable Runtime 更新。
3. 从 Desktop Release 下载对应 macOS、Windows 或 Linux 安装包；已有桌面端通过 stable update channel 检查更新，确认 manifest 指向 `0.53.0`。
4. 在 NextClaw 中同时使用会话、项目文件与面板应用，确认工作区可连续查看和处理 AI 生成结果；执行受控重启后，确认活跃会话按发布说明自动续接。
5. 打开 X 官宣，确认正文、链接和工作台配图可见且发布者为 `@XiaotiaoWang`。

## 可维护性总结汇总

- 发布语义继续由统一 `release.yml` 和 release scripts 拥有，没有新增第二套发布入口、替代 tag 或人工资产上传路径。
- 故障修复只调整 Desktop job 的 checkout / branch bind 控制面；不可变 `desktop_target`、Draft-first 原子公开、NPM 与 Runtime identity 均保持原 owner。
- 新增设计与本发布记录位于既有 `docs/designs`、`docs/logs/v<semver>-<slug>/README.md` owner；planned-path preflight 与治理检查通过。
- 恢复运行证明重复执行是幂等的：NPM、Runtime、Draft 和 tag 都被复用，没有覆盖已公开不可变产物。

## NPM 包发布记录

本批共发布 30 个 NPM 包，并为每个包创建对应版本 tag：

- `nextclaw@0.53.0`
- `@nextclaw/agent-chat-ui@0.10.0`
- `@nextclaw/app-runtime@0.16.7`
- `@nextclaw/channel-extension-dingtalk@0.2.49`
- `@nextclaw/channel-extension-discord@0.2.49`
- `@nextclaw/channel-extension-email@0.2.49`
- `@nextclaw/channel-extension-feishu@0.2.38`
- `@nextclaw/channel-extension-qq@0.2.36`
- `@nextclaw/channel-extension-slack@0.2.49`
- `@nextclaw/channel-extension-telegram@0.2.49`
- `@nextclaw/channel-extension-wecom@0.2.49`
- `@nextclaw/channel-extension-weixin@0.2.38`
- `@nextclaw/channel-extension-whatsapp@0.2.49`
- `@nextclaw/client-sdk@0.12.6`
- `@nextclaw/companion@0.2.63`
- `@nextclaw/core@0.18.0`
- `@nextclaw/desktop-extension-wechat@0.2.7`
- `@nextclaw/extension-sdk@0.5.7`
- `@nextclaw/harness@0.2.20`
- `@nextclaw/kernel@0.18.0`
- `@nextclaw/mcp@0.3.50`
- `@nextclaw/ncp-mcp@0.2.50`
- `@nextclaw/nextclaw-narp-runtime-opencode@0.2.50`
- `@nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.50`
- `@nextclaw/remote@0.3.63`
- `@nextclaw/runtime@0.4.49`
- `@nextclaw/server@0.23.6`
- `@nextclaw/service@0.7.0`
- `@nextclaw/shared@0.8.0`
- `@nextclaw/ui@0.26.0`
