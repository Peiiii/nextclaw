# v0.18.58 Dev Runner Frontend Startup

## 迭代完成说明

- 根因：`pnpm dev start` 在真正启动 Vite 前会先等待后端 ready；原先 30 秒超时在冷启动、并发 dev 实例或插件加载较慢时偏短，导致 runner 已打印前端 URL 但尚未 spawn 前端进程就失败退出。
- 确认方式：使用隔离 `NEXTCLAW_HOME` 和独立端口复现，观察到后端有时超过 30 秒才开始监听；前端日志只会在后端 ready 后出现。
- 修复：保持 30 秒后端 ready 超时；ready 判定改为真实 HTTP API 探测；前端 URL 只在后端 ready、即将启动 Vite 时打印；启动失败时清理已启动子进程，避免残留进程继续占端口并诱发下一轮 fallback。

## 测试/验证/验收方式

- `node --check scripts/dev/dev-runner.mjs`
- `pnpm exec eslint scripts/dev/dev-runner.mjs`
- `NEXTCLAW_HOME=$(mktemp -d /tmp/nextclaw-dev-smoke4.XXXXXX) NEXTCLAW_DEV_BACKEND_PORT=19062 NEXTCLAW_DEV_FRONTEND_PORT=5262 pnpm dev start`
- `curl http://127.0.0.1:19062/api/app/meta`
- `curl http://127.0.0.1:5262/`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths scripts/dev/dev-runner.mjs`
- `pnpm check:governance-backlog-ratchet`
- `pnpm lint:new-code:governance` 已运行，但被本次未触达的 Feishu 文件 context-destructuring 既有/并行改动阻塞。

## 发布/部署方式

不涉及部署；脚本改动随仓库后续常规发布或提交进入使用路径。

## 用户/产品视角的验收步骤

1. 在已有 dev 实例或冷启动较慢的环境中运行 `pnpm dev start`。
2. 观察日志先出现后端等待提示。
3. 后端 API ready 后再出现 `Backend ready; starting frontend` 和 Vite ready 日志。
4. 访问日志中打印的前端端口，应返回 Vite 页面。

## 可维护性总结汇总

- 本次是非功能 bugfix，非测试代码净增为负。
- 删除了重复的 connect 端口探测路径，端口选择保留 bind 探测，后端 ready 使用真实 HTTP API 探测，职责更清晰。
- `post-edit-maintainability-review` 已使用；`dev-runner.mjs` 接近 500 行预算，后续如果继续扩展 dev runner，应拆分端口探测、进程生命周期和启动编排。

## NPM 包发布记录

不涉及 NPM 包发布。
