# v0.16.71-nextclaw-app-runtime-mvp

## 迭代完成说明

本次迭代落出了第一版独立的 `NextClaw App Runtime` 技术能力，不接入现有 `nextclaw-server`、`nextclaw-ui` 或 `nextclaw` 主产品链路，先把“一个可分发、可运行、前后端分层的小型微应用宿主”单独跑通。

本次新增的核心交付包括：

- 新建独立包 `packages/nextclaw-app-runtime`
- 新增短命令 CLI `napp`
- 支持 `napp create <app-dir>` 生成一个最小可跑的微应用骨架
- 支持 `napp inspect <app-dir>` 校验应用目录与 manifest
- 支持 `napp run <app-dir>` 启动本地宿主，提供 UI 静态服务和 `__napp` bridge
- 支持 `napp dev <app-dir>`，当前等价于 `run`
- 第二阶段补齐 `napp pack / install / uninstall / list / info`
- 支持 `.napp` bundle，内部包含 `.napp/bundle.json` 与 `.napp/checksums.json`
- 支持本地安装目录与数据目录分离
- 支持本地 app registry：`~/.nextclaw/apps/registry.json`
- 支持安装态运行：`napp run <app-id>`
- 继续补齐相对完善 MVP：`napp update / registry / permissions / grant / revoke`
- 支持默认 registry 与自定义 registry：`~/.nextclaw/apps/config.json`
- 支持 npm 风格 registry app spec：`napp install <app-id[@version]>`
- 支持 registry 安装时的 bundle `sha256` 校验与 publisher/source 元信息记录
- 支持已安装应用的显式权限管理与复用授权运行
- 支持最小权限模型：`documentAccess`、`allowedDomains`、`storage`、`capabilities.hostBridge`
- 新增示例应用 `apps/examples/hello-notes`
- `napp create` 生成的骨架内置最小 `manifest.json / main / ui / assets` 目录合同，并默认产出可直接运行的 starter app
- 通过 Wasm `main/app.wasm` 跑通“读取已授权目录 -> 汇总输入 -> 调 Wasm 导出 -> 返回 UI”这条完整链路
- 将新包纳入根级 `build / lint / tsc` 脚本，避免后续仓库级验证遗漏
- 补齐 `@nextclaw/app-runtime` 的对外发布元数据与 `napp --help / --version`
- 新增 marketplace skill：`skills/nextclaw-app-runtime`
- 已将 `@nextclaw/app-runtime` 发布到 npm
- 已将 `nextclaw-app-runtime` 以官方 skill `@nextclaw/nextclaw-app-runtime` 发布到 NextClaw marketplace
- 已旋转并持久化 `MARKETPLACE_ADMIN_TOKEN`，用于后续官方 skill 更新

本次实现刻意保持一条主路径：

1. 载入 app 目录
2. 校验 `manifest.json`
3. 解析用户通过 CLI 注入的目录授权
4. 启动本地宿主
5. UI 通过 bridge 调用主模块
6. 宿主读取授权目录并把聚合结果交给 Wasm

当前 Wasm 执行底座先使用 Node 原生 `WebAssembly`，并保留 `sidecar` 抽象位。这样做是为了优先验证应用形态、目录 contract、权限 contract 和桥接 contract，而不是在第一版就把实现复杂度压到 Wasmtime 进程管理上。

相关设计文档：

- [应用模型设计](../../../plans/2026-04-18-nextclaw-wasm-apps-model-design.md)
- [方案冻结稿](../../../plans/2026-04-18-nextclaw-wasm-apps-freeze.md)
- [最小实现计划](../../../plans/2026-04-18-nextclaw-wasm-apps-mvp-implementation-plan.md)
- [运行时结构设计](../../../plans/2026-04-18-nextclaw-app-runtime-structure-design.md)
- [分发与安装闭环设计稿](../../../plans/2026-04-19-nextclaw-app-distribution-closure-design.md)
- [第二阶段收尾冻结稿](../../../plans/2026-04-19-nextclaw-app-runtime-phase2-freeze.md)
- [相对完善 MVP 一次性收尾方案](../../../plans/2026-04-19-nextclaw-app-runtime-mvp-completion-design.md)

## 测试/验证/验收方式

本次实际执行的验证如下：

