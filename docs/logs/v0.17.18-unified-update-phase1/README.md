# v0.17.18 unified update phase 1 and 2

## 迭代完成说明（改了什么）

本次完成统一更新系统第一阶段与第二阶段。第一阶段把“共享更新契约 + 桌面端自动下载进度 + 手动应用状态”落到现有架构中；第二阶段把 npm global 包收敛为稳定 launcher / shim，并让 npm 安装态使用 runtime bundle + current pointer 的更新模型。

- 在 `@nextclaw/kernel` 增加共享更新类型契约，覆盖安装形态、状态、下载进度、阻塞原因、是否可自动下载、是否可应用、是否需要重启等字段。
- 在 `@nextclaw/kernel` 增加 update manifest 共享契约与 `@nextclaw/kernel/update-contract` 子路径，避免 desktop、npm、UI 分别复制字段。
- 桌面 launcher 的 update coordinator 改为基于共享契约输出 snapshot，并新增 `blocked` 状态表达 `minimumLauncherVersion` 不满足的情况。
- 桌面下载服务支持基于 response stream 上报下载进度，保留原有 bundle 下载、验签、sha256 校验、解压、安装流程。
- UI 系统状态页展示下载进度、下载字节数、`blocked` 状态与阻塞说明。
- UI 桌面桥接类型改为复用 `@nextclaw/kernel` 共享契约，只保留桌面端自己的窄化字段。
- 修正桌面更新测试夹具，使测试 bundle 的 runtime entrypoint 与 manifest 保持一致。
- npm 包新增 `dist/cli/launcher/index.js` 作为 bin 入口。默认从 `~/.nextclaw/launcher/runtime-bundles/current.json` 启动已应用 runtime bundle；没有 current bundle 或显式禁用时，回到包内 `dist/cli/app/index.js`。
- 新增 npm runtime bundle layout、state store、bundle 校验/安装/切换、update source、download/update manager 与 CLI command service。
- `nextclaw update` 改为 runtime bundle 检查/下载/应用：默认检查并下载，`--check` 只检查，`--apply` 只切换已下载 bundle，不再执行 `npm install -g`。
- gateway `update.run` 改为走 runtime bundle 下载与应用，删除旧的 npm global self-update service、报告工具和测试，避免旧路径再次被误用。
- npm runtime update manifest 支持 `file://` 本地源，与 bundle 的 `file://` 支持保持一致，便于离线 release 候选包和本地签名 smoke 验证。
- 新增 `pnpm -C packages/nextclaw smoke:npm-runtime-update`，在临时 `NEXTCLAW_HOME` 中生成签名 key、manifest、runtime bundle zip，完整验证 check、download、apply 与新版 runtime 生效。
- UI 产品版本号旁边新增更新状态入口：下载中只展示百分比；下载完成后显示“更新”按钮，点击后直接执行 `applyDownloadedUpdate`，不会只是跳转到更新页。
- 同批次补充：NPM 安装态的 UI 更新链路正式接通。前端不再自己判断“桌面还是 NPM”，而是统一只消费 `UpdateSnapshot` 和统一动作；桌面端继续走 desktop bridge，managed local service / NPM 安装态通过 `/api/runtime/update` host 暴露同一套状态、下载、应用、偏好与 channel 接口。产品版本号旁边的进度/更新按钮与 `/updates` 页现在都会走统一 runtime update manager。
- 同批次补充：NPM managed local service update host 改为后台任务模型。自动检查开启时会自动检查；`autoDownload=true` 时会后台自动下载并持续更新 `progress`；点击“更新”会应用已下载 bundle 并请求 managed service 重启，让新版本真正生效，而不是只切指针不切进程。
- 同批次补充：开发态 `pnpm dev start` 默认重新对齐到真实 `~/.nextclaw`，不再偷偷改用 `~/.nextclaw-dev-home/<repo>`。根因通过对比 `scripts/dev/dev-runner.mjs`、README 文案、`/api/config` 实际返回和 `~/.nextclaw-dev-home/nextbot/config.json` 现场确认：实现与文档漂移导致开发态加载了另一套 home，用户看到“配置没加载”；同时 runtime update host 在 dev 启动后会自动检查公网 manifest，而当 manifest 尚未发布时会把 404 持久化为 `failed`，前端左上角因此显示“更新异常”。本次修复命中根因：直接把 dev-runner 默认 home 改回 `~/.nextclaw`，并让 dev-runner 显式禁用 runtime update host，使开发态不再把“未发布 manifest”误判为产品更新失败。
- 同批次补充：已修复“前台 `nextclaw serve` 点击版本号旁更新按钮后服务自杀、刷新页面卡死”的真实用户问题。接口层复现结果是：公开 `nextclaw@0.18.12-beta.4` 在 `downloaded` 状态下调用 `POST /api/runtime/update/apply` 会先返回 `200 + status=restart-required`，随后同端口 `GET /api/runtime/update` 直接 `fetch failed`。根因不是前端按钮，而是 `NpmRuntimeUpdateHost.applyDownloadedUpdate()` 无条件调用 `requestManagedServiceRestart(... background-service-or-exit ...)`，导致前台 `serve` 进程在没有托管后台 service 可重启时直接走了 exit 分支。修复方式是在 `createServiceUiHosts()` 中显式区分“当前进程是否就是 managed service owner”，并把这个分流下沉给 `NpmRuntimeUpdateHost`：managed service 继续执行重启；前台 `serve` 只返回 `restart-required` 和手动重启提示，不再主动退出当前进程。
- 同批次补充：已发布 `nextclaw@0.18.12-beta.3` 的“打开界面即显示更新失败”问题已通过接口层复现并命中根因。隔离安装公开 beta 后启动 `nextclaw serve`，`GET /api/runtime/update` 返回 `channel=stable`、`status=failed`、`errorMessage=runtime update manifest request failed with status 404`；同时公网 `beta` manifest 存在，而同平台 `stable` manifest 为 `404`。根因不是 UI 映射，而是 beta launcher 的默认 update channel 仍落成 `stable`。修复方式是在 launcher update source / state 默认值中引入“beta launcher 默认走 beta channel”的统一规则，并把这条默认同时用于 CLI `update`、managed service runtime update host 与 launcher state store。
- 同批次补充：修复默认 channel 后，本地新构建安装物一度继续卡在 `signature-verification-unavailable`。根因通过比对已发布 beta 与当前构建产物确认：新的 tsdown 产物把 `NpmRuntimeUpdateSourceService` 拆到了 `dist/*.js` 共享 chunk，`import.meta.url` 所在目录从 `dist/cli/app` 变成了 `dist`，原先只兼容 `dist/cli/app|launcher -> ../../../resources` 的相对路径不再命中包根 `resources/update-bundle-public.pem`。修复后包内 public key 路径会同时兼容 `dist/*.js` 共享 chunk 与 `dist/cli/*` 旧布局。
- 同批次补充：统一 beta 发版前再次命中 release contract 缺口。`release:check:groups` 现场确认 `@nextclaw/companion` 缺少标准 `prepublishOnly`，而当前仓库里的 `nextclaw` 依赖图已经包含 `@nextclaw/companion`。这意味着继续发布新的 `nextclaw` 而不补 companion publish guard，会把 release batch 卡在 guard 阶段，且未来一旦 `nextclaw` 的发布 manifest 真带上 companion 依赖，还会把“统一 beta 发布”拖成安装事故。修复方式是给 `apps/companion/package.json` 补齐标准 `prepublishOnly`，把 companion 拉回既有 pnpm release contract。
- 同批次补充：已修复 `nextclaw restart` 会把我们自己的前台 `nextclaw serve` 误判成“healthy unmanaged instance”的问题。根因不是端口真被外部服务占用，而是 `RestartCommands` 之前只认 `managedServiceStateStore`，完全忽略前台 `serve` 写入的 `localUiRuntimeStore`。因此当用户升级全局 npm 包后，对仍在运行的前台 `serve` 执行 `nextclaw restart`，CLI 会看到健康端口，却因为没有 `run/service.json` 就把它当成 unmanaged external listener 拒绝重启。修复方式是在 `RestartCommands` owner 内优先读取 `localUiRuntimeStore`：若目标端口就是 NextClaw 自己的前台 runtime，则先停掉该 PID，再按既有主路径拉起受管后台 service；只有既非 managed state、也非本地前台 runtime 时，才继续报真正的 unmanaged listener 错误。
- 同批次补充：进一步确认并修复了导致 `ui-runtime.json` 持续被死进程污染的更深层根因。第一层根因是 `startUiServer()` 之前在真正 listen 成功前就返回，导致后来会因 `EADDRINUSE` 崩掉的失败进程，仍然能继续执行并把自己写进 `ui-runtime.json`；第二层根因是 macOS LaunchAgent 之前生成的是 `KeepAlive=true` 且直接执行 `nextclaw serve`，在同一端口已被受管后台 service 占用时会被 `launchd` 无限重拉，持续制造 `EADDRINUSE` 并反复覆盖本地 runtime owner。修复方式分别是：让 `startUiServer()` 只在 Hono `serve()` 真正进入 listening 回调后才 resolve、在 listen error 时直接 reject；同时把 LaunchAgent 改成“登录时启动一次但不做 KeepAlive 监督重拉”。
- 同批次补充：把 NPM beta 发布闭环收敛成了可复用入口，而不是继续依赖“记住一串步骤”。新增仓库命令 `pnpm release:beta`，它默认串起 `release:auto -> release commit -> push branch/tags -> nextclaw runtime beta workflow -> release asset / public manifest 验证`；同时新增 `/release-beta` 元指令与 `npm-beta-release` skill，后续再遇到“发一个 beta”时可以直接复用这条 owner，而不是重新人工拼流程。该入口仍复用既有 `release:auto` 与 `npm-runtime-update-release.yml`，没有新造第二套发布机制。
- 同批次补充：已修复“全局 npm 外壳已经升级到 `0.18.12-beta.7`，但产品实际仍启动 `current.json` 里的 `0.18.12-beta.4` bundle，导致 `nextclaw --version` 和左上角版本号都继续显示 beta.4”的启动语义 bug。根因不是 UI 展示源，而是 launcher 之前无条件优先执行 `current` runtime bundle；只要 `~/.nextclaw/launcher/runtime-bundles/current.json` 里还指着旧 bundle，新装上的 npm 外壳版本就会被静默盖住。修复方式是在 launcher / runtime update manager 里统一引入“effective current version”规则：当前 bundle 和已安装外壳之间，始终以更高版本作为有效运行版本；当外壳版本更高时，launcher 直接回落到包内 app，并把 `/api/runtime/update` 的 `currentVersion` 同步成外壳版本。
- 同批次补充：统一 UI 实时状态入口已从“各处直接订阅 `/ws` 或轮询”收敛为 `nextclaw.eventBus -> /ws -> nextclawClient.eventBus -> UI consumers`。根因是 runtime update 进度原先依赖 host 模式固定轮询，且 SDK / UI 缺少统一事件总线契约；修复方式是在 `@nextclaw/kernel` 顶层提供 `nextclaw.eventBus`、`EventBus`、`eventKeys` 和 `AppEvent`，server 只把 event bus bridge 到既有 `/ws`，SDK 暴露懒启动的 `client.eventBus`，UI 通过 `useAppEventConsumers` 消费 `runtime.update.snapshot`，并删除 runtime update host 的永久 1s 轮询。
- 同批次补充：补齐 UI bundling 层面的 `@nextclaw/kernel` / `@nextclaw/client-sdk` alias。验证中发现 `tsc` 能解析 tsconfig path，但 Vite build 无法从 client SDK 源码转译链路解析 `@nextclaw/kernel`，导致 `@nextclaw/ui build` 失败；修复后 Vite / Vitest / tsconfig 三者解析口径一致，并重新同步 `packages/nextclaw/ui-dist`。
- 同步 `apps/desktop`、`@nextclaw/ui` 与 `nextclaw` 对 `@nextclaw/kernel` 的 workspace 依赖，并更新 lockfile。

