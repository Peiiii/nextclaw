# v0.15.86-desktop-launcher-bundle-foundation

## 迭代完成说明

- 桌面端启动主链路已从“固定依赖打包内 runtime”推进到“优先解析 active product bundle”，并把 bundle source、legacy source、环境变量覆盖三种来源显式区分开。
- 已删除旧的 [updater.ts](/Users/peiwang/Projects/nextbot/apps/desktop/src/updater.ts)，不再把 `electron-updater` 视为桌面端免下载更新的主合同。
- 已新增 launcher 基础层并收拢到 [apps/desktop/src/launcher](/Users/peiwang/Projects/nextbot/apps/desktop/src/launcher)，当前包含：
  - bundle 目录与 pointer/state 管理
  - bundle manifest 解析
  - active bundle 解析与本地 bundle 安装
  - candidate 激活、健康确认、自动回滚
  - update manifest 解析
  - 远端 bundle 下载、zip 解包、本地安装与 SHA-256 完整性校验
- 在收到“角色优先于领域、不要发明假角色、不要保留无意义 barrel”的反馈后，launcher 目录最终收敛为三层稳定角色：
  - `services/`：`bundle.service.ts`、`bundle-lifecycle.service.ts`、`update.service.ts`
  - `stores/`：`bundle-layout.store.ts`、`launcher-state.store.ts`
  - `utils/`：`bundle-manifest.utils.ts`、`update-manifest.utils.ts`、`version.utils.ts`
- 已删除 launcher 内所有 `index.ts` barrel，`main.ts` 与 `runtime-config.ts` 都直接依赖真实文件路径，不再增加中转层。
- 已把这轮目录治理经验沉淀为 skill：
  - [role-first-file-organization](/Users/peiwang/Projects/nextbot/.agents/skills/role-first-file-organization/SKILL.md)
- `main.ts` 现在会在桌面启动前先处理 pending candidate：第一次允许 candidate 启动一次；如果该 candidate 已启动过但未被标记健康，则下次启动前自动回滚到上一已知健康版本。
- `main.ts` 现在还会接入真正的产品包更新闭环：
  - 已发布桌面包默认会从 GitHub Release 的 `manifest-stable-<platform>-<arch>.json` 拉取 stable update manifest；`NEXTCLAW_DESKTOP_UPDATE_MANIFEST_URL` 只再作为显式 override
  - launcher 会先校验 update manifest 的 Ed25519 `manifestSignature`，通过后才信任其中的 bundle URL、版本号与 hash/signature 元数据
  - 若未发现 active bundle，则会先尝试拉取首个 stable bundle 再启动桌面端
  - 若已有 active bundle，则会在后台检查更新、下载 zip 产品包、校验 SHA-256 与 Ed25519 `bundleSignature`、解包安装到 `versions/`、激活为 candidate，并弹出“Restart Now / Later”提示
  - 用户确认重启后，launcher 会在下一次启动时切到新 bundle；如果新版本没有健康确认成功，后续启动会自动回滚
  - 若远端最新版本已经被本机标记为坏版本，则 launcher 会显式 quarantine 它，不再反复下载和反复激活
- `runtime-config.ts` 现在已经删除 `legacy-runtime` 自动兜底路径，桌面端运行时来源只剩：
  - `bundle`
  - `NEXTCLAW_DESKTOP_RUNTIME_SCRIPT` 显式 override
- 开发态 `pnpm -C apps/desktop dev` 也已切到显式 override，不再偷偷借用旧 fallback。
- 已新增产物侧脚本：
  - [build-product-bundle.service.mjs](/Users/peiwang/Projects/nextbot/apps/desktop/scripts/update/services/build-product-bundle.service.mjs)
  - [build-update-manifest.service.mjs](/Users/peiwang/Projects/nextbot/apps/desktop/scripts/update/services/build-update-manifest.service.mjs)
  - [write-bundle-public-key.service.mjs](/Users/peiwang/Projects/nextbot/apps/desktop/scripts/update/services/write-bundle-public-key.service.mjs)
  - `build-product-bundle.mjs` 会复用 `pnpm --filter nextclaw --prod deploy` 产出自包含 runtime，补出 `ui/`、`plugins/` 与 `manifest.json`，并生成 launcher 可直接消费的 zip product bundle
  - 该脚本会对 zip product bundle 计算 `bundleSha256`、`bundleSignature`，并对 manifest payload 本身生成 `manifestSignature`
  - `write-bundle-public-key.mjs` 会从同一把 Ed25519 私钥导出 launcher 打包内置的公钥文件，避免已发布应用再依赖外部环境变量才能验签
- `electron-after-pack.cjs` 现在会把 `build/update-bundle-public.pem` 拷贝进打包资源目录 `resources/update/update-bundle-public.pem`。
- 本次收尾又修正了两个真正阻断本地 `.dmg` 可用性的产物问题：
  - `update.service.ts` 的 seed zip 解包不再并发 `Promise.all` 写文件，已改成顺序解压，避免超大 bundle 首启时触发 `EMFILE` 导致 seed 安装失败。
  - `build-product-bundle.service.mjs` 生成 runtime bundle 时，`pnpm deploy` 已切到 `--config.node-linker=hoisted`。这样 bundle 内的 runtime `node_modules` 不再依赖 pnpm symlink 拓扑，zip 解包后也能稳定解析 `@nextclaw/core -> undici` 这类运行时依赖，不会再出现桌面端首启 `ERR_MODULE_NOT_FOUND: Cannot find package 'undici'`。