- `pnpm install`
- `python3 .agents/skills/marketplace-skill-publisher/scripts/validate_marketplace_skill.py --skill-dir skills/nextclaw-app-runtime`
- `pnpm -C packages/nextclaw-app-runtime test`
- `pnpm -C packages/nextclaw-app-runtime tsc`
- `pnpm -C packages/nextclaw-app-runtime lint`
- `pnpm -C packages/nextclaw-app-runtime build`
- `pnpm -C packages/nextclaw-app-runtime exec node dist/main.js pack ../../apps/examples/hello-notes --json`
- `tmpdir=$(mktemp -d) && node packages/nextclaw-app-runtime/dist/main.js create "$tmpdir/starter" --json && node packages/nextclaw-app-runtime/dist/main.js pack "$tmpdir/starter" --out "$tmpdir/starter.napp" --json && NEXTCLAW_APP_HOME="$tmpdir/home" node packages/nextclaw-app-runtime/dist/main.js install "$tmpdir/starter.napp" --json`
- `tmpdir=$(mktemp -d) && NEXTCLAW_APP_HOME="$tmpdir/home" node packages/nextclaw-app-runtime/dist/main.js list --json`
- `tmpdir=$(mktemp -d) && NEXTCLAW_APP_HOME="$tmpdir/home" node packages/nextclaw-app-runtime/dist/main.js info <app-id> --json`
- `tmpdir=$(mktemp -d) && NEXTCLAW_APP_HOME="$tmpdir/home" node packages/nextclaw-app-runtime/dist/main.js uninstall <app-id> --json`
- `tmpdir=$(mktemp -d) && NEXTCLAW_APP_HOME="$tmpdir/home" node packages/nextclaw-app-runtime/dist/main.js registry set http://127.0.0.1:<port>/ --json`
- `tmpdir=$(mktemp -d) && NEXTCLAW_APP_HOME="$tmpdir/home" node packages/nextclaw-app-runtime/dist/main.js install nextclaw.hello-notes --json`
- `tmpdir=$(mktemp -d) && NEXTCLAW_APP_HOME="$tmpdir/home" node packages/nextclaw-app-runtime/dist/main.js update nextclaw.hello-notes --json`
- `tmpdir=$(mktemp -d) && NEXTCLAW_APP_HOME="$tmpdir/home" node packages/nextclaw-app-runtime/dist/main.js permissions nextclaw.hello-notes --json`
- `tmpdir=$(mktemp -d) && NEXTCLAW_APP_HOME="$tmpdir/home" node packages/nextclaw-app-runtime/dist/main.js grant nextclaw.hello-notes --document notes=/absolute/path --json`
- `tmpdir=$(mktemp -d) && NEXTCLAW_APP_HOME="$tmpdir/home" node packages/nextclaw-app-runtime/dist/main.js revoke nextclaw.hello-notes --document notes --json`
- `tmpdir=$(mktemp -d) && node packages/nextclaw-app-runtime/dist/main.js create "$tmpdir/starter" --json`
- `tmpdir=$(mktemp -d) && node packages/nextclaw-app-runtime/dist/main.js create "$tmpdir/starter" --json && node packages/nextclaw-app-runtime/dist/main.js inspect "$tmpdir/starter" --json`
- `cd packages/nextclaw-app-runtime && node dist/main.js --help`
- `cd packages/nextclaw-app-runtime && node dist/main.js --version`
- `pnpm -C packages/nextclaw-app-runtime smoke`
- `pnpm -C packages/nextclaw-app-runtime exec node dist/main.js inspect ../../apps/examples/hello-notes --json`
- `cd packages/nextclaw-app-runtime && pnpm publish --access public --dry-run --no-git-checks`
- `pnpm publish --access public --no-git-checks`（分别在 `packages/nextclaw-app-runtime@0.1.0` 与 `@0.2.0` 下正式执行）
- `node packages/nextclaw/dist/cli/index.js account status`
- `node packages/nextclaw/dist/cli/index.js skills publish skills/nextclaw-app-runtime --meta skills/nextclaw-app-runtime/marketplace.json --scope nextclaw --api-base https://marketplace-api.nextclaw.io`
- `node packages/nextclaw/dist/cli/index.js skills update skills/nextclaw-app-runtime --meta skills/nextclaw-app-runtime/marketplace.json --scope nextclaw --token <local-admin-token> --api-base https://marketplace-api.nextclaw.io`
- `curl -sS https://marketplace-api.nextclaw.io/api/v1/skills/items/%40nextclaw%2Fnextclaw-app-runtime`
- `curl -sS https://marketplace-api.nextclaw.io/api/v1/skills/items/%40nextclaw%2Fnextclaw-app-runtime/files`
- `node packages/nextclaw/dist/cli/index.js skills install @nextclaw/nextclaw-app-runtime --api-base https://marketplace-api.nextclaw.io --workdir <tmp-dir>`
- `npm view @nextclaw/app-runtime version --json`
- `pnpm lint:new-code:governance`
- `pnpm lint:maintainability:guard`

