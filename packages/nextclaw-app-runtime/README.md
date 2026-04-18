# NextClaw App Runtime

`@nextclaw/app-runtime` 是一个独立的微应用 runtime/CLI 包。

当前 MVP 提供三件事：

- `napp inspect <app-dir>`：校验应用目录与 manifest
- `napp run <app-dir>`：启动本地宿主，提供 UI 静态服务和桥接 API
- `napp dev <app-dir>`：当前等价于 `run`

第一版先聚焦“独立可运行的微应用宿主”，不接入现有 NextClaw 主产品路由、服务或传播层。

## 应用目录

```text
manifest.json
main/
  app.wasm
ui/
  index.html
assets/
```

## 当前 MVP 范围

- `main` 执行形态：`wasm`
- UI 装载：本地静态服务
- 宿主桥接：`/__napp/*`
- 权限词汇：`documentAccess`、`allowedDomains`、`storage`、`capabilities`
- 当前 Wasm 执行底座：Node 原生 `WebAssembly`

## 示例

```bash
napp inspect ./apps/examples/hello-notes
napp run ./apps/examples/hello-notes --document notes=/absolute/path/to/notes
```
