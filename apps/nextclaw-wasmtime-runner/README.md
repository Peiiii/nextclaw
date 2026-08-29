# NextClaw Portable Runtime Runner

这是 Portable Capability Runtime 的 Rust-first 宿主实现。它通过 stdin/stdout NDJSON 接收 NextClaw Kernel 请求，并以嵌入式 Spin Runtime Factors 在一个共享 Wasmtime 进程中缓存、隔离和执行多个 WebAssembly Component。

Spin 是内部执行引擎，不是公开 App 合同。它不暴露 `spin.toml`，也不接管 `.napp`、安装、授权、Action、数据或生命周期；这些语义仍由 NextClaw owner 管理。runner 只负责 Component 装载、Factor linking、执行和资源隔离，发布 artifact 名与现有 Kernel NDJSON/WIT 合同保持不变。

## 当前合同

`wit/portable-service.wit` 定义一个最小 `service-app` world：

- Guest 导出 `list-actions`、`invoke` 以及明确的 `start` / `handle-event` / `stop` 生命周期；
- Host 提供日志、KV、HTTPS GET、运行时信息和受控的 Component Provider 调用；
- Guest 没有继承宿主文件系统或原生网络；
- HTTP 必须使用 HTTPS，并经过 `.napp` 的 `allowedDomains` 白名单；
- Action Component 每次调用使用独立 Store；Resident Component 由宿主保留同一个 Store 与实例并持续接收事件；Provider Component 独立注册并保留实例，Consumer 只有在 manifest 显式声明 `providers` 后才能调用。

## Reference Component

- `guests/state-lab`：读取/增加由宿主落盘的计数，并返回 runner 信息；
- `guests/capability-lab`：验证允许/拒绝的网络、结构化失败、执行超时和 runner 信息。
- `guests/resident-lab`：验证常驻实例、宿主定时事件、内存连续性与 durable cursor。
- `guests/provider-lab`：注册一个可复用的联系人规范化 Provider，并保留独立调用计数。
- `guests/composition-lab`：通过 Host 的 `component-call` 调用已声明 Provider，并验证未声明依赖被拒绝。

## Spin-compatible smoke

正式 runner 构建后可执行同一套可重复的五 Guest 核心链路 smoke：

```sh
node apps/nextclaw-wasmtime-runner/tools/spin-runner-smoke.tools.mjs \
  apps/nextclaw-wasmtime-runner/target/release/nextclaw-wasmtime-runner
```

脚本验证 list-actions、Host KV、存储/网络拒绝、Provider 与 Consumer component-call（允许/拒绝）、Resident 事件/状态/停止，以及同一 PID 和实例计数；网络拒绝不依赖公网。

## 产品构建

需要 Rust、`cargo-component` 和 `wasm32-wasip2` target：

```bash
pnpm portable-runtime:build
```

该命令构建五个 guest Component 和当前平台 runner，把 guest artifact 同步到内置体验包，并把 runner 同步到 `packages/nextclaw/resources/native/<os>-<arch>`。NextClaw Distribution 从该标准资源路径注入 Kernel；正常产品启动不需要 `NEXTCLAW_WASMTIME_RUNNER_PATH`。该环境变量只保留给 runner 开发者做显式 override，路径无效时会直接报错，不静默回退。

构建合同覆盖 macOS arm64/x64、Linux arm64/x64 和 Windows x64。runner 必须在对应原生系统上构建，CI 使用三平台矩阵验证；guest Component 是同一份平台无关 artifact。也可以显式指定目标供 CI 或打包流程使用：

```bash
node apps/nextclaw-wasmtime-runner/scripts/build-product-runtime.mjs --platform linux --arch x64
```

## 内存方向性基准

在构建 release runner 和 Component 后运行：

```bash
node tools/runtime-memory.tools.mjs
```

脚本会在同一台机器上分别测量空 runner、加载 1/5/10 个独立 artifact 路径的 Action Component，以及 1/5/10 个最小 Node Service 独立进程的稳定 RSS，并记录首个 Component 装载和热 Action 延迟。每个 RSS 点取五次 OS 采样的中位数，用来验证共享 runner 的服务密度方向；它不替代等价业务 workload、Resident 密度、CPU 与跨平台统计。可用 `--runner <path>` 对同一 workload 比较候选实现。

## 已知边界

当前仍未达到生产 runtime：还缺经过真实无限循环验证的内部 CPU/内存隔离、Secret、流式 HTTP、外部事件总线、热升级和 runner 多租户安全分区。Resident 已验证宿主定时事件、保留实例、宿主重启和 runner 异常退出恢复，但还没有通用事件订阅路由。Provider 已验证显式依赖、宿主校验、独立实例和 runner 恢复，当前不支持 Provider 递归调用另一个 Provider。超时目前由 Kernel 杀掉共享 runner 并重建持久角色，用于验证故障恢复主链，不是最终资源治理方案。
