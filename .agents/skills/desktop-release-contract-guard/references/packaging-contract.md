# Desktop 打包合同

- 先运行 `pnpm desktop:package:verify`；给维护者可点击 macOS 产物前再运行 `pnpm desktop:package:handoff:verify`。
- 干净 clone 在 `pnpm install --frozen-lockfile` 后必须能验证，不能依赖旧 workspace dist。
- 直接 `dist/pack` 前先运行 `pnpm -C apps/desktop bundle:public-key:ensure`。
- 包内必须有 `Contents/Resources/update/update-bundle-public.pem`，且可验证目标 manifest。
- 用 `pnpm -C apps/desktop bundle:minimum-launcher-version -- --channel <stable|beta>` 检查 floor；纯 UI/runtime 普通修复不提高 floor。
- bundle 必须包含 runtime CLI、UI、worker 和内置 skill 等声明资产，禁止打入 raw `runtime/node_modules`，并保持文件数预算。
- 构建脚本跨 Windows/macOS/Linux，禁止依赖 POSIX shell expansion；优先 Node 脚本和工具原生 glob。
- 输出 artifact 路径和大小；异常体积先检查重复 runtime、旧 release 内容和依赖。
