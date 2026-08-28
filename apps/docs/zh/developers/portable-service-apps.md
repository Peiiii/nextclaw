# 开发 WASM Service App

当前 Portable Runtime 的官方开发路径是 Rust + WebAssembly Component。下面的流程以 NextClaw 源码仓库为准：创建 Rust Guest，把它声明为 schema v2 App 的 Service Component，然后使用 NextClaw CLI 沿真实 Runtime 检查和调用。

## 准备环境

需要安装：

- Rust toolchain；
- `cargo-component`；
- `wasm32-wasip2` target；
- NextClaw 源码仓库的 Node.js 与 pnpm 依赖。

仓库内置的 Rust Guest 和 WIT 合同位于：

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
└── services/
    └── notes-state/
        ├── service-app.json
        └── service.wasm
```

`manifest.json` 使用 `runtime.profile: "wasi"`，并在 `components` 中声明每个 Panel 和 Service。完整字段见 [Runtime 模型与能力合同](/zh/developers/portable-runtime-contracts#所属-app-清单)。

## 实现 Rust Guest

Rust crate 输出 `cdylib`，并让 `cargo-component` 使用仓库中的 `service-app` world：

```toml
[package]
name = "my-notes-service"
version = "0.1.0"
edition = "2024"
publish = false

[dependencies]
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
wit-bindgen-rt = { version = "0.44.0", features = ["bitflags"] }

[lib]
crate-type = ["cdylib"]

[package.metadata.component]
package = "nextclaw:portable-service"
target = { path = "../../wit", world = "service-app" }
```

Guest 实现生成绑定中的 `Guest` trait。每个实现都需要提供 Action 列表、调用入口和生命周期函数：

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

## 构建 Component 和 runner

在 NextClaw 仓库根目录运行：

```bash
pnpm portable-runtime:build
```

该命令构建仓库中的五个 Rust Guest，并为当前平台构建原生 runner，再把产物同步到 NextClaw 的标准资源位置。它是当前源码开发命令，不是面向独立第三方项目发布的 SDK 命令。

单独开发自己的 Guest 时，也可以在 runner 目录使用 `cargo component build --release`，然后把产物复制为 Service 清单中 `component.entry` 指向的文件。

## 声明 Panel 调用的 Actions

Panel 的 `panel-app.json` 使用 `actions` 列出完整 Action id：

```json
{
  "id": "notes-panel",
  "title": "Notes",
  "entry": "index.html",
  "actions": [
    "notes-state.notes_list",
    "notes-state.note_save"
  ]
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

先执行静态检查：

```bash
nextclaw app check <service-app-dir>
```

再通过真实 Service App Runtime 启动 Service 并比较声明与实际 Actions：

```bash
nextclaw app dev <service-app-dir>
```

调用一个明确选择的 Action：

```bash
nextclaw app call <service-app-dir> notes_list --input '{}' --json
```

`app dev` 和 `app call` 使用与源码位置绑定的隔离开发实例，并读取所属 schema v2 App 的存储、域名和 Provider 声明。要在启动前只重置这个开发实例：

```bash
nextclaw app dev <service-app-dir> \
  --reset-data \
  --confirm <app-id> \
  --json
```

如果修改后的 Service 已在 NextClaw UI 中运行，可先让宿主重启该 App 的 live runtime，再验证 Panel 链路：

```bash
nextclaw app restart <app-id> --json
```

普通 Service 源码或清单修改不要求重启 NextClaw 宿主。

## 开发检查清单

- Service id 与目录名一致，Component 路径位于包内。
- `service-app.json` 的 Actions 与 `list-actions()` 完全一致。
- 每项 Action 有准确的 `risk`、用途说明和最小 `inputSchema`。
- App 只声明实际需要的存储、域名和 Provider。
- `app check` 和 `app dev` 通过，并至少调用一个无副作用或已明确选择的关键 Action。
- Panel 只在 `actions` 中声明实际调用的完整 Action id。
- 持久化、Resident 或 Provider 场景沿真实运行时完成一次停止与恢复验证。

当前完整参考实现位于 `packages/nextclaw/resources/apps/nextclaw-portable-runtime-lab`，但它是开发验证应用，不是 Portable Runtime 的产品定义。
