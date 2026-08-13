# 本地 Extension 源码验证

仓库内 first-party extension 的 manifest 在开发态仍可能启动 `dist/main.js`，而默认 `pnpm dev` 不构建全部 `packages/extensions/*`。源码已改但 dist 未重建时，真实进程会继续运行旧逻辑。

## 选择入口

```bash
pnpm dev:claude
pnpm dev:extensions:build
pnpm dev:extensions:watch
pnpm -r --filter @nextclaw/channel-extension-weixin build
```

- Claude Code NARP/runtime SDK：使用 `pnpm dev:claude`，确认日志含 `Claude runtime source: enabled`；它直接运行相关 TypeScript 源码并在变化后重启 backend。
- channel extension 单次验证：先运行 `pnpm dev:extensions:build`，再做授权、扫码或消息链路。
- 只改一个 extension：使用 workspace filter 构建该包。
- 连续开发：单独运行 `pnpm dev:extensions:watch`；watch 只重建 dist，已经启动的 extension 进程仍需按当前链路重启。

排查“源码已修但行为没变”时，先核对 manifest 的入口和 `dist/main.js` 是否来自最新 src。source runner、watch 和热更新属于开发工程化，不进入 kernel/server 业务协议。
