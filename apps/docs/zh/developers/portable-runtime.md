# Portable Runtime

Portable Runtime 是 NextClaw 用来运行 WebAssembly Component Service App 的方式。你把 Rust/WASI Guest、Service 清单和可选 Panel 一起打包为 schema v2 `.napp`，NextClaw 用随产品提供的原生 runner 运行 Component，并在应用边界转交每一项宿主资源。

它不是一个通用容器。Component 只能拿到应用声明、且在已安装宿主中完成绑定的存储、文件夹、域名、密钥槽位、Provider 和 AI 槽位。正是这个边界让同一份应用包可以在支持的平台运行，而不必把当前用户的完整环境交给 Guest。

## 什么时候该选它

| 适合 Portable Runtime | 适合 native-process Service |
| --- | --- |
| 服务可以作为 Rust/WASI Component 运行 | 必须直接启动平台程序，或复用 Node、Python 等完整运行时 |
| 希望用一个通用 `.napp`，并由宿主转交能力 | 集成确实需要外部守护进程、SDK、驱动或系统命令 |
| KV、SQLite、已批准 HTTP、用户授权文件、配置值和声明 Provider 已能覆盖需求 | 部署需要 Redis 等外部依赖；必须明确声明并让设置过程可见 |

自包含应用优先使用 Portable Runtime。外部依赖只是一条明确、可见的例外：不能让用户猜该装什么，也不能把凭据写进清单。

## 架构

```text
Panel / Agent / nextclaw CLI
            │ 已声明的操作
            ▼
NextClaw Kernel：授权、绑定、生命周期、证据
            │ 已解析的能力快照
            ▼
随产品提供的 Spin runner ── WIT ── Rust/WASI Component
```

Panel、Agent 和 CLI 的调用都经过同一个 Kernel owner。它校验操作输入、在调用时解析授权、启动或复用对应运行通道，并写入脱敏验证记录。Guest 不会拿到宿主配置文件、任意进程环境，也不能绕开这些检查。

## 需要构建的内容

一个最小应用包包含：

```text
my-app/
├── manifest.json
├── panels/<panel-id>.panel/       # 可选的用户界面
├── service-components/<service-id>/
│   ├── service-app.json
│   └── service.wasm
├── guest/                         # Rust 源码、Cargo.lock、复制的 WIT 包
└── tests/service-smoke.json
```

用 `nextclaw app create ./my-app --template rust-wasi` 创建。之后从包根目录运行 `build`、`check`、`test`、`dev`、`call` 和 `pack`。这样 Panel、Service、权限和同包 Component 始终处于同一个产品边界。

## 从这里开始

1. [能力与安全边界](/zh/developers/portable-runtime-contracts)：清单请求、WIT、挂载点和错误边界。
2. [开发 Service App](/zh/developers/portable-service-apps)：Rust 开发流程。
3. [Job、事件与可观测性](/zh/developers/portable-runtime-observability)：长时间工作、Resident 投递和诊断事实。
4. [打包与分发](/zh/developers/portable-runtime-distribution)：通用产物和外部依赖规则。