设计依据见 [统一更新系统设计文档](../../designs/2026-05-05-unified-update-system.design.md)。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-kernel tsc`：通过。
- `pnpm -C packages/nextclaw-kernel build`：通过。
- `pnpm -C packages/nextclaw-ui tsc`：通过。
- `pnpm -C apps/desktop tsc`：通过。
- `pnpm -C packages/nextclaw test -- src/cli/launcher/npm-runtime-update.manager.test.ts --run`：通过，1 个测试文件、2 个用例。
- `pnpm -C packages/nextclaw build`：通过，确认 `dist/cli/launcher/index.js` 与 `dist/cli/app/index.js` 均生成并带执行权限。
- `pnpm -C packages/nextclaw tsc`：通过。
- `pnpm -C packages/nextclaw smoke:npm-runtime-update`：通过。脚本会先构建 `@nextclaw/kernel` 与 `nextclaw`，再在临时目录中生成签名 runtime bundle 与 manifest，验证：
  - `nextclaw update --check --json` 只报告 `update-available`，不写 current pointer。
  - `nextclaw update --json` 下载并安装到 versions 目录，但仍不切 current pointer。
  - `nextclaw update --apply --json` 切换 current pointer 并返回 `restart-required`。
  - 下一次 `nextclaw --version` 从已应用 runtime bundle 启动，输出 smoke runtime 版本。
  - 更新链路不创建或修改 `config.json`、`sessions`、`skills`、`workspace` 等用户拥有目录。
- `pnpm -C packages/nextclaw validation:npm-update`：通过。该命令复用 NPM runtime update smoke fixture，准备本地签名 manifest、runtime bundle、临时 `NEXTCLAW_HOME` 和临时 `nextclaw` shim，然后打印可直接复制执行的命令序列：`nextclaw --version`、`nextclaw update --check`、`nextclaw update`、`nextclaw update --apply`、再次 `nextclaw --version`。已按输出命令实际手动执行一遍，观察到：初始 `nextclaw --version` 为 `0.18.11`；`update --check` 提示 `none -> 0.99.1`；`update` 下载后仍保持 `0.18.11`；`update --apply` 后最终 `nextclaw --version` 输出 `smoke-runtime-0.99.1`。
- `pnpm -C packages/nextclaw validation:npm-update -- --published-beta`：通过。该命令从真实 npm registry 全新安装 `nextclaw@beta`，验证 `nextclaw --version` 输出已发布 beta 版本，并在已安装包目录内直接探测 `InputBudgetPruner`，确认 `estimate` / `prune` 都存在，覆盖“已发布 beta 包的依赖闭包与关键运行时 API”这条用户真实安装路径。
- `pnpm -C packages/nextclaw test src/cli/shared/services/ui/tests/npm-runtime-update-host.service.test.ts src/cli/shared/services/ui/tests/service-ui-hosts.service.test.ts`：通过，覆盖“前台 `serve` apply 后不退出当前进程”和“managed service apply 后继续请求重启”这两条分流。
- `pnpm -C packages/nextclaw tsc`：通过。
- `pnpm -C packages/nextclaw build`：通过。
- 真实接口层定向验收：通过。本地签名更新源下启动 `node packages/nextclaw/dist/cli/app/index.js serve --ui-port 18892`，轮询 `/api/runtime/update` 直到 `downloaded`，调用 `POST /api/runtime/update/apply` 后返回 `status=restart-required`、`recoveryCommand="Restart this NextClaw process to launch the downloaded runtime."`；等待 1.2 秒后再次 `GET /api/runtime/update` 仍返回 `200`，且状态保持 `restart-required`，直接证明前台 `serve` 不会再因 apply 自行退出。
- `pnpm -C packages/nextclaw test tests/cli/restart-commands.test.ts`：通过，覆盖“`restart` 遇到目标端口上的前台 `serve` 时，会先停止该 PID 再拉起受管后台 service；遇到无关健康 listener 时，仍然拒绝重启”的分支。
- 真实前台重启 smoke（隔离 `NEXTCLAW_HOME`、非仓库工作目录）：先启动 `node packages/nextclaw/dist/cli/app/index.js serve --ui-port 18795`，确认 `/tmp/.../run/ui-runtime.json` 写入当前前台 PID 与 `uiPort=18795`；随后在第二个进程执行 `node packages/nextclaw/dist/cli/app/index.js restart --ui-port 18795`，观察到 CLI 先输出 `Restarting nextclaw foreground runtime (PID ...)` 再成功拉起后台 service；最终 `/tmp/.../run/service.json` 与 `ui-runtime.json` 都更新为新的后台 PID，`curl http://127.0.0.1:18795/api/health` 返回 `200 {"status":"ok"}`。
- `pnpm -C packages/nextclaw-server test src/ui/server.cors.test.ts src/ui/server.weixin-channel.test.ts`：通过。
- `pnpm -C packages/nextclaw-server tsc`：通过。
- 本地 `ui-runtime.json` 污染防回归 smoke：通过。隔离 `NEXTCLAW_HOME` 下先启动一个健康 `serve --ui-port 53282`，再启动第二个同端口 `serve`；第二个进程现在会直接因 `EADDRINUSE` 退出，且不会再输出 `✓ UI API/UI frontend`，`run/ui-runtime.json` 仍保持第一条健康进程的 PID 与端口，没有被失败进程覆盖。
- 本机 LaunchAgent 现场验收：通过。重新安装/加载本地构建出的 LaunchAgent 后，`~/Library/LaunchAgents/io.nextclaw.host-agent.plist` 已变为 `KeepAlive=false`；`launchctl print gui/501/io.nextclaw.host-agent` 显示 `state = not running`，stdout/stderr 日志行数在数秒轮询内保持不变，证明之前那条无限重拉 `nextclaw serve` 的冲突链已停止；随后直接运行全局 `nextclaw restart`，不再报 `healthy unmanaged instance`，并成功恢复 `http://127.0.0.1:55667/api/health = ok`。
- `node scripts/release/release-beta.mjs --help`：通过，输出一键 beta 发布入口、参数和默认闭环步骤。
- `node scripts/release/release-beta.mjs --dry-run`：通过，输出“release:auto / release commit / push / runtime workflow 验证”这条计划链，确认脚本入口可直接自解释。
- `pnpm release:beta -- --branch master`：已完成真实发布。NPM registry 现已看到 `nextclaw@beta = 0.18.12-beta.7`，并完成当前 release batch 的 npm publish、release commit 推送与 beta runtime workflow dispatch。
- `gh workflow run npm-runtime-update-release.yml --repo Peiiii/nextclaw --ref master -f channel=beta -f release_tag=nextclaw@0.18.12-beta.7`：通过。对应 workflow run 为 `25449644478`，四个平台构建与 publish job 全部成功。
- `gh release view nextclaw@0.18.12-beta.7 --repo Peiiii/nextclaw --json url,isPrerelease,assets`：通过，确认 prerelease release 下已有四个平台 runtime zip asset。
- `git show origin/gh-pages:npm-runtime-updates/beta/manifest-beta-<platform>-<arch>.json`：通过，确认 gh-pages 分支上的四个平台 beta manifest 都已指向 `0.18.12-beta.7` 且 `hostKind=npm-runtime-bundle`。
- `NEXTCLAW_HOME=<tmp-with-current-beta4> node packages/nextclaw/dist/cli/launcher/index.js --version`：通过。在隔离 home 中保留 `current.json = 0.18.12-beta.4`、但使用修后的 `nextclaw@0.18.12-beta.7` 本地构建时，launcher 现在输出 `0.18.12-beta.7`，直接证明“新外壳不会再被旧 current bundle 静默盖住”。
- `NEXTCLAW_HOME=<tmp-with-current-beta4> node packages/nextclaw/dist/cli/app/index.js serve --ui-port 18841` + `GET /api/runtime/update`：通过。接口层返回 `hostVersion = 0.18.12-beta.7`、`currentVersion = 0.18.12-beta.7`，并把 `launcher/npm-runtime-update-state.json` 同步成 `beta.7`，证明 UI 读取到的有效运行版本也已与实际外壳版本对齐。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths AGENTS.md commands/commands.md docs/workflows/npm-release-process.md package.json scripts/release/release-beta.mjs .agents/skills/npm-beta-release/SKILL.md .agents/skills/npm-release-contract-guard/SKILL.md`：通过，0 error / 1 warning。warning 为 `scripts/release/release-beta.mjs` 接近文件预算，但无 function budget / owner 边界 error。
- `pnpm lint:new-code:governance`：通过（本轮 beta 发布入口相关改动）。
- `pnpm check:governance-backlog-ratchet`：未通过，仍为仓库历史 `docFileNameViolations 13 > baseline 11`，与本轮 beta 发布入口改动无关。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths <touched-files>`：通过，0 error / 0 warning，非测试代码净增 0。
- `pnpm lint:new-code:governance`：未通过，但失败来自工作区无关文件 `apps/companion/src/launcher.ts` 的既有 role-boundary 问题，不是本次 update host 修复引入。
- `pnpm check:governance-backlog-ratchet`：未通过，仍是仓库历史 `docFileNameViolations 13 > baseline 11`，与本次修复无关。
- 真实接口层复现（公开 beta）：
  - 隔离安装 `nextclaw@0.18.12-beta.3` 到临时 prefix / `NEXTCLAW_HOME`。
  - 启动 `nextclaw serve --ui-port 18777`。
  - `GET /api/runtime/update` 返回 `channel=stable`、`status=failed`、`errorMessage=runtime update manifest request failed with status 404`。
  - 同时现场确认当前平台 `beta` manifest 存在而 `stable` manifest 返回 `404`，因此问题归因到默认 channel 错误，而不是 UI。
