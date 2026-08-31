# 开发 Portable Service App

当前支持的开发路径是 Rust 加 WASI Component。请从生成的应用包开始，而不是手写 runner 命令或临时拼 WIT 文件。

## 创建并准备项目

```bash
nextclaw app doctor --profile wasi
nextclaw app create ./reading-log --template rust-wasi
cd ./reading-log
nextclaw app build . --json
```

`doctor` 会检查 `cargo`、`rustc` 和 `wasm32-wasip2` target。生成的 Component 流程只额外需要这个 Rust target；Guest 依赖由 `guest/Cargo.lock` 固定。

模板包含 schema v2 应用包、一个小 Panel、`service-components/<id>/service-app.json`、`guest/` Rust 源码、复制的 WIT 包以及 `tests/service-smoke.json`。复制出来的 WIT 目录是应用自身版本化合同的一部分。

## 实现操作

每个操作都要同时出现在 `service-app.json` 和 Rust Guest 的 `list-actions` 里。`invoke` 接收操作名和 JSON 对象，成功时返回 JSON 字符串，失败时返回简短、带代码前缀的错误。

```rust
fn invoke(action: String, input_json: String) -> Result<String, String> {
    match action.as_str() {
        "entry_save" => {
            let input: serde_json::Value = serde_json::from_str(&input_json)
                .map_err(|_| "INVALID_INPUT: expected an object".to_string())?;
            // 校验业务字段，只使用已声明能力，然后返回 JSON 结果。
            Ok(serde_json::json!({ "saved": true }).to_string())
        }
        _ => Err(format!("UNKNOWN_ACTION: {action}")),
    }
}
```

不要把一个操作做成无类型 RPC 通道。每个操作都要有收窄的 `inputSchema`、准确的 `risk` 和符合真实工作量的超时。Panel 只能声明自己真正会调用的完整操作 id。

## 构建、检查、测试和调用

```bash
nextclaw app build . --json
nextclaw app check . --json
nextclaw app test . --json
nextclaw app dev . --json
nextclaw app call . entry_save --input '{"title":"A title"}' --json
```

`build` 编译 Guest 并写入声明的 `service.wasm`。`check` 检查完整应用包：根清单、同包 Component、Panel 操作引用，以及 Component/清单操作合同。`test` 用真实 Runtime 运行 smoke fixture。`dev` 启动隔离的开发实例；`call` 通过该实例调用一个 Guest 操作。

一个包有多个 Service 时，需要明确选择：

```bash
nextclaw app call . entry_save --component reading-log --input '{"title":"A title"}' --json
```

只重置开发实例、不影响其他已安装应用：

```bash
nextclaw app dev . --reset-data --confirm <app-id> --json
```

## 有意识地选择生命周期

- **Action**：普通的一次请求、一次返回。
- **Resident**：Component 需要接收持久事件时使用。事件处理必须确认完成或请求重试，并能安全处理重复投递。
- **Provider**：其他已声明 Component 需要使用你提供的稳定能力时使用。

使用包中随附的对应 WIT world。旧 Action Component 要继续兼容 `service-app`；新的持久化 Resident 只有在目标运行时提供时才使用 `service-app-v2`。不要根据源码仓库猜测，应对目标产品版本运行 `app check` 和 `app test`。

## 接入 Panel、Agent 或外部依赖

Panel 通过注入的 bridge 调用操作：

```js
const entry = await window.nextclaw.serviceActions.invoke(
  "reading-log.entry_save",
  { title: "A title" },
);
```

Panel 运行在隔离 iframe 中。不要从 Panel 直接 `fetch("/api/...")`；读取运行证据或验收状态也应使用宿主注入的只读 bridge：

```js
const records = await window.nextclaw.verificationRecords.list({ appId: "reading-log", limit: 20 });
const status = await window.nextclaw.portableRuntimeAcceptance.status({ locale: "zh-CN" });
```

这样既保留 iframe 的 opaque-origin 隔离，也由宿主校验当前 Panel 会话；不需要、也不应该给 Panel 增加 `allow-same-origin`。

把声明操作授权给 Agent 后，Agent 看到的是同一套输入输出合同。适合 Agent 的操作应保持小而明确。

需要其他 Component 时，声明 Provider 依赖和兼容 WIT 合同。需要模型或 Agent 时，在 `requires.modelSlots` 或 `requires.agentSlots` 声明命名槽位，由已安装宿主另行绑定。需要 Redis 等服务时，声明为可见的外部资源；可能时提供 Agent 可以执行的设置操作。不能让“包安装成功”掩盖外部依赖。

## 真实循环通过后再打包

```bash
nextclaw app pack . --out reading-log.napp --json
nextclaw app validate-publish . --json
```

继续阅读：[能力与安全边界](/zh/developers/portable-runtime-contracts) · [打包与分发](/zh/developers/portable-runtime-distribution)
