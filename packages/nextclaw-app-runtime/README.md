# NextClaw App Runtime

`@nextclaw/app-runtime` 是一个独立的微应用 runtime/CLI 包。

当前第二阶段提供下面这些能力：

- `napp create <app-dir>`：生成一个最小可跑的微应用骨架
- `napp inspect <app-dir>`：校验应用目录与 manifest
- `napp run <app-dir|app-id>`：启动本地宿主，支持目录运行和已安装应用运行
- `napp dev <app-dir>`：当前等价于 `run`
- `napp pack <app-dir>`：把应用目录打成 `.napp` bundle
- `napp install <app-dir|bundle.napp>`：安装应用到本地统一 app 目录
- `napp uninstall <app-id>`：卸载已安装应用
- `napp list`：列出已安装应用
- `napp info <app-id>`：查看已安装应用详情

## 安装

```bash
npm install -g @nextclaw/app-runtime
```

安装后可用：

```bash
napp --help
napp --version
```

第一版先聚焦“独立可运行的微应用宿主 + 本地打包安装闭环”，不接入现有 NextClaw 主产品路由、服务或 app marketplace 后端。

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
- 分发包形态：`.napp`（底层为 zip）
- 安装目录：`~/.nextclaw/apps/packages/<app-id>/<version>/`
- 用户数据目录：`~/.nextclaw/apps/data/<app-id>/`
- 本地 registry：`~/.nextclaw/apps/registry.json`

## 第二阶段工作流

开发者工作流：

```bash
napp create ./my-first-napp
napp inspect ./my-first-napp
napp pack ./my-first-napp
```

用户安装工作流：

```bash
napp install ./my-first-napp
napp list
napp info nextclaw.my-first-napp
napp run nextclaw.my-first-napp
```

卸载：

```bash
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
napp run nextclaw.my-first-napp
```

已有示例应用：

```bash
napp inspect ./apps/examples/hello-notes
napp pack ./apps/examples/hello-notes
napp install ./apps/examples/hello-notes
napp run ./apps/examples/hello-notes --document notes=/absolute/path/to/notes
```

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
