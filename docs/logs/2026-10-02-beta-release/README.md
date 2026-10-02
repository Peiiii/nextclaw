# NextClaw 0.59.0-beta.2 发布

## 迭代完成说明

用户授权“发布 beta 版本”。从冻结主干 `fd7d4b69cb3b6b9440214794bbc27b499da8bb42` 建立独立 worktree，使用 `pnpm release:beta` 发布完整公开包批次。核心变化为[会话置顶持久化](../2026-10-02-session-pin-persistence/README.md)与[定时任务会话视图](../2026-10-02-scheduled-session-view/README.md)。状态：NPM、Runtime 和 GitHub 版本说明完成，国内文档镜像继续自动部署。

发布提交为 `31bb3a4ab9c92ba8f1535ea80d3dc8622ac7bb2a`，22 个 package tag 指向该不可变身份。发布期间主干新增的 Bibo 提交通过普通 merge 保留，未加入本次冻结产物；主干集成提交为 `0f0551bd197488ff28c8c95dacae78c53ff75616`。NPM 与 Runtime 已完成；GitHub 更新说明已发布，文档站镜像部署仍由既有工作流继续。

## 测试/验证/验收方式

- 独立依赖安装、发布健康检查、发布依赖闭包的 build/tsc、打包审核通过；公开 registry 核验 22/22。未重复运行功能阶段已经完成的定向回归。
- `validation:npm-update -- --published-beta` 使用独立缓存从公开 registry 全局安装，通过包版本、产物与运行时 API 核验，实际版本为 `0.59.0-beta.2`。
- 另在隔离数据 home 启动精确 registry 包的已安装 app entry；`/api/app/meta` 返回版本 `0.59.0-beta.2`，前端 HTTP 200，产物入口为 `assets/main-DJQ2BE5Y.js`。这是安装验证夹具，用户预览继续读取现有本地实例数据和模型配置。夹具服务验证后停止。
- 中英文文档镜像检查、VitePress 构建与 diff governance 通过。发布验证窗口调整后，原 owning entry 再次核验 22/22。
- 本地 master 七项已有 WIP 与上游路径无交集后安全快进；最终检查原文件 hash 和分支闭合。

## 发布/部署方式

统一入口首先完成 build/version/publish。NPM 接受上传后，部分包短暂不可见；最后 `@nextclaw/ui@0.27.5-beta.2` 返回 E409 `previously staged version`，暂存列表为空，没有可供维护者手工审批的 stage。沿同一 checkpoint `dff32d6c4ebd4d83` 等待后，22 包均公开，没有生成新版本或替换发布身份。

