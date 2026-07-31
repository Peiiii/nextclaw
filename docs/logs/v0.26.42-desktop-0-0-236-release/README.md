# v0.26.42 Desktop 0.0.236 / Runtime 0.27.7 stable 发布

## 迭代完成说明

- 本轮已把 NextClaw runtime `0.27.7` 带到 Desktop stable 通道，桌面壳版本为 `0.0.236`，正式 tag 为 `v0.27.7-desktop.1`。
- 发布内容覆盖自上一桌面正式版 `0.0.234 / 0.27.5` 以来的 `0.27.6` 与 `0.27.7` 用户能力，并包含 Codex app-server binary 解析与跨 runtime session identity 的后续可靠性修复。
- stable 最低 launcher 版本继续保持 `0.0.141`，没有提高已安装用户的更新门槛。
- 已修正 `0.27.7` 中英文公开说明与结构化 release notes，把原先“本次不包含新的桌面安装包”更新为 Desktop `0.0.236` 的真实发布范围。
- 正式 GitHub Release 为 stable/latest、非 draft、非 prerelease，共 30 个资产；双语 Release body 中英各保留一条 changelog，已移除 GitHub 创建时自动附加的重复尾注。
- 官网 stable 下载 fallback 已在正式产物、更新通道与 APT 仓库全部验收后同步到 `v0.27.7-desktop.1 / 0.0.236`，避免下载页在 GitHub API 不可用时回退到旧版。

## 测试/验证/验收方式

- 发布前使用隔离 worktree 运行 `pnpm install --frozen-lockfile` 与 `pnpm desktop:package:verify`，验证打包公钥、GUI 启动、renderer 就绪、runtime 健康和安装资产合同。
- 远端创建 Release 前运行 `desktop-release-preflight.yml`，确认 stable 签名密钥和发布目标 SHA 合同。
- 正式 workflow 必须完成 macOS arm64/x64、Windows x64/arm64、Linux x64 构建，以及 release assets、desktop update channels 与 stable APT 发布。
- 收尾必须核对 GitHub Release 资产、`gh-pages` stable manifest、公开 Pages manifest 和公开 APT `Packages`。
- 本地隔离验证已真实构建 140.4 MB 的 macOS arm64 DMG，验证安装包内公钥、seed runtime `0.27.7`、262 个 runtime 文件、31 个 plugin 文件、隔离 runtime init、GUI `ready-to-show`、renderer 加载与健康 API。
- 远端 preflight run `30617638319` 成功；Desktop release run `30617658653` 的 attempt 2 成功，5 个平台 matrix job 与 `publish-release-assets`、`publish-desktop-update-channels`、`publish-linux-apt-repo` 全部通过。
- attempt 1 的 Linux `.deb` smoke 在真正启动安装包前，因 Docker Hub 连续三次拉取 `ubuntu:24.04` 超时失败；同一 run 只重跑失败 job 后越过该边界并通过，证明失败属于外部镜像网络瞬态，不是 `.deb` 或 runtime 缺陷。
- 公开 stable manifest 的 darwin arm64/x64、win32 arm64/x64、linux x64 五个 target 均为 runtime `0.27.7`、最低 launcher `0.0.141`，并指向同一公开 release notes URL；公开 APT `Packages` 包含 `nextclaw-desktop 0.0.236`。
- 官网 fallback 更新通过 `pnpm -C apps/landing lint`、`pnpm -C apps/landing tsc`、`pnpm -C apps/landing build`、新代码治理和 backlog ratchet；lint 为 0 error，并保留 `main.ts` 两项既有文件长度 warning。
- Cloudflare Pages 预览域与正式域的中英文下载页均返回 200，生产 bundle 只包含新 tag/version；Playwright 真实浏览器进一步确认页面渲染版本、Release 链接、macOS 双架构、Windows 安装器与便携版、Linux AppImage 下载链接全部精确指向本次 Release。

## 发布/部署方式

- 使用仓库标准入口 `pnpm release:desktop:stable -- --notes-file docs/logs/v0.26.42-desktop-0-0-236-release/github-release.md`，发布目标为 `ac4e6ba28f4c7b571006dd62c638016783b2f7eb`。
- 自动化已把本地 `master` 的 7 个已提交发布目标推送到 `origin/master`，再执行远端预检、创建正式 GitHub Release 并等待完整发布闭环。
- 本轮不发布 `@nextclaw/desktop` 到 NPM；桌面安装包、portable 包、runtime bundle、更新 manifest 与 APT 包统一由 GitHub Desktop Release workflow 产出。
- 不涉及数据库 migration 或后端服务部署。
- 官网使用本机已登录的固定 Wrangler 部署 `apps/landing/dist` 到 Cloudflare Pages 项目 `nextclaw-landing` 的 `master` 分支；本次部署地址为 https://299fd180.nextclaw-landing.pages.dev，正式入口为 https://nextclaw.io/en/download/ 与 https://nextclaw.io/zh/download/。
- GitHub Release：https://github.com/Peiiii/nextclaw/releases/tag/v0.27.7-desktop.1
- Desktop release workflow：https://github.com/Peiiii/nextclaw/actions/runs/30617658653
- Signing preflight workflow：https://github.com/Peiiii/nextclaw/actions/runs/30617638319

## 用户/产品视角的验收步骤

1. 从官网中英文下载页或正式 GitHub Release 下载 macOS、Windows 或 Linux 对应安装资产，确认页面和桌面壳版本均为 `0.0.236`。
2. 启动应用，确认内置 runtime 为 `0.27.7`，并可正常进入聊天界面、创建会话与运行 Agent。
3. 在 launcher `0.0.141` 或更新版本检查 stable 更新，确认 manifest 返回 runtime `0.27.7` 与公开 `0.27.7` 更新说明。
4. Linux 用户可从 stable APT 仓库读取并安装 `0.0.236`。
5. macOS 与 Windows 的首次打开继续按未签名构建说明完成系统确认。

## 可维护性总结汇总

- 本轮发布准备修改用户可见说明、结构化 release notes、迭代记录，以及 landing 既有 stable fallback 的两个常量；没有新增文件、抽象、分支或并行下载路径。
- 公开文案与 stable manifest 复用同一份 `0.27.7` release notes URL，避免桌面资产已经发布但说明仍声明“无桌面安装包”的双重事实。
- 桌面版本、runtime 版本、最低 launcher 版本和 tag 仍由现有标准自动化读取与校验，没有新增手工发布分支或替代脚本。
- landing 源码改动为 `+2/-2`、非测试生产语义代码净增 `0`；maintainability guard 为 0 error、0 warning，满足非功能改动净增 `<= 0`。

## 红区触达与减债记录

- 本轮未触达代码红区；landing 仅原位更新既有下载事实 owner。
- 正向减债是删除公开发布说明、官网 fallback 与桌面实际发布范围之间的冲突，并继续复用结构化 release notes、单一 stable 发布入口和单一官网 fallback owner。

## NPM 包发布记录

- 本轮不新增顶层 `nextclaw` 或 `@nextclaw/desktop` NPM 发布。
- Desktop runtime 所依赖的 Codex、Claude 与 Hermes runtime patch 已在上一批次发布并完成 registry 安装/导入验证；本轮只闭合桌面安装与更新分发。