- `main.ts` 追加了更早期的桌面启动日志，日志会优先落到桌面数据目录下的 `launcher/main.log`，便于排查 packaged 环境下 `requestSingleInstanceLock`、seed 安装、runtime bootstrap 这些首启阶段问题。
- 本次续改又给桌面窗口本身补上了 renderer 诊断日志，`launcher/main.log` 现在除了 launcher/runtime 启动链路，还会记录：
  - `BrowserWindow` 的 `did-start-loading / did-finish-load / did-fail-load / did-navigate / did-navigate-in-page / render-process-gone`
  - renderer `console-message`
  - 当前实际路由
  - 桌面窗口对 `/api/auth/status`、`/api/config`、`/api/ncp/sessions` 这些关键请求的发起与返回状态
- 这轮日志补齐后，已用真实 packaged 桌面端确认：桌面窗口自身启动后确实会进入 `/chat`，并实际请求 `/api/config` 与 `/api/ncp/sessions`，且都返回 `200`；因此“桌面端把用户数据目录读错了”目前没有被证据支持。
- 本次续改最终定位并修复了真正影响用户的桌面端可用性问题：打包桌面端原先在 `app.isPackaged === true` 时默认走 `managed-service`，会先执行 `nextclaw start` 再连接固定后台服务端口；这会让桌面端在用户机器上被“已经存在的旧 NextClaw 服务”劫持，进而出现“打开桌面端但会话/provider/model 为空或与当前 bundle 不一致”的不确定行为。
- 现在桌面端运行时已收敛为单一路径：无论开发态还是打包态，都会直接拉起当前桌面 bundle 自带的 runtime `serve` 进程，并连接该进程自己分配的 loopback 端口；桌面端不再依赖系统里已有的 `nextclaw start` 后台服务来决定自己展示哪个 UI / runtime / 数据链路。
- 这次修复的结果是：
  - 桌面端打开后仍然读取 `~/.nextclaw` 下的真实用户数据
  - 但不会再因为本机已有旧后台服务而连到错误的固定端口
  - 打包后的桌面端现在会稳定加载自己当前 bundle 对应的 UI 与 runtime，一起升级、一起回滚、一起切换
- 本次续改又进一步定位并修复了一个只在 macOS `open "/Applications/NextClaw Desktop.app"` / Finder 双击链路下暴露的问题：
  - 原先无证书构建产物虽然带有主可执行文件的 adhoc 标记，但整个 `.app` bundle 并没有形成完整的资源封印，`codesign -dv` 会表现为 `Identifier=Electron`、`Info.plist=not bound`、`Sealed Resources=none`
  - 这会导致“直接运行 `Contents/MacOS/NextClaw Desktop`”和“按 app bundle 语义启动”出现分叉，前者可能看起来正常，后者则会落到不可预测的 macOS bundle 启动行为
  - 现在 [apps/desktop/scripts/electron-after-sign.cjs](/Users/peiwang/Projects/nextbot/apps/desktop/scripts/electron-after-sign.cjs) 已改成：
    - 先验证 `.app` 的 bundle 签名是否完整
    - 若发现是这种不完整的 partial / adhoc 状态，就自动执行 `codesign --force --deep --sign - --timestamp=none <app>` 生成完整的 adhoc bundle 签名
    - 然后再决定是否继续 notarization；无 Apple 凭据时会保留完整 adhoc bundle，但跳过 notarize
  - 这样即使没有 Apple 证书，后续打包出的 `.app` 也至少是“完整可启动的 adhoc bundle”，不会再停留在“只有主二进制有零散签名、app bundle 本体不完整”的坏状态
- 本次排查最终又把“桌面端打开后 provider / model / session 看起来像空的一样”收敛成两类环境污染，并已用日志和真实返回体完成证据化验证：
  - GUI / Finder / Spotlight 链路：历史遗留的 `launchd` 环境里曾残留错误的 `NEXTCLAW_HOME`、`NEXTCLAW_DESKTOP_DATA_DIR`，旧版 packaged desktop 会原样继承它们，导致 runtime 读错用户目录。
  - 当前实现已在 packaged 模式下切断这条继承链：即使 ambient 环境里仍带着错误的 `NEXTCLAW_HOME`、`NEXTCLAW_DESKTOP_DATA_DIR`，桌面端也会强制把 runtime home 固定解析到 `~/.nextclaw`，并把 desktop data dir 固定解析到 `app.getPath("userData")`。
  - 终端 `open` 链路还存在另一个会制造假象的污染项：如果当前 shell 带着 `ELECTRON_RUN_AS_NODE=1`，那么 `open "/Applications/NextClaw Desktop.app"` 拉起的并不是正常 Electron GUI 语义，而是被切成 Node 模式的 Electron；此时“open 没日志 / 行为异常”不能拿来判断 packaged app 主链路是否正常。
  - 因而当前正确的排查口径是：
    - Finder / Spotlight / 双击：重点看 packaged app 是否忽略脏的 `NEXTCLAW_HOME` / `NEXTCLAW_DESKTOP_DATA_DIR`
    - 终端 `open`：必须先排除 `ELECTRON_RUN_AS_NODE`，否则结论无效
