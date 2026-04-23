# NextClaw App Runtime

`@nextclaw/app-runtime` 是一个独立的微应用 runtime/CLI 包。

当前相对完善 MVP 提供下面这些能力：

- `napp create <app-dir>`：生成一个最小可跑的微应用骨架
- `napp inspect <app-dir>`：校验应用目录与 manifest
- `napp doctor`：检查本机 NApp/WASI HTTP 开发运行环境
- `napp build <app-dir> --install`：安装模板依赖并构建 TS/WASI HTTP 后端
- `napp run <app-dir|app-id>`：启动本地宿主，支持目录运行和已安装应用运行
- `napp dev <app-dir>`：当前等价于 `run`
- `napp pack <app-dir>`：把应用目录打成 `.napp` bundle
- `napp publish <app-dir>`：把应用目录发布到官方 apps registry
- `napp install <app-dir|bundle.napp|app-id[@version]>`：从本地或 registry 安装应用
- `napp update <app-id>`：更新已安装应用
- `napp uninstall <app-id>`：卸载已安装应用
- `napp list`：列出已安装应用
- `napp info <app-id>`：查看已安装应用详情
- `napp registry [get|set|reset]`：查看或切换 registry
- `napp permissions <app-id>`：查看应用权限状态
- `napp grant <app-id> --document scope=/path`：写入目录授权
- `napp revoke <app-id> --document scope`：撤销目录授权

## 安装

```bash
npm install -g @nextclaw/app-runtime
```

安装后可用：

```bash
napp --help
napp --version
```

当前版本先聚焦“独立可运行的微应用宿主 + 可分发、可安装、可更新、可授权的 CLI/runtime 闭环”。普通用户入口推荐通过 NextClaw 的 `nextclaw-app-runtime` skill 编排这些命令。

## 应用目录

```text
manifest.json
main/
  app.wasm
  package.json     # ts-http 模板存在
  src/             # ts-http 模板存在
ui/
  index.html
assets/
```

## 当前 MVP 范围

- `main` 执行形态：`wasm` 或 `wasi-http-component`
- UI 装载：本地静态服务
- 宿主桥接：`/__napp/*`
- WASI HTTP 业务 API：`/api/*`
- 权限词汇：`documentAccess`、`allowedDomains`、`storage`、`capabilities`
- 当前 Wasm 执行底座：Node 原生 `WebAssembly` 与 Wasmtime `serve`
- 分发包形态：`.napp`（底层为 zip）
- 安装目录：`~/.nextclaw/apps/packages/<app-id>/<version>/`
- 用户数据目录：`~/.nextclaw/apps/data/<app-id>/`
- 本地 registry：`~/.nextclaw/apps/registry.json`
- 本地 config：`~/.nextclaw/apps/config.json`
- 默认 registry：`https://apps-registry.nextclaw.io/api/v1/apps/registry/`

## 当前 MVP 工作流

开发者工作流：

```bash
napp doctor
napp create ./my-first-napp --template ts-http
napp build ./my-first-napp --install
napp inspect ./my-first-napp
napp run ./my-first-napp --data ./my-first-napp/.napp/data
napp pack ./my-first-napp
napp publish ./my-first-napp
```

本地安装工作流：

```bash
napp install ./my-first-napp
napp list
napp info nextclaw.my-first-napp
napp run nextclaw.my-first-napp
```

registry 安装与更新工作流：

```bash
napp registry set https://registry.example.com/
napp install nextclaw.hello-notes
napp permissions nextclaw.hello-notes
napp grant nextclaw.hello-notes --document notes=/absolute/path/to/notes
napp run nextclaw.hello-notes
napp update nextclaw.hello-notes
```

卸载与权限回收：

```bash
napp revoke nextclaw.my-first-napp --document notes
napp uninstall nextclaw.my-first-napp
napp uninstall nextclaw.my-first-napp --purge-data
```

## 示例

```bash
napp create ./my-first-napp
napp inspect ./my-first-napp
napp pack ./my-first-napp
napp install ./my-first-napp
napp list
napp info nextclaw.my-first-napp
napp permissions nextclaw.my-first-napp
napp run nextclaw.my-first-napp
```

已有示例应用：

```bash
napp inspect ./apps/examples/hello-notes
napp pack ./apps/examples/hello-notes
napp publish ./apps/examples/hello-notes
napp install ./apps/examples/hello-notes
napp grant nextclaw.hello-notes --document notes=/absolute/path/to/notes
napp run ./apps/examples/hello-notes --document notes=/absolute/path/to/notes
```

registry 示例：

```bash
napp registry get
napp registry set https://registry.example.com/
napp install nextclaw.hello-notes
napp update nextclaw.hello-notes
```

官方 apps 入口：

- Web：`https://apps.nextclaw.io`
- Registry/API：`https://apps-registry.nextclaw.io`

## Bundle 结构

`.napp` bundle 的最小结构如下：

```text
manifest.json
main/
ui/
assets/
.napp/
  bundle.json
  checksums.json
```

## Registry Metadata 结构

registry 按 npm 风格使用一个 base URL，再按 app id 拉取 metadata 文档。metadata 的最小结构如下：

```json
{
  "name": "nextclaw.hello-notes",
  "description": "Registry-hosted Hello Notes",
  "dist-tags": {
    "latest": "0.2.0"
  },
  "versions": {
    "0.2.0": {
      "name": "nextclaw.hello-notes",
      "version": "0.2.0",
      "publisher": {
        "id": "nextclaw",
        "name": "NextClaw Official"
      },
      "dist": {
        "bundle": "./-/hello-notes-0.2.0.napp",
        "sha256": "<sha256>"
      }
    }
  }
}
```
