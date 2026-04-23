# v0.16.93-napp-wasi-component-ts-template

## 迭代完成说明

本次迭代把 NApp 从固定 `__napp/run` action bridge 扩展到最小可运行的 WASI HTTP component 全栈应用模型，并保持现有 `manifest.json + main/ + ui/ + assets/` 目录合同不变。

根因状态：

- 根因是什么：旧 NApp main 只有固定 Wasm export/action demo，没有 WASI HTTP 后端运行器、没有 `/api/*` 同源代理、没有运行时指定数据目录挂载，所以无法实现“前端普通 fetch 后端，后端持久化 Todo 数据”的基础全栈应用。
- 如何确认：代码路径上 `manifest.main.kind` 只支持 `wasm` action；`AppHostService` 只服务 `__napp/*` 和 UI；`RunCommand` 没有启动 WASI HTTP component；模板也没有 TS/Hono 后端构建链路。
- 为什么命中根因：本次补齐了 manifest contract、TS/Hono scaffold、Wasmtime `serve` runner、`/api/*` proxy、`--data` 到 guest `/data` 的挂载，并用真实 Todo HTTP 请求验证数据落盘。
- 后续补充根因：Apps marketplace 的 app publish 协议仍只接受旧的 `main.kind="wasm"` + `export/action` manifest，导致新的 `wasi-http-component` 应用在上架时会被直接拒绝；同时 `.napp` 打包原先会递归收集整个 `main/` 目录，把 `node_modules` 等构建期文件一并带入 bundle，放大上传体积与用户困惑。

核心改动：

- 新增方案计划文档：[NApp WASI Component TS HTTP 方案计划](../../plans/2026-04-23-napp-wasi-component-ts-http-plan.md)
- 新增普通用户产品化方案：[NApp 普通用户产品化方案计划](../../plans/2026-04-23-napp-ordinary-user-productization-plan.md)
- 新增分阶段优化方案：[NApp 分阶段优化执行方案](../../plans/2026-04-23-napp-phase-optimization-plan.md)
- 新增轻量 source 分发方案：[NApp Source Distribution 方案计划](../../plans/2026-04-24-napp-source-distribution-plan.md)
- 新增目标锚点：[goal-progress.md](work/goal-progress.md)
- `manifest.main.kind` 新增 `wasi-http-component`，`inspect` 可展示 `mainKind`
- `napp create` 新增显式模板参数：`--template starter|ts-http|ts-http-lite`
- 新增 `ts-http` 模板，生成 TypeScript/Hono 后端、WIT world、JCO/ComponentizeJS 构建脚本、普通 `fetch("/api/todos")` 前端和 Todo List 示例
- 新增 `ts-http-lite` 模板，继续使用官方 `jco-std` WASI HTTP adapter，但不走默认 Hono 路由层，提供体积优先路径
- 新增 `napp doctor`，普通用户/skill 可以先检查 NApp 开发运行环境是否就绪
- 新增 `napp build <app-dir> --install`，自动安装模板依赖并构建 TS/WASI HTTP 后端
- 修复 apps marketplace 发布协议，使其支持 `wasi-http-component` manifest，不再要求旧 `wasm action` 字段
- 收紧 `.napp` 打包范围，只包含 `manifest.json`、`main.entry`、`ui/`、`assets/` 与 icon，不再把 `main/node_modules`、源码和 lockfile 打进发行包
- 新增 `napp validate-publish <app-dir>`，本地统一做发布前检查，并输出 bundle 文件列表与体积 warning
- 新增 `.napp` 双模式分发合同：`distributionMode=source|bundle`
- `napp pack` / `napp publish` / `napp validate-publish` 默认切到 `source`；显式 `--mode bundle` 保留预构建发布
- `source` 模式下 `.napp` 默认只携带用户源码/配置/UI/assets，安装时再本地物化成现有运行态目录，不改变 `manifest.json + main/ + ui/ + assets/` 运行合同
- marketplace app registry 文档新增 `dist.kind`，worker 版本记录新增 `distribution_mode` 落库与下载响应头回显
- `napp run/dev` 新增 `--data <path>`，用于把 host 数据目录挂载到 WASI guest `/data`
- 新增 Wasmtime WASI HTTP component runner，启动 `wasmtime serve` 并启用 WASI CLI/HTTP/network 能力
- NApp host 把 `/api/*` 代理给 WASM 后端，其它路径继续服务 UI 和 `__napp/*`
- 保留默认 `starter` 行为不变，避免影响当前 demo
- 更新 `skills/nextclaw-app-runtime`，把它从旧的 napp 说明升级为普通用户端到端 workflow：创建、构建预览、发布、安装运行、排障
- 进一步收口 `skills/nextclaw-app-runtime`：创建时显式推荐 `ts-http` / `ts-http-lite`，发布前强制先走 `napp validate-publish`，并把失败提示改成普通用户语言