- 为了避免桌面壳入口继续膨胀，本次还把 `main.ts` 中新增的日志与窗口诊断逻辑收敛进了：
  - [apps/desktop/src/utils/desktop-logging.utils.ts](/Users/peiwang/Projects/nextbot/apps/desktop/src/utils/desktop-logging.utils.ts)
  - [apps/desktop/src/utils/window-diagnostics.utils.ts](/Users/peiwang/Projects/nextbot/apps/desktop/src/utils/window-diagnostics.utils.ts)
  让 [apps/desktop/src/main.ts](/Users/peiwang/Projects/nextbot/apps/desktop/src/main.ts) 重新回到“桌面启动编排 owner”的职责边界。
- 本次续改已把桌面端“免下载更新”真正落成用户可感知的产品体验，而不再只是主进程后台能力：
  - 默认策略改为“自动检查更新，但不默认自动后台下载”
  - 已支持应用内手动 `检查更新 / 下载更新 / 立即重启更新`
  - 下载与应用已拆成两个明确阶段：下载完成后保留 `downloaded` 状态，是否立即重启仍由用户决定
  - 已新增桌面端更新偏好：`automaticChecks`、`autoDownload`
  - 已新增设置页入口 `/updates`，并同步接入桌面应用菜单入口
- 这次续改同时把桌面更新壳层职责从 [apps/desktop/src/main.ts](/Users/peiwang/Projects/nextbot/apps/desktop/src/main.ts) 再次向外收敛：
  - 新增 [apps/desktop/src/services/desktop-update-shell.service.ts](/Users/peiwang/Projects/nextbot/apps/desktop/src/services/desktop-update-shell.service.ts)，专门承接菜单、IPC、弹窗提示、snapshot 广播与重启应用更新
  - `main.ts` 已从上一轮一度膨胀后的 593 行重新压回 372 行
- renderer 侧新增了完整桥接链路：
  - [apps/desktop/src/preload.ts](/Users/peiwang/Projects/nextbot/apps/desktop/src/preload.ts) 现在会暴露桌面更新 API 与状态订阅
  - [packages/nextclaw-ui/src/desktop/managers/desktop-update.manager.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/desktop/managers/desktop-update.manager.ts) 收敛更新页面的桌面交互 owner
  - [packages/nextclaw-ui/src/desktop/stores/desktop-update.store.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/desktop/stores/desktop-update.store.ts) 负责 renderer 侧状态承载
  - [packages/nextclaw-ui/src/components/config/desktop-update-config.tsx](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/components/config/desktop-update-config.tsx) 提供最终设置页
- 本次又额外修复了一个会让“我已经写好了更新页，但用户安装出来还是旧界面”的发布链路问题：
  - 原先桌面端 `dist/pack` 在生成 `seed-product-bundle.zip` 前只要求 runtime 产物存在，不保证 `packages/nextclaw/ui-dist` 一定按当前源码重新构建
  - 这会导致桌面安装包复用陈旧 `ui-dist`，把旧 UI 一起打进 DMG
  - 现在 [apps/desktop/scripts/update/services/build-product-bundle.service.mjs](/Users/peiwang/Projects/nextbot/apps/desktop/scripts/update/services/build-product-bundle.service.mjs) 已在生成 product bundle 前强制执行 `packages/nextclaw-ui build` 与 `packages/nextclaw build`，把“先拿最新 UI/runtime，再打包”变成显式合同
- 本次还额外修复了一个只在 packaged app 启动后暴露的 preload 桥接问题：
  - 原先 [apps/desktop/src/preload.ts](/Users/peiwang/Projects/nextbot/apps/desktop/src/preload.ts) 通过本地相对模块加载 `desktop-ipc.utils`
  - packaged Electron 在该 preload 场景下会出现本地模块解析失败，导致窗口日志出现 `Unable to load preload script` 与 `module not found: ./utils/desktop-ipc.utils`
  - preload 一旦失效，`window.nextclawDesktop` 桥接就不会注入到 renderer，更新页即使已经打进 UI，也只能退化成“桌面端桥接不可用”的状态
  - 现在 preload 已收敛为自包含入口，直接内联桌面更新 IPC channel 常量，不再依赖本地相对模块解析
- 本次续改还补齐了 update coordinator 的产品语义：
  - 检查更新时会稳定写入 `lastUpdateCheckAt`
  - 已下载版本会在应用或回滚时清理 `downloadedVersion` / `downloadedReleaseNotesUrl`
  - 自动后台下载只会在用户明确打开 `autoDownload` 时发生
- 为了让现有冒烟链继续可用，本次顺手修复了 [apps/desktop/scripts/smoke-runtime.mjs](/Users/peiwang/Projects/nextbot/apps/desktop/scripts/smoke-runtime.mjs) 与当前 `RuntimeServiceProcess` 契约脱节的问题；现在该脚本会传入显式 `runtimeEnv`，并回到当前真实支持的 embedded runtime 启动方式。
- `.github/workflows/desktop-release.yml` 现在会在 release 发布时统一产出并上传：
  - 桌面安装物
  - `nextclaw-bundle-<platform>-<arch>-<version>.zip`
  - `manifest-stable-<platform>-<arch>.json`
  - `update-bundle-public.pem`
