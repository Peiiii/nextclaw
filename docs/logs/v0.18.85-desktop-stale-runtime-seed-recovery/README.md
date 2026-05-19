# v0.18.85 Desktop Stale Runtime Seed Recovery

## 迭代完成说明

本次修复 Windows preview 安装后可能启动失败的问题：用户机器上可能已经存在同版本 `current.json` / `state.json` / `versions/<version>`，而旧逻辑会优先解析这个结构上可用但内容过期的 current bundle，导致 Electron 启动旧 runtime 后在 health check 阶段超时，表现为 `Unable to start local NextClaw runtime` 和 `Runtime health check timeout: TypeError fetch failed`。

确认方式：复盘 `v0.19.10-desktop-beta.2` 的 Windows smoke 只覆盖干净临时目录，未覆盖真实用户目录中残留同版本坏 bundle 的状态。代码修复改为在非环境覆盖路径下先执行 packaged seed bootstrap，再解析 runtime command；同时 packaged seed fingerprint 变化时会替换同版本现有 bundle。

本次不是只缩短等待或显示启动壳，而是修复启动选择顺序和同版本 seed 替换合同。

## 测试/验证/验收方式

- `pnpm -C apps/desktop tsc`
- `pnpm -C apps/desktop lint`
- `pnpm -C apps/desktop build:main && node --test apps/desktop/dist/src/services/desktop-runtime-command.service.test.js apps/desktop/dist/src/services/desktop-bundle-bootstrap.service.test.js`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`
- `pnpm lint:new-code:governance -- --files ...`
- `pnpm check:governance-backlog-ratchet`

Windows release/validate smoke 也新增 `-SeedStaleSameVersionBundle`，启动前写入同版本旧 current bundle，要求真实 GUI/API 冒烟仍在 20 秒门槛内通过。

## 发布/部署方式

计划发布新的 desktop preview：桌面壳版本提升到 `0.0.168`，runtime/update bundle 版本提升到 `0.19.12`。发布必须使用包含本修复的 Windows release workflow，并确认 `desktop-release` 的 Windows exe 与 installer smoke 都启用了 stale same-version seed 场景。

## 用户/产品视角的验收步骤

1. 安装新的 Windows preview。
2. 在存在旧 `@nextclaw/desktop` 用户数据目录的机器上直接启动。
3. 20 秒内进入真实 NextClaw 窗口，而不是停在 `Starting NextClaw` 或弹出 `Unable to start local NextClaw runtime`。
4. 无短暂命令行窗口弹出，核心 API `/api/health`、`/api/auth/status`、`/api/config`、`/api/ncp/sessions` 可用。

## 可维护性总结汇总

已使用 `post-edit-maintainability-guard`。本次修复保持 runtime command owner 与 bundle bootstrap owner 的职责边界：runtime command resolver 不再绕过 bootstrap；同版本 seed 替换逻辑收敛在 `DesktopBundleBootstrapService`。非测试代码净减少；新增的 Windows smoke 污染态验证属于发布验证基础设施，同时删除了 desktop validate workflow 中重复的 Windows 日志 staging 块。

## NPM 包发布记录

不涉及 NPM 包发布。本次只发布 desktop preview，不走 NPM beta 发布。
