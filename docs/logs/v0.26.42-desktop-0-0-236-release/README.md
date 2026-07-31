# v0.26.42 Desktop 0.0.236 / Runtime 0.27.7 stable 发布

## 迭代完成说明

- 本轮把已发布的 NextClaw runtime `0.27.7` 带到 Desktop stable 通道，桌面壳版本为 `0.0.236`，候选 tag 为 `v0.27.7-desktop.1`。
- 发布内容覆盖自上一桌面正式版 `0.0.234 / 0.27.5` 以来的 `0.27.6` 与 `0.27.7` 用户能力，并包含 Codex app-server binary 解析与跨 runtime session identity 的后续可靠性修复。
- stable 最低 launcher 版本继续保持 `0.0.141`，没有提高已安装用户的更新门槛。
- 已修正 `0.27.7` 中英文公开说明与结构化 release notes，把原先“本次不包含新的桌面安装包”更新为 Desktop `0.0.236` 的真实发布范围。

## 测试/验证/验收方式

- 发布前使用隔离 worktree 运行 `pnpm install --frozen-lockfile` 与 `pnpm desktop:package:verify`，验证打包公钥、GUI 启动、renderer 就绪、runtime 健康和安装资产合同。
- 远端创建 Release 前运行 `desktop-release-preflight.yml`，确认 stable 签名密钥和发布目标 SHA 合同。
- 正式 workflow 必须完成 macOS arm64/x64、Windows x64/arm64、Linux x64 构建，以及 release assets、desktop update channels 与 stable APT 发布。
- 收尾必须核对 GitHub Release 资产、`gh-pages` stable manifest、公开 Pages manifest 和公开 APT `Packages`。

## 发布/部署方式

- 使用仓库标准入口 `pnpm release:desktop:stable -- --notes-file docs/logs/v0.26.42-desktop-0-0-236-release/github-release.md`。
- 自动化会先把本地 `master` 的已提交发布目标推送到 `origin/master`，再执行远端预检、创建正式 GitHub Release 并等待完整发布闭环。
- 本轮不发布 `@nextclaw/desktop` 到 NPM；桌面安装包、portable 包、runtime bundle、更新 manifest 与 APT 包统一由 GitHub Desktop Release workflow 产出。
- 不涉及数据库 migration 或后端服务部署。

## 用户/产品视角的验收步骤

1. 从正式 GitHub Release 下载 macOS、Windows 或 Linux 对应安装资产，确认桌面壳版本为 `0.0.236`。
2. 启动应用，确认内置 runtime 为 `0.27.7`，并可正常进入聊天界面、创建会话与运行 Agent。
3. 在 launcher `0.0.141` 或更新版本检查 stable 更新，确认 manifest 返回 runtime `0.27.7` 与公开 `0.27.7` 更新说明。
4. Linux 用户可从 stable APT 仓库读取并安装 `0.0.236`。
5. macOS 与 Windows 的首次打开继续按未签名构建说明完成系统确认。

## 可维护性总结汇总

- 本轮发布准备只修改用户可见说明、结构化 release notes 与迭代记录，没有修改源码、脚本、测试或运行链路。
- 公开文案与 stable manifest 复用同一份 `0.27.7` release notes URL，避免桌面资产已经发布但说明仍声明“无桌面安装包”的双重事实。
- 桌面版本、runtime 版本、最低 launcher 版本和 tag 仍由现有标准自动化读取与校验，没有新增手工发布分支或替代脚本。

## 红区触达与减债记录

- 本轮未触达代码红区。
- 正向减债是删除公开发布说明与桌面实际发布范围之间的冲突，并继续复用结构化 release notes 与单一 stable 发布入口。

## NPM 包发布记录

- 本轮不新增顶层 `nextclaw` 或 `@nextclaw/desktop` NPM 发布。
- Desktop runtime 所依赖的 Codex、Claude 与 Hermes runtime patch 已在上一批次发布并完成 registry 安装/导入验证；本轮只闭合桌面安装与更新分发。
