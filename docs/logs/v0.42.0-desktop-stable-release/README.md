# v0.42.0 Desktop 稳定版发布记录

## 迭代完成说明

- 发布批次：NextClaw runtime `0.42.0`、Desktop `0.0.260`、稳定桌面 tag `v0.42.0-desktop.1`。
- NPM/runtime 发布、GitHub Release、公开 stable update channel、稳定 APT 仓库和 X 发布说明均已闭合。
- 首次桌面工作流只剩 Linux APT 发布失败：正式 `.deb` 为 `109326464` bytes，超过 GitHub Pages 单文件 `100 MiB` 限制；极限 xz 重打包仍为 `106818928` bytes。
- 根因通过失败 job `96534840228` 日志确认，不是构建或签名失败。修复路径是 APT 镜像专用重打包：保留正式 Release 原资产，仅在 gh-pages APT 包中移除非运行时诊断、Vulkan fallback、冗余浏览器资源/locale 和开发文档，再以 xz extreme 重建。
- 恢复工作流 `32407411955` 通过，最终 APT 包低于限制；签名仓库、全新安装和升级冒烟均通过。桌面闭合命令复用同一 tag 和该 run，未创建新 tag、未重复上传桌面资产。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ui build && pnpm -C packages/nextclaw build` 通过。
- `pnpm release:prepare:publish-artifacts`、严格 publish-artifacts 校验通过；43 个 NPM 包逐包完成 registry/integrity 校验。
- `nextclaw@0.42.0` 及同批包公开可安装；从 `0.41.0` 执行 runtime `check`、`download-only`、`apply` 和新进程版本检查，最终为 `0.42.0`。
- runtime workflow `32399601071` 成功，darwin arm64/x64、linux x64、win32 x64 stable 资产和 gh-pages manifest 均通过。
- Desktop preflight `32400734305` 成功；桌面矩阵、Release assets、update channels 成功。macOS arm64 本地 DMG 包验证、GUI smoke、API health、command surface 和 seed runtime `init` 通过。
- APT recovery workflow `32407411955` 的签名仓库、Ubuntu 24.04 fresh install 和 upgrade smoke 通过；闭合校验确认 gh-pages 与公开 Pages manifest、APT candidate 均为 `0.42.0`/`0.0.260`。
- X 帖子 readback 已核对作者、文本和图片：<https://x.com/i/status/2090498013022286049>。

## 发布/部署方式

- NPM/runtime：`nextclaw@0.42.0` 与同批 43 个包发布到公开 npm registry；runtime Release：<https://github.com/Peiiii/nextclaw/releases/tag/nextclaw%400.42.0>。
- Desktop Release：<https://github.com/Peiiii/nextclaw/releases/tag/v0.42.0-desktop.1>。
- Desktop stable channel 通过 GitHub Pages 发布；Linux stable APT 使用现有 Release `.deb` 的 APT 专用压缩包，不改变 GitHub Release 原始下载资产。
- 线上工作流：runtime `32399601071`、desktop 初次构建 `32400809094`、APT 恢复 `32407411955`。

## 用户/产品视角的验收步骤

1. 安装桌面 `v0.42.0-desktop.1`，确认 shell 为 `0.0.260`、runtime bundle 为 `0.42.0`。
2. 在更新检查中确认 stable manifest 指向 `0.42.0`，并可下载对应平台 bundle。
3. Linux 用户按 stable APT 安装命令安装 `nextclaw-desktop`，确认 candidate/installed 版本为 `0.0.260`，再执行升级检查。
4. 打开应用，确认固定 Panel App 的可折叠分组、Marketplace 平台兼容提示和内置 Node fallback 可用。

## 可维护性总结汇总

- 本批次把 GitHub Pages 单文件限制作为发布合同显式处理，恢复路径复用现有 tag/run，不引入伪 universal 包或重复 Release。
- APT 裁剪逻辑集中在 workflow 的专用重打包步骤，正式桌面资产保持完整；失败时仍 fail-closed，不会发布超限文件。
- 未新增 wrapper 或平行发布链路；提交、tag、runtime、desktop、APT 和文档证据均可从同一发布记录追溯。
- 自动检查与本地验证均通过；仅 APT 专用裁剪包未在本机执行 GUI 启动，已用 Ubuntu fresh-install/upgrade 冒烟覆盖安装合同，后续可在 VPS 补充真实启动验证。

## NPM 包发布记录

- 需要发布：本批次包含 runtime、kernel、server、UI 及相关 workspace 包的稳定版本闭合。
- 已发布：`nextclaw@0.42.0` 与同批共 43 个包；`@nextclaw/ui` 使用 `0.19.3`，逐包公开 registry/integrity 校验通过。
- 无待统一发布包，无外部阻塞；NPM SLA 观测为 `67.45s`，随后 runtime channel 已独立恢复并完成验证。