关键观察点：

- `create` 能在空目录下生成可立即通过 `inspect` 与 `run` 的 starter app
- `inspect` 能正确解析 `hello-notes` manifest，并输出 `main/ui/permissions` 摘要
- `pack` 能生成 `.napp` bundle，并在 bundle 内写入 `.napp/bundle.json` 与 `.napp/checksums.json`
- `install` 能把 app 目录或 `.napp` bundle 安装到本地统一目录，并更新 `registry.json`
- `list / info / uninstall` 能围绕本地 registry 正常工作
- `run <app-id>` 能直接运行已安装应用，不再只支持目录路径
- `install <app-id>` 能通过 registry metadata 下载 bundle、校验 `sha256` 并完成安装
- `update <app-id>` 能识别并切换到 registry `latest`
- `registry set / get` 能稳定切换默认 registry，不依赖主产品配置
- `permissions / grant / revoke` 能把 requested permissions 与本地 grants 区分开，并显式管理目录授权
- `--help` 与 `--version` 能作为 skill 安装后的最小 readiness check
- `smoke` 能真实启动 `napp run`
- `smoke` 新增了一段真实的 `napp registry set -> napp install <app-id> -> napp permissions -> napp grant -> napp run <app-id> -> napp update -> napp revoke` 验证
- `smoke` 会在临时目录创建两份 notes，再通过 `POST /__napp/run` 调用 Wasm 主模块
- 结果中 `documentCount`、`textBytes`、`output.output` 与预期一致
- marketplace skill metadata 本地校验通过，`Errors: 0`，`Warnings: 0`
- npm dry-run 通过，正式发布后 `npm view @nextclaw/app-runtime version` 返回 `0.2.0`
- 官方 skill 远端详情返回 `200`，`packageName=@nextclaw/nextclaw-app-runtime`，`publishStatus=published`
- 官方 skill 远端详情中的 `descriptionI18n` 已同步到 `napp create` 新工作流
- 官方 skill 安装冒烟通过，临时目录中包含 `SKILL.md` 与 `marketplace.json`
- `MARKETPLACE_ADMIN_TOKEN` 已旋转到 Cloudflare Worker secret，并本地持久化到 `$HOME/.nextclaw/secrets/marketplace-admin-token.env`
- 新增文件命名、角色后缀、class arrow methods、param mutation、react effects 等治理检查全部通过

## 发布/部署方式

当前阶段已完成对外发布，但仍未接入主产品主链路。

如果要本地体验这一版 runtime，可按下面方式运行：

```bash
pnpm -C packages/nextclaw-app-runtime build
node packages/nextclaw-app-runtime/dist/main.js create ./tmp/my-first-napp
node packages/nextclaw-app-runtime/dist/main.js inspect ./tmp/my-first-napp --json
node packages/nextclaw-app-runtime/dist/main.js pack ./tmp/my-first-napp
node packages/nextclaw-app-runtime/dist/main.js install ./tmp/my-first-napp
node packages/nextclaw-app-runtime/dist/main.js list
node packages/nextclaw-app-runtime/dist/main.js info nextclaw.my-first-napp
node packages/nextclaw-app-runtime/dist/main.js permissions nextclaw.my-first-napp
node packages/nextclaw-app-runtime/dist/main.js run nextclaw.my-first-napp
node packages/nextclaw-app-runtime/dist/main.js uninstall nextclaw.my-first-napp

node packages/nextclaw-app-runtime/dist/main.js inspect apps/examples/hello-notes --json
node packages/nextclaw-app-runtime/dist/main.js run apps/examples/hello-notes --document notes=/absolute/path/to/notes
node packages/nextclaw-app-runtime/dist/main.js registry set https://registry.example.com
node packages/nextclaw-app-runtime/dist/main.js install nextclaw.hello-notes
node packages/nextclaw-app-runtime/dist/main.js update nextclaw.hello-notes
node packages/nextclaw-app-runtime/dist/main.js grant nextclaw.hello-notes --document notes=/absolute/path/to/notes
```

