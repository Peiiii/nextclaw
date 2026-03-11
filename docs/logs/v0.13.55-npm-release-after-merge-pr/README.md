# v0.13.55-npm-release-after-merge-pr

## 迭代完成说明（改了什么）
- 发现已合并 PR 后仓库缺少待发布 changeset，补充联动 changeset 并执行版本发布闭环。
- 按依赖链完成 19 个 npm 包发布（`@nextclaw/*` + `nextclaw`），将本地版本推送至 npm 并创建对应 git tag。
- 本次发布后的关键版本：`nextclaw@0.9.22`、`@nextclaw/core@0.7.5`、`@nextclaw/server@0.6.9`、`@nextclaw/ui@0.6.12`。
- 文档影响评估：发布流程与功能文档已覆盖本次变更，无额外文档改写项（发布流程参考 [NPM 发布流程](../../workflows/npm-release-process.md)）。

## 测试/验证/验收方式
- 发布前版本生成：`pnpm release:version`（含 README 同步校验）。
- 发布前完整校验：`pnpm release:publish` 内置执行 `pnpm build`、`pnpm lint`、`pnpm tsc`，均通过（lint 仅历史 warning，无阻塞错误）。
- 发布后线上核验：逐个执行 `npm view <pkg> version`，确认 19 个目标包均返回新版本。
- 冒烟测试（非仓库目录）：
  - 命令：`npm i nextclaw@0.9.22`、`npx nextclaw --version`、`npx nextclaw --help`（在 `/tmp` 临时目录执行并清理）。
  - 结果：CLI 正常输出 `0.9.22` 与命令帮助。

## 发布/部署方式
- 按 [NPM 发布流程](../../workflows/npm-release-process.md) 执行：
  - `pnpm release:version`
  - `pnpm release:publish`
- 发布产物：npm 包已上架，git tags 已自动创建。

## 用户/产品视角的验收步骤
1. 在任意新目录执行 `npm i nextclaw@0.9.22`。
2. 执行 `npx nextclaw --version`，期望输出 `0.9.22`。
3. 执行 `npx nextclaw --help`，期望看到完整命令列表（如 `start`、`serve`、`agent`）。
4. 如需验证扩展链路，可安装对应 `@nextclaw/*` 新版本并执行现有集成流程。
