---
name: nextclaw-app-publisher
description: Validate, package, and submit schema v2 NextClaw Mini Apps with Panel-only, Service-only, or Panel + Service composition, supporting Portable WASI and native-process Service runtimes. Use when the user asks to publish, submit, list, or share an App in the Marketplace, including account readiness, universal or targeted artifacts, metadata, and review-status handling.
description_zh: 校验、打包并提交纯 Panel、纯 Service 或 Panel + Service 组成的 schema v2 NextClaw Mini App，并支持 Portable WASI 与 native-process 两种 Service runtime。适用于用户要求发布、提交、上架或分享应用，以及处理账户就绪、通用或定向制品、元数据和审核状态。
---

# 发布 NextClaw Mini App

把已经完成开发和验证的 schema v2 Mini App 提交到 NextClaw Marketplace。对外只使用 `nextclaw app ...`；不要要求用户安装或调用 `napp`，也不要暴露 registry URL、token 或内部 bundle mode。

## 边界

- 本 skill 只拥有组包、发布前校验、账户就绪和提交流程。
- 创建或修改 Panel/Service 时读取 `nextclaw-app-creator` 及其路由的专项 skill。
- 只有用户明确要求“发布、提交、上架”时才执行 `nextclaw app publish`；检查或准备发布停在 `validate-publish`。
- 只处理 root `manifest.json` 为 `schemaVersion: 2` 的 Mini App 包；legacy schema v1 NApp 不进入本流程。
- 不在 `~/.nextclaw/apps` 中创建开发源码；该目录属于已安装包和实例数据 owner。

## 先确认组件组成，再确认 Service runtime 与 distribution

先独立判断包的组件组成：

- Panel-only：只有 Panel components；
- Service-only：只有 Service components；
- Panel + Service：两类 components 同时存在。

只有后两种组成需要继续判断 Service runtime。Panel-only 与 Portable WASI、native-process 不是同一层的三个选项：前者描述组件组成，后两者只描述 Service 如何运行。

| Service runtime | 根 runtime profile | distribution | 发布边界 |
| --- | --- | --- | --- |
| 不适用（Panel-only） | `panel-only` | 通常 `universal` | 普通审核 |
| Portable Rust/WASI | `wasi` | 纯可移植资源使用 `universal` | 按声明能力审核 |
| native-process | `native-process` | 自包含时可通用；含平台原生资源时使用 `targeted` | 高权限人工审核 |

不要按“包里存在 Service”就推断为 native-process。判断以 `service-app.json` 为准：

- `protocol: "wasi-component"` + `component.entry` 对应 Portable WASI；
- `protocol: "mcp"` + `command/args` 对应 native-process。

不能只改 `runtime.profile` 来改变真实安全边界。WASI 包必须有合法 Component、匹配 WIT/manifest action 合同和宿主能力声明；native-process 包必须如实保留宿主进程、权限与外部依赖。

## Rust 与最终用户

- 应用作者在发布前构建 Rust/WASI Guest 时需要 Rust 工具链，并运行 `nextclaw app build/test`。
- 最终用户安装、启用和运行已构建的 Portable `.napp` 不需要 Rust、Cargo、Wasmtime 或系统 Node；NextClaw 提供 runner。
- 发布结果不能把开发工具链写成终端安装前置条件。

## 发布资格门

有效包至少包含：

- `manifest.json`：schema v2、稳定 app id/version、真实 runtime、distribution、permissions 与 component 引用；
- `marketplace.json`：`slug`、`summary`、`summaryI18n`、`author`、非空 tags 和真实展示信息；
- 根 manifest 引用的所有 Panel/Service 目录、图标和 Marketplace 图片；
- Portable Service 的已构建 `.wasm`、版本匹配 WIT 和 service smoke fixture；
- targeted App 声明的精确 target 集与对应自包含 artifacts。

如果用户只有散落的 loose Panel/native Service，先按 `nextclaw-app-creator` 的 package-root 合同组装到 workspace `app-packages/<username>.<app-name>/`。复制组件时保留原开发目录，根 manifest 成为发布包组件归属的事实源。

## 发布流程

### 1. 账户就绪

```bash
nextclaw account status --json
```

未登录时运行 `nextclaw login`，让用户完成浏览器登录。缺少 username 时，引导用户在平台账号页设置，或在用户明确给出后运行 `nextclaw account set-username <username>`。不要索取、拼接或回显原始 token。

个人 App id 使用账户 username scope，例如 `alice.notes`。

### 2. 组件与运行时验证

所有包先从完整包根运行：

```bash
nextclaw app check <app-dir> --json
```

含 Service 的包再运行 `dev`；Portable Service 还必须先运行 `build` 并执行 smoke fixture：

```bash
nextclaw app build <app-dir> --json
nextclaw app test <app-dir> --json
nextclaw app dev <app-dir> --json
```

native-process Service 不运行 Portable `build/test`，但必须运行 `dev` 验证真实 MCP discovery。Panel-only 包不运行 `dev`。

存在无需敏感输入且无副作用的 read action 时，用 `nextclaw app call` 抽测一个。除非用户已授权，不调用写文件、外部访问或危险 action。

### 3. 打包与整包校验

纯 Portable 或其它 universal App：

```bash
nextclaw app pack <app-dir> --out dist/<app-name>.napp --json
nextclaw app validate-publish <app-dir> --json
```

包含平台原生资源的 targeted App：

```bash
nextclaw app pack <app-dir> --target linux-x64-gnu --out dist/linux-x64-gnu.napp --json
nextclaw app pack <app-dir> --target darwin-arm64 --out dist/darwin-arm64.napp --json
nextclaw app validate-publish <app-dir> --artifacts dist --json
```

`distribution.targets` 与 `--artifacts` 中的 canonical target 文件必须精确一致。不要给 universal App 传原生 target，也不要给 targeted App 混入 `universal.napp`。

修复全部 error。Warning 先用普通语言解释影响；只有用户确认后才在发布命令加入 `--allow-warnings`。不得通过删除权限、伪造 runtime 或漏传 artifact 绕过校验。

### 4. 明确授权后提交

```bash
nextclaw app publish <app-dir> --json
```

targeted App 使用已经校验的 artifacts：

```bash
nextclaw app publish <app-dir> --artifacts dist --json
```

不传 token、API base、registry 或分发 mode；它们由 NextClaw 登录态与内置发布链路负责。

## 结果说明

- `publishStatus: pending`：已提交审核，尚未出现在 Marketplace；提供 `https://platform.nextclaw.io/apps` 管理入口。
- `publishStatus: published` + `catalogVisibility: listed`：已审核并进入公开目录，返回命令给出的公开详情页。
- `publishStatus: published` + `catalogVisibility: unlisted`：已审核，可按 App id 安装，但不会出现在公开目录或搜索中。
- `rejected`：保留线上已有版本，按反馈修复后重新提交。
- 已发布个人 App 当前不能直接覆盖更新时，不要更换 app id 绕过版本级审核保护。

社区 native-process Service 会进入高权限人工审核；Portable Service 也必须按实际文件、网络、secret、Provider 和 AI slot 请求接受审核。不要承诺自动通过。

## 完成条件

- creator 对应 runtime 的 build/check/test/dev/call 证据完整；
- `validate-publish` 对当前 package 与 artifact 集成功；
- 远端提交只在用户明确授权后发生；
- 最终准确区分本地验证、已提交审核、公开 listed 与 unlisted；
- runtime、distribution、权限和最终用户依赖描述都与真实制品一致。