- 本地安装物同链路验收（修后）：
  - `pnpm -C packages/nextclaw tsc`：通过。
  - `pnpm -C packages/nextclaw test src/cli/launcher/npm-runtime-update.manager.test.ts src/cli/shared/services/ui/tests/service-ui-hosts.service.test.ts`：通过，2 个测试文件、7 个用例。
  - `pnpm -C packages/nextclaw build`：通过。
  - 以修后源码重新 `pack + npm install -g <tgz> --prefix <tmp>`，启动 `nextclaw serve --ui-port 18781`。
  - `GET /api/runtime/update` 返回 `channel=beta`、`status=downloading`，并出现连续 `progress`（例如 `17% -> 25%`）；`errorMessage=null`。这直接证明修后安装物已经从“打开即更新失败”切到“后台自动下载并上报进度”。
- 新增 NPM runtime update 正式发布链路：
  - `packages/nextclaw/scripts/build-npm-runtime-update-channel.mjs` 负责构建自包含 runtime bundle、生成 `hostKind=npm-runtime-bundle` 的签名 manifest，并写入包内 `resources/update-bundle-public.pem`。
  - `packages/nextclaw/npm-runtime-compatibility.json` 固化 NPM runtime update 的 stable / beta launcher floor，默认均保持 `0.18.11`，避免发布时随意提升 minimum launcher version。
  - `.github/workflows/npm-runtime-update-release.yml` 负责把 stable / beta NPM runtime update manifest 发布到 `gh-pages` 的 `npm-runtime-updates/<channel>`，并把大体积 `nextclaw-runtime-*.zip` 上传到对应 GitHub Release assets，避免 `gh-pages` 100MB 单文件限制。
  - NPM launcher 默认从 `https://Peiiii.github.io/nextclaw/npm-runtime-updates` 读取 manifest，并默认读取包内 public key；用户不再需要理解或手动配置 manifest URL / 验签公钥。
  - 真实 beta apply 验证发现 `pnpm deploy` 产物中的部分 workspace package 可能只有 `package.json`、缺少 `dist/index.js`。根因通过临时用户目录中已下载 runtime bundle 的 `node_modules/@nextclaw/core`、`@nextclaw/server`、`@nextclaw/remote` 目录确认：CI 日志显示这些包已构建，但 deploy 使用的 workspace package 快照仍未包含构建后的 `dist`。修复方式是在拓扑构建后追加一次 `pnpm install --frozen-lockfile --offline`，刷新 pnpm 的本地 workspace package 快照，再执行 deploy；本地已确认刷新后 deploy 产物包含这些 runtime 入口。
  - 已用临时 ed25519 key 在 `/tmp` 生成 beta `manifest-beta-darwin-arm64.json` 与 `nextclaw-runtime-darwin-arm64-0.18.11.zip`，并通过 `nextclaw update --channel beta --check --json` 验证 manifest 读取与签名校验链路。
  - 已在 `/tmp` 通过 `pnpm install --frozen-lockfile --offline` 后的 `pnpm --config.node-linker=hoisted --filter nextclaw --prod deploy <tmp>` 验证，产物中存在 `@nextclaw/core/dist/index.js`、`@nextclaw/server/dist/index.js`、`@nextclaw/remote/dist/index.js`。
