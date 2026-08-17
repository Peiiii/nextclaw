---
name: nextclaw-app-publisher
description: Validate, package, and submit schema v2 NextClaw Mini Apps made from Panel Apps, Service Apps, or both. Use when the user asks to publish, submit, list, or share their app in the App Marketplace, including login, personal scope, marketplace metadata, and review-status handling. Do not use for legacy schema v1 WASI NApps.
description_zh: 使用 NextClaw 原生命令校验、组装并提交由 Panel App、Service App 或二者组合而成的 schema v2 Mini App。用户说“发布这个应用”“提交到应用市场”“分享我的 Panel/Service App”“上架 Mini App”，或需要处理登录、个人 scope、marketplace.json、审核状态时使用；不适用于 legacy schema v1 WASI NApp。
---

# 发布 NextClaw Mini App

把用户已经开发好的 Panel App、Service App 或组合应用提交到 NextClaw 应用市场。对外只使用 `nextclaw app ...`；不要要求用户安装、理解或调用 `napp`，也不要暴露 registry URL、token、bundle mode 等底层参数。

## 边界

- 只处理 root `manifest.json` 为 `schemaVersion: 2` 的 Mini App 包。
- 创建或修改组件本身时先读取 `nextclaw-app-creator` 及其路由的 Panel/Service 专项 skill；本 skill 只拥有组包、发布前校验、登录和提交流程。
- 只有用户明确要求“发布 / 提交 / 上架”时才执行 `nextclaw app publish`。仅询问方案、检查应用或准备发布时停在 `validate-publish`。
- 当前 schema v2 Service component 会在用户机器上启动本地进程并继承宿主环境，根 manifest 必须如实声明 `runtime.profile: native-process`；不要把它改成 `wasi`，因为当前没有 schema v2 WASI Service 执行合同。
- 社区 Service App 可以提交公开上架，但必须进入高权限人工审核；管理员可审核为 `listed` 或 `unlisted`。不要承诺自动通过，也不要把人工审核说成平台不支持发布。
- 不在 `~/.nextclaw/apps` 中创建开发源码。需要组包时写入当前 NextClaw workspace 的 `app-packages/<username>.<app-name>/`。
- 原生 App 可只支持一个 target，也可支持多个 targets；root `distribution.targets` 是支持范围的唯一声明，`--artifacts` 目录中的 `<target-key>.napp` 必须与之精确一致。

## 上架资格门

在组包和发布前先按真实组件确定资格，声明必须与执行方式一致：

| 包形态 | schema v2 runtime | 社区审核结果 | 可以进入公开目录 |
| --- | --- | --- | --- |
| 仅 Panel component | `panel-only` | 通过并公开，或通过但不公开 | 是 |
| 任意 Service component | `native-process` | 高权限人工审核，可通过并公开或通过但不公开 | 审核通过后可以 |
| Service component + `wasi` 标签 | 非法组合 | 校验失败 | 否 |

只有 manifest、组件格式和宿主运行时都实现 WASI，才能把应用称为 WASI。当前 schema v2 Service 使用 `service-app.json` 的 `command/args` 启动宿主进程，因此仅修改 `runtime.profile` 属于错误安全声明，必须停止并修正。

如果用户明确要求公开上架，而核心功能依赖 Service component，如实保留 `native-process`、权限和组件声明，说明它会进入高权限人工审核并准备源码、权限用途和网络目标等证据；不要为了降低审核等级删除 Service 或伪造 WASI。

## 发布流程

1. 运行账户检查：

   ```bash
   nextclaw account status --json
   ```

   如果未登录，运行 `nextclaw login` 并让用户完成浏览器登录；如果缺少 username，引导用户在平台账号页设置，或由用户明确给出名称后运行 `nextclaw account set-username <username>`。不要索取或拼接原始 token。

2. 找到 Mini App 包根目录。有效包至少包含：

   - `manifest.json`：`schemaVersion` 为 `2`，`id` 使用 `<username>.<app-name>`，`components` 引用真实 Panel/Service 目录；仅 Panel 时声明 `panel-only`，含 Service 时声明 `native-process`。
   - `marketplace.json`：至少包含 `slug`、`summary`、`summaryI18n`、`author` 和非空 `tags`。
   - 所有组件目录、图标和 marketplace 图片都位于包根目录内。

   如果用户只有散落的 Panel/Service 目录，创建 `app-packages/<username>.<app-name>/`，复制组件源码并生成 root `manifest.json`、`marketplace.json`。保留原开发目录，不要把多个组件直接塞入任一组件目录。

3. 校验每个组件：

   ```bash
   nextclaw app check <panel-or-service-dir> --json
   nextclaw app dev <service-app-dir> --json
   ```

   每个 Panel App 和 Service App 都要运行 `check`。Service App 额外运行 `dev` 核对真实 runtime 与 action 列表；存在无需敏感输入且无副作用的 read action 时，用 `nextclaw app call` 抽测一个。除非用户已授权，不调用会写文件、运行命令或访问外部服务的 action。

4. 校验完整发布包：

   ```bash
   nextclaw app validate-publish <mini-app-dir> [--artifacts <dir>] --json
   ```

   修复所有 error。`schema v2 Service components do not support a WASI runtime yet` 表示声明和真实执行方式冲突，必须恢复为 `native-process`，不能用 `--allow-warnings` 或删除权限声明绕过。出现其它 warning 时先用普通语言说明影响；只有用户确认后才在发布命令中加入 `--allow-warnings`。

5. 用户已明确授权发布且校验通过后提交：

   ```bash
   nextclaw app publish <mini-app-dir> [--artifacts <dir>] --json
   ```

   不传 `--token`、API base、registry 或分发 mode；这些由 NextClaw 登录态和内置发布链路负责。

## 结果说明

- `publishStatus: pending`：明确告诉用户“已提交审核，尚未出现在应用市场”，并提供 `https://platform.nextclaw.io/apps` 管理入口。不要返回安装命令或把公开详情页说成已经可访问。
- `publishStatus: published` 且 `catalogVisibility: listed`：说明已经审核通过并进入公开目录，返回命令结果中的公开详情页。
- `publishStatus: published` 且 `catalogVisibility: unlisted`：说明已经审核通过，可按 App ID 安装，但不会出现在公开目录或搜索结果中；不要把它说成“已公开上架”。
- `rejected` 后可以修复并重新提交；`pending` 时也可以重新提交同一应用。
- 已发布的个人应用当前不能直接覆盖更新。若服务端拒绝更新，说明现有线上版本仍保持可用，等待后续版本级审核能力；不要改 app id 绕过保护。

## 完成条件

- 发布前的组件检查和整包校验都有真实成功输出。
- 远端提交只发生在用户明确要求后。
- 最终准确区分“本地校验通过”“已提交审核”和“已公开发布”。
- 最终准确区分 `listed` 与 `unlisted`，并确认运行时声明没有把 native process 伪装成 WASI。
- 用户全程只需要理解 NextClaw、自己的应用和审核状态。
