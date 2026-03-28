# v0.14.257-shell-first-capability-hydration

## 迭代完成说明

- 将 dev/service 启动链改为两阶段：
  - shell/kernal 先起
  - plugin/channel capability 在后台 hydration
- `loadPluginRegistry()` 不再是 UI shell 与 `/api/auth/status` 的前置条件。
- 新增 `/api/runtime/bootstrap-status`，显式暴露 `shell-ready`、`hydrating-capabilities`、`ready`、`error` 等阶段状态。
- 新增 progressive plugin loader，并在插件之间显式让出事件循环，避免把整段插件装配压成一次性大阻塞。
- 启动期 plugin runtime bridge 改为通过 getter 读取最新 `pluginChannelBindings`，避免 hydration 后继续持有旧快照。
- 相关设计文档见：[Shell-First Capability Hydration Design](../../designs/2026-03-27-shell-first-capability-hydration-design.md)

## 测试/验证/验收方式

- 类型检查：
  - `pnpm -C packages/nextclaw-openclaw-compat tsc -p tsconfig.json`
  - `pnpm -C packages/nextclaw tsc -p tsconfig.json`
  - `pnpm -C packages/nextclaw-server tsc -p tsconfig.json`
- 单测：
  - `pnpm -C packages/nextclaw exec vitest run src/cli/commands/service-bootstrap-status.test.ts src/cli/commands/service-plugin-runtime-bridge.test.ts`
  - `pnpm -C packages/nextclaw-server exec vitest run src/ui/router.auth.test.ts`
- 启动冒烟：
  - 使用临时 `NEXTCLAW_HOME` + 4 个人为减速插件启动 `tsx src/cli/index.ts serve --ui-port <port>`
  - 在插件 hydration 仍进行中时验证：
    - `/api/auth/status` 已返回 `200`
    - `/api/runtime/bootstrap-status` 先返回 `shell-ready/pending`，稍后返回 `hydrating-capabilities/running`
- 可维护性守卫：
  - `node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`
  - 结果：`Errors: 0`

## 发布/部署方式

- 本次改动涉及 `@nextclaw/openclaw-compat`、`@nextclaw/server`、`nextclaw` 启动链路。
- 正式发布时按仓库既有 npm/release 流程执行：
  - 生成版本变更
  - 发布受影响包
  - 若消费方依赖源码或打包产物，重新构建并完成一次真实启动冒烟
- 本次任务内未执行正式发布或远程部署。

## 用户/产品视角的验收步骤

1. 执行 `pnpm dev start`。
2. 在前端刚启动后的前几秒，直接请求 `http://127.0.0.1:5174/api/auth/status`。
3. 预期该接口不再需要等插件日志全部打印完才返回。
4. 同时请求 `http://127.0.0.1:5174/api/runtime/bootstrap-status`。
5. 预期先看到 `phase = shell-ready`、`pluginHydration.state = pending`，随后切到 `phase = hydrating-capabilities`。
6. 等后台 hydration 与 channel 启动完成后，预期 `phase = ready`，并且原有 channel/plugin 能正常工作。
