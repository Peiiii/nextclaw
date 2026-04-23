# NApp WASI TS HTTP 目标锚点

## 当前目标

- 完成 NApp 的最小可运行 TS/Hono WASI HTTP 应用链路。
- 前端普通 `fetch("/api/todos")` 调后端。
- 后端实际运行在 Wasmtime/WASI 沙箱中。
- Todo 数据写入运行时指定的宿主目录，并在 guest 中固定表现为 `/data`。
- 继续产品化到普通用户可通过 NextClaw 能力入口开发、分发、安装和运行 NApp。

## 明确非目标

- 不重做 Docker。
- 不引入复杂权限中心、数据库抽象、LLM 能力或通用插件桥接。
- 不改变现有 `manifest.json + main/ + ui/ + assets/` 目录合同。
- 不把 Rust 设为唯一后端语言。

## 冻结边界 / 不变量

- 使用官方 Bytecode Alliance/JCO/ComponentizeJS/WASI HTTP 路线。
- 网络访问不做默认域名白名单；本阶段只处理前端到后端的本地代理。
- 文件能力先只实现运行时 `--data` 挂载到 `/data`。
- 行为显式失败，不做隐藏 fallback。

## 已完成进展

- `manifest.main.kind` 已支持 `wasi-http-component`。
- `napp create --template ts-http` 已生成 TS/Hono Todo 模板。
- runtime 已接入 Wasmtime `serve` 并代理 `/api/*`。
- `napp run --data <path>` 已将 host 数据目录挂载到 guest `/data`。
- Todo 端到端冒烟已通过，数据写入运行时指定目录。
- `napp doctor` 与 `napp build --install` 已支持 skill 编排的普通用户开发流。
- `skills/nextclaw-app-runtime` 已更新为创建、预览、发布、安装运行的端到端工作流。
- 已确定双模式分发边界：`.napp` 容器不变，新增 `source` / `bundle` 分发模式，默认切到 `source`。

## 当前下一步

- 完成 marketplace skill 更新、远端校验、可维护性复核、迭代留痕与提交。

## 锚点计数器

- 当前：0/20
