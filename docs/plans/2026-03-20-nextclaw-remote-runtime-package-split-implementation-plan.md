# NextClaw Remote Runtime Package Split Implementation Plan

日期：2026-03-20

## 目标

把当前 `nextclaw` 主包中的 remote runtime 拆到独立包 `@nextclaw/remote`，并完成验证、发布、安装态冒烟与 git 提交。

## 阶段 1：建立新包骨架

- 新增 `packages/nextclaw-remote`
- 补齐：
  - `package.json`
  - `tsconfig.json`
  - `eslint.config.mjs`
  - `README.md`
  - `src/index.ts`
- 将新包接入 root `build/lint/tsc` 脚本
- 将 `nextclaw` 对新包依赖改为 `workspace:*`

验收：

- `pnpm install` 后 workspace 正常解析
- `pnpm -C packages/nextclaw-remote tsc/lint/build` 通过

## 阶段 2：迁移 remote runtime

- 迁移以下模块到新包：
  - command register facade
  - runtime actions
  - platform client
  - connector
  - relay bridge
  - service module
  - remote status store
- 将原先对 `nextclaw` 内部能力的直接 import 改成依赖注入

验收：

- 新包内不再 import `packages/nextclaw/src/cli/*`
- `rg` 检查主包旧 `remote/` 路径无残留引用

## 阶段 3：宿主适配收口

- 在 `nextclaw` 主包新增单一 bridge：
  - `remote-runtime-support.ts`
- 将以下接线点切到新包：
  - CLI 入口
  - runtime 初始化
  - remote commands
  - diagnostics
  - service remote runtime

验收：

- `pnpm -C packages/nextclaw tsc/lint/build` 通过
- 主包旧 `src/cli/remote/*` 删除

## 阶段 4：发布闭环

- 新增 changeset
- 执行版本生成
- 发布 npm
- 进行安装态冒烟
- 创建迭代 README
- 提交 git commit

验收：

- npm 上可拉取新版本
- `npx nextclaw@<new-version> remote --help` 正常
- `npx nextclaw@<new-version> remote status --help` 正常