- 顺手修复了桌面包入口路径错误：Electron 打包入口现在对齐到 `dist/src/main.js`，不再错误指向不存在的 `dist/main.js`。
- 技术方案见：
  - [2026-04-11-desktop-no-download-update-architecture-design](../../plans/2026-04-11-desktop-no-download-update-architecture-design.md)
  - [2026-04-11-desktop-no-download-update-phase1-implementation-plan](../../plans/2026-04-11-desktop-no-download-update-phase1-implementation-plan.md)
  - [2026-04-12-desktop-update-product-experience-final-design](../../plans/2026-04-12-desktop-update-product-experience-final-design.md)

## 测试/验证/验收方式

- 已执行：`pnpm -C apps/desktop tsc`
  - 结果：通过
- 已执行：`pnpm -C apps/desktop lint`
  - 结果：通过
- 已执行：`pnpm -C apps/desktop build:main && node --test apps/desktop/dist/**/*.test.js`
  - 结果：已收敛为更精确的测试入口 `node --test apps/desktop/dist/src/launcher/__tests__/*.test.js`，通过，`24 passed / 24 total`
- 已执行：`pnpm -C apps/desktop smoke`
  - 结果：通过。删除 `legacy-runtime` 后，桌面端 runtime smoke 仍保持可用。
- 已执行：`pnpm -C packages/nextclaw-ui tsc`
  - 结果：通过
- 已执行：`pnpm -C packages/nextclaw-ui exec eslint src/desktop/desktop-update.types.ts src/desktop/stores/desktop-update.store.ts src/desktop/managers/desktop-update.manager.ts src/components/config/desktop-update-config.tsx src/App.tsx src/components/layout/Sidebar.tsx src/components/layout/sidebar.layout.test.tsx src/lib/ui-document-title.ts src/lib/i18n.ts src/lib/desktop-update-labels.utils.ts`
  - 结果：通过
- 已执行：`pnpm -C packages/nextclaw-ui build`
  - 结果：通过。已确认桌面更新设置页产物被打进 UI bundle，最终 chunk 中包含 `desktop-update-config-*.js`
- 已执行：`node apps/desktop/scripts/update/services/build-update-manifest.service.mjs -- ...`
  - 结果：通过。使用临时 Ed25519 密钥与临时 bundle 文件做了真实冒烟，脚本能产出 manifest，且产出的 `manifestSignature` 与 `bundleSignature` 都可被公钥成功验签。
- 已执行：`node apps/desktop/scripts/update/services/build-product-bundle.service.mjs -- ...`
  - 结果：通过。使用临时输出目录做了真实冒烟，脚本能生成 `nextclaw-bundle-<platform>-<arch>-<version>.zip`，并确认包内至少包含：
    - `bundle/manifest.json`
    - `bundle/runtime/dist/cli/index.js`
    - `bundle/ui/index.html`
    - `bundle/plugins/.keep`
- 已执行：`pnpm -C apps/desktop bundle:public-key -- --private-key-file ... --output ...`
  - 结果：通过。脚本能从 Ed25519 私钥稳定导出与预期一致的 SPKI PEM 公钥。
- 已执行：`CSC_IDENTITY_AUTO_DISCOVERY=false pnpm -C apps/desktop exec electron-builder --dir --mac --arm64 --publish never`
  - 结果：通过。确认 `afterPack` 会把 `update-bundle-public.pem` 复制到打包产物中的 `Contents/Resources/update/update-bundle-public.pem`。
- 已执行：`pnpm -C apps/desktop dist`
  - 结果：通过。已在本地重新生成：
    - `apps/desktop/release/NextClaw Desktop-0.0.134-arm64.dmg`
    - `apps/desktop/release/NextClaw Desktop-0.0.134-arm64-mac.zip`
  - 补充验证：`electron-builder` 输出中已明确命中新加的签名修复分支，日志包含：
    - `bundle signature verification failed; rebuilding adhoc signature`
    - 后续重新签名完成后继续产出 DMG / ZIP
- 已执行：`codesign --verify --deep --strict --verbose=4 'apps/desktop/release/mac-arm64/NextClaw Desktop.app'`
  - 结果：通过。新产物已经是完整的 adhoc bundle 签名，`Identifier=io.nextclaw.desktop`，`Info.plist` 与资源都被 seal 进 bundle。
- 已执行：覆盖安装新构建产物到 `/Applications/NextClaw Desktop.app` 后再次执行 `codesign --verify --deep --strict --verbose=4`
  - 结果：通过。当前机器上的安装版也已经不再是旧的残缺 bundle 签名状态。
- 已执行：`env -u ELECTRON_RUN_AS_NODE bash apps/desktop/scripts/smoke-macos-dmg.sh 'apps/desktop/release/NextClaw Desktop-0.0.134-arm64.dmg' 240`
  - 结果：通过。桌面端本体成功完成：
    - 安装 packaged seed bundle
    - 解析 active bundle runtime
    - 启动本地 runtime
    - 命中 `http://127.0.0.1:59736/api/health`
  - 说明：这次冒烟明确命中了桌面端自身启动出来的 runtime，不再走 fallback runtime。
