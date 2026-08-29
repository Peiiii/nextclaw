# 开发 WASM Service App

当前 Portable Runtime 的官方开发路径是 Rust + WebAssembly Component。NextClaw 可以直接生成一个包含 WIT 合同、Rust Guest、Panel 和 Service 清单的独立项目；开发普通 App 不需要克隆 NextClaw 源码仓库。Component 由内嵌的 Spin Runtime 执行，但 App 作者只需要遵守公开的 `.napp`、WIT 和 NDJSON 合同。

Portable Service 默认应当是自包含的：把需要的 Component、清单和构建结果放进 `.napp`，用户安装后即可运行。需要 Redis 等外部服务时，使用 Service 清单的 `requires` 显式声明；这会让 App 显示为 `needs-capability` 或 `needs-configuration` 并阻止启用，直到依赖满足。当前不会自动安装外部服务或完成第三方授权，也不要在清单中放凭据或连接字符串。

## 从可运行模板开始

```bash
nextclaw app doctor --profile wasi
nextclaw app create ./my-counter --template rust-wasi
cd my-counter
nextclaw app build .
```

然后直接以 App 根目录完成检查、运行和调用：

```bash
nextclaw app check .
nextclaw app test . --json
nextclaw app dev .
nextclaw app call . counter_increment --input '{"step":3}' --json
nextclaw app call . counter_read --json
```

模板中的计数由 Rust/WASM 计算，并通过宿主 KV 持久保存；Panel 与 CLI 调用的是同一组 Action。

## 准备环境

先运行 `nextclaw app doctor --profile wasi`。它会检查：

- NextClaw 是否能找到 `cargo` 和 `rustc`；
- Rust 版本是否满足模板要求；
- `wasm32-wasip2` target 是否已经安装。

缺少 target 时，诊断结果会直接给出 `rustup target add wasm32-wasip2`。构建 Guest 不要求额外安装 `wasmtime`、`wkg`、`cargo-component` 或 `wit-bindgen` CLI；模板把 `wit-bindgen` 固定为 Rust 依赖。

`app create` 会把当前 WIT 合同放进项目的 `guest/wit/portable-service.wit`，并生成锁定依赖的 `Cargo.lock`。只有维护 NextClaw Runtime 或仓库内置验证应用时，才需要源码仓库。

仓库维护者使用的 Rust Guest 和 WIT 合同位于：

```text
apps/nextclaw-wasmtime-runner/
├── wit/portable-service.wit
└── guests/
```

## 应用目录

一个同时包含 Panel 和 Portable Service 的 App 可以使用以下结构：

```text
my-app/
├── manifest.json
├── panels/
│   └── notes.panel/
│       ├── panel-app.json
│       └── index.html
└── service-components/
    └── notes-state/
        ├── service-app.json
        └── service.wasm
```