- `pnpm -C packages/nextclaw-ui test -- --run src/features/system-status/components/desktop-update-config.test.tsx`：通过，1 个测试文件、2 个用例。
- `pnpm -C packages/nextclaw-ui test -- --run src/shared/components/common/brand-header.test.tsx src/features/system-status/components/desktop-update-config.test.tsx`：通过，2 个测试文件、4 个用例，验证版本号旁边下载进度展示与“更新”按钮应用动作。
- `pnpm -C packages/nextclaw-ui tsc`：通过（同批次补充后复验）。
- `pnpm -C packages/nextclaw-server tsc`：通过（同批次补充后复验）。
- `pnpm --filter @nextclaw/kernel test`：通过，1 个测试文件、4 个用例，覆盖 `EventBus emit/on/off/once/subscribeAll`、listener error 隔离和首尾订阅生命周期。
- `pnpm --filter @nextclaw/client-sdk test`：通过，1 个测试文件、4 个用例，覆盖 `client.eventBus` 懒启动 `/ws`、`sessions.subscribe` 复用同一事件总线、reconnect 与最后订阅释放后的关闭。
- `pnpm --filter nextclaw test -- src/cli/shared/services/ui/tests/npm-runtime-update-host.service.test.ts`：通过，1 个测试文件、3 个用例，覆盖 runtime update host 应用更新时发布 `runtime.update.snapshot`。
- `pnpm --filter @nextclaw/ui test -- src/features/system-status/components/desktop-update-config.test.tsx`：通过，1 个测试文件、3 个用例，覆盖更新页不再自己 start/stop manager，以及下载进度能从共享 store 正常展示。
- `pnpm --filter @nextclaw/kernel tsc`、`pnpm --filter @nextclaw/client-sdk tsc`、`pnpm --filter @nextclaw/server tsc`、`pnpm --filter @nextclaw/ui tsc`、`pnpm --filter nextclaw tsc`：均通过。
- `pnpm --filter @nextclaw/kernel build`、`pnpm --filter @nextclaw/client-sdk build`、`pnpm --filter @nextclaw/ui build`、`pnpm --filter nextclaw build`：均通过。`@nextclaw/ui build` 首次发现 Vite alias 缺口，补齐后复验通过；`nextclaw build` 已把新 UI dist 同步进 NPM 包产物。
- `rg "RUNTIME_HOST_POLL_INTERVAL|pollingTimer|ensurePolling|use-realtime-query-bridge|setInterval\\(" packages/nextclaw-ui/src packages/nextclaw-client-sdk/src`：通过，未再发现 runtime update host 轮询实现；`/api/runtime/update` 仅保留在 SDK 的显式初始/动作 API 中。
- `pnpm lint:maintainability:guard`：通过。事件总线相关文件无 maintainability finding；当前工作区同时包含 module-structure governance 相关未提交改动，因此全量输出 3 个 near-budget warning，来源为 `scripts/governance/module-structure/*`，非本次事件总线改造引入。
- `pnpm -C packages/nextclaw-server test src/ui/router.runtime-control.test.ts src/ui/ui-routes/runtime-update-routes.test.ts`：通过，2 个测试文件、6 个用例，覆盖统一 runtime update route。
- `pnpm -C packages/nextclaw test src/cli/launcher/npm-runtime-update.manager.test.ts src/cli/shared/services/ui/tests/runtime-control-host.service.test.ts`：通过，2 个测试文件、5 个用例，确认 runtime bundle download/apply 语义未被 UI 接线破坏。
- `pnpm -C packages/nextclaw test src/cli/shared/services/ui/tests/service-ui-hosts.service.test.ts src/cli/shared/services/ui/tests/runtime-control-host.service.test.ts`：通过，2 个测试文件、5 个用例，覆盖“默认暴露 runtime update host / 开发态禁用 runtime update host”的宿主边界。
- `pnpm -C packages/nextclaw tsc`：通过（本轮开发态修复后复验）。
- `pnpm dev start`（使用 `NEXTCLAW_DEV_BACKEND_PORT=18892 NEXTCLAW_DEV_FRONTEND_PORT=5184` 隔离端口）：
  - 终端打印 `NEXTCLAW_HOME: /Users/peiwang/.nextclaw`，确认开发态默认落到真实 home。
  - `curl http://127.0.0.1:18892/api/runtime/update` 返回 `404 Not Found`，确认开发态 runtime update host 已禁用，不再把未发布 manifest 误报为“更新异常”。
  - `curl http://127.0.0.1:18892/api/config` 返回的 provider keys / channels 与 `~/.nextclaw/config.json` 对齐，确认开发态读取的是同一套配置。
