# v0.14.245-progressive-plugin-loader-release-unblock

## 迭代完成说明

- 补齐 `@nextclaw/openclaw-compat` 已被主链路依赖但尚未进入正式提交的 progressive plugin loader 源文件。
- 修复隔离 release worktree 在 `tsc/build` 阶段因缺少 `src/plugins/loader/*` 模块而中断的问题。
- 本次改动只覆盖发布阻塞所需的最小源码集合，不卷入主工作区其它未发布改动。

## 测试/验证/验收方式

- 在隔离 release worktree 中执行 `pnpm -C packages/nextclaw-openclaw-compat tsc`。
- 在隔离 release worktree 中执行 `pnpm -C packages/nextclaw tsc`。
- 在隔离 release worktree 中执行正式 `pnpm release:publish`，并用 registry 查询验证版本已发布。

## 发布/部署方式

- 先将本次最小提交 cherry-pick 到隔离 release worktree。
- 在隔离 worktree 中继续既有 `release:version` 结果，执行 `pnpm release:publish`。
- 使用项目根 `.npmrc` 作为认证源完成 npm 发布。

## 用户/产品视角的验收步骤

- 运行正式发布后的 `nextclaw` 包，确认安装流程不再因 `workspace:*` 或缺失模块失败。
- 启动 shell-first / service gateway 流程，确认 progressive plugin loading 链路能够正常进入。
- 打开 UI 并访问会话/状态相关接口，确认服务可正常工作。
