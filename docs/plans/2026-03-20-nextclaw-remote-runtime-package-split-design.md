# NextClaw Remote Runtime Package Split Design

日期：2026-03-20

## 背景

`nextclaw remote` 已经具备可用能力，但此前实现仍然堆叠在 `packages/nextclaw/src/cli/remote/` 下。这样虽然功能上线快，但长期有两个问题：

1. `nextclaw` 主包持续膨胀，产品命令层、运行时能力层、service 状态适配层混在一起。
2. 后续如果继续演进 remote access，例如后台保活、平台侧 relay 升级、更多宿主复用，主包会继续承担不必要的结构复杂度。

这次不做“大而全平台化 remote 重构”，而是做一次结构上正确、成本可控的拆包：把 remote 运行时正式拆为独立 npm 包，`nextclaw` 主包只保留宿主装配和配置写入职责。

## 目标

- 新建独立可发布包 `@nextclaw/remote`。
- 将 remote runtime 主链路整体迁出 `nextclaw` 主包：
  - remote command registration facade
  - runtime action facade
  - platform client
  - websocket connector
  - relay bridge
  - service module
  - remote status model/store
- `nextclaw` 主包继续保留：
  - CLI 总入口
  - config 读写与用户交互输出
  - service.json 持久化
  - 进程状态判断
  - 平台 API base 的宿主解析规则

## 非目标

- 不新增第二套 remote 功能实现。
- 不把平台网页、Cloudflare worker、UI 配置页一起塞进新包。
- 不引入 `remote-core` / `remote-platform` / `remote-ui` 多层包体系，避免过早抽象。

## 包边界

### `@nextclaw/remote`

负责纯 remote runtime 能力：

- 设备注册
- connector 生命周期
- relay request/response bridge
- service-mode module
- remote runtime state model
- CLI remote 子命令注册门面

它可以依赖 `@nextclaw/core` 的配置模型和 `@nextclaw/server` 的本地 auth bridge，但不能反向依赖 `nextclaw` 主包内部文件。

### `nextclaw`

负责产品宿主能力：

- `remote enable/disable/status/doctor` 的用户输出与 config 变更
- `service.json` 的 remote slice 持久化
- `isProcessRunning/readServiceState/updateServiceState`
- `resolvePlatformApiBase` 等 NextClaw 特有策略

主包通过一个薄桥接文件，把这些宿主能力注入给 `@nextclaw/remote`。

## 依赖方向

依赖方向固定为：

`nextclaw -> @nextclaw/remote -> @nextclaw/core / @nextclaw/server`

不允许：

- `@nextclaw/remote -> nextclaw`
- `@nextclaw/remote` 直接读写 `service.json`
- `@nextclaw/remote` 内部引用 `packages/nextclaw/src/cli/*`

这样可以保证未来如果出现第二个宿主，只需要再写一个新的 host adapter，而不是复制 remote 运行时。

## 关键设计

### 1. 注入而不是反向 import

`RemotePlatformClient` 不再直接 import `nextclaw` 内部工具，而是通过 deps 注入：

- `loadConfig`
- `getDataDir`
- `getPackageVersion`
- `resolvePlatformBase`
- `readManagedServiceState`
- `isProcessRunning`

### 2. 状态存储保持宿主所有权

`RemoteStatusStore` 在新包中只负责组装 remote runtime state，不负责知道宿主完整 service state 结构。真正的 `service.json` 写入仍由 `nextclaw` 的 bridge 负责。

### 3. 只保留一层宿主适配

主包新增单个桥接文件 `remote-runtime-support.ts`，集中承载：

- platform client 创建
- connector 创建
- remote status store 适配
- remote snapshot 解析

这样可以避免适配逻辑散落到 `remote.ts`、`diagnostics.ts`、`service-remote-runtime.ts` 多处。

## 未来扩展

如果后续 remote access 继续变大，下一步也不应该直接回到主包堆逻辑，而应基于 `@nextclaw/remote` 向下再演进：

- `@nextclaw/remote` 继续作为宿主友好的 runtime 包
- 如有必要，再从内部抽出更底层的 `remote-core`

但在当前阶段，这一步先不做，避免把简单问题设计复杂。
