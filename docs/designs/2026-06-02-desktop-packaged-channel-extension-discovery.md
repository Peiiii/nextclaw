# Desktop Packaged Channel Extension Discovery

## 背景

桌面端点击微信重新生成二维码时报错：

```text
channel auth is not supported: weixin
```

接口复现结果：

- 桌面 runtime 返回 `404 NOT_SUPPORTED`。
- 全局 NPM runtime 返回正常微信二维码数据。
- 仓库 dev runtime 返回正常微信二维码数据。

直接原因是桌面 runtime 没有发现 `weixin` channel extension binding。更底层的差异是桌面 runtime 启动时设置了 `NEXTCLAW_DISABLE_BUILTIN_EXTENSIONS=1`，kernel 会跳过从 `node_modules/@nextclaw/channel-extension-*` 发现内置 extension；但桌面 product bundle 的 `plugins` 目录当前只有 `.keep`，没有提供等价的 packaged extension 发现路径。

历史上这个禁用开关是为了避免桌面端重复启动 built-in extension 子进程，并规避 Windows 下 `spawn node ENOENT`、控制台闪窗和 slim runtime bundle 被 `node_modules` 拖大的问题。这个方向本身合理，但 channel extension 迁移完成后，桌面端缺少了替代的显式 extension root。

## 目标

- 保留桌面端 `NEXTCLAW_DISABLE_BUILTIN_EXTENSIONS=1`，不恢复隐式 `node_modules` built-in discovery。
- 桌面 product bundle 显式携带一方 channel extensions。
- kernel 只感知 extension manifest roots，不感知桌面/NPM 运行形态。
- 桌面端 `POST /api/config/channels/weixin/auth/start` 能返回二维码数据，而不是 `NOT_SUPPORTED`。
- 保持 slim runtime 合同：`bundle/runtime/node_modules` 仍然禁止出现。

## 方案

1. 桌面 product bundle 构建时，把一方 channel extensions 打入 `bundle/plugins/<extension-package>/`。
2. 每个 packaged extension 目录包含：
   - `nextclaw.extension.json`
   - `package.json`
   - `dist/main.mjs`
3. `dist/main.mjs` 由 `tsdown` 以桌面专用方式从 `src/main.ts` 打包，依赖内联，避免 plugin 自带 `node_modules`。
4. 写入 bundle 的 manifest 只在 packaged copy 中把 `server.args` 改为 `["dist/main.mjs"]`；源包 manifest 不变。
5. 桌面 launcher 解析当前 bundle 后，把 `pluginsDirectory` 注入 runtime env：

```text
NEXTCLAW_PACKAGED_EXTENSION_DIR=<current-bundle>/plugins
```

6. kernel extension discovery 增加显式 packaged root：
   - 总是读取 `NEXTCLAW_PACKAGED_EXTENSION_DIR`。
   - `NEXTCLAW_DISABLE_BUILTIN_EXTENSIONS=1` 只禁用隐式 built-in package discovery。
   - 用户安装目录、workspace extension 目录、dev first-party 目录仍保持原优先级。

## 验收

- seed bundle zip 中存在 `bundle/plugins/nextclaw-channel-extension-weixin/nextclaw.extension.json`。
- seed bundle zip 中存在 `bundle/plugins/nextclaw-channel-extension-weixin/dist/main.mjs`。
- seed bundle zip 中不存在 `bundle/runtime/node_modules`。
- 在隔离 `NEXTCLAW_HOME` 中启动解包后的 runtime，并设置：

```text
NEXTCLAW_DISABLE_BUILTIN_EXTENSIONS=1
NEXTCLAW_PACKAGED_EXTENSION_DIR=<extracted>/bundle/plugins
```

- 等待 runtime 日志出现 `Channels enabled: ... weixin`，再调用：

```text
POST /api/config/channels/weixin/auth/start
```

结果应为 `200 OK` 且返回 `kind: "qr_code"`、`sessionId`、`qrCodeUrl`。

接口 smoke 可以把 `baseUrl` 指向本地 QR fixture 后端，用于验证 server -> packaged extension child process -> weixin auth capability -> HTTP QR backend 的完整调用链；微信公网二维码服务可作为独立外部集成验收。

## 风险与控制

- **体积风险**：一方 channel extensions 的第三方依赖会进入 packaged plugin bundle。用 zip 体积和 uncompressed bytes 做发布前观察；不把它们放进 `runtime/node_modules`。
- **启动风险**：packaged extensions 会作为 stdio 子进程启动。当前 lifecycle 已经把 manifest 的 `node` 映射为 `process.execPath`，并设置 `windowsHide: true`。
- **启动窗口风险**：channel bindings 来自 manifest，可能早于 extension websocket 订阅完成。接口冒烟需要等待 `Channels enabled`；若后续 UI 允许在 deferred startup 完成前触发 auth start，应补充 extension readiness/请求重试机制。
- **合同漂移风险**：桌面打包验证必须检查 expected channel extension manifest 和入口文件，避免以后只 build extension 却没有放进 product bundle。