- 已执行：`env -u ELECTRON_RUN_AS_NODE 'apps/desktop/release/mac-arm64/NextClaw Desktop.app/Contents/MacOS/NextClaw Desktop'`
  - 结果：通过。新的桌面窗口诊断日志已经在 [apps/desktop/src/main.ts](/Users/peiwang/Projects/nextbot/apps/desktop/src/main.ts) 对应的 packaged 应用里生效，并在 `~/Library/Application Support/@nextclaw/desktop/launcher/main.log` 中确认到：
    - 桌面窗口实际加载 `http://127.0.0.1:53489/chat`
    - renderer 真实发起 `GET /api/ncp/sessions?limit=200`
    - renderer 真实发起 `GET /api/config`
    - 两者都返回 `200`
- 已执行：`env -u ELECTRON_RUN_AS_NODE open -n "/Applications/NextClaw Desktop.app"`
  - 结果：通过。`~/Library/Application Support/@nextclaw/desktop/launcher/main.log` 明确记录：
    - `runtimeHome=/Users/peiwang/.nextclaw`
    - `resolvedRuntimeHome=/Users/peiwang/.nextclaw`
    - `resolvedDesktopDataDir=/Users/peiwang/Library/Application Support/@nextclaw/desktop`
    - renderer 真实发起 `/api/config`、`/api/config/meta`、`/api/ncp/sessions`，且均返回 `200`
- 已执行：`env -u ELECTRON_RUN_AS_NODE NEXTCLAW_HOME=/tmp/nextclaw-bad-home-open NEXTCLAW_DESKTOP_DATA_DIR=/tmp/nextclaw-bad-desktop-open open -n "/Applications/NextClaw Desktop.app"`
  - 结果：通过。虽然日志里仍能看到：
    - `ambientNextclawHome=/tmp/nextclaw-bad-home-open`
    - `ambientDesktopDataDir=/tmp/nextclaw-bad-desktop-open`
    但 packaged app 最终仍固定解析到：
    - `runtimeHome=/Users/peiwang/.nextclaw`
    - `resolvedRuntimeHome=/Users/peiwang/.nextclaw`
    - `resolvedDesktopDataDir=/Users/peiwang/Library/Application Support/@nextclaw/desktop`
- 已执行：重新生成 `apps/desktop/build/update/seed-product-bundle.zip` 后直接解包检查
  - 结果：通过。新的 seed bundle 已明确包含：
    - `bundle/ui/assets/desktop-update-config-*.js`
    - `/updates` 路由
    - `desktopUpdatesPageTitle`
    - `desktopUpdatesAutomaticChecks`
  - 说明：这次验证直接证实“桌面安装包里已经不是旧前端”，根因确认为旧 `ui-dist` 被复用的问题已消除。
- 已执行：覆盖安装最新构建产物到 `/Applications/NextClaw Desktop.app` 后，再直接解包其中的 `Contents/Resources/update/seed-product-bundle.zip`
  - 结果：通过。安装后的 app 资源里同样包含 `desktop-update-config-*.js` 与 `/updates` 路由，不再是旧 seed bundle。
- 已执行：直接启动 `/Applications/NextClaw Desktop.app/Contents/MacOS/NextClaw Desktop` 并检查 `~/Library/Logs/@nextclaw/desktop/main.log`
  - 结果：通过。最新日志已确认：
    - `Runtime source: bundle`
    - `Bundle version: 0.17.6`
    - 不再出现 `Unable to load preload script`
    - 不再出现 `module not found: ./utils/desktop-ipc.utils`
    - 启动后已进入 `Desktop update snapshot changed. status=idle/checking/failed ...`
  - 说明：这次验证确认 packaged preload 桥接已真正恢复，桌面更新页不再因为 preload 失效而退化。
- 已执行：Playwright 直接拉起刚打包出来的 [apps/desktop/release/mac-arm64/NextClaw Desktop.app](/Users/peiwang/Projects/nextbot/apps/desktop/release/mac-arm64/NextClaw%20Desktop.app) 二进制，并在页面内读取桌面 UI 当前状态
  - 结果：通过。确认桌面端当前使用自己的独立 loopback 端口而不是固定 `55667`，并且页面内可直接读到：
    - `providerKeys = ["nextclaw", "minimax", "custom-1", "custom-2", "dashscope", "custom-3", "custom-4"]`
    - `defaultModel = "dashscope/qwen3.6-plus"`
    - `metaProviderCount = 20`
    - `sessionCount = 912`
  - 说明：这次验证直接覆盖了用户最关心的结果，即“桌面端打开后能正常加载原有 `~/.nextclaw` 数据，而不是空 provider / 空 model / 空会话列表”。
- 本次续改还补上了桌面 bundle 存储回收策略，避免版本目录无限增长：
  - launcher 现在只保留被当前状态明确引用的版本：`currentVersion`、`previousVersion`、`lastKnownGoodVersion`、`candidateVersion`、`downloadedVersion`，以及 `current.json` / `previous.json` 指针指向的版本
  - 一旦版本切换、下载待应用、回滚或健康确认完成，未被这些引用命中的旧 `versions/<version>` 目录会自动删除
  - `staging/` 只再承担临时下载/解压用途，启动时与清理时会主动清掉历史残留
  - 因而桌面端更新链路现在的空间上界已收敛为“当前版本 + 一个回滚版本 + 一个已下载待应用版本 + 短生命周期 staging”，而不是每升级一次永久多留一整份 UI/runtime/plugins