## 测试/验证/验收方式

已执行：

- `pnpm -C packages/nextclaw-app-runtime tsc`
- `pnpm -C packages/nextclaw-app-runtime test`
- `pnpm -C packages/nextclaw-app-runtime lint`
- `pnpm -C packages/nextclaw-app-runtime build`
- `node packages/nextclaw-app-runtime/dist/main.js create "$tmpdir/lite-app" --template ts-http-lite --json`
- `node packages/nextclaw-app-runtime/dist/main.js build "$lite_appdir" --install --json`
- `node packages/nextclaw-app-runtime/dist/main.js pack "$lite_appdir" --out "$lite_bundle" --json`
- `node packages/nextclaw-app-runtime/dist/main.js create "$tmpdir/todo-app" --template ts-http --json`
- `node packages/nextclaw-app-runtime/dist/main.js doctor --json`
- `node packages/nextclaw-app-runtime/dist/main.js build "$appdir" --install --json`
- `node packages/nextclaw-app-runtime/dist/main.js run "$appdir" --port 0 --data "$datadir" --json`
- `curl "$url/api/todos"`
- `curl -X POST "$url/api/todos" -H 'content-type: application/json' --data '{"title":"Buy milk"}'`
- 检查 `$datadir/todos.json`
- `node packages/nextclaw-app-runtime/dist/main.js pack "$appdir" --out "$bundle" --json`
- `NEXTCLAW_APP_HOME="$apphome" node packages/nextclaw-app-runtime/dist/main.js install "$bundle" --json`
- `NEXTCLAW_APP_HOME="$apphome" node packages/nextclaw-app-runtime/dist/main.js run nextclaw.user-todo --port 0 --json`
- `python3 .agents/skills/marketplace-skill-publisher/scripts/validate_marketplace_skill.py --skill-dir skills/nextclaw-app-runtime`
- `npm view @nextclaw/app-runtime version`
- `pnpm publish --access public --no-git-checks`（在 `packages/nextclaw-app-runtime` 下执行）
- `node packages/nextclaw/dist/cli/app/index.js skills update skills/nextclaw-app-runtime --meta skills/nextclaw-app-runtime/marketplace.json --api-base https://marketplace-api.nextclaw.io`
- `python3 .agents/skills/marketplace-skill-publisher/scripts/validate_marketplace_skill.py --skill-dir skills/nextclaw-app-runtime`（phase 3 收口后复跑）
- `node packages/nextclaw/dist/cli/app/index.js skills update skills/nextclaw-app-runtime --meta skills/nextclaw-app-runtime/marketplace.json --api-base https://marketplace-api.nextclaw.io`（phase 3 收口后复发）
- `curl -sS https://marketplace-api.nextclaw.io/api/v1/skills/items/nextclaw-app-runtime`
- `node packages/nextclaw/dist/cli/app/index.js skills install nextclaw-app-runtime --api-base https://marketplace-api.nextclaw.io --workdir "$tmp_dir"`
- `pnpm -C workers/marketplace-api tsc`
- `node packages/nextclaw-app-runtime/dist/main.js validate-publish "$appdir" --json`
- `node packages/nextclaw-app-runtime/dist/main.js pack "$appdir" --out "$bundle" --json`
- `unzip -l "$bundle"`
- `node packages/nextclaw-app-runtime/dist/main.js validate-publish "$appdir" --mode source --json`
- `node packages/nextclaw-app-runtime/dist/main.js pack "$appdir" --mode source --out "$bundle" --json`
- `NEXTCLAW_APP_HOME="$apphome" node packages/nextclaw-app-runtime/dist/main.js install "$bundle" --json`
- `NEXTCLAW_APP_HOME="$apphome" node packages/nextclaw-app-runtime/dist/main.js run nextclaw.todo-app --port 0`
- `curl "$url/api/todos"`
- `pnpm lint:maintainability:guard`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths <本次触达 app-runtime 文件>`
- `node scripts/governance/lint-new-code-governance.mjs -- <本次触达 app-runtime 文件>`
- `pnpm check:governance-backlog-ratchet`
- `pnpm -C workers/marketplace-api db:migrate:skills:remote`
- `pnpm -C workers/marketplace-api run deploy`

关键结果：

- 包级全量单测通过：11 个测试文件，17 条测试
- 包级 lint / tsc / build 通过
- 生成模板的 `npm run build` 成功产出 `main/app.wasm`
- `napp doctor --json` 能识别 `npm`、`wasmtime`、`wkg` 并返回机器可读结果
- `napp build <app-dir> --install --json` 成功自动安装依赖并构建 `main/app.wasm`
- 真实端到端冒烟通过：`GET /api/todos` 初始返回 `[]`
- 真实端到端冒烟通过：`POST /api/todos` 返回包含 `Buy milk` 的 Todo
- 真实端到端冒烟通过：数据写入 `--data` 指定目录下的 `todos.json`
- 安装态冒烟通过：本地 `.napp` bundle 可安装到隔离 `NEXTCLAW_APP_HOME`，再通过 app id 运行，并自动使用安装态私有数据目录
- UI 首页可从同一个 NApp host 访问
- `skills/nextclaw-app-runtime` marketplace 校验通过：0 error、0 warning
- `@nextclaw/app-runtime@0.5.0` 已发布到 npm latest
- `@nextclaw/app-runtime@0.6.0` 已发布到 npm latest
- `@nextclaw/app-runtime@0.7.0` 已发布到 npm latest
- `skills/nextclaw-app-runtime` 已更新到 NextClaw marketplace，远端 metadata 与安装文件校验通过
- `skills/nextclaw-app-runtime` 已按 phase 3 新工作流再次更新到 NextClaw marketplace
- marketplace skill 安装冒烟通过：非仓库临时目录可安装出 `SKILL.md` 与 `marketplace.json`
- marketplace worker 类型检查通过，`wasi-http-component` app manifest 能通过新的发布协议编译约束
- 真实 ts-http 打包 smoke 显示：构建后的 `main/app.wasm` 约 13.3 MB，但最终 `.napp` 约 4.2 MB，archive 内只有 7 个运行时文件，不再包含 `main/node_modules`
- 真实模板对比显示：`ts-http-lite` 可正常 `create -> build -> pack`，并把 `main/app.wasm` 从约 `13.34 MB` 降到约 `13.25 MB`，`.napp` 从约 `4.43 MB` 降到约 `4.36 MB`
- `napp validate-publish` 真实冒烟通过：可输出 `mainEntrySizeBytes`、`bundleSizeBytes`、`bundleFilePaths`，并在当前模板上给出 `main-entry-large` warning
- 默认 `source` 真实冒烟通过：`validate-publish -> pack -> install -> run -> GET /api/todos` 全链路打通
- 真实 `source` 包校验结果：`distributionMode=source`，构建后的 `main/app.wasm` 约 `12.7 MB`，但默认 `.napp` 约 `44.7 KB`
- 真实安装态校验结果：安装记录写入 `distributionMode=source`，安装时本地物化，再通过 app id 正常启动并返回 `[]`
- `wkg wit fetch` 在当前环境出现 OCI token warning，但不阻塞构建
- `jco componentize` 出现 componentize-js 0.19.3 fallback warning，原因是当前 WIT 使用 WASI Preview 2 旧于 0.2.10 的包；不阻塞本次验收，后续可升级 WIT 版本处理
- Scoped 治理检查有效覆盖 21 个本次触达文件，0 error
- 仓库级 `pnpm lint:maintainability:guard` 被本次范围外的 `packages/nextclaw/src/cli/shared/services/gateway/...` 既有脏文件阻塞；本次未修改该无关路径
- 可维护性 guard 有 2 个 warning：`packages/nextclaw-app-runtime/src/commands` 为历史超预算目录；新增模板文件 517 行，接近 600 行预算

## 发布/部署方式

已执行发布：

- NPM：`@nextclaw/app-runtime@0.5.0`、`@nextclaw/app-runtime@0.6.0`、`@nextclaw/app-runtime@0.7.0`
- NextClaw marketplace skill：`nextclaw-app-runtime`
- Marketplace API worker：已执行远端 D1 migration `0009_marketplace_app_distribution_mode_20260424.sql` 并部署到 `marketplace-api.nextclaw.io` / `apps-registry.nextclaw.io`

本地体验方式：

```bash
pnpm -C packages/nextclaw-app-runtime build
node packages/nextclaw-app-runtime/dist/main.js create /tmp/todo-app --template ts-http
node packages/nextclaw-app-runtime/dist/main.js doctor
node packages/nextclaw-app-runtime/dist/main.js build /tmp/todo-app --install
node packages/nextclaw-app-runtime/dist/main.js run /tmp/todo-app --data /tmp/todo-app/.napp/data
```

## 用户/产品视角的验收步骤

1. 用户运行 `napp create ./todo-app --template ts-http`；若更看重包体，可改用 `--template ts-http-lite`
2. 用户看到目录仍是 `manifest.json + main/ + ui/ + assets/`
3. AI/skill 执行 `napp doctor --json`，确认本机运行环境就绪
4. AI/skill 执行 `napp build ./todo-app --install`，产出 `main/app.wasm`
5. 用户运行或由 AI/skill 运行 `napp run ./todo-app --data ./todo-app/.napp/data --port 0 --json`
6. 用户打开应用 UI，前端通过普通 `fetch("/api/todos")` 调后端
7. 用户新增 Todo 后，后端在 WASI 沙箱内写 guest `/data/todos.json`
8. 用户在宿主机看到实际数据文件位于 `./todo-app/.napp/data/todos.json`
9. 用户要分发时，AI/skill 执行 `napp build --install`、`napp inspect --json`、`napp validate-publish --mode source --json`、`napp publish --mode source`
10. 用户要安装商店应用时，AI/skill 执行 `napp install <app-id>`、`napp run <app-id> --port 0 --json`

## 可维护性总结汇总

可维护性复核结论：通过

本次顺手减债：是

代码增减报告：

- 新增：504 行
- 删除：47 行
- 净增：+457 行

非测试代码增减报告：

- 新增：312 行
- 删除：44 行
- 净增：+268 行

长期目标对齐 / 可维护性推进：

- 本次顺着“统一入口 + 能力编排 + 生态扩展”的长期方向推进了一步，把 NApp 从 action demo 变成可承载普通全栈应用的轻量运行容器。
- 这次是新增用户能力，因此非测试代码净增为正是必要的；增长集中在分发合同、安装物化、registry 协议和 worker 持久化，没有把平台扩展成远端构建系统。
- 主路径保持显式：只有 `main.kind=wasi-http-component` 才启动 Wasmtime runner，缺少 `--data` 直接失败，不做隐藏 fallback 或环境猜测。
- 普通用户入口由现有 `nextclaw-app-runtime` skill 承接，skill 负责工作流和排障，runtime 负责执行，避免把 AI 指令和执行逻辑混在一起。

独立可维护性复核：

- no maintainability findings
- 当前保留三个 watchpoint：`packages/nextclaw-app-runtime/src/commands` 是历史超预算目录；`workers/marketplace-api/src/infrastructure/apps/marketplace-app-record.repository.ts` 接近 400 行预算；`ts-http-lite` 当前只带来小幅体积下降，后续若继续追求数量级缩减，应优先研究 componentize/JCO 产物而不是继续替换上层路由
- phase 3 的 skill 收口刻意只改用户路径文案与执行顺序，没有再改 runtime 协议、模板合同或本地运行链路，避免体验层与底层机制继续耦合
- `pnpm lint:maintainability:guard` 与 `pnpm lint:new-code:governance` 均通过；`pnpm check:governance-backlog-ratchet` 因仓库范围外的既有文档 `docs/logs/v0.16.96-unified-release-0-18-4/GITHUB_RELEASE.md` 仍是 tracked legacy violation 而失败，本次未触碰该无关路径

## NPM 包发布记录

本次涉及 NPM 包：`@nextclaw/app-runtime`

- 本次是否需要发包：需要，因为 `napp create`、`napp run/dev` 命令面、manifest 类型和运行链路都发生变化
- 当前是否已发布：phase 1 已发布 `@nextclaw/app-runtime@0.5.0`；phase 2 已发布 `@nextclaw/app-runtime@0.6.0`；本次 source-first 双模式分发已发布 `@nextclaw/app-runtime@0.7.0`
- marketplace skill：已更新 `nextclaw-app-runtime`，并在 phase 3 收口后再次更新
- 后续状态：不需要待统一发布
- 触发条件：无
