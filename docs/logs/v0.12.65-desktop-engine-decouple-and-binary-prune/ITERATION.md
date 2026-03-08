# v0.12.65 desktop-engine-decouple-and-binary-prune

## 迭代完成说明（改了什么）

- 将 Codex / Claude runtime engine 从默认内置链路中解耦：
  - `packages/nextclaw-openclaw-compat/src/plugins/loader.ts` 移除 bundled runtime engine 插件自动加载逻辑。
  - `packages/nextclaw-openclaw-compat/package.json` 移除 `@nextclaw/nextclaw-engine-codex-sdk` 与 `@nextclaw/nextclaw-engine-claude-agent-sdk` 依赖。
- 新增桌面打包后裁剪脚本：
  - 新增 `apps/desktop/scripts/electron-after-pack.cjs`，在 `afterPack` 阶段按目标平台/架构清理无关二进制与默认不内置的 engine 插件包。
  - `apps/desktop/package.json` 增加 `build.afterPack` 钩子。
- 对齐本地与 CI 的构建顺序，避免 workspace 依赖未构建导致行为不一致：
  - `scripts/desktop-package-build.mjs`
  - `scripts/desktop-package-verify.mjs`
  - `.github/workflows/desktop-validate.yml`
  - `.github/workflows/desktop-release.yml`
  在打包前新增 `packages/nextclaw-openclaw-compat` 与 `packages/nextclaw-server` 构建步骤。
- 调整 workspace 依赖引用以确保桌面链路使用本地包：
  - `packages/nextclaw-server/package.json`：`@nextclaw/openclaw-compat -> workspace:*`
  - `packages/nextclaw/package.json`：`@nextclaw/openclaw-compat/@nextclaw/server -> workspace:*`

## 测试/验证/验收方式

- 静态/语法校验：
  - `node --check scripts/desktop-package-build.mjs`
  - `node --check scripts/desktop-package-verify.mjs`
  - `node --check apps/desktop/scripts/electron-after-pack.cjs`
  - `bash -n apps/desktop/scripts/smoke-macos-dmg.sh`
- 关键包构建与类型校验：
  - `pnpm -C packages/nextclaw-openclaw-compat lint && pnpm -C packages/nextclaw-openclaw-compat tsc && pnpm -C packages/nextclaw-openclaw-compat build`
  - `pnpm -C packages/nextclaw-server lint && pnpm -C packages/nextclaw-server tsc && pnpm -C packages/nextclaw-server build`
  - `pnpm -C packages/nextclaw lint && pnpm -C packages/nextclaw tsc && pnpm -C packages/nextclaw build`
  - `pnpm -C apps/desktop lint && pnpm -C apps/desktop tsc`
- 根目录一键链路验证：
  - `pnpm desktop:package` 通过，macOS 产物体积降至约 `112 MB`（`dmg/zip`）。
  - `pnpm desktop:package:verify` 通过，安装后健康检查通过。
- 独立插件能力烟测（隔离目录）：
  - 在 `/tmp` 设置 `NEXTCLAW_HOME`，`plugins list` 默认无 codex/claude engine。
  - `plugins install ./packages/extensions/nextclaw-engine-plugin-codex-sdk --link` 后，`plugins list` 可看到 `nextclaw-engine-codex-sdk` 与 `engineKinds: ["codex-sdk"]`。

## 发布/部署方式

- 无数据库迁移。
- 合并后桌面构建命令与 CI 自动生效：
  - 本地：`pnpm desktop:package` / `pnpm desktop:package:verify`
  - CI：`desktop-validate` / `desktop-release` workflow
- Windows 端同样会走 `afterPack` 裁剪逻辑（基于 `electronPlatformName + arch`）。

## 用户/产品视角的验收步骤

1. 执行 `pnpm desktop:package` 获取桌面包，确认体积明显下降（macOS 当前约 112MB）。
2. 执行 `pnpm desktop:package:verify`，确认安装后可启动且 `/api/health` 验证通过。
3. 启动后默认仅有基础能力，不默认附带 Codex/Claude engine。
4. 需要时由用户手动安装对应 engine 插件（插件机制），安装后再启用对应 engine。