- 为了避免桌面入口继续膨胀，本次又把“启动前 seed 安装 / 远端首包拉取 / pending candidate 恢复 / bundle 存储清理”从 [apps/desktop/src/main.ts](/Users/peiwang/Projects/nextbot/apps/desktop/src/main.ts) 收敛进了 [apps/desktop/src/services/desktop-bundle-bootstrap.service.ts](/Users/peiwang/Projects/nextbot/apps/desktop/src/services/desktop-bundle-bootstrap.service.ts)，让桌面入口重新只承担 Electron 生命周期与窗口装配。
- 已执行：`ruby -e 'require "yaml"; YAML.load_file(".github/workflows/desktop-release.yml")'`
  - 结果：通过。release workflow YAML 语法可正常解析。
- 已执行：`pnpm lint:maintainability:guard`
  - 结果：通过。当前剩余输出仅为预警，没有新增硬错误；本次新增链路的治理检查、命名检查、owner 边界检查均已通过。
- 已执行：`pnpm dlx tsx --test apps/desktop/src/launcher/__tests__/launcher-foundation.test.ts`
  - 结果：通过。21/21 测试全部通过，其中新增覆盖了：
    - 仅保留被状态引用的版本目录
    - 清理 `staging/` 历史残留
    - 健康确认后自动删除更老的无引用版本
- 已执行：`pnpm dlx tsx --test apps/desktop/src/launcher/__tests__/update-coordinator.service.test.ts`
  - 结果：通过。4/4 测试全部通过，其中新增确认：
    - “先下载、后应用”模式下仍会保留当前版本与待应用版本
    - 下载新版本后会自动删除更老且无引用的历史版本
- 已执行：`pnpm -C apps/desktop build:main`
  - 结果：通过。
- 已尝试执行：`python3 /Users/peiwang/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/role-first-file-organization`
  - 结果：未通过，失败原因不是 skill 本身，而是当前本机 Python 环境缺少 `yaml` 模块，报错 `ModuleNotFoundError: No module named 'yaml'`

## 发布/部署方式

- 本次只完成桌面端 launcher 基础层，不涉及数据库、远程 migration 或生产环境部署。
- 若要随桌面包发版，按现有桌面构建链路执行 `pnpm -C apps/desktop build:main` 后继续现有 Electron 打包流程即可。
- 当前已实现远端 update manifest 解析、版本比较、zip 产品包下载、SHA-256 校验、Ed25519 bundle 签名校验、zip 解包安装、candidate 激活、重启切换提示、坏版本 quarantine 与启动失败自动回滚。
- 当前已打通 release 自动产物链路：`desktop-release` 会从 `NEXTCLAW_DESKTOP_BUNDLE_PRIVATE_KEY` 导出公钥、构建桌面安装物、构建 product bundle、生成 signed manifest，并把这些文件一起上传到 GitHub Release。
- 当前仍未实现：
  - 桌面 launcher 自身更新
- 现阶段实际发布桌面端免下载更新时，桌面端默认会直接消费 GitHub Release 的 stable manifest 与打包内公钥；只有在本地联调、灰度或私有源场景下，才额外使用：
  - `NEXTCLAW_DESKTOP_UPDATE_MANIFEST_URL`
  - `NEXTCLAW_DESKTOP_BUNDLE_PUBLIC_KEY`

## 用户/产品视角的验收步骤

1. 在桌面端数据目录下准备一个合法的 product bundle，并把 `current.json` 指向该版本。
2. 启动桌面端，确认日志里会打印 `Runtime source: bundle`，且应用能正常拉起该 bundle 内的 runtime。
3. 将一个新版本 bundle 激活为 candidate 后重启桌面端，确认第一次会尝试启动 candidate，而不是在启动前被错误回滚。
4. 让该 candidate 在首次启动后被标记健康，确认后续再次重启时不会触发回滚。
5. 模拟 candidate 启动失败且未完成健康确认，再次启动桌面端，确认 launcher 会在启动前自动回滚到上一已知健康版本。
6. 对已发布桌面包，确认它默认会请求 GitHub Release 的 `manifest-stable-<platform>-<arch>.json`；本地联调时也可通过 `NEXTCLAW_DESKTOP_UPDATE_MANIFEST_URL` 与 `NEXTCLAW_DESKTOP_BUNDLE_PUBLIC_KEY` 覆盖该默认源。
7. 当 manifest 提供更新版本时，确认桌面端会先校验 manifest 的 `manifestSignature`，再下载 zip 产品包，并继续校验 SHA-256 与 `bundleSignature`，解包安装到 `versions/<new-version>`，并把该版本激活为 candidate。
8. 观察桌面端弹出“NextClaw Update Ready”，点击 `Restart Now` 后确认桌面端重启并切到新 bundle。
9. 故意让新版本在首次启动后未完成健康确认，再次启动桌面端，确认 launcher 会自动回滚到上一已知健康版本。
10. 在没有任何 current bundle 的干净数据目录下，配置 `NEXTCLAW_DESKTOP_UPDATE_MANIFEST_URL` 与 `NEXTCLAW_DESKTOP_BUNDLE_PUBLIC_KEY`，确认桌面端会先拉取首个 stable bundle，再启动应用，而不要求用户手动下载产品包。
11. 将一个已知坏版本号写入 launcher state 的 `badVersions` 后再次提供相同版本 manifest，确认 launcher 会显式跳过该版本，而不是反复下载它。
12. 在本机先人为启动一个旧的 `nextclaw start` 后台服务，再打开最新桌面端，确认桌面窗口仍然会连到自己的独立端口（例如 `http://127.0.0.1:53489/chat`），而不是被旧服务固定端口劫持。
13. 打开桌面端后确认会话列表、provider 列表和默认模型都与 `~/.nextclaw/config.json`、`~/.nextclaw/sessions` 中的真实数据一致，而不是出现空列表。
14. 打开桌面端设置页，确认左侧设置导航已经出现“更新”入口，进入后可看到：
  - 当前桌面壳版本
  - 当前产品版本
  - 可用版本
  - 上次检查时间