发布等待窗口由原 owner `verify-release-published.mjs` 的 12×5 秒扩大为 120×10 秒，覆盖本批约十余分钟的暂存等待，保留严格核验和失败终态。恢复过程中从已有 checkpoint 使用 60×10 秒窗口等待剩余阶段并成功；默认窗口覆盖从首次上传开始的完整等待。依据是本次已接受上传但晚于原预算公开的真实链路，以及 NPM 的[发布时扫描说明](https://github.blog/changelog/2026-09-03-multiple-trusted-publishing-configurations-for-npm/)。具体内部扫描状态不可见，不将 E409 推断为人工审批要求。

NPM_READY 时间为 2026-10-02 15:42:26 UTC；从统一入口开始 15:11:02 UTC 计算约 31 分 24 秒。主要等待为 registry 可见性和约 10 分 57 秒的空缓存真实安装。恢复仅执行原 owner 的未完成阶段：registry 核验、精确 release commit/tag、安装验证，再调用 `release:beta:runtime`；不重新 changeset version。

Runtime 的[首次工作流](https://github.com/Peiiii/nextclaw/actions/runs/37029229889)完成 macOS arm64/x64、Linux x64、Windows x64 构建、真实 HTTP/组件生命周期验证、四个 release assets 与 gh-pages 状态发布。最后 Pages 部署因 release branch 不在 `github-pages` environment 允许范围而失败。沿同一版本执行既有 Pages owner 的 master 分支入口，[恢复工作流](https://github.com/Peiiii/nextclaw/actions/runs/37031209125)成功；没有重建矩阵、移动 tag 或更改环境保护规则。

修正 full-beta 与 Runtime-only 默认发布控制分支为 `master`，由 Runtime owner 的公共常量统一定义，产物仍绑定不可变 release SHA。原有 CLI 发布分支继续只承担 release commit/tag；增加从独立 release branch 执行两个真实 CLI dry-run 的回归。14 个编排回归、Node 语法检查及 diff governance 通过；本批仅修改 MJS 发布控制，无新增 TypeScript 产品改动。

`release:beta:runtime -- --version 0.59.0-beta.2 --verify-only` 验证四平台 assets 和公网 manifest 成功，状态 `public (built)`；`hostKind=npm-runtime-bundle`，兼容 floor 保持 `0.18.11`。beta 验证同步核对 `releaseNotesUrl` 指向本版 GitHub Release。该 Release 已发布双语 Markdown，正文无 frontmatter，分别链接完整文档；四个平台资产齐全，保持 prerelease。

本批两类发布异常介入为 registry 暂存等待与 Pages 分支保护，分别修回原核验 owner 和 Runtime 入口。文档由 master push 触发的[部署工作流](https://github.com/Peiiii/nextclaw/actions/runs/37029876673)继续交付：build 与 deploy-global 已成功，deploy-domestic 仍在运行。本机文档站 HTTP 校验遭遇 403/连接重置，未宣称公开文档 URL/CORS 已验证。Beta 的更新说明入口使用已验证的[GitHub Release](https://github.com/Peiiii/nextclaw/releases/tag/nextclaw%400.59.0-beta.2)。本批不包含 Desktop 安装包发布。

截至 2026-10-02 16:24 UTC，从统一入口执行开始约 73 分钟；包含发布核验、真实安装、冷构建、主干集成与发布恢复，不作为仅上传耗时。NPM_READY 约 31 分钟，两类异常已恢复并修回原 owner。最终记录提交和分支回流继续按普通 push/reconcile 完成。

## 用户/产品视角的验收步骤

1. `npm install -g nextclaw@beta` 安装 beta；配置和会话沿用原实例。
2. 置顶一条较旧会话，刷新及重启后确认仍优先显示；取消置顶后恢复普通列表。
3. 在桌面或手机会话列表切换“定时任务”，查看任务创建的专属会话及历史结果；搜索和刷新后视图保持正确。
4. 从 beta Runtime 更新入口或[中英文更新说明](https://docs.nextclaw.io/zh/notes/2026-10-02-nextclaw-v0-59-0-beta-2)阅读本版变化。

## 可维护性总结汇总

保留唯一 package/version/checkpoint 与既有发布入口。机制修正扩大已有有界核验窗口并区分 publication branch 与受保护 workflow ref，无新增发布器、状态 owner、版本特判或治理脚本。Node 语法检查、14 个编排回归、diff-only maintainability 与 diff governance 通过。自动维护性 0 errors / 1 warning，来自既有 full-beta 脚本接近 500 行预算；针对告警复核后保留当前 owner，新增策略常量由 Runtime owner 统一导出，删除不再消费的分支参数/读取，没有为行数拆出包装层或扩展其它发布职责。新文档路径 planned-path preflight 通过。

暂存等待的恢复事实归本批记录，通用预算修正归原发布脚本，不增加常驻规则或 Skill。收尾只提交本批产物和记录，保护其它任务 WIP。

## NPM 包发布记录

公开 registry 已核验以下 22 个版本。所有包按完整公开 workspace 批次跟随 Changesets；private package 版本记录随批次提交，不表示托管产品已部署。

| 包 | 版本 | 状态 |
| --- | --- | --- |
| @nextclaw/core | 0.18.6-beta.1 | 已公开 |
| @nextclaw/channel-extension-dingtalk | 0.2.55-beta.1 | 已公开 |
| @nextclaw/channel-extension-discord | 0.2.55-beta.1 | 已公开 |
| @nextclaw/channel-extension-email | 0.2.55-beta.1 | 已公开 |
| @nextclaw/channel-extension-slack | 0.2.55-beta.1 | 已公开 |
| @nextclaw/channel-extension-telegram | 0.2.55-beta.1 | 已公开 |
| @nextclaw/channel-extension-wecom | 0.2.55-beta.1 | 已公开 |
| @nextclaw/channel-extension-whatsapp | 0.2.55-beta.1 | 已公开 |
| @nextclaw/mcp | 0.3.56-beta.1 | 已公开 |
| @nextclaw/ncp-mcp | 0.2.56-beta.1 | 已公开 |
| @nextclaw/nextclaw-ncp-runtime-stdio-client | 0.3.56-beta.1 | 已公开 |
| @nextclaw/nextclaw-narp-runtime-opencode | 0.2.56-beta.1 | 已公开 |
| @nextclaw/runtime | 0.4.55-beta.1 | 已公开 |
| @nextclaw/kernel | 0.19.2-beta.2 | 已公开 |
| @nextclaw/harness | 0.2.28-beta.2 | 已公开 |
| @nextclaw/server | 0.23.14-beta.2 | 已公开 |
| @nextclaw/client-sdk | 0.12.14-beta.2 | 已公开 |
| @nextclaw/companion | 0.2.71-beta.2 | 已公开 |
| @nextclaw/remote | 0.3.71-beta.2 | 已公开 |
| @nextclaw/service | 0.7.8-beta.2 | 已公开 |
| @nextclaw/ui | 0.27.5-beta.2 | 已公开 |
| nextclaw | 0.59.0-beta.2 | 已公开 |
