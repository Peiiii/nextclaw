# NextClaw 0.34.0 NPM Stable 发布记录

## 迭代完成说明

本次从 committed `4731c96f557495c4725dd3e8117a441a45316cae` 创建隔离 release worktree，发布 NextClaw NPM stable / `latest`。主工作区未提交的 session token、child session、UI 和 `ui-dist` WIP 未进入发布。

确定性发布命令总耗时 378.63 秒，完成了版本化、严格验证、NPM publish、22/22 精确 registry 验证、release commit/tags、精确公网冷安装和分支闭环。`nextclaw@latest` 已指向 `0.34.0`。

本次发布暴露并完成定位一个 release plan 计数缺陷：

- 现象：dry-run 显示 24 个版本变化、6 个 NPM 上传包、36 个验证包和 30 个支持包；真实发布为 22 个 NPM 上传包、39 个验证包和 17 个支持包。
- 直接触发：4 个 Changeset 直接声明 6 个 package，但 Changesets 在 `updateInternalDependencies: patch` 合同下把内部依赖变化传播到另外 16 个 public package。
- 生成路径：Changesets 的 canonical `status.releases` 在 version 前已经计算出 24 个版本变化，其中 22 个 public；`summarizeExplicitReleaseScope()` 没有消费该集合，只统计“Changeset 直接包 + 当前版本缺 Git tag 包”，并把 6 错误标为 `npmPublishPackageCount`。
- 防线缺口：`resolvePendingStableExecutionContext()` 同时读取了 Changesets plan 和独立 explicit scope，却没有让版本计划成为 package/validation scope 的单一 owner；现有测试只给 formatter 硬编码 `6 / 36 / 30`，没有覆盖 `updateInternalDependencies` 传播后 dry-run 与 post-version checkpoint 一致性。
- 确认方式：在同一发布 commit 的临时 worktree 重放 `changeset status`，得到 4 个 Changeset、6 个直接 package、24 个 computed release、22 个 public computed release 和 16 个传播 release；正式 checkpoint 与 registry 均为 22 个 package。

根因已经完整定位，但没有在不可逆发布进行中修改 release 源码。后续修复应由 Changesets `status.releases` 统一产生版本变化集合、预期 registry 上传集合和 validation closure，并增加“dry-run 预测 == post-version checkpoint”合同测试；不能只把显示数字从 6 改成 22。

## 测试/验证/验收方式

- `pnpm release:npm:stable -- --branch codex/release-npm-stable-20260814 --dry-run`
  - worktree clean：通过
  - 目标版本：`nextclaw 0.33.2 -> 0.34.0`
- `pnpm release:npm:stable -- --branch codex/release-npm-stable-20260814`
  - strict validation：83/83 步骤通过
  - build：39 个，累计 CPU 179.19 秒
  - tsc：22 个，累计 CPU 131.01 秒
  - lint：22 个，累计 CPU 99.12 秒
  - strict validation wall time：129.39 秒
  - 总 wall time：378.63 秒
- Registry：22/22 精确 `pkg@version` 可见。
- Manifest：22 个已发布 package 均未泄漏 `workspace:*` dependency。
- Dist-tag：`nextclaw@latest = 0.34.0`。
- Published install：从公开 registry 精确安装 `nextclaw@0.34.0` 成功；`nextclaw --version`、app entry、launcher entry、update public key 和 embedded UI 全部通过。
- Branch closure：`pnpm release:check:branch-closure -- --target master --release codex/release-npm-stable-20260814` 通过；发布内容先闭合到本地 `master` 与 `origin/master` 的共同提交 `8fb8f957f35354518a86098b144d1ee6a422a6ab`，本记录提交后再同步前移两者。

## 发布/部署方式

- 发布对象：NPM stable / `latest`。
- Release commit：`0c67725f113ed44f70d12868b4cd5c35d3c9e450`。
- 发布内容 branch closure commit：`8fb8f957f35354518a86098b144d1ee6a422a6ab`；发布记录提交属于同一发布闭环，不改变已发布 package。
- 执行分支：`codex/release-npm-stable-20260814`。
- 目标分支：本地 `master` 和 `origin/master`。
- 主工作区 WIP：原样保护在 `codex/wip-session-workspace-20260814`，切换前后 status 一致。
- 不包含：stable runtime channel、desktop、docs site、website 和 X 发布。

## 用户/产品视角的验收步骤

1. 运行 `npm view nextclaw@latest version`，应返回 `0.34.0`。
2. 在临时 prefix 安装 `npm install -g nextclaw@0.34.0 --prefix <temp>`。
3. 运行 `<temp>/bin/nextclaw --version`，应返回 `0.34.0`。
4. 确认安装包包含 app entry、launcher entry、`resources/update-bundle-public.pem` 和 embedded UI。
5. 本次只验收 NPM 安装入口；runtime update channel 和 desktop 不属于本次完成范围。

## 可维护性总结汇总

- 本次发布没有修改产品或 release 实现源码，因此未新增 service、manager、兼容分支或目录扩张。
- 隔离 worktree、精确 package checkpoint、registry verify、published install 和 branch-closure owner 均按既有合同执行。
- 发现 release dry-run 将“直接 Changeset seed”误当“实际上传集合”，owner 边界不清；根因和正确修复 owner 已记录，尚未实施代码修复。
- 本次不适用 post-edit maintainability guard：发布过程只生成版本、changelog、tag、构建产物和本记录，没有源码实现改动。
- 新增迭代目录与 `README.md` 符合当前 iteration log 约定，并在编辑前完成 planned-path preflight。

## NPM 包发布记录

以下 22 个 package 已发布并通过精确 registry 验证：

- `@nextclaw/app-runtime@0.10.0`
- `@nextclaw/channel-extension-dingtalk@0.2.25`
- `@nextclaw/channel-extension-discord@0.2.25`
- `@nextclaw/channel-extension-email@0.2.25`
- `@nextclaw/channel-extension-slack@0.2.25`
- `@nextclaw/channel-extension-telegram@0.2.25`
- `@nextclaw/channel-extension-wecom@0.2.25`
- `@nextclaw/channel-extension-whatsapp@0.2.25`
- `@nextclaw/client-sdk@0.5.28`
- `@nextclaw/companion@0.2.28`
- `@nextclaw/core@0.16.0`
- `@nextclaw/kernel@0.6.28`
- `@nextclaw/mcp@0.3.26`
- `@nextclaw/ncp-mcp@0.2.26`
- `@nextclaw/nextclaw-narp-runtime-opencode@0.2.26`
- `@nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.26`
- `@nextclaw/remote@0.3.28`
- `@nextclaw/runtime@0.4.25`
- `@nextclaw/server@0.15.28`
- `@nextclaw/service@0.3.30`
- `@nextclaw/ui@0.15.29`
- `nextclaw@0.34.0`

发布状态：全部已发布；`nextclaw@latest` 为 `0.34.0`；无待统一发布 package；无残余 registry blocker。
