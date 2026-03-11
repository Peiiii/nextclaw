# v0.13.49 readme dev server start

## 迭代完成说明

- 在根目录 [README.md](C:\Users\com01\Desktop\VIVYCORE\nextclaw\README.md) 的 Quick Start 区域新增 “Run The Development Server” 小节。
- 补充仓库开发态启动方式：`pnpm install`、`pnpm dev`，以及按需单独启动的 `pnpm dev:backend`、`pnpm dev:frontend`。
- 明确开发启动应在仓库根目录执行，并说明终端会输出本地访问地址。

## 测试/验证/验收方式

- 文档改动，不触达构建、类型检查、运行时代码路径，`build` / `lint` / `tsc` 不适用。
- 结构校验：
  - 确认根 `README.md` 已出现开发服务器启动小节与对应命令。
  - 确认本次迭代目录命名符合 `v<semver>-<slug>`，且版本号递增为 `v0.13.49`。

## 发布/部署方式

- 本次为文档更新，无需单独部署服务。
- 如需对外同步，可随仓库后续常规发布流程一并发布。

## 用户/产品视角的验收步骤

1. 打开仓库根目录 `README.md`。
2. 在 Quick Start 区域查看新增的 “Run The Development Server” 小节。
3. 按文档在仓库根目录执行 `pnpm install` 和 `pnpm dev`。
4. 如只想单独调试前后端，按文档执行 `pnpm dev:backend` 或 `pnpm dev:frontend`。