15. 在更新页点击“检查更新”，确认应用内状态会在 `idle / checking / update-available / up-to-date / downloaded / failed` 之间按实际情况切换，而不是直接静默替换当前版本。
16. 在更新页点击“下载更新”，确认只会把新版本下载到本地并进入“已下载待应用”，当前运行版本不应立即改变。
17. 在更新页点击“立即重启更新”，确认应用重启后才切到新版本；若新版本启动失败且没有健康确认，后续再次启动时仍会自动回滚。
18. 切换“自动检查更新”和“发现更新后自动后台下载”两个偏好开关，重启桌面端后确认状态仍能保留，且只有在打开 `autoDownload` 时才会自动进入下载阶段。
19. 打开 `~/Library/Logs/@nextclaw/desktop/main.log`，确认最新启动日志中不再出现 `Unable to load preload script` 与 `module not found: ./utils/desktop-ipc.utils`。
20. 使用最新安装到 `/Applications/NextClaw Desktop.app` 的桌面端进入设置页，确认左侧已经出现“更新”入口，而不是旧版本里缺失该入口的状态。
21. 连续完成多次桌面 bundle 更新后，检查 `~/Library/Application Support/@nextclaw/desktop/versions`，确认不会无限堆积历史版本；正常情况下只应保留：
  - 当前运行版本
  - 一个可回滚版本
  - 一个已下载待应用版本（如果存在）
22. 检查 `~/Library/Application Support/@nextclaw/desktop/staging`，确认桌面稳定运行后不会残留历史下载或历史解压目录。

## 可维护性总结汇总

- 可维护性复核结论：保留债务经说明接受
- 长期目标对齐 / 可维护性推进：本次顺着“桌面端产品版本单元统一、入口合同更单一、运行来源更可解释”的长期方向又推进了一步。相比继续往旧 `electron-updater` 路径堆 patch，这次把“manifest -> 下载 -> 验签 -> 解包 -> 安装 -> candidate 激活 -> 重启切换 -> 坏版本 quarantine”继续收敛进 launcher 主链路里，桌面更新体验开始真正服从同一份 bundle 合同。
- 本次是否已尽最大努力优化可维护性：是
- 是否优先遵循删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好：是。本次没有新增新的兼容分支或隐藏 fallback，而是把“版本保留多少”收敛成单一、显式的引用保留规则，同时删除了“版本目录会一直堆着不管”的隐性维护债。
- 本次桌面端可用性修复也遵循了“单路径优先、可预测优先”的原则：没有再在 `managed-service` 上叠加“如果发现旧服务就猜测是否重启 / 强行接管 / 根据端口做兼容”的 incident patch，而是直接删除桌面端对外部后台服务的依赖，把契约收敛成“桌面 app 启动就拉起自己 bundle 的 runtime 并连接自己的端口”。
- 本次关于磁盘占用的修复也遵循了同样原则：不是通过“定时扫描一堆猜测路径”做隐式回收，而是严格围绕 launcher state 与 version pointer 做引用式清理。只要版本不再被当前运行、回滚或待应用语义引用，就自动删除。
- 抽象与边界方面，本次新增的 [apps/desktop/src/services/desktop-bundle-bootstrap.service.ts](/Users/peiwang/Projects/nextbot/apps/desktop/src/services/desktop-bundle-bootstrap.service.ts) 属于必要收敛而非过度拆分：它把原本继续膨胀的 `main.ts` 启动前 bundle 编排收回到单一 service owner，避免入口文件继续承载过多分支。
- 代码增减报告：
  - 统计口径：仅统计本次续改相对上一提交的桌面端相关改动，不含 `docs/` 设计与迭代文档。
  - 新增：`692` 行以上
  - 删除：`51` 行以上
  - 净增：`+641` 行以上
- 非测试代码增减报告：
  - 统计口径：同上，但排除 `*.test.*`、`__tests__/`
  - 新增：`406` 行以上
  - 删除：`49` 行以上
  - 净增：`+357` 行以上