本次实际对外发布链路：

```bash
cd packages/nextclaw-app-runtime
pnpm publish --access public --no-git-checks

cd /Users/peiwang/Projects/nextbot
source "$HOME/.nextclaw/secrets/marketplace-admin-token.env"
node packages/nextclaw/dist/cli/index.js skills update \
  skills/nextclaw-app-runtime \
  --meta skills/nextclaw-app-runtime/marketplace.json \
  --scope nextclaw \
  --token "$NEXTCLAW_MARKETPLACE_ADMIN_TOKEN" \
  --api-base https://marketplace-api.nextclaw.io
```

本地官方 admin token 持久化路径：

```text
$HOME/.nextclaw/secrets/marketplace-admin-token.env
```

本机 shell 自动加载方式：

```text
[ -f "$HOME/.nextclaw/secrets/marketplace-admin-token.env" ] && source "$HOME/.nextclaw/secrets/marketplace-admin-token.env"
```

后续若需要更新官方 skill，可直接使用：

```bash
source "$HOME/.nextclaw/secrets/marketplace-admin-token.env"
node packages/nextclaw/dist/cli/index.js skills update \
  skills/nextclaw-app-runtime \
  --meta skills/nextclaw-app-runtime/marketplace.json \
  --scope nextclaw \
  --token "$NEXTCLAW_MARKETPLACE_ADMIN_TOKEN" \
  --api-base https://marketplace-api.nextclaw.io
```

## 用户/产品视角的验收步骤

从用户视角，本次应能完成下面这条最小体验路径：

1. 运行 `napp create ./my-first-napp`
2. 运行 `napp inspect ./my-first-napp`
3. 运行 `napp pack ./my-first-napp`
4. 运行 `napp install ./my-first-napp`
5. 运行 `napp list`，看到已安装应用
6. 运行 `napp info nextclaw.my-first-napp`
7. 运行 `napp permissions nextclaw.my-first-napp`
8. 运行 `napp run nextclaw.my-first-napp`
9. 打开本地输出的 URL
10. 在页面里点击 `Run Starter Demo`
11. 页面展示 `documentCount=0`、`textBytes=0`、`wasm-score=200`
12. 运行 `napp registry set https://registry.example.com`
13. 运行 `napp install nextclaw.hello-notes`
14. 运行 `napp grant nextclaw.hello-notes --document notes=/your/notes/path`
15. 运行 `napp update nextclaw.hello-notes`
16. 运行 `napp revoke nextclaw.hello-notes --document notes`
17. 运行 `napp uninstall nextclaw.my-first-napp`

如果以上步骤成立，说明“独立宿主 + bundle + local registry + npm 风格 registry + update + 显式权限管理”这套相对完善 MVP 已经成立。

## 可维护性总结汇总

可维护性复核结论：通过

本次顺手减债：是

长期目标对齐 / 可维护性推进：

- 这次改动顺着 NextClaw “统一入口 + 能力编排 + 生态扩展”的长期方向推进了一小步，因为它把“用户自己做的小应用”收敛成了一个可复制的运行时形态，而不是继续往主产品里堆一个一次性功能
- 这次没有直接接主产品，而是先做独立 runtime 包，降低了对既有服务/UI/CLI 的耦合压力
- 这次进一步把“微应用运行时能力”包装成可独立安装的 npm 包与可独立安装的 marketplace skill，让生态入口更接近真实用户使用方式
- 这次继续把入口往前推了一步，不再要求用户先手抄目录结构或复制示例目录，而是可以直接从 `napp create` 开始
- 这次进一步把“能开发、能跑”推进成了“能打包、能安装、能管理、能运行已安装 app”，把微应用从 runtime 原型推进到了真正可交付的本地产品闭环
- 这次继续把“本地产品闭环”推进成了“可配置 registry、可远端安装、可更新、可授权”的相对完善 MVP，离真正可分享使用的生态形态更近了一步

代码增减报告：