- `pnpm release:check:groups`：最初失败，错误为 `apps/companion/package.json` 缺少标准 `prepublishOnly`；补齐后可继续进入统一 beta 发布预检。
- `pnpm release:check`：首次失败，根因为 `@nextclaw/remote` 在消费 `@nextclaw/server` 的公开类型时，命中了 `@nextclaw/kernel/update-contract` 子路径，但 `packages/nextclaw-remote/tsconfig.json` 只把 `@nextclaw/server` 映到源码，没有同时映射 `@nextclaw/kernel` 与 `@nextclaw/kernel/update-contract`。这会让 release batch 在 `remote tsc` 阶段直接报 `TS2307`。本次修复是在 `packages/nextclaw-remote/tsconfig.json` 中补齐这两条 path contract，并同步保留 `package.json` 中对 `@nextclaw/kernel` 的 direct dependency。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths scripts/dev/dev-runner.mjs packages/nextclaw/src/cli/shared/services/ui/service-ui-hosts.service.ts packages/nextclaw/src/cli/shared/services/ui/tests/service-ui-hosts.service.test.ts README.md README.zh-CN.md`：通过，`Non-test line changes: +12 / -14 / net -2`，no maintainability findings。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：未通过；当前仓库的 `docFileNameViolations` 为 `13`，高于 baseline `11`，属于既有治理基线差异，本次改动未新增 governed doc 文件。
- 新增 `pnpm -C apps/desktop validation:dev-update`：开发态手动验收入口。该命令会在临时目录中准备本地签名更新源、隔离 `NEXTCLAW_HOME` 与桌面 launcher 数据目录、启动本地 update server，并拉起桌面 dev app。开发者可像真实用户一样在“设置 > 桌面端更新”中切到 Beta、下载更新，并在产品版本号旁边观察下载进度和“更新”按钮；点击“更新”后验证 launcher state / current pointer 切到新版本。自动化验证可使用 `--prepare-only` 只准备并检查本地更新源。
- `node --check apps/desktop/scripts/update/services/dev-update-validation.service.mjs`：通过。
- `pnpm -C apps/desktop validation:dev-update -- --prepare-only --stable-seed-bundle /tmp/nextclaw-dev-update-fixture-seed.zip --beta-version 0.18.51`：通过。验证脚本可基于指定 seed bundle 生成 stable/beta 本地更新源；检查 beta/stable manifest 均包含 `bundleUrl`、`bundleSha256`、`bundleSignature`、`manifestSignature`，且 minimum launcher version 仍由既有治理服务计算。
- `pnpm -C apps/desktop build:main`：通过。
- `node --test apps/desktop/dist/apps/desktop/src/launcher/__tests__/update-coordinator.service.test.js`：通过，8 个用例。
- `NEXTCLAW_HOME=$(mktemp -d) node packages/nextclaw/dist/cli/launcher/index.js --version`：通过，输出 `0.18.11`，验证 npm launcher shim 在无 current bundle 时回到包内 app。
- `NEXTCLAW_HOME=$(mktemp -d) node packages/nextclaw/dist/cli/launcher/index.js update --check --json`：按预期返回 blocked，原因是未配置 `NEXTCLAW_UPDATE_BUNDLE_PUBLIC_KEY` / `NEXTCLAW_UPDATE_BUNDLE_PUBLIC_KEY_PATH`，验证无签名公钥时不会下载未验证 bundle。
- `pnpm lint:new-code:governance`：未通过，失败点均为当前工作区已有 NCP 脏改文件命名/角色边界；本次新增的 `cli/launcher` 目录已收敛到 12 个文件以内，并通过自身命名/角色治理要求。
- `pnpm lint:maintainability:guard`：未通过，前置 maintainability check 对本次更新链路已无 error，仅保留 warning；随后在 `pnpm lint:new-code:governance` 阶段被当前工作区已有 NCP 脏改文件命名/角色边界阻塞。
- `node scripts/governance/check-governance-backlog-ratchet.mjs`：失败，`docFileNameViolations` 当前 13，高于 baseline 11；该 ratchet 与本次 update 实现无直接关系。
- `node scripts/governance/report-doc-file-name-violations.mjs --tracked-only --limit 30`：已确认 ratchet 失败来源为历史 tracked 文档命名遗留项。

## 发布/部署方式

本次已完成 NPM beta 发布闭环，当前公开状态如下：

- npm dist-tag：`nextclaw@beta = 0.18.12-beta.7`
- release commit：`a11f4fd1 chore: release beta batch`
- runtime workflow：[25449644478](https://github.com/Peiiii/nextclaw/actions/runs/25449644478)
- runtime release：[nextclaw@0.18.12-beta.7](https://github.com/Peiiii/nextclaw/releases/tag/nextclaw%400.18.12-beta.7)

其中 NPM 包发布和 runtime channel 发布都已经成功；GitHub Pages 的公网 CDN 传播存在短暂延迟，可能在几分钟内仍返回旧的 `beta.6` manifest，但 `gh-pages` 分支上的真实发布内容已更新为 `beta.7`。

桌面端仍沿用既有 launcher bundle layout：下载后的 bundle 安装到 launcher 管理的版本目录，由用户点击应用后切换 current pointer 并重启生效。本次未改变用户数据目录、插件目录或现有 bundle 保留策略。

NPM 形态新增安装态 runtime bundle layout：

```text
~/.nextclaw/
  launcher/
    npm-runtime-update-state.json
    runtime-bundles/
      current.json
      previous.json
      staging/
      versions/<version>/
