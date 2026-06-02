# v0.20.13 Desktop Packaged Channel Extensions

## 迭代完成说明

本次修复桌面端点击微信渠道重新生成二维码时出现 `channel auth is not supported: weixin` 的根因问题。

根因是桌面 runtime 为避免重复启动内置扩展，设置了 `NEXTCLAW_DISABLE_BUILTIN_EXTENSIONS=1`，kernel 因此跳过 `node_modules` 内置 extension 发现；但桌面 seed/product bundle 的 `bundle/plugins` 目录此前只放 `.keep`，没有把 channel extension 作为桌面专属 packaged extension 放入 bundle。结果桌面端没有 weixin channel auth binding，`/api/config/channels/weixin/auth/start` 直接返回 unsupported。

修复方式：

- 保留 `NEXTCLAW_DISABLE_BUILTIN_EXTENSIONS=1`，不恢复 `node_modules` 内置 extension 扫描，避免回到历史上的重复 extension 子进程问题。
- desktop product bundle 显式打包 10 个 channel extension 到 `bundle/plugins/<extension>/`。
- desktop launcher 向 runtime 注入 `NEXTCLAW_PACKAGED_EXTENSION_DIR=<bundle>/plugins`。
- kernel extension manifest discovery 在 builtin discovery disabled 时仍读取显式 packaged extension root。
- seed bundle/package verify 增加 packaged channel extension manifest 和 `dist/main.mjs` 合同检查。

配套设计文档：`docs/designs/2026-06-02-desktop-packaged-channel-extension-discovery.md`。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/kernel test -- src/services/extension-runtime.service.test.ts`：通过，7 个测试通过。
- `pnpm -C apps/desktop build:main && node --test apps/desktop/dist/src/services/runtime-process.service.test.js`：通过，3 个测试通过。
- `node -c apps/desktop/scripts/update/services/build-product-bundle.service.mjs && node -c scripts/desktop/desktop-package-verify.mjs`：通过。
- `pnpm --filter @nextclaw/kernel tsc`：通过。
- `pnpm -C apps/desktop tsc`：通过。
- `pnpm --filter @nextclaw/kernel lint`：通过。
- `pnpm -C apps/desktop lint`：通过。
- `pnpm -C apps/desktop bundle:seed -- --channel stable --output-dir ../../tmp/desktop-packaged-extension-validation`：通过，seed zip 生成成功。
- seed zip 结构验证：`bundle/plugins` 包含 10 个 channel extension，每个 extension 都有 `nextclaw.extension.json` 和 `dist/main.mjs`。
- bundle 体量对比：HEAD 中旧 seed bundle 约 `4,975,387` bytes；本次验证生成的 seed bundle 约 `8,722,655` bytes，增长约 `3.75MB`，作为携带 10 个 packaged channel extensions 的代价可接受。
- 接口级冒烟：使用真实 seed bundle runtime、`NEXTCLAW_DISABLE_BUILTIN_EXTENSIONS=1`、`NEXTCLAW_PACKAGED_EXTENSION_DIR=<extracted>/bundle/plugins` 启动隔离 runtime，等待 `Channels enabled: ... weixin` 后调用 `POST /api/config/channels/weixin/auth/start`，返回 `200`、`kind=qr_code`、`channel=weixin`、包含 `sessionId` 与 `qrCodeUrl`。
- `pnpm check:governance-backlog-ratchet`：通过。
- `pnpm lint:new-code:governance`：未全局通过，原因是工作区已有 touched 文件 `packages/nextclaw-core/src/features/config/configs/schema.ts` 命中 file-role-boundaries，不属于本次触达范围。
- 路径级 maintainability guard：通过，无 error；`scripts/desktop/desktop-package-verify.mjs` 接近 500 行预算，记录后续拆分缝。

## 发布/部署方式

本次尚未发布桌面安装包或 NPM 包。变更需要进入后续 desktop release / update bundle 流程后生效。

## 用户/产品视角的验收步骤

1. 安装包含本修复的桌面端。
2. 打开 Channels 配置里的 Weixin。
3. 点击重新生成二维码。
4. 预期不再出现 `channel auth is not supported: weixin`。
5. 预期接口返回二维码会话，并在 UI 显示二维码等待扫码。

## 可维护性总结汇总

本次没有恢复 builtin discovery，也没有引入第二套桌面 runtime extension 机制，而是把“桌面 bundle 自带 extension”建成显式 packaged root，职责边界更清楚：bundle 负责携带，desktop launcher 负责注入路径，kernel discovery 负责读取显式 root。

代码有净增长，原因是补齐缺失的产品打包合同和验证合同；主要增长集中在 bundle 打包脚本与 seed verify 脚本。后续维护风险是 `scripts/desktop/desktop-package-verify.mjs` 接近 500 行预算，下一步拆分缝是把 seed bundle 结构校验抽到独立 verifier 模块。

## NPM 包发布记录

不涉及 NPM 包发布。本次修复需要随桌面端 bundle / desktop release 发布后生效。