- 新增：1792 行
- 删除：4 行
- 净增：+1788 行

非测试代码增减报告：

- 新增：1646 行
- 删除：4 行
- 净增：+1642 行

独立可维护性复核：

- no maintainability findings
- 这次属于新增用户能力，不是纯 bugfix 或纯重构，因此非测试代码净增为正是允许的
- 在新增能力前已经把范围压到最小：不做产品接入、不做市场层、不做交互式模板系统、不做安装器、不做通用网络执行、不做复杂 Wasmtime 进程管理
- 业务 owner 相对清晰：manifest 读取收敛到 `AppManifestService`，权限收敛到 `AppPermissionsService`，应用执行收敛到 `AppInstanceService`，宿主收敛到 `AppHostService`，Wasm 调用收敛到 `WasmMainRunnerService`
- `napp create` 的新增逻辑也保持单 owner：目录与模板生成都收敛到 `AppScaffoldService`，CLI 入口只负责分发命令，没有把模板写入逻辑塞进 `main.ts`
- 第二阶段新增逻辑也保持了清晰 owner：`bundle/` 只管 bundle，`install/` 只管安装与运行解析，`registry/` 只管 registry，`paths/` 只管本地目录，`commands/` 只管 CLI 输出
- 这轮继续维持 role-first owner：远端 metadata 与 registry config 收敛在 `registry/`，权限授权收敛在 `permissions/`，update 仍然回收到 `install/` 主流程，而不是再长一层 `marketplace/` 假目录
- 新增的 marketplace skill 没有偷渡 runtime 逻辑，而是保持“skill 负责 onboarding，runtime 负责执行”的清晰边界
- 命名和目录结构已经按仓库治理规则收敛到明确角色后缀，没有继续制造 `logic/`、`helpers/`、`misc` 这类假角色
- 复杂度没有被隐藏到 effect、普通函数 mutation 或兜底分支里，主链路保持单一路径

治理与目录判断：

- 本次已尽最大努力优化可维护性：是
- 已优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是
- 由于这是新增运行时能力，总代码量与文件数出现净增长；该增长是最小必要增长，因为本次同时交付了 CLI、宿主、bridge、Wasm 执行、示例应用与 smoke 闭环，且刻意未引入产品耦合层、市场层和复杂 sidecar 管理
- 由于本次继续新增 starter scaffold，非测试代码继续净增；这一增长主要来自首份可运行模板的 HTML / controller / WAT / wasm 内嵌资源，但仍保持在单一 owner 下，没有再引入额外模板系统或二次抽象
- 第二阶段代码增长主要来自 bundle、registry、install 和新的命令层，但这些增长没有平铺到已有 owner 里，而是各自收敛到明确模块边界
- 抽象、模块边界、class / helper / service / controller 划分比“把逻辑堆进一个 CLI 文件”更清晰，也避免了补丁式叠加
- 目录结构与文件组织满足当前治理要求；新增文件已通过 `lint:new-code:governance` 与 `lint:maintainability:guard`

第二阶段增量代码增减报告：

- 新增：1459 行
- 删除：187 行
- 净增：+1272 行

第二阶段增量非测试代码增减报告：

- 新增：1346 行
- 删除：187 行
- 净增：+1159 行

后续 watchpoint：

- 如果下一阶段引入真实 Wasmtime sidecar，需要优先复用当前 `main-runner / sidecar` 边界，不要再平行长出第二套 runner
- 如果下一阶段加入更多 bridge action，应优先围绕现有 host contract 演进，而不是让 UI 直接新增散点 API

## NPM 包发布记录

本次涉及 NPM 包发布判断。

需要发布的包：

- `@nextclaw/app-runtime`

当前状态：

- `@nextclaw/app-runtime`：`0.3.0` 已发布

官方 marketplace skill 状态：

- `@nextclaw/nextclaw-app-runtime`：已更新，远端文案已同步 `napp create` 新能力

补充说明：

- 本次已执行 changeset version，并完成 `@nextclaw/app-runtime@0.2.0` 正式发布
- 本次已继续执行 changeset version，并完成 `@nextclaw/app-runtime@0.3.0` 正式发布
- `npm view @nextclaw/app-runtime version` 当前返回 `0.3.0`
- marketplace 官方更新不再依赖手工临时复制 token，当前机器已具备可复用的本地 token 存储与自动加载路径