```

该目录只归 npm launcher 管理，不触碰 `~/.nextclaw/config.json`、workspace、sessions、skills 或用户插件目录。`npm install -g` 只保留为 `host-too-old` 时的手动 recoveryCommand，不再作为自动下载或常规更新路径。

本地 smoke 验证命令：

```bash
pnpm -C packages/nextclaw smoke:npm-runtime-update
```

该命令不依赖真实公网更新源，也不会写入仓库目录或真实 `~/.nextclaw`；它会在系统临时目录创建隔离 `NEXTCLAW_HOME` 并在结束后清理。

NPM 用户视角手动验收命令：

```bash
pnpm -C packages/nextclaw validation:npm-update
```

该命令不会替换真实全局 npm 包，也不会写真实 `~/.nextclaw`。它会构建本地 package、生成临时更新源和临时 `nextclaw` shim，并打印一组 shell 命令。验收时按输出依次执行：

1. `nextclaw --version`：应显示当前包内 runtime 版本。
2. `nextclaw update --check`：应只提示有新 runtime，不下载、不切换。
3. `nextclaw update`：应下载 runtime bundle，并提示运行 `nextclaw update --apply`。
4. 再次 `nextclaw --version`：仍应是旧 runtime，证明自动下载不会自动生效。
5. `nextclaw update --apply`：切换 current pointer，并提示重启或新进程生效。
6. 最后 `nextclaw --version`：应显示 smoke runtime 新版本。

NPM beta 发布/测试方式：

1. 发布带 runtime update public key 的 `nextclaw` NPM 包。发布前必须运行 NPM runtime update channel builder，确保 `resources/update-bundle-public.pem` 已写入包内；`prepack` 会检查该文件存在。
2. 触发 `npm-runtime-update-release` workflow，选择 `channel=beta`。workflow 会生成并发布：
   - `npm-runtime-updates/beta/manifest-beta-darwin-arm64.json`
   - `npm-runtime-updates/beta/manifest-beta-darwin-x64.json`
   - `npm-runtime-updates/beta/manifest-beta-linux-x64.json`
   - `npm-runtime-updates/beta/manifest-beta-win32-x64.json`
   - 对应 `nextclaw-runtime-<platform>-<arch>-<version>.zip` 作为 GitHub Release assets
3. 用户侧测试不需要理解更新源，只需：

```bash
npm install -g nextclaw@beta
nextclaw update --channel beta --check
nextclaw update --channel beta
nextclaw update --apply
nextclaw --version
```

`nextclaw update --channel beta` 会自动读取公网 beta manifest 并使用包内 public key 验签。下载完成不会立即生效，只有 `nextclaw update --apply` 后的新进程才会切到 beta runtime。

桌面开发态手动验收命令：

```bash
pnpm -C apps/desktop validation:dev-update
```

默认行为是生成临时 stable seed bundle 与本地 beta 更新源，随后启动本地 update server 和桌面 dev app。它使用隔离的 `NEXTCLAW_HOME` / `NEXTCLAW_DESKTOP_DATA_DIR`，不会写入真实用户目录。常用参数：

- `--prepare-only`：只准备本地更新源并输出路径，用于脚本自身或 release artifact 的快速验证。
- `--stable-seed-bundle <path>`：复用指定 seed bundle，避免每次重新生成。
- `--beta-version <version>`：指定本地 Beta 更新版本。
- `--skip-build`：跳过构建，仅在已有可用 runtime / seed 产物时使用。
- `--keep`：保留临时目录，便于检查 `launcher/state.json`、`current.json`、manifest 和 bundle。

## 用户/产品视角的验收步骤

1. 打开桌面端系统状态页，进入桌面更新配置区域。
2. 触发检查更新，存在新 bundle 时应进入可用更新状态。
3. 点击下载或启用自动下载后，下载过程中应在更新页看到百分比和字节进度，并在产品版本号旁边看到下载百分比。
4. 下载完成后，状态应显示“已下载待应用”，产品版本号旁边应出现“更新”按钮；用户点击“更新”后才切换到新版本。
5. 当 manifest 要求的 minimum launcher version 高于当前 launcher 时，状态应显示为“更新被阻塞”，而不是误报普通失败。
6. 对 npm 安装态，运行 `nextclaw update --check` 应只检查状态；运行 `nextclaw update` 应下载 runtime bundle 但不切 current；运行 `nextclaw update --apply` 才切换 current pointer。
7. 对 npm 安装态，运行 `nextclaw --version` 或其它命令时，如果存在 current runtime bundle，应从 current 指向的 bundle runtime script 启动；如果不存在 current bundle，应启动包内 app。
8. 开发者本机亲自验收 NPM 更新时，运行 `pnpm -C packages/nextclaw validation:npm-update` 并按输出命令操作。这个入口从 CLI 用户视角验证“检查、下载、手动 apply、新进程生效”，不是走真实 npm registry，也不依赖 `npm install -g` 覆盖安装。
9. 对真实 NPM beta 用户，只需要安装 `nextclaw@beta` 并运行 `nextclaw update --channel beta`；默认 manifest base URL 和默认 public key 都由包内发布材料提供。
10. 对 NPM managed local service UI，启动本地服务后打开产品界面：如果有新版本且 `autoDownload=true`，版本号旁边会先出现下载百分比；下载完成后版本号旁边出现“更新”按钮；进入 `/updates` 页应能看到同一份状态、进度和操作入口，不再显示“当前仅桌面端可用”。
11. 对开发态 `pnpm dev start`，终端应直接打印 `NEXTCLAW_HOME: ~/.nextclaw`；如果本机 `~/.nextclaw/config.json` 已配置 provider / channel，开发态应直接读到同一套配置，不再出现“像是没加载配置”的情况。
12. 对开发态 `pnpm dev start`，左上角不应再出现“更新异常”；因为开发态不会暴露 runtime update host，`/api/runtime/update` 应返回 `404`，前端会把它视为“当前环境无更新宿主”，而不是产品更新失败。

开发者本机亲自验收桌面更新时，优先运行 `pnpm -C apps/desktop validation:dev-update`。预期流程是：桌面窗口打开后，Stable 初始版本可用；切到 Beta 后可检测到新版本；点击下载时版本号旁边出现百分比；下载完成后版本号旁边出现“更新”；点击“更新”后应用重启，隔离目录里的 launcher state 与 current pointer 指向 Beta 版本。该开发态入口默认用本地源码 runtime 验证 UI 和更新控制面，因此用于确认“交互、状态、进度展示、手动应用入口”是否正确；完整 bundle 启动后的真实切换仍由 `pnpm -C apps/desktop smoke:update` 覆盖。

过程锚点见 [goal-progress.md](./work/goal-progress.md)。

## 可维护性总结汇总

本次是新增用户可见能力，非测试代码有必要净增长。按当前工作区相关变更统计：总代码新增 2491 行、删除 623 行、净增 1868 行；排除测试后新增 2178 行、删除 469 行、净增 1709 行。增长主要来自共享契约、桌面进度读取、npm runtime bundle layout/update/shim、CLI 命令、完整 smoke 脚本与定向测试；同时删除了旧 npm global self-update service、报告工具和对应测试。

已尽最大努力遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”。本次没有新建独立 update 包，而是把跨 launcher 的稳定字段放进既有 `@nextclaw/kernel`；桌面下载只在现有 `DesktopUpdateService` 增加 stream progress；npm 侧集中在 `packages/nextclaw/src/cli/launcher`，不扩散到 core/runtime/UI；状态编排由明确的 manager / service / store owner 承载。

抽象边界保持为：`@nextclaw/kernel` 负责共享 contract，desktop launcher 负责桌面下载/验签/安装，npm launcher 负责 npm 安装态 runtime bundle 下载/验签/安装/切换，UI 负责渲染 snapshot。该拆分避免了新增独立包，也避免了让 npm 复用 desktop 私有目录与 Electron 假设。

目录结构方面，本次新增 `cli/launcher` 目录一度超过 12 文件预算，已通过合并 version helper、按角色后缀重命名等方式收敛到 12 个文件，并在 `cli/launcher/README.md` 记录目录预算豁免与后续禁止继续新增直接文件的治理边界。当前全量治理仍被工作区已有 NCP 脏改和历史 doc ratchet 阻塞，非本次 update 实现新增问题。

独立可维护性复核结论：保留债务经说明接受。no maintainability findings for update-system-owned files。长期目标对齐 / 可维护性推进：本次顺着“统一入口、统一契约、不同 launcher 只替换具体实现”的方向推进，删除了旧 `npm install -g` self-update 主路径，避免继续保留双更新体系，并补上可重复 smoke 作为长期回归入口。保留债务：npm runtime bundle 的 release 产物生成/发布流水线仍需后续接入；当前工作区已有 NCP 脏改和历史 doc ratchet 仍需单独治理。

同批次补充：为 NPM 安装态新增 `validation:npm-update` 手动验收入口时，没有新增第二套 fixture 生成脚本，而是在既有 `smoke-npm-runtime-update.mjs` 上增加 `--manual` 模式，复用同一组签名 manifest/runtime bundle fixture。定向 maintainability guard 对本次补充文件无 findings；本次补充属于开发者可见验收能力，非测试代码净增主要来自用户指令打印、临时 shim 与公钥文件路径输出，已保持在单脚本内，避免扩散新的目录或服务层。

同批次补充：本次把 NPM 安装态 UI 更新链路补齐后，针对新增代码路径重新执行了 `tsc` 与定向 UI / server / launcher 测试，均通过。`pnpm lint:maintainability:guard` 在 update 相关文件上已清掉本次新增 error；最终仍被工作区中与本次无关的已有脏改阻塞：`packages/nextclaw-core/src/config/reload.ts` 与 `packages/nextclaw-core/src/config/schema.ts` 触发 file-role-boundary 错误。这两处不是本次 runtime update 改动引入的问题，但会导致整仓治理命令无法在当前工作区全绿。

同批次补充：开发态修复属于非功能性收口，不新增用户能力。独立可维护性复核结论：通过；本次顺手减债：是。代码增减报告：新增 97 行、删除 14 行、净增 +83 行；非测试代码增减报告：新增 12 行、删除 14 行、净增 -2 行。正向减债动作：简化。质量与可维护性提升证明：删除了错误的默认 `~/.nextclaw-dev-home/<repo>` 心智与 `NEXTCLAW_DEV_HOME` 额外入口，开发态现在只保留“默认走 `~/.nextclaw`，需要覆盖时只认 `NEXTCLAW_HOME`”这一条清晰主路径；同时把“开发态没有发布 manifest”这个环境事实收敛到宿主层，不再污染前端状态。为何不是单纯压缩行数：这次不是靠把代码写密，而是靠删掉一条多余配置路径和一条错误宿主暴露路径，减少了需要理解和排查的分叉。

## NPM 包发布记录

本次开始发布 NPM beta 版本，先提供给用户侧验证；用户确认 beta 没问题后再发布正式版。

### beta.9 package-only + runtime closure

- 已发布 `nextclaw@0.18.12-beta.9`，dist-tag 为 `beta`。
- 本次先通过 `pnpm release:beta:npm` 验证“只发 NPM、不触发 runtime workflow”的快速路径，再单独执行 `pnpm release:beta:runtime -- --version 0.18.12-beta.9 --branch master` 补齐自动更新通道。
- 真实 npm publish 一度在隔离 worktree 中因未继承项目根 `.npmrc` 失败，报 `E404 Not Found / no permission`。修复方式不是改包内容，而是在 isolated worktree 发布时显式带上 `NPM_CONFIG_USERCONFIG=/Users/peiwang/Projects/nextbot/.npmrc`；随后 `nextclaw@0.18.12-beta.9` 成功发布。
- runtime workflow `25454210414` 已成功完成，四个平台 bundle assets 均已上传到 `nextclaw@0.18.12-beta.9` release：
  - `nextclaw-runtime-darwin-arm64-0.18.12-beta.9.zip`
  - `nextclaw-runtime-darwin-x64-0.18.12-beta.9.zip`
  - `nextclaw-runtime-linux-x64-0.18.12-beta.9.zip`
  - `nextclaw-runtime-win32-x64-0.18.12-beta.9.zip`
- `gh-pages` 分支提交 `4808d8af` 已把 beta manifest 切到 `0.18.12-beta.9`；GitHub Pages 状态随后从 `building` 进入 `built`，公网 manifest 最终也已传播到 `0.18.12-beta.9`。
- 这次再次验证了 split beta 入口的职责边界：
  - `pnpm release:beta:npm`：只发 npm，不触发 runtime workflow
  - `pnpm release:beta:runtime`：只发 runtime channel，不重复发 npm 包
  - `pnpm release:beta`：一次闭合 package + runtime channel

- `@nextclaw/kernel`：已发布 `0.1.2-beta.0`，dist-tag 为 `beta`。本次新增共享更新契约类型与 `./update-contract` export，供 `nextclaw` beta runtime 使用。
- `@nextclaw/core`：已发布 `0.12.13-beta.1`，dist-tag 为 `beta`。真实 `nextclaw@0.18.12-beta.1` 发消息验证发现 app 已调用 `InputBudgetPruner.estimate()`，但公网旧版 `@nextclaw/core` 尚未包含该方法，导致 `this.inputBudgetPruner.estimate is not a function`。已通过检查临时 npm 安装目录中的 `@nextclaw/core/dist/index.d.ts` 与运行 `new InputBudgetPruner().estimate` 确认根因，并补发新 beta。
- `@nextclaw/ui`：待统一发布。本次更新桌面更新配置 UI 与共享契约依赖。
- `nextclaw`：已发布 `0.18.12-beta.3`，dist-tag 为 `beta`，并依赖 `@nextclaw/kernel@0.1.2-beta.1` 与 `@nextclaw/core@0.12.13-beta.1`。已通过 `pnpm -C packages/nextclaw validation:npm-update -- --published-beta` 验证真实 npm registry 新装链路：`nextclaw --version` 输出当前 beta 版本，且已安装包内 `InputBudgetPruner.estimate` / `prune` 都存在。`0.18.12-beta.1` 已 deprecated，用于阻断 `this.inputBudgetPruner.estimate is not a function` 继续扩散；`0.18.12-beta.0` 也已 deprecated，因其依赖的公网 `@nextclaw/kernel@0.1.1` 缺少 `./update-contract` export，启动会报 `ERR_PACKAGE_PATH_NOT_EXPORTED`。本次 bin 入口改为 npm runtime launcher，并新增 runtime bundle 更新/切换能力；包内已加入与当前公开 update channel 一致的 `resources/update-bundle-public.pem`。
- `@nextclaw/desktop`：桌面应用构建受影响，不作为普通公开 NPM 包记录；需要走桌面 release 构建流程。

当前发布策略：先发布 `nextclaw@beta` 供真实用户路径验证；正式版等待 beta 验收通过后再发布。已验证全新临时目录从真实 registry 安装 `nextclaw@beta` 后，`nextclaw --version` 输出当前 beta 版本，且关键运行时 API `InputBudgetPruner.estimate` 存在。首次 workflow dispatch 因把 `release_tag` 错误用于 checkout ref 而在 checkout 阶段失败，已修正为 dispatch 时 checkout 当前分支、`release_tag` 只用于 release notes URL。第二次 workflow dispatch 进入构建阶段后发现 runtime channel builder 在干净 CI 中只构建 `@nextclaw/ui` 而未先构建其 workspace 依赖，导致 Vite 解析 `@nextclaw/ncp-toolkit` 的 `dist` 失败；真实下载/apply 验证又发现 runtime bundle 中 `@nextclaw/core` 等 workspace runtime 依赖即使已构建，也可能没有被 `pnpm deploy` 带入 bundle。builder 已改为 `pnpm --filter nextclaw... build`，按拓扑构建 `nextclaw` 及其 workspace 依赖，并在 deploy 前刷新 pnpm workspace package 快照。随后又在发布 `gh-pages` 阶段命中 GitHub 100MB 单文件限制：四个平台 zip 中，两个 Darwin 包约 299MB，Linux/Windows 也超过 100MB，导致 push 被 pre-receive hook 拒绝。最终修复是保持 `gh-pages` 只承载小体积 manifest 与 `update-bundle-public.pem`，把 `nextclaw-runtime-*.zip` 改为上传到与 release tag 对应的 GitHub Release assets，再由 manifest 的 `bundleUrl` 直接指向 release 下载地址。第三次 workflow dispatch `25412612830` 已成功完成：四个平台 bundle 构建成功、release assets 上传成功、`gh-pages` manifest 发布成功。

当前新增未发布修复状态：

- `nextclaw`：有。当前工作区额外包含“`nextclaw restart` 识别并接管前台 `serve` runtime”“`startUiServer` 真实 ready 契约修复”以及“macOS LaunchAgent 取消 `KeepAlive` 反复拉起 `serve`”三项未发布修复；待本次提交并随下一次 beta 统一发布。
- 发布入口侧：有。当前工作区额外包含 `pnpm release:beta`、`/release-beta` 与 `npm-beta-release` skill 三项未发布发布闭环收敛；目的是让后续 beta 发版可以直接复用，不再靠人工回忆流程。

最终真实用户路径验收（隔离目录）：

- 从真实 npm registry 安装 `nextclaw@0.18.12-beta.2`，初始 `nextclaw --version` 为 `0.18.12-beta.2`。
- 运行 `nextclaw update --channel beta --check --json`，返回 `status=update-available`、`availableVersion=0.18.12-beta.3`、`minimumHostVersion=0.18.11`。
- 运行 `nextclaw update --channel beta --json`，返回 `status=downloaded`、`downloadedVersion=0.18.12-beta.3`，且 `nextclaw --version` 仍保持 `0.18.12-beta.2`，证明自动下载不会自动生效。
- 运行 `nextclaw update --channel beta --apply --json`，返回 `status=restart-required`、`currentVersion=0.18.12-beta.3`。
- 新进程再次执行 `nextclaw --version`，输出 `0.18.12-beta.3`，确认真实用户路径的 check / download / apply / 新版本生效闭环成立。

本次发布复盘：慢点不是单一构建速度，而是缺少发布前阻断机制，导致问题按“beta0 依赖缺 export -> workflow checkout ref -> CI workspace dist -> runtime apply 缺 dist -> 真实发消息 API 版本不匹配”的顺序串行暴露。已把 NPM release skill 增加为发布前必须做依赖闭包 API 检查、真实安装 smoke、runtime update check/download/apply/new-process 验证，并要求每次 release attempt 后把耗时堵点转成 skill rule、preflight script、CI gate 或 smoke command，不能只写复盘叙述。

同批次新增真实已发布 API 自动更新验收（`0.18.12-beta.4`）：

- `gh run view 25435357020 --json status,conclusion,url,jobs` 返回 `status=completed`、`conclusion=success`，确认新的 runtime beta channel 已发布。
- `curl -fsSL 'https://peiiii.github.io/nextclaw/npm-runtime-updates/beta/manifest-beta-darwin-arm64.json?ts=<unix>'` 返回 `latestVersion=0.18.12-beta.4`、`minimumLauncherVersion=0.18.11`、`bundleUrl` 指向 `nextclaw@0.18.12-beta.4` release asset。
- `gh release view 'nextclaw@0.18.12-beta.4' --json url,isPrerelease,assets` 确认四个平台 `nextclaw-runtime-*-0.18.12-beta.4.zip` assets 已上传；release 上旧的 beta.3 资产仍在，但 manifest 已切到 beta.4 资产，不影响用户更新路径。
- 用全新临时 prefix / `NEXTCLAW_HOME` 安装 `nextclaw@beta` 后，`nextclaw --version` 输出 `0.18.12-beta.4`。
- 启动 `nextclaw serve --ui-port 18784` 后，`GET /api/runtime/update` 首次即返回 `channel=beta`、`status=downloading`、`errorMessage=null`，并连续上报 `progress`（实际观察到 `16% -> 19% -> ... -> 100%`）。
- 轮询直到状态变为 `downloaded`，此时 `downloadedVersion=0.18.12-beta.4`、`canApplyInApp=true`。
- `POST /api/runtime/update/apply` 返回 `status=restart-required`、`currentVersion=0.18.12-beta.4`；旧服务进程随即退出。
- 用同一 `NEXTCLAW_HOME` 重启 `serve` 后，再次查询 `/api/runtime/update` 得到 `currentVersion=0.18.12-beta.4`、`status=up-to-date`。这条链路直接证明“自动下载但手动应用生效”的真实已发布 beta 用户路径已经闭环。
- 另外记录一个发布核对细节：GitHub Pages 存在短时缓存，裸 `curl` 可能暂时看到旧 manifest；验收时应使用 cache-busting query，或直接核对 `gh-pages` 最新 commit `95d29a83` 的 manifest 内容。

同批次新增旧 `beta.3` 自动恢复验收（stable recovery manifest）：

- 根因再确认：真实已发布 `nextclaw@0.18.12-beta.3` 原样启动后，`GET /api/runtime/update` 返回 `channel=stable`、`status=failed`、`errorMessage=runtime update manifest request failed with status 404`。
- 修复策略不是改旧安装体，而是发布一个 recovery-only 的 stable manifest：`latestVersion=0.18.12-beta.4`，`minimumLauncherVersion=0.18.12-beta.3`。这样只有坏掉的 `beta.3+` launcher 会命中，`0.18.11` 等普通 stable 用户不会被拉到 beta runtime。
- 为此补充 `.github/workflows/npm-runtime-update-release.yml` 的 `minimum_launcher_version_override` workflow_dispatch 输入，并在 build 步骤把 override 透传给 `packages/nextclaw/scripts/build-npm-runtime-update-channel.mjs`。
- 恢复发布 workflow：`25436582081`，成功后 `gh-pages` 最新 commit 为 `0e0288ebd9b833c44b0e3fd04801fa37b8d42f06`。
- `origin/gh-pages:npm-runtime-updates/stable/manifest-stable-darwin-arm64.json` 已确认包含：
  - `latestVersion = 0.18.12-beta.4`
  - `minimumLauncherVersion = 0.18.12-beta.3`
  - `bundleUrl` 指向 `nextclaw@0.18.12-beta.4` release asset
- 等待 GitHub Pages 从 `building` 变为 `built` 后，公开 stable manifest URL 变为 `200`。
- 真实旧安装体验证：
  - 使用原始已发布 `nextclaw@0.18.12-beta.3` 安装体，不改代码，只换新的空 `NEXTCLAW_HOME`。
  - 启动 `serve` 后，`GET /api/runtime/update` 首次即返回 `channel=stable`、`availableVersion=0.18.12-beta.4`、`minimumHostVersion=0.18.12-beta.3`、`status=downloading`，并出现连续下载进度。
  - 自动下载完成后状态变为 `downloaded`。
  - `POST /api/runtime/update/apply` 返回 `status=restart-required`、`currentVersion=0.18.12-beta.4`。
  - 同一安装体的新进程 `nextclaw --version` 输出 `0.18.12-beta.4`。
- 这条验证证明：之前复现的旧 `beta.3` 真实故障场景，已经通过恢复发布被修复；旧版本不仅能升到高版本，而且现在会在原本失败的 stable 自动检查链路里直接恢复。
- 本次额外发现：当前公网 `beta` 与 `stable` runtime manifest 指向的 `0.18.12-beta.4` bundle 都会在下载末端报 `sha256 mismatch`。这会阻塞新的在线自动下载，但不是这次“点击更新后前台服务退出”的代码根因；后者已通过本地签名更新源完成真实接口验收。公网 bundle 合同问题需要在下一次 runtime channel 发布时单独纠正。

同批次发布链路提速补充（`release:beta` / runtime workflow）：

- 已再次确认：`pnpm release:beta` 分两段
  - 本地 `release:auto` / npm publish
  - 若 batch 含 `nextclaw`，再走远端 `npm-runtime-update-release` workflow
- runtime workflow 慢的根因不是“写一点 manifest 元数据”，而是必须在 4 个平台 runner 上构建、签名并上传真实 runtime bundle，然后再发布 `gh-pages` manifest。
- 本次识别并消除了一段非必要耗时：原 `scripts/release/release-beta.mjs` 会在 workflow 成功后立刻强校验公网 Pages URL；如果 `gh-pages` 分支已经是新版本，但 GitHub Pages 仍处于 `building` / CDN 传播延迟，脚本会误判失败，逼人重复 rerun 整个 beta 发布。
- 已把 manifest 校验职责拆到 `scripts/release/release-runtime-manifest-verify.mjs`，并改成：
  - 先验证 `gh-pages` 分支上的 manifest 是否已正确指向新版本
  - 再短轮询公网 Pages URL
  - 若 `gh-pages` 正确且 Pages 仍在 `building`，输出提示而不是把整次发布判失败
- 本次真实发布 `nextclaw@0.18.12-beta.8` 时已命中并验证这条优化：`gh-pages` 分支先更新到 `beta.8`，随后 GitHub Pages 从 `building` 进入 `built`，公网 URL 最终也返回 `beta.8`。这次之后，Pages 传播延迟不再会把已成功的 runtime workflow 误报成发布失败。

同批次发布入口拆分补充：

- 为了满足“有时只想快速发 npm beta 包，不想立即开放自动更新通道”的需求，本次把 beta 发布入口按语义拆成三类：
  - `pnpm release:beta`：完整闭环，发 npm 包并闭合 runtime update channel
  - `pnpm release:beta:npm`：只发 npm beta 包
  - `pnpm release:beta:runtime`：只补发 beta runtime update channel
- `release:beta:npm` 通过包装 `release-beta.mjs --skip-runtime-channel` 提供一个显式、短路径的 npm-only 命令，不再要求发布者记忆参数语义。
- `release:beta:runtime` 会默认读取当前已发布的 `nextclaw@beta` 版本，然后单独触发 `npm-runtime-update-release`，等待 workflow 成功，并校验 release assets、`gh-pages` manifest 与公网 manifest。
- 相关入口已同步到：
  - `package.json`
  - `commands/commands.md`
  - `AGENTS.md` 命令索引
  - `npm-beta-release` / `npm-release-contract-guard` skill
