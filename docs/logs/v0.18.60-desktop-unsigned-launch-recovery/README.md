# v0.18.60 desktop unsigned launch recovery

## 迭代完成说明

- 根因分层确认：
  - `ENOTEMPTY` 来自历史坏 `0.19.6` bundle 目录在修复安装时被同步 `rm` 卡住或失败，导致同版本 seed 无法覆盖。现在 bundle 安装会先验证既有同版本目录，发现 partial/bad cache 后快速改名到 staging trash 并后台删除，再安装干净 bundle。
  - `ERR_FAILED (-2)` 的直接原因不是 runtime HTTP 服务不可达，而是上一版 unsigned 签名修复把 Electron helper 重新签成了会被 macOS `AppleSystemPolicy` 拒绝的形态。现在 macOS unsigned 打包回到完整 adhoc bundle 签名，避免 Renderer helper 被系统杀掉。
  - 历史失败会把同一个 packaged seed sha256 记录成 bad version。新 launcher 修好后如果仍然只按 seed sha256 判断，就会永久跳过同一个 `0.19.6` seed。现在 packaged seed quarantine 同时绑定 launcher/app 壳指纹；壳层变化后会允许同 seed 重试，成功启动后再标记 healthy。
  - `ENAMETOOLONG` 来自 staging 清理路径的二次 trash：清理 `staging/.trash-invalid-*` 时又改名成 `.trash-staging-.trash-invalid-*`，多次启动后无限增长。现在 staging 内遗留目录直接删除，不再二次 trash。
  - 修复上面问题后，真实数据目录还暴露了同版本 quarantined seed 重试卡死：旧 `0.19.6` 目录存在时，重试会复用同版本目录并在后续同步删除大量 runtime 文件。现在 quarantined seed retry 会先替换旧版本目录，再安装 packaged seed。
- 诊断补齐：
  - macOS DMG smoke 失败时会打印新的 main log 区间，并额外带出近 5 分钟 `AMFI / AppleSystemPolicy` 日志，避免只看到最后的 `ERR_FAILED`。
  - smoke 脚本新增 `isolated` / `real` profile，真实用户数据目录问题可以单独验证。
  - `desktop-release-contract-guard` 已新增强制规则：交付 smoke 必须检查当前启动窗口日志，命中 `ENAMETOOLONG` / `ENOTEMPTY` / `ERR_FAILED` / `render-process-gone` / bootstrap 失败即失败；真实机器必须跑 real-profile；runtime ready 且有 provider credentials 时必须跑 `pnpm smoke:ncp-chat` 并拿到 assistant 回复。
- 可维护性修正：
  - `smoke-macos-dmg.sh` 新增逻辑后触发文件长度红线，已把通用诊断与窗口 ready 判定拆到 `apps/desktop/scripts/smoke/macos-smoke-diagnostics.sh`，主脚本从 499 行降到 473 行。

## 测试/验证/验收方式

- 已通过：
  - `pnpm -C apps/desktop build:main`
  - `node --max-old-space-size=4096 node_modules/eslint/bin/eslint.js ...`
  - `bash -n apps/desktop/scripts/smoke-macos-dmg.sh`
  - `bash -n apps/desktop/scripts/smoke/macos-smoke-diagnostics.sh`
  - `pnpm -C apps/desktop exec node --test dist/src/services/desktop-bundle-bootstrap.service.test.js`
  - `pnpm -C apps/desktop exec node --test dist/src/launcher/__tests__/launcher-foundation.test.js`
  - `pnpm -C apps/desktop exec node --test dist/src/services/desktop-update-source.service.test.js`
  - `codesign --verify --deep --strict --verbose=4 apps/desktop/release/mac-arm64/NextClaw\ Desktop.app`
  - `codesign --verify --deep --strict --verbose=2 /Applications/NextClaw\ Desktop.app`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`
  - `pnpm check:governance-backlog-ratchet`
- 真实数据目录恢复验证：
  - 通过 `DesktopBundleBootstrapService` 指向 `/Users/peiwang/Library/Application Support/@nextclaw/desktop` 重放 packaged seed bootstrap，确认 previously quarantined `0.19.6` 可以在新 launcher 指纹下重试并完成安装。
  - 验证 staging 根目录为空，不再残留或继续生成 `.trash-staging-.trash-*` 长路径。
  - 启动真实 `0.19.6` runtime 后，`/api/health` 返回 `ncpAgent: ready` 与 `cronService: ready`。
  - `pnpm smoke:ncp-chat -- --session-type native --model deepseek/deepseek-v4-flash --base-url http://127.0.0.1:18999 --prompt "Reply exactly NEXTCLAW_DESKTOP_SMOKE_OK" --timeout-ms 120000 --json` 返回 `ok: true`，assistant 回复 `NEXTCLAW_DESKTOP_SMOKE_OK`。
  - `NEXTCLAW_DESKTOP_SMOKE_PROFILE=real bash apps/desktop/scripts/smoke-macos-dmg.sh "apps/desktop/release/NextClaw Desktop-0.0.162-arm64.dmg" 120` 通过：从 DMG 临时安装，真实数据目录启动，GUI ready 用时约 10088ms，health URL 为 `http://127.0.0.1:52395/api/health`，日志出现 `ready-to-show`、`did-finish-load`、`Bundle version marked healthy: 0.19.6`。
  - GUI-launched runtime AI smoke 通过：启动 release `.app` 后发现 runtime port `52820`，`/api/health` 返回 ok，`pnpm --silent smoke:ncp-chat -- --session-type native --model deepseek/deepseek-v4-flash --base-url http://127.0.0.1:52820 --prompt "Reply exactly NEXTCLAW_DESKTOP_GUI_AI_OK" --timeout-ms 120000 --json` 返回 `ok: true`，assistant 回复 `NEXTCLAW_DESKTOP_GUI_AI_OK`，耗时约 3551ms。
