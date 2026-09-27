# NextClaw Desktop 稳定版发布

## 迭代完成说明

状态：桌面发布已完成，`DESKTOP_READY`。用户授权发布桌面端稳定版；不重发 NPM。国内文档镜像为辅助发布面，恢复 run 仍在执行，未计为已通过。

控制面冻结于远程 master `3dfc2764d9be5ed378fd0b4aa834cbeb6fe06d91`；产品产物冻结于已发布 `nextclaw@0.57.3` 提交 `bdeef19c5a88917f89bb8ef6fde749fd8fdcadc5`，Desktop `0.0.299`。后续共享源码变化不混入安装包。

预检确认 NPM latest 为 0.57.3，但该版本缺少桌面发布要求的双语文档与结构化 JSON。本批补齐同版本说明，通过显式 notes-file / release-notes-url 传入独立桌面发布入口，保持产品提交不可变。

过程记录：

- 文档准备提交 `a4d7b08ba13c203332695d3d841d67c879f0298d` 已合入远程 master；国际站双语页面、JSON 均返回 200。Docs Deploy run `36325629350` 的国内镜像尚在同步。
- 本地 Electron 43.4.1 并行下载有分块长时间不增长；官方直连与资产 API 下载也中断或显著变慢。通过 npm 镜像取得同一包，SHA-256 与 Electron 官方 SHASUMS 完全一致：`fe3cac8cbfd9ba1739fac6c69166cf30848741f93cbe251d800ae6ef7cebb64b`。停止本任务卡住的下载后重写缓存，重新执行完整打包验证；不修改产品或取消验证。
- 本地 macOS DMG 验证已通过：614 个 runtime 文件、54 个插件文件、包内公钥和更新清单验签、Electron 内置 Node 执行 runtime init、隔离 profile 实际安装与 GUI/API 启动均成功；Runtime 0.57.3 被标为 healthy。
- 签名预检 run `36327058508` 成功。发布身份冻结为 `v0.57.3-desktop.1`，Desktop run `36327084823`，dispatch `b11c9ea6-fa3a-4e87-befc-8e286d91c6be`；完整资产校验前保持 Draft。
- 首轮 macOS Intel job 在取得 Electron headers 前因 `www.electronjs.org` DNS 解析失败退出（curl exit 6）；其他平台继续执行，待本轮终态后沿同一 run 重跑失败 job。
- 首轮其他四平台均成功；同一 run 仅重跑失败的 Intel job，第二次 headers 下载及全部构建/冒烟成功。恢复 closure 复用本轮已通过的本地打包验证和签名预检，不重复构建已成功的平台、不创建新 tag。
- 发布 workflow 于 `2026-09-27T15:21:46Z` 全部成功，总 wall time 2162 秒（36 分 2 秒，包含失败与恢复）。最终 31 个 Release assets：原精确集合 30 个，加 APT Pages 包资产 1 个；Release 为公开 stable（非 Draft、非 prerelease）。五个平台公网清单均为 Runtime 0.57.3、launcher floor 0.0.141，并指向本次版本说明。
- 国内 Docs Deploy 首轮 OSS 上传失败：1219 个文件中 597 个对象成功、637 个对象失败，详细错误只写入 Runner report，现有日志不足以确认根因。已沿同一 run/产物身份重跑失败的国内 job（attempt 2）；国际站与桌面安装/更新完成门不受该辅助镜像等待影响。
- 主工作区原有一份修改和四份未跟踪文档保持原状。主线协调返回 `LOCAL_WORKTREE_RETRYING`，自动 retry worker 保护活跃 WIP 并接管本地镜像快进。

`AUTOMATION_INTERVENTIONS: 3`：本地 Electron 下载缓存恢复、Intel Runner DNS 失败后重跑、国内文档 OSS 上传失败后重跑。前两项已闭合；国内镜像状态如上，不隐去辅助发布面的缺口。网络恢复复用既有 owner；不为这些环境事件新增治理脚本或常驻规则。

## 测试/验证/验收方式

planned-path preflight、docs:i18n:check（167 对页面）、docs build、lint:new-code:governance、governance backlog ratchet 和双语 GitHub 正文校验已通过。本地打包验证、远端五平台安装/启动冒烟、完整资产集合、签名清单、stable update channel、公网五平台清单、APT 安装/升级及 GitHub Pages 部署均通过；独立 closure 返回 `DESKTOP_READY`。没有宣称产品所有功能均已重测，也未用隔离 profile 冒烟代替真实用户 profile 验收。

已发布 Runtime 的四个平台 gh-pages/public 清单均为 0.57.3，保持原 GitHub release notes URL。当前补齐的桌面说明使用新双语文档 URL；核验历史 Runtime 投影时绑定其已发布 URL，不将当前 checkout 的后补内容倒推为原 manifest 的身份。

## 发布/部署方式

使用 `pnpm release:desktop:stable`，channel=stable，target 为上述已发布提交。文档通过现有 Docs Deploy workflow 发布；隐藏 Draft 仅在完整 assets 验证后公开。发布后运行 `pnpm release:reconcile:mainline`，保护主工作区既有 WIP。

- Release：https://github.com/Peiiii/nextclaw/releases/tag/v0.57.3-desktop.1
- Desktop workflow：https://github.com/Peiiii/nextclaw/actions/runs/36327084823
- 文档 workflow：https://github.com/Peiiii/nextclaw/actions/runs/36325629350
- 中文说明：https://docs.nextclaw.io/zh/notes/2026-09-27-nextclaw-v0-57-3
- 英文说明：https://docs.nextclaw.io/en/notes/2026-09-27-nextclaw-v0-57-3

官网 landing 与 X 宣发未触发：本次是既有稳定 Runtime 的窄桌面发布，未新增产品功能或独立宣传成果。

## 用户/产品视角的验收步骤

从上述 GitHub Release 下载对应平台安装包；启动后核对 Runtime 0.57.3，发送消息时确认输入区不再被接收确认卡片撑高。安装、启动与更新协议由自动冒烟证明；本批不新增产品实现。Release 正文已补齐 macOS 未公证包和 Windows SmartScreen 的首次打开指引。

## 可维护性总结汇总

复用既有发布、版本说明与主线协调 owner，只补文档和发布记录，不改变源码、目录边界或发布机制。文档沿用日期命名和 JSON schema；无新增产品行为，不添加 changeset。源码 maintainability 检查不适用；治理检查与 docs 验证均通过。

同步纠正下级 unsigned handoff reference 的旧清单：stable 不标为 prerelease，双语正文按中文在前、英文在后，与 Desktop owner 既有合同一致。未增加 owner、入口或触发条件；AGENTS、Skill 数、description 和 discovery 字符均无本任务增量，command/script/baseline 不适用。`check:skill-progressive-loading` PASS：16 个顶层 skills、27 个 Wiki skills、2895 discovery 字符、82259 SKILL.md bytes、1489 description 字符、11980 AGENTS.md bytes。规则变化只消除相邻旧合同冲突；网络事件留在本记录，不扩大为新流程。

## NPM 包发布记录

不涉及 NPM 包发布。消费已发布 `nextclaw@0.57.3` stable identity。
