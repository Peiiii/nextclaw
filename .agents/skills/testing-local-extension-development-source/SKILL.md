---
name: testing-local-extension-development-source
description: 当本仓库本地调试 NextClaw extension/channel extension、修改 packages/extensions/* 源码、遇到 dev 运行旧 dist/main.js、需要验证未发布 extension 或微信/飞书等渠道 extension 源码时使用。
---

# Testing Local Extension Development Source

## 核心事实

- 本仓库 first-party extension 的 `nextclaw.extension.json` 在开发态仍然启动 `dist/main.js`。
- 默认 `pnpm dev` 不自动构建 `packages/extensions/*`，避免普通开发启动变慢。
- 修改 extension `src` 后，如果没有重建 `dist`，运行中的 extension 可能仍是旧逻辑。

## 命令

```bash
pnpm dev:extensions:build
pnpm dev:extensions:watch
pnpm -r --filter @nextclaw/channel-extension-weixin build
```

## 使用方式

- 修改 channel extension 源码后，先运行 `pnpm dev:extensions:build`，再做扫码、授权、消息收发等链路验证。
- 只需要构建某个 extension 时，直接使用 pnpm workspace filter，例如 `pnpm -r --filter @nextclaw/channel-extension-weixin build`。
- 连续开发 channel extension 时，单独开一个终端运行 `pnpm dev:extensions:watch`。
- watch 命令只负责重建 `dist`；如果 extension 进程已经启动，仍需按当前运行链路重启对应进程。
- 排查“源码已经修了但行为还是旧的”时，优先确认 manifest 指向的 `dist/main.js` 是否已经由最新 `src` 构建出来。

## 注意

- 这套命令只解决本仓库 extension 开发态源码到 `dist` 的同步问题，不改变 runtime 的业务协议。
- 不要把 extension source runner、热更新或构建监听逻辑塞进 kernel/server 业务源码；这属于开发工程化职责。
