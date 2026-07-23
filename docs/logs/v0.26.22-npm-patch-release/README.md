# NextClaw 0.27.4 NPM Patch 发布

## 迭代完成说明

本次发布目标为 `nextclaw@0.27.4`，采用 full public workspace patch batch，共 49 个公开包。发布批次交付三项已提交能力：流式消息期间可在离底超过 10px 后逃逸贴底、移动端 Apps 入口跳转修正，以及定向文件预览保持完整内容。

贴底问题的直接原因不是 10px 阈值失效，而是动态高度虚拟列表在流式行仍与视口相交时把它误判为“视口上方行”，随后用高度补偿直接写回滚动位置，绕过了 sticky hook 的逃逸状态。修复后，只有整行已经完全离开视口上沿时才参与锚定补偿；正在阅读的流式行不会重新夺回滚动位置。

本次不配图：贴底逃逸是跨时间的滚动行为，静态截图不能证明结果。X 帖不适用：这是稳定性 patch，不扩大为社交媒体发布。

## 测试/验证/验收方式

发布准备阶段已完成：

- NPM 身份：`peiiii`。
- 定向 hook 回归：7 项测试通过，覆盖离底 `11px` 与 `20px` 后流式行增长 `100px` 仍不被虚拟列表拉回。
- 真实浏览器验收：在用户指定会话的当前源码页面中，离底 `20px` 后内容继续增长 `291px`，滚动距离仍保持 `20px`；回到底部后再次向上滚动 `11px`，持续流式更新后仍保持 `11px`。
- `pnpm -C packages/nextclaw-ui tsc`、UI lint、定向 ESLint：通过。
- `NEXTCLAW_RELEASE_CHECK_RESET=1 pnpm release:check:strict`：从空 checkpoint 完成 49 个公开包的 build、TypeScript 与 lint，0 个阻断错误；输出中的 lint 项均为既有 warning。
- `pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet` 与 scoped maintainability guard：通过。
- `pnpm -C apps/docs build` 与结构化发布说明 JSON 解析：通过。
- `packages/nextclaw/resources/update-bundle-public.pem` 已存在且非空；`nextclaw@0.27.4` 发布 tarball 的 prepack 合同检查通过，并包含该公钥与本次构建的 UI 制品。
- NPM registry 已确认 49/49 包版本可见，`nextclaw@latest` 为 `0.27.4`；49 个 annotated tag 已推送。
- stable runtime workflow [30016749618](https://github.com/Peiiii/nextclaw/actions/runs/30016749618) 四个平台全部成功，GitHub Release 与公开 manifest 验证通过。
- 公网安装与升级：全新安装的 CLI 报告 `0.27.4`；隔离安装的 `0.27.3` 检查到 `0.27.4`，完成签名 bundle 下载与应用后报告 `currentVersion: 0.27.4`。
- Docs Deploy [30016482460](https://github.com/Peiiii/nextclaw/actions/runs/30016482460) 成功，中英文发布说明与结构化 JSON 均返回 HTTP 200。
- 自动触发的 Windows NPM 冒烟首次遇到 registry 传播竞态；49/49 可见后重跑已成功安装 CLI，但 workflow 仍调用已移除的 `nextclaw update --timeout` 参数而失败。这是既有 workflow 合同漂移，不是 `0.27.4` 安装或 stable manifest 失败。

## 发布/部署方式

- NPM：使用仓库标准 `pnpm release:publish` 发布 49 个公开包，不使用 raw `npm publish`。
- Runtime update：已发布 `0.27.4` stable runtime channel；[GitHub Release](https://github.com/Peiiii/nextclaw/releases/tag/nextclaw%400.27.4) 与四平台公开 manifest 已验证。
- Docs：已发布[中文更新说明](https://docs.nextclaw.io/zh/notes/2026-07-23-nextclaw-v0-27-4)、[英文更新说明](https://docs.nextclaw.io/en/notes/2026-07-23-nextclaw-v0-27-4)和结构化 JSON，公开请求均为 HTTP 200。
- Desktop installer / manifest：不适用，本次不发布新的桌面安装包。
- 数据库 migration / 独立后端部署：不适用，本次没有数据库或独立后端变更。
- 当前用户运行中的 NextClaw 服务：不主动重启，避免中断正在进行的会话。

## 用户/产品视角的验收步骤

1. 打开一段正在流式输出的长回复，先保持在底部，确认消息继续自动贴底。
2. 向上滚动到离底超过 `10px`，确认“回到底部”按钮出现。
3. 让回复继续增长，确认阅读位置不会被重新拉回底部。
4. 点击“回到底部”，确认重新进入贴底状态。
5. 在移动端底部导航点击 Apps，确认进入 Apps 页面；打开定向文件预览，确认内容不被截断。

## 可维护性总结汇总

贴底修复的 scoped maintainability 结果为总计 `+50 / -42 / net +8`，其中非测试生产代码 `+1 / -1 / net 0`，满足非功能改动净增门槛。正向减债是把虚拟列表的补偿条件从“行起点在滚动偏移之上”收紧为“行终点已经完全在滚动偏移之上”，继续复用唯一的 virtualizer owner，没有新增平行状态、effect、helper 或兼容分支。

本次发布操作只新增必要的版本号、changelog、产品更新说明、结构化 JSON、构建后的 UI 制品和发布记录，不新增额外产品语义源码。

## NPM 包发布记录

- 发布批次：49 个公开包 full public workspace patch。
- 主包：`nextclaw@0.27.4`。
- 关键包：`@nextclaw/ui@0.15.17`、`@nextclaw/server@0.15.17`。
- 当前状态：registry publish、`latest`、49 个 tag、stable runtime、GitHub Release、公开 manifest、Docs Deploy、全新安装和 `0.27.3 -> 0.27.4` 隔离升级验证全部闭合。
- `@nextclaw/desktop` 是 private workspace package，只同步内部版本元数据，不进入 NPM publish。
- Desktop installer / manifest 未发布；自动 `desktop-validate` 的 Linux runtime 初始化与 Windows 临时路径短名断言失败不属于本次 NPM patch 发布面。