`manifest.json` 使用 `runtime.profile: "wasi"`，并在 `components` 中声明每个 Panel 和 Service。完整字段见 [Runtime 模型与能力合同](/zh/developers/portable-runtime-contracts#所属-app-清单)。`app check` 会同时验证包清单、Panel 引用和同包 Service Action。

## 实现 Rust Guest

Rust crate 输出 `cdylib`，通过项目内固定版本的 `wit-bindgen` 使用 `service-app` world：

```toml
[package]
name = "my-notes-service"
version = "0.1.0"
edition = "2024"
publish = false

[dependencies]
serde_json = "1.0"
wit-bindgen = "0.44.0"

[lib]
crate-type = ["cdylib"]

```

通过项目内的 WIT 生成绑定，并实现 `Guest` trait。每个实现都需要提供 Action 列表、调用入口和生命周期函数：

```rust
impl Guest for NotesService {
    fn list_actions() -> Vec<Action> {
        vec![Action {
            name: "notes_list".into(),
            title: "List notes".into(),
            description: "Returns saved notes".into(),
        }]
    }

    fn invoke(action: String, input_json: String) -> Result<String, String> {
        match action.as_str() {
            "notes_list" => {
                let value = host::kv_get("notes")?.unwrap_or_else(|| "[]".into());
                Ok(value)
            }
            _ => Err(format!("unknown action: {action}")),
        }
    }

    fn start(_config_json: String) -> Result<String, String> { Ok("{}".into()) }
    fn handle_event(_event_json: String) -> Result<String, String> {
        Err("this Action Component does not handle events".into())
    }
    fn stop(_reason_json: String) -> Result<String, String> { Ok("{}".into()) }
}
```

仓库中的 `state-lab`、`resident-lab`、`provider-lab` 和 `composition-lab` 分别给出了 KV、Resident、Provider 和组合调用的完整实现。

## 构建 Component

推荐从 App 根目录构建：

```bash
nextclaw app build .
```

该命令按 `Cargo.lock` 执行 `cargo build --locked --release --target wasm32-wasip2`，并把生成的 Component 放到 `service-components/<service-id>/service.wasm`。构建结果会明确列出目标文件，随后可直接执行 `app check` 和 `app test`。

NextClaw 会提供当前平台的原生 runner；App 开发者只构建跨平台的 `.wasm` Component，不需要为 Windows、Linux 和 macOS 分别编译 runner。

只有维护 NextClaw Runtime 本身时，才在源码仓库根目录运行 `pnpm portable-runtime:build`，构建平台运行时和内置验证 Components。应用作者不能通过公开 API 动态加载任意第三方 Spin Factor；需要额外宿主能力时，应使用已有的受支持 Factor/Native Provider，或改用 `native-process` Service。

## 声明 Panel 调用的 Actions

Panel 的 `panel-app.json` 使用 `actions` 列出完整 Action id：

```json
{
  "id": "notes-panel",
  "title": "Notes",
  "entry": "index.html",
  "actions": ["notes-state.notes_list", "notes-state.note_save"]
}
```

Panel 当前推荐通过宿主注入的 bridge 调用，以保留首次授权确认和自动重试体验：

```js
const notes = await window.nextclaw.serviceActions.invoke(
  "notes-state.notes_list",
  {},
);
```

`invoke()` 直接返回业务 payload，不会再包一层 `{ result }`。

## 检查和运行

推荐直接对完整 App 根目录执行：

```bash
nextclaw app check <app-dir>
nextclaw app test <app-dir> --json
nextclaw app dev <app-dir>
nextclaw app call <app-dir> notes_list --input '{}' --json
```

`app test` 执行模板内 `tests/service-smoke.json` 声明的真实 Action 序列；每一步可声明输入与输出断言，因此持久化等行为不必靠手工读取 runner 协议验证。

包内只有一个 Service 时会自动选择；有多个 Service 时增加 `--component <service-id>`。`app call` 的第二个位置参数是 Guest 暴露的 Action 名称，不是完整 Action id，输入必须是 JSON 对象。`app dev` 和 `app call` 使用与源码位置绑定的隔离开发实例，并读取同一个 schema v2 App 的存储、域名和 Provider 声明。要在启动前只重置这个开发实例：

```bash
nextclaw app dev <app-dir> \
  --reset-data \
  --confirm <app-id> \
  --json
```

如果修改后的 Service 已在 NextClaw UI 中运行，可先让宿主重启该 App 的 live runtime，再验证 Panel 链路：

```bash
nextclaw app restart <app-id> --json
```

普通 Service 源码或清单修改不要求重启 NextClaw 宿主。

## 打包、安装与启用

```bash
nextclaw app pack . --out my-counter.napp
nextclaw app install ./my-counter.napp --json
nextclaw app enable nextclaw.my-counter --json
```

本地目录和 `.napp` 都支持相对路径。安装和启用由正在运行的 NextClaw 宿主完成；失败时 CLI 会保留服务端返回的错误码与原因。

没有平台原生文件的 Rust/WASI App 默认生成 `universal` 产物，不需要传 `--target`；确实包含平台特定资源时再显式选择目标平台。

## 错误与运行观测

WASI 调用失败会保留稳定错误码，Panel、CLI 和 HTTP API 可据此区分问题：

| 错误码                       | 含义                                         |
| ---------------------------- | -------------------------------------------- |
| `WASI_CAPABILITY_DENIED`     | Guest 使用了清单未授权的存储、网络或宿主能力 |
| `WASI_INPUT_SCHEMA_MISMATCH` | Action 输入与合同不匹配                      |
| `WASI_GUEST_EXPORT_MISSING`  | 清单声明的 Action 未由 Guest 暴露            |
| `WASI_ABI_VERSION_MISMATCH`  | Guest 与当前 WIT/ABI 合同不兼容              |
| `WASI_COMPONENT_TRAP`        | Guest 执行时触发 trap                        |
| `WASI_COMPONENT_FAILED`      | 其它 Component 运行失败                      |

`nextclaw app call ... --json` 还会返回 `observation`，其中包含本次操作、App id、Action 耗时、runner PID、可用时的内存采样以及受限长度的 Service 日志。权限拒绝和 trap 的诊断不会再退化为无原因的通用 409/502。

## 开发检查清单

- Service id 与目录名一致，Component 路径位于包内。
- `service-app.json` 的 Actions 与 `list-actions()` 完全一致。
- 每项 Action 有准确的 `risk`、用途说明和最小 `inputSchema`。
- App 只声明实际需要的存储、域名和 Provider。
- 对 App 根目录依次执行 `app build`、`app check`、`app test` 和 `app dev`，并至少调用一个无副作用或已明确选择的关键 Action。
- Panel 只在 `actions` 中声明实际调用的完整 Action id。
- 持久化、Resident 或 Provider 场景沿真实运行时完成一次停止与恢复验证。

当前完整参考实现位于 `packages/nextclaw/resources/apps/nextclaw-portable-runtime-lab`，但它是开发验证应用，不是 Portable Runtime 的产品定义。
