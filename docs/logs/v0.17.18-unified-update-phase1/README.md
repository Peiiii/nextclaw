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
- 同步 `apps/desktop`、`@nextclaw/ui` 与 `nextclaw` 对 `@nextclaw/kernel` 的 workspace 依赖，并更新 lockfile。

设计依据见 [统一更新系统设计文档](../../designs/2026-05-05-unified-update-system-design.md)。

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
- 新增 NPM runtime update 正式发布链路：
  - `packages/nextclaw/scripts/build-npm-runtime-update-channel.mjs` 负责构建自包含 runtime bundle、生成 `hostKind=npm-runtime-bundle` 的签名 manifest，并写入包内 `resources/update-bundle-public.pem`。
  - `packages/nextclaw/npm-runtime-compatibility.json` 固化 NPM runtime update 的 stable / beta launcher floor，默认均保持 `0.18.11`，避免发布时随意提升 minimum launcher version。
  - `.github/workflows/npm-runtime-update-release.yml` 负责把 stable / beta NPM runtime update channel 发布到 `gh-pages` 的 `npm-runtime-updates/<channel>`。
  - NPM launcher 默认从 `https://Peiiii.github.io/nextclaw/npm-runtime-updates` 读取 manifest，并默认读取包内 public key；用户不再需要理解或手动配置 manifest URL / 验签公钥。
  - 已用临时 ed25519 key 在 `/tmp` 生成 beta `manifest-beta-darwin-arm64.json` 与 `nextclaw-runtime-darwin-arm64-0.18.11.zip`，并通过 `nextclaw update --channel beta --check --json` 验证 manifest 读取与签名校验链路。
- `pnpm -C packages/nextclaw-ui test -- --run src/features/system-status/components/desktop-update-config.test.tsx`：通过，1 个测试文件、2 个用例。
- `pnpm -C packages/nextclaw-ui test -- --run src/shared/components/common/brand-header.test.tsx src/features/system-status/components/desktop-update-config.test.tsx`：通过，2 个测试文件、4 个用例，验证版本号旁边下载进度展示与“更新”按钮应用动作。
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

本次尚未发布。后续发布需要随统一 release 流程构建桌面包，并按普通 NPM 发布流程发布受影响 workspace 包。

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
   - 对应 `nextclaw-runtime-<platform>-<arch>-<version>.zip`
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

开发者本机亲自验收桌面更新时，优先运行 `pnpm -C apps/desktop validation:dev-update`。预期流程是：桌面窗口打开后，Stable 初始版本可用；切到 Beta 后可检测到新版本；点击下载时版本号旁边出现百分比；下载完成后版本号旁边出现“更新”；点击“更新”后应用重启，隔离目录里的 launcher state 与 current pointer 指向 Beta 版本。该开发态入口默认用本地源码 runtime 验证 UI 和更新控制面，因此用于确认“交互、状态、进度展示、手动应用入口”是否正确；完整 bundle 启动后的真实切换仍由 `pnpm -C apps/desktop smoke:update` 覆盖。

过程锚点见 [goal-progress.md](./work/goal-progress.md)。

## 可维护性总结汇总

本次是新增用户可见能力，非测试代码有必要净增长。按当前工作区相关变更统计：总代码新增 2491 行、删除 623 行、净增 1868 行；排除测试后新增 2178 行、删除 469 行、净增 1709 行。增长主要来自共享契约、桌面进度读取、npm runtime bundle layout/update/shim、CLI 命令、完整 smoke 脚本与定向测试；同时删除了旧 npm global self-update service、报告工具和对应测试。

已尽最大努力遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”。本次没有新建独立 update 包，而是把跨 launcher 的稳定字段放进既有 `@nextclaw/kernel`；桌面下载只在现有 `DesktopUpdateService` 增加 stream progress；npm 侧集中在 `packages/nextclaw/src/cli/launcher`，不扩散到 core/runtime/UI；状态编排由明确的 manager / service / store owner 承载。

抽象边界保持为：`@nextclaw/kernel` 负责共享 contract，desktop launcher 负责桌面下载/验签/安装，npm launcher 负责 npm 安装态 runtime bundle 下载/验签/安装/切换，UI 负责渲染 snapshot。该拆分避免了新增独立包，也避免了让 npm 复用 desktop 私有目录与 Electron 假设。

目录结构方面，本次新增 `cli/launcher` 目录一度超过 12 文件预算，已通过合并 version helper、按角色后缀重命名等方式收敛到 12 个文件，并在 `cli/launcher/README.md` 记录目录预算豁免与后续禁止继续新增直接文件的治理边界。当前全量治理仍被工作区已有 NCP 脏改和历史 doc ratchet 阻塞，非本次 update 实现新增问题。

独立可维护性复核结论：保留债务经说明接受。no maintainability findings for update-system-owned files。长期目标对齐 / 可维护性推进：本次顺着“统一入口、统一契约、不同 launcher 只替换具体实现”的方向推进，删除了旧 `npm install -g` self-update 主路径，避免继续保留双更新体系，并补上可重复 smoke 作为长期回归入口。保留债务：npm runtime bundle 的 release 产物生成/发布流水线仍需后续接入；当前工作区已有 NCP 脏改和历史 doc ratchet 仍需单独治理。

同批次补充：为 NPM 安装态新增 `validation:npm-update` 手动验收入口时，没有新增第二套 fixture 生成脚本，而是在既有 `smoke-npm-runtime-update.mjs` 上增加 `--manual` 模式，复用同一组签名 manifest/runtime bundle fixture。定向 maintainability guard 对本次补充文件无 findings；本次补充属于开发者可见验收能力，非测试代码净增主要来自用户指令打印、临时 shim 与公钥文件路径输出，已保持在单脚本内，避免扩散新的目录或服务层。

## NPM 包发布记录

本次开始发布 NPM beta 版本，先提供给用户侧验证；用户确认 beta 没问题后再发布正式版。

- `@nextclaw/kernel`：已发布 `0.1.2-beta.0`，dist-tag 为 `beta`。本次新增共享更新契约类型与 `./update-contract` export，供 `nextclaw` beta runtime 使用。
- `@nextclaw/ui`：待统一发布。本次更新桌面更新配置 UI 与共享契约依赖。
- `nextclaw`：已发布 `0.18.12-beta.1`，dist-tag 为 `beta`，并依赖 `@nextclaw/kernel@0.1.2-beta.0`。`0.18.12-beta.0` 已 deprecated；真实安装验证发现该版本依赖的公网 `@nextclaw/kernel@0.1.1` 缺少 `./update-contract` export，启动会报 `ERR_PACKAGE_PATH_NOT_EXPORTED`。本次 bin 入口改为 npm runtime launcher，并新增 runtime bundle 更新/切换能力；包内已加入与当前公开 update channel 一致的 `resources/update-bundle-public.pem`。
- `@nextclaw/desktop`：桌面应用构建受影响，不作为普通公开 NPM 包记录；需要走桌面 release 构建流程。

当前发布策略：先发布 `nextclaw@beta` 供真实用户路径验证；正式版等待 beta 验收通过后再发布。已验证全新临时目录 `npm install nextclaw@beta` 后 `nextclaw --version` 输出 `0.18.12-beta.1`；`nextclaw update --channel beta --check --json` 当前因公网 runtime beta manifest 尚未发布返回 404，需等待 `npm-runtime-update-release` workflow 发布 channel 后复验。首次 workflow dispatch 因把 `release_tag` 错误用于 checkout ref 而在 checkout 阶段失败，已修正为 dispatch 时 checkout 当前分支、`release_tag` 只用于 release notes URL。
