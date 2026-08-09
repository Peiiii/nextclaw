# Stable NPM 一键发布自动化设计

## 问题与目标

当前 `release:auto` 已能完成 changeset 补全、版本化、构建、NPM publish、registry 反查和本地 tag，但 stable 发布仍需要操作者手工提交版本产物、推送 branch/tag、触发 stable runtime、验证公开 manifest，再从真实 registry 安装和升级。各段能力已经存在，缺少一个拥有完整生命周期的 stable owner。

本次新增根级 `pnpm release:stable`。目标是用户明确授权一次后，由同一命令自动执行完整 stable 闭环；任一步失败立即停止，不把“workflow 已 dispatch”或“npm publish 返回成功”冒充最终完成。

## Owner 与主链路

`scripts/release/release-stable.mjs` 是唯一编排 owner，只负责阶段顺序、前置门禁、release commit/tag 指向和结果汇总；参数解析、dry-run 计划与恢复命令格式化下沉到无副作用的 `release-stable.utils.mjs`，不复制底层发布实现：

1. 读取 Changesets release plan，冻结目标版本和发布 package 闭包。
2. 验证 stable 模式、干净工作树、当前分支/远端同步、NPM/GitHub 身份、结构化 release notes 和 packaged public key。链接 worktree 缺少项目级 `.npmrc` 时，自动引用主 worktree 的本机配置作为 `NPM_CONFIG_USERCONFIG`；只传路径，不复制、提交或输出凭据。
3. 复用 `release:auto:prepare -> release:version -> release:check:strict -> release:publish` 完成版本化和 registry 发布。
4. 创建 release commit，把本批 package tags 统一指向该 commit，再推送 branch 和 tags。
5. 复用 `release:stable:runtime` 等待 runtime workflow、GitHub Release、四平台 assets、gh-pages 和公开 manifest 全部通过。
6. 复用 `packages/nextclaw` 的 smoke，从真实 registry 安装精确 stable 版本，并从发布前 stable 完成 `check -> download-only -> apply -> 新进程版本`。
7. 汇总 package/version/dist-tag、commit、runtime URL、公开安装证据和明确跳过项。

严格发布检查维护两个不同集合：Changesets 决定的“发布包闭包”拥有 version、checkpoint、tag 和 registry 语义；这些包的完整 workspace 依赖闭包属于“构建前置集合”，只按拓扑顺序生成干净环境需要的 `dist`，不进入发布数量、checkpoint、tag 或 publish。禁止依赖主工作区残留构建产物让隔离验证偶然通过。

`release:beta`、`release:publish`、runtime workflow 和 Changesets 继续是原有 owner；stable 脚本不得 raw `npm publish`，不得另写 manifest 或直接上传 release assets。

## 不可逆边界与失败恢复

NPM publish 是首个不可逆点。因此 release plan、版本级别、release notes、auth、分支同步和严格检查都必须在它之前完成。dry-run 只读取 plan 和外部版本，不写 changeset、版本文件、tag 或远端状态。

标准入口从 packages 阶段开始。发布后的恢复不重复 publish，而使用显式 `--resume-from`：

- `git`：registry 已发布，只补 release commit、tag 和 push；
- `runtime`：branch/tag 已闭合，只补 stable runtime 和真实安装；
- `install`：runtime 已闭合，只重跑真实 registry 安装/升级。

恢复必须显式提供目标 `--version`；需要升级验证时同时提供 `--previous-version`，禁止猜测“最新一次 checkpoint”而误闭合别的批次。脚本失败信息必须输出精确恢复命令。

允许显式 `--skip-runtime-channel` 或 `--skip-published-install`，但它们是有记录的发布例外，不是默认路径；完成摘要必须显示 skipped，不能宣称完整 stable 闭环。

## 版本与发布说明

版本语义仍由发布任务依据完整未发布批次决定，并在运行 `release:stable` 前写入代表性 changeset；脚本验证 Changesets 计算结果，不用关键词机械决定 minor/patch。stable runtime 默认要求目标版本已有 `apps/docs/public/release-notes/nextclaw-v<version>.json`，在 publish 前阻断缺失说明，避免包已发布后才发现 channel 无法闭合。

纯 workspace package 批次如果不包含 `nextclaw`，自动跳过 runtime 与 launcher 安装验证，但仍完成 registry、release commit、tag 和 push。

## 验证标准

- 参数和 plan 单元测试覆盖默认、dry-run、skip、resume、缺失恢复版本和非法阶段。
- dry-run 在真实仓库输出 previous/target version、branch、package 数和完整阶段，不产生 git diff/tag/远端变化。
- 新建链接 worktree 不复制 `.npmrc` 时，stable 脚本仍能自动使用主 worktree 的项目级 npm config；显式 `NPM_CONFIG_USERCONFIG` 和当前 worktree 自有 `.npmrc` 优先，不被覆盖。
- 删除所有 workspace `dist` 的干净环境中，严格检查先构建未发布的 workspace 依赖闭包，再验证发布包；构建前置不得出现在 release checkpoint 和 package tags 中。
- stable published smoke 验证精确包版本、app/launcher/public key/UI 载荷；升级验证不设置自定义 manifest 或 public key。
- 现有 beta、`release:publish` 和 `release:stable:runtime` 命令保持原行为。
- 修改的脚本通过 Node 语法检查、定向测试、ESLint/治理检查和 maintainability guard。

## 非目标

- 设计本身不授权真实发布；实际发布、tag、推送和 runtime workflow 仍以用户当次明确授权为准。
- 不用确定性脚本替代 AI 编写高质量 release notes 或版本语义判断。
- 不自动绕过真实 VPS、签名密钥、NPM 权限或其它批次特有的发布验收门槛。
- 不覆盖 desktop、docs、landing 或后端部署；它们继续由各自发布合同拥有。
