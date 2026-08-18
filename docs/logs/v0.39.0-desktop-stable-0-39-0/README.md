# NextClaw Desktop Stable 0.39.0 发布记录

## 迭代完成说明

本批次从 `master` 提交 `f25c4c37bfac5ed19eba8b74868299a6e4bd055f` 发布 NextClaw Desktop stable。桌面壳版本为 `0.0.255`，内置 runtime 为已经公开验证的 `nextclaw@0.39.0`，最低 launcher 版本保持 `0.0.141`。正式 tag 为 `v0.39.0-desktop.1`，最终状态为 `DESKTOP_READY`。

本次桌面版本补齐 0.37.0 之后已经进入 0.39.0 runtime 的会话可靠性修复，包括空闲 NCP 流立即建立、OpenAI Responses 多轮历史与函数工具协议修正，以及思考关闭偏好稳定性。用户反馈的“回复丢失后会话仍停在运行中、必须重启再继续生成”与既有 SSE 恢复问题高度相关，但根因未完全定位；因此本次发布只陈述已包含的修复，不把尚未在原用户环境复验的问题表述为确定闭环。

发布期间 GitHub API 代理多次返回 EOF。所有失败都发生在本地状态查询或首次 Release 参数校验：远端 signing preflight `32132842151` 已成功；首次完整 package verify 已成功；GitHub Release 在使用完整 target SHA 后创建；后续始终复用同一 tag 与 workflow `32133244179`，没有创建重复版本或重复发布已成功资产。

## 测试/验证/验收方式

- 本地隔离 worktree `desktop:package:verify` 通过：
  - Desktop lint、TypeScript 和 main build 通过。
  - macOS arm64 DMG 构建成功，大小约 141.9 MB。
  - seed runtime 精确为 `0.39.0`，runtime 文件 279、plugin 文件 51。
  - update manifest 验签、CLI init、命令面、GUI 启动与 `/api/health` 冒烟通过。
- GitHub signing-secret preflight：run `32132842151`，结论 `success`。
- Desktop release workflow：run `32133244179`，8/8 jobs `success`。
- 五个平台矩阵全部通过：macOS arm64/x64、Windows arm64/x64、Linux x64。
- Release assets 已核对包含 DMG、macOS ZIP、Windows installer、Windows portable/unpacked ZIP、Linux AppImage/deb、五个平台 runtime bundle、五个平台 stable manifest 和 `update-bundle-public.pem`。
- 公开 stable manifest 已验证：`latestVersion=0.39.0`、`minimumLauncherVersion=0.0.141`、release notes URL 指向 0.39.0 英文产品笔记。
- 公开 APT Packages 已验证：`nextclaw-desktop` 为 `0.0.255`。
- Landing fallback 更新后执行匹配范围 TypeScript、ESLint、生产构建和 diff-only maintainability 检查。

## 发布/部署方式

- GitHub Release：https://github.com/Peiiii/nextclaw/releases/tag/v0.39.0-desktop.1
- Workflow：https://github.com/Peiiii/nextclaw/actions/runs/32133244179
- Release 名称：`NextClaw Desktop 0.0.255`。
- 更新渠道：`gh-pages/desktop-updates/stable` 已发布并完成公网 manifest 验证。
- Linux APT：`gh-pages/apt` 已发布 `0.0.255`，fresh install 与 upgrade smoke 均通过。
- 官网动态下载主链继续读取 GitHub Releases API；静态 fallback 同步为 `v0.39.0-desktop.1 / 0.0.255`。
- 不包含：NPM publish、NPM dist-tag 修改、beta channel、X 或其它社交发布。

## 用户/产品视角的验收步骤

1. 打开官网桌面下载页，确认版本显示为 `0.0.255`，Release 为 `v0.39.0-desktop.1`。
2. 在目标平台下载并安装，确认内置 runtime 为 `0.39.0`。
3. 在原问题会话使用相同 provider/model 连续发送至少 10 轮；每轮回复后等待 1–2 分钟，确认回复不消失且无需重启即可发送下一条。
4. 模拟一次断网、休眠或窗口重新加载，确认会话自动恢复并结束运行状态。
5. 如仍复现，保留 session ID、provider/model 与时间点，检查 `message.completed`、`run.finished` 和 SSE reconnect 事件，以补齐尚未完全定位的根因。

## 可维护性总结汇总

- 本次没有修改产品实现；桌面产物只消费已经发布并验证的 `nextclaw@0.39.0`，没有把工作区未发布 package 源码静默混入 installer。
- 官网 fallback 只替换既有 tag/version 常量，没有新增下载路径或第二套 release owner。
- 发布始终复用仓库唯一的 `release:desktop:stable` 自动化入口；网络恢复阶段复用同一 tag/run，没有产生重复 identity。
- 新增迭代目录与 GitHub 双语发布正文已在编辑前通过 planned-path governance preflight。
- 自动维护性检查结果和匹配范围验证记录见本节上方；未发现新增抽象、文件职责或目录扩张问题。

## NPM 包发布记录

不涉及 NPM 包发布。本次 Desktop stable 消费已经公开发布并验证的 `nextclaw@0.39.0`；没有执行 NPM publish，也没有修改 `latest` 或 `beta` dist-tag。当前未发布的 `@nextclaw/app-runtime` changeset 属于后续批次，没有进入本次 seed runtime。
