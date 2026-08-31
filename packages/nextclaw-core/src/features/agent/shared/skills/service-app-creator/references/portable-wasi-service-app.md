# Portable Rust/WASI Service App

仅当 `service-app-creator` 已选择 Portable WASI 运行形态时读取。本 reference 拥有 schema v2 Portable 包、Rust/WASI Guest、WIT、能力声明、生命周期和验证细节。

## 创建前检查

```bash
nextclaw app doctor --profile wasi
```

开发机器需要 `cargo`、`rustc` 与 `wasm32-wasip2`。缺少 target 时，只有用户同意修改本机 Rust 工具链后才能运行 `rustup target add wasm32-wasip2`。安装并运行已构建 `.napp` 的最终用户不需要这些开发工具，也不需要系统 Node、Cargo 或 Wasmtime。

## 从当前 scaffold 开始

不要手写 runner 命令或从其它 NextClaw 版本复制 WIT。创建完整包：

```bash
nextclaw app create <app-dir> --template rust-wasi
cd <app-dir>
nextclaw app build . --json
```

生成结果至少包含：

```text
<app-dir>/
├── manifest.json
├── marketplace.json
├── panels/<panel-id>.panel/
├── service-components/<service-id>/
│   ├── service-app.json
│   └── service.wasm
├── guest/
│   ├── Cargo.toml
│   ├── Cargo.lock
│   ├── src/lib.rs
│   └── wit/
└── tests/service-smoke.json
```

即使应用最终不需要 Panel，也从 schema v2 包根维护 Service、权限、测试和制品；删除模板 Panel 时同步删除根 manifest 的 component 与 presentation 引用。

## 根 manifest

Portable Service 的根 manifest 明确声明：

```json
{
  "schemaVersion": 2,
  "id": "example.reading-log",
  "name": "Reading Log",
  "version": "0.1.0",
  "runtime": { "profile": "wasi" },
  "distribution": { "mode": "universal" },
  "storage": { "scope": "global", "schemaVersion": 1 },
  "permissions": {
    "storage": { "namespace": "reading-log" },
    "allowedDomains": ["api.example.com"]
  },
  "components": [
    { "kind": "panel", "path": "panels/reading-log-panel.panel" },
    { "kind": "service", "path": "service-components/reading-log-service" }
  ]
}
```

只声明真实需要的能力：

- `permissions.storage`：宿主管理的应用私有 KV / SQLite；
- `permissions.documentAccess`：用户授权的命名文件夹，Guest 内挂载为 `/documents/<scope>`；
- `permissions.allowedDomains`：受目标与重定向检查的 WASI 出站 HTTP；
- `permissions.secrets`：命名密钥槽位，只写元信息，不写秘密值；
- `requires.capabilities` / `resources`：Provider 或外部资源绑定；
- `requires.modelSlots` / `agentSlots`：由安装宿主绑定的模型或 Agent 槽位；
- `provides.capabilities`：向其它已声明消费者提供的稳定 Provider 合同。

manifest 是能力请求，不是能力令牌。不要依赖任意环境变量、用户绝对路径、socket 或未声明网络。

## Service manifest 与 WIT

```json
{
  "id": "reading-log-service",
  "title": "Reading Log Service",
  "protocol": "wasi-component",
  "component": { "entry": "service.wasm" },
  "lifecycle": { "mode": "action" },
  "actions": {
    "entry_save": {
      "title": "Save entry",
      "risk": "write",
      "timeoutMs": 7000,
      "inputSchema": { "type": "object", "required": ["title"] }
    }
  }
}
```

每个 action 必须同时存在于 `service-app.json.actions` 与 Guest `list-actions`。Guest `invoke` 接收 action 名和 JSON 对象，成功返回稳定 JSON，失败返回简短、可分类错误；不要把 action 做成万能脚本入口。

只使用 scaffold 复制到 `guest/wit/` 的 WIT 包。WIT 包名、world 和版本属于兼容合同：

- **Action**：一次请求、一次结果，默认选择；
- **Resident**：需要接收持久事件时使用，必须确认或请求重试，并能安全处理重复投递；
- **Provider**：为其它声明消费者提供稳定能力，先于消费者启动、后于消费者停止。

旧 Action Component 保持 `service-app` world；只有目标产品随附 `service-app-v2` 时，新的持久 Resident 才使用它。Provider 依赖声明兼容 WIT，不能形成 Provider 递归调用。

## Panel 与 Agent

Panel 在自己的 manifest 声明完整 action id：

```json
{
  "actions": ["reading-log-service.entry_save"]
}
```

运行时仍使用统一 bridge：

```js
const entry = await window.nextclaw.serviceActions.invoke(
  "reading-log-service.entry_save",
  { title: "A title" }
);
```

不要让 Panel 直接请求 Service Gateway、保存 token 或根据 runtime profile 分叉调用方式。授权给 Agent 的 action 也使用同一输入输出合同。

## 完整开发循环

从包根运行：

```bash
nextclaw app build . --json
nextclaw app check . --json
nextclaw app test . --json
nextclaw app dev . --json
nextclaw app call . <action-name> --input '{}' --json
```

- `build` 编译 Guest，并把 Component 写入 `service-app.json.component.entry`；
- `check` 验证根 manifest、组件引用、Panel action allowlist 与 Component/manifest action 合同；
- `test` 通过真实 Portable Runtime 执行 `tests/service-smoke.json`；
- `dev` 使用隔离开发实例；
- `call` 调用一个 action；多 Service 包增加 `--component <service-id>`。

测试持久状态前可以精确重置开发实例：

```bash
nextclaw app dev . --reset-data --confirm <app-id> --json
```

通过真实循环后再打包：

```bash
nextclaw app pack . --out <app-name>.napp --json
nextclaw app validate-publish . --json
```

纯 Portable 包使用 `distribution.mode: universal`，不把 runner 打进 `.napp`。只有包内确实包含平台原生资源时才声明 targeted distribution。

## 完成条件

- `doctor` 证明当前创作者工具链状态；
- `build/check/test` 全部成功；
- 至少一个无危险副作用的关键 action 通过 `call` 或 smoke fixture；
- manifest 能力与 Guest 实际访问一致；
- Panel allowlist、Service actions 和 Guest exports 一致；
- 明确告诉用户：Rust 是本机构建依赖，不是安装后运行依赖。
