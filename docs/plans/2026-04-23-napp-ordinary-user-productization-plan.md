# NApp 普通用户产品化方案计划

## 背景

当前 NApp 的 TS/Hono WASI HTTP 技术链路已经跑通：`napp create --template ts-http` 可以生成 Todo 应用，`main/` 可以编译出 `app.wasm`，`napp run --data <path>` 可以启动 Wasmtime 沙箱后端，前端可以通过普通 `fetch("/api/todos")` 调后端并把数据写入运行时指定目录。

但这还不是普通 NextClaw 用户可自然使用的产品体验。普通用户不应该理解 Wasmtime、WASI、JCO、wkg、npm、registry URL 或 `--data` 的细节。用户只应该表达目标：创建自己的小应用、发布到应用商店、安装并运行应用商店里的应用。

## 验收标准

本阶段的验收标准不是“底层命令能跑”，而是 AI 使用 `nextclaw-app-runtime` skill 后，普通用户可以不懂底层原理地完成三件事：

1. 开发自己的小应用：用户说“帮我做一个 Todo/记账/清单小应用”，AI 能创建 NApp 目录、安装模板依赖、构建 WASM 后端、运行本地预览，并给用户一个可打开的本地链接。
2. 分发到应用商店：用户说“发布这个应用”，AI 能先检查应用、构建、打包、使用 NextClaw 登录态发布到 Apps marketplace，并返回详情页与安装命令。
3. 安装和运行商店应用：用户说“安装并运行某个应用”，AI 能通过官方 registry 安装应用，使用安装态私有数据目录运行应用，并给用户一个可打开的本地链接。

## 推荐方案

保留现有架构，不引入新应用中心：

- `@nextclaw/app-runtime` 继续作为执行层，负责 create/build/inspect/pack/publish/install/run。
- `skills/nextclaw-app-runtime` 作为普通用户入口，负责把用户意图翻译成确定性工作流、检查环境、自动执行命令、解释失败。
- Apps marketplace API 和 `apps.nextclaw.io` 继续作为分发层，不新增第二套商店协议。
- NextClaw 主产品后续可以把这些命令包成 UI，但本阶段先把 skill + CLI 的可靠闭环做完整。

## 本次最小实现

为了让 skill 不再要求用户理解依赖，本次补齐：

- `napp doctor`：检查 `npm`、`wasmtime`、`wkg`，输出缺失项和安装建议。
- `napp build <app-dir> --install`：自动进入 `main/` 执行 `npm install` 和 `npm run build`，普通用户不需要知道模板内部构建命令。
- `napp create --template ts-http` 的 skill 流程升级为“创建后立即 build/inspect/run”，而不是只生成目录。
- `skills/nextclaw-app-runtime` 更新为普通用户端到端工作流：开发、发布、安装运行、排障。
- 文档记录当前真实边界：本阶段自动化的是开发体验和运行体验，不自动代替用户登录平台，也不绕过发布权限。

## 用户工作流

### 开发自己的小应用

用户只需要说：

> 帮我做一个 Todo 小应用。

AI 执行：

```bash
napp doctor --json
napp create ./todo-app --template ts-http
napp build ./todo-app --install
napp inspect ./todo-app --json
napp run ./todo-app --data ./todo-app/.napp/data --port 0 --json
```

AI 返回本地预览链接，并说明数据文件位置。

### 分发到应用商店

用户只需要说：

> 把这个应用发布到应用商店。

AI 执行：

```bash
napp build ./todo-app --install
napp inspect ./todo-app --json
napp publish ./todo-app
```

如果没有 NextClaw 登录态，AI 明确提示用户先 `nextclaw login`，而不是让发布失败变成难懂的 token 错误。

### 安装并运行商店应用

用户只需要说：

> 安装并运行 nextclaw.todo。

AI 执行：

```bash
napp install nextclaw.todo
napp run nextclaw.todo --port 0 --json
```

安装态应用自动使用 `~/.nextclaw/apps/data/<app-id>`，普通用户不需要传 `--data`。

## 非目标

- 不在本阶段重做桌面 UI 应用中心。
- 不自动绕过平台登录、发布审核或 marketplace 权限。
- 不把 skill 伪装成 runtime；skill 只负责编排和排障，真正执行仍由 `@nextclaw/app-runtime` 完成。
- 不扩展到通用 Docker 功能；`--mount`、`--publish` 仍是后续迭代。
- 不隐藏运行失败；缺少本机工具时必须清楚说明缺什么、怎么补。

## 后续方向

1. 桌面端增加 Apps 管理页：创建、安装、运行、停止、查看日志。
2. `napp run --open` 或桌面内嵌打开应用链接。
3. `napp use <app-id>` 合并安装与运行。
4. 将 Wasmtime/wkg 作为桌面发行包内置依赖，进一步减少系统环境差异。
5. 增加 `--mount` 和 `--publish`，继续向 Docker-like 心智靠近。
