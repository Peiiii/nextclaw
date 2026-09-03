# Desktop 打包合同

- 先运行 `pnpm desktop:package:verify`；给维护者可点击 macOS 产物前再运行 `pnpm desktop:package:handoff:verify`。
- 干净 clone 在 `pnpm install --frozen-lockfile` 后必须能验证，不能依赖旧 workspace dist。
- 直接 `dist/pack` 前先运行 `pnpm -C apps/desktop bundle:public-key:ensure`。
- 包内必须有 `Contents/Resources/update/update-bundle-public.pem`，且可验证目标 manifest。
- 用 `pnpm -C apps/desktop bundle:minimum-launcher-version -- --channel <stable|beta>` 检查 floor；纯 UI/runtime 普通修复不提高 floor。
- product bundle 运行时资源声明的唯一事实源是 [`product-bundle-assets.config.mjs`](../../../../apps/desktop/scripts/update/configs/product-bundle-assets.config.mjs)；触达 runtime 文件集合、独立 WASM/worker、资源目录、内置扩展或平台原生依赖时，先读取并判断是否需要更新该合同。已声明 `tree` / `pattern` 覆盖范围内的普通文件新增会自动纳入，不重复维护文件清单。
- bundle 必须包含 runtime CLI、UI、worker 和内置 skill 等声明资产，禁止打入 raw `runtime/node_modules`，并保持文件数预算；合同变化后先运行 `pnpm -C apps/desktop bundle:test`。
- runtime 文件集合、native resources 或 bundle 复制规则变化时，开发阶段先在当前平台运行 `pnpm -C apps/desktop bundle:build -- --channel stable`；本地预算/形状通过后再运行五平台验证，正式发布不得成为首次 bundle 构建证据。
- 构建脚本跨 Windows/macOS/Linux，禁止依赖 POSIX shell expansion；优先 Node 脚本和工具原生 glob。
- 输出 artifact 路径和大小；异常体积先检查重复 runtime、旧 release 内容和依赖。