- 打包验证：
  - `env CSC_IDENTITY_AUTO_DISCOVERY=false NODE_OPTIONS=--max-old-space-size=4096 pnpm -C apps/desktop dist -- --mac dmg --arm64 --publish never`
  - 产物大小：DMG 约 131M，mac zip 约 126M，seed bundle 约 20M。
- 运行验证：
  - release 目录 `.app` 使用隔离 home 直接启动成功，`0.19.6` seed 被安装、runtime health 返回 ok、窗口出现 `ready-to-show` 与 `did-finish-load`，并最终标记 `Bundle version marked healthy: 0.19.6`。
  - 同一 home 的暖启动进入几秒级，runtime startup 约 2.2s，窗口加载与关键 API 请求均成功。
  - 真实数据目录 real-profile DMG smoke 和 GUI-launched AI smoke 均已通过。
- 已知验收边界：
  - 新复制到 `/Applications` 的 unsigned `.app` 在未被系统批准时仍可能触发 macOS unsigned approval。无 Developer ID / notarization 时，代码不能无密码静默绕过这一步。
  - 本机尝试 `spctl --add` 返回该操作不再支持；`xattr -dr com.apple.quarantine` 不足以绕过当前 provenance/trust policy。
  - 本轮最新 release `.app` 已能进入 JS main、完成 bootstrap、启动 GUI runtime、通过 health 和 AI smoke；若用户本机 `/Applications` 旧拷贝仍打不开，应先换成本轮新 DMG 里的 `.app`。

## 发布/部署方式

- 本轮只生成本地 macOS arm64 验证产物，未创建 GitHub release，未发布 update channel。
- 本地产物：
  - `apps/desktop/release/NextClaw Desktop-0.0.162-arm64.dmg`
  - `apps/desktop/release/mac-arm64/NextClaw Desktop.app`
  - `apps/desktop/release/NextClaw Desktop-0.0.162-arm64-mac.zip`

## 用户/产品视角的验收步骤

- 安装后首次打开如果 macOS 拦截 unsigned app，需要在系统 UI 中确认打开；这是 unsigned policy，不是 runtime URL 失败。
- 通过系统批准后，期望启动链路是：
  - 不再出现旧的 `ENOTEMPTY` 修复失败。
  - 不再出现 Renderer helper 被杀导致的 `ERR_FAILED (-2)`。
  - 日志中应看到 packaged seed `0.19.6` 被安装或确认、runtime health ok、窗口 `ready-to-show` / `did-finish-load`、`Bundle version marked healthy: 0.19.6`。
- 暖启动应在几秒级进入可用窗口；冷启动如果需要全新初始化和 seed 解压，会明显更慢，但不应卡在 Dock 弹跳无窗口。

## 可维护性总结汇总

- 非功能修复仍尽量收敛 owner：
  - 签名策略留在 `electron-after-sign.cjs`。
  - seed quarantine 判定留在 `DesktopBundleBootstrapService`。
  - bundle partial cache 替换留在 `DesktopBundleService`。
  - smoke 诊断拆到 `scripts/smoke/` 子模块。
- 删除了不再使用的 `@electron/osx-sign` 直接依赖。
- 删除了 DMG GUI smoke 里的 `ELECTRON_RUN_AS_NODE` fallback 诊断，避免 fallback 成功被误读为 GUI 启动成功；GUI smoke 现在只对真实窗口、renderer load、health 与日志负责。
- 维护性 guard 已通过，无 error；剩余 warnings 主要来自历史目录/文件预算和本轮未触达的 UI 改动。
- `pnpm lint:new-code:governance` 当前仍被无关已存在/并行改动阻塞：`packages/nextclaw-ui/src/features/marketplace/components/marketplace-curated-module-state.ts` 的 React effect 规则。该文件不属于本轮桌面修复范围。

## 机制沉淀

- 失败模式：之前把局部 smoke、进程存活、fallback 或干净环境通过误判为“用户真实桌面可用”，没有把真实数据目录、当前日志窗口、GUI lifecycle、runtime health 和 AI 回复作为同一条交付契约。
- 已沉淀到 `.agents/skills/desktop-release-contract-guard/SKILL.md`：
  - local handoff validation ladder：构建与体积检查、isolated GUI smoke、real-profile GUI smoke、GUI-launched AI smoke、再交付。
  - failure triage playbook：Dock bounce/no window、`ERR_FAILED (-2)`、`ENOTEMPTY`、`ENAMETOOLONG`、same seed quarantine、DMG 体积异常的分诊顺序。
  - forbidden shortcuts：不能用 local node、fallback、codesign、进程存活或 clean smoke 替代真实 GUI 验收。
- 已沉淀到 `.agents/skills/unsigned-desktop-release-playbook/SKILL.md`：
  - 区分 unsigned trust approval 和 product startup failure。
  - 无签名本地构建默认走 macOS UI approval，不要求 Keychain / 本地证书。
  - 如果 JS 已启动，继续看产品日志；不能用“unsigned”掩盖真实 runtime bug。
- 这些落点会在后续 DMG、desktop release、unsigned build、本地安装包交付请求中自动触发，比写普通文档更可靠。

## NPM 包发布记录

不涉及 NPM 包发布。