- 若总代码或非测试代码净增长，是否已做到最佳删减：当前已经到这一步的较优收敛点。为了把“下载的归档”真正变成“受信任、可启动、可回避坏版本的新版本”，这次新增主要仍压在已有 `update.service.ts`、三个直接服务 release/update 的脚本，以及 release workflow 本身里；同时我把新增脚本收拢进了 `apps/desktop/scripts/update/` 子目录，避免继续把 `apps/desktop/scripts` 顶层摊平。新增的 manifest 自签名能力也复用了同一把更新密钥，没有再引入第二套签名角色；而旧的 `legacy-runtime` 自动兜底路径已经实际删除。
- 本次续改的额外维护性收益：没有再发明新的“桌面 runtime 兼容层”或“zip 补丁层”，而是直接把问题收敛成两处最小修复：
  - 解压策略从并发改顺序
  - bundle 产物从 symlink 拓扑改为 hoisted 可打包拓扑
  这比继续在 runtime 解析阶段追加隐藏 fallback 更可预测，也更符合“删减优先、单路径优先”的目标。
- 本次针对“安装包仍是旧前端”的修复也遵循了同样的原则：没有再补一层 freshness 猜测器或缓存探测器，而是直接把发布链路改成“先构最新 UI/runtime，再打 seed bundle”的单路径合同。
- 本次 preload 修复同样保持最小收敛：没有新增 preload loader、barrel 或额外 bridge class，只是把 6 个 IPC channel 常量内联回 preload 文件本身，让 packaged preload 行为重新回到最可预测的单文件入口。
- 本次无证书 macOS 打包修复也遵循了同样的思路：没有新增一整套“签名管理框架”或多层包装脚本，只是在已有 `electron-after-sign.cjs` 中把“签名完整性自检 + 必要时补做完整 adhoc 深签名”收敛成最小补丁，避免以后继续靠人工 `codesign` 救火。
- 本次又额外删掉了桌面端 `runtime-service.ts` 里整条 `managed-service` 分支及其相关测试残留，让桌面运行链路不再同时维护“连外部后台服务”和“拉起内嵌 runtime”两套路径；同时把 `main.ts` 中与壳层编排无关的日志/窗口诊断逻辑移动到 `utils`，把入口文件重新压回预算内。
- 本次续改继续沿着“少一点入口膨胀、少一点隐式行为”的方向推进：
  - 把桌面更新壳层编排从 `main.ts` 抽到独立 `DesktopUpdateShellService`
  - 把新增的桌面更新文案从 `i18n.ts` 拆到 [packages/nextclaw-ui/src/lib/desktop-update-labels.utils.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/lib/desktop-update-labels.utils.ts)
  - 把新增的 update coordinator 行为测试拆到 [apps/desktop/src/launcher/__tests__/update-coordinator.service.test.ts](/Users/peiwang/Projects/nextbot/apps/desktop/src/launcher/__tests__/update-coordinator.service.test.ts)，避免原测试文件继续无边界膨胀
- 这次新增的 renderer 诊断日志虽然带来了少量非功能代码，但仍压在现有 `main.ts` 这个桌面壳入口 owner 内，没有再拆新的 logger class、diagnostic service 或 Electron bridge；它解决的是“桌面窗口真实发生了什么无法证据化”这个直接排障缺口，属于最小必要增长。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：部分达成。总代码量相对本大迭代起点仍是净增，但本次这轮续改本身已经删掉了桌面端一整条运行模式分支，并把 `main.ts` 从超预算状态压回预算内；新增的两个 `utils` 文件属于为了降低入口复杂度而做的职责收敛，没有继续恶化目录平铺度。
- 这次最终收尾后，`pnpm lint:maintainability:guard` 已恢复通过；剩余只保留维护性预警，没有再留下本轮新增硬阻断。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰：是。`main.ts` 仍保持壳层协调，负责“何时检查首包 / 何时后台拉更新 / 何时提示重启”；真正的下载、解包、安装、candidate 激活都仍归 `update.service.ts` 拥有。本次没有额外引入 `extractor`、`archive-installer` 之类只包一层的类。
- 是否避免了过度抽象或补丁式叠加：是。本次没有引入额外 framework 式抽象，也没有做 incident-specific fallback patch，并且已经删除 `legacy-runtime` 自动兜底路径，把桌面端运行来源收敛成更可预测的单一路径合同。
- 目录结构与文件组织是否满足当前项目治理要求：当前桌面端链路已满足本次治理要求，`apps/desktop/src` 根目录文件数问题已通过子目录收敛消除，launcher 内也已删除所有无意义 barrel。后续若继续推进 update client / manifest / signer，应继续放在 `launcher/` 目录内，并优先复用现有 `services / stores / utils` 角色，避免重新把 `src` 根目录铺平或发明新的假角色。
- 本次可维护性评估是否基于独立于实现阶段的 review：是。本节基于实现完成后的独立复核，结合了构建、测试、维护性守卫结果与对启动合同/抽象边界的二次判断。
- no maintainability findings
- 可维护性总结：这次续改虽然带来了净增代码，但它补上的是真正缺口，不再只是“会检查更新”，而是“能把归档变成受信任、可切换、可 quarantine 的新 bundle”，并且已经具备产物侧的 bundle 生成、manifest 生成、公钥内置与 CI 发布链路。增长基本都被压在已有 service 和少量直给脚本里，没有继续制造新的角色层；同时旧的 `legacy-runtime` 自动兜底也已经删除。下一条最该盯住的维护性债务是继续避免 `update.service.ts` 与 launcher 测试文件继续膨胀，以及是否要在未来再做 launcher 自更新。
