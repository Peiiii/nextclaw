# v0.18.70 Desktop Update Arch Recovery

## 迭代完成说明

- 根因：桌面 product bundle 的本地存储目录按 `version` 命名，未区分 `platform/arch`。当同一版本号的 arm64 bundle 已经作为 `currentVersion` 留在本机状态里，再用 x64 launcher 启动时，启动阶段会读取同一路径并触发 `bundle arch mismatch: expected x64 but got arm64`，表现为点击更新/重启后应用退出但没有进入可用新进程。
- 确认证据：本机 `/Users/peiwang/Library/Application Support/@nextclaw/desktop/launcher/main.log` 在 2026-05-16 记录了 `packaged=true platform=darwin arch=x64` 后立刻 `Failed to bootstrap runtime: Error: bundle arch mismatch: expected x64 but got arm64`。
- 修复：`DesktopBundleBootstrapService` 在安装 seed 或远端初始 bundle 前，先校验当前 active bundle 是否兼容当前 launcher；若不兼容，清除 current/previous pointer 与候选下载状态，让同架构 packaged seed 或远端 manifest 重新安装。
- 同批减债：删除 packaged seed bootstrap 的冗余叙事日志/计时日志 helper，保留关键成功/失败信号，避免 bugfix 通过增加生产代码维护面完成。

## 测试/验证/验收方式

- `pnpm -C apps/desktop tsc`
- `pnpm -C apps/desktop lint`
- `pnpm -C apps/desktop build:main`
- `node --test apps/desktop/dist/src/services/desktop-bundle-bootstrap.service.test.js`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths apps/desktop/src/services/desktop-bundle-bootstrap.service.ts apps/desktop/src/services/desktop-bundle-bootstrap.service.test.ts`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`

## 发布/部署方式

- 本次只修改源码与测试，尚未执行桌面发布。
- 需要进入正式桌面分发时，应继续走 `desktop-release-contract-guard` 的桌面发布闭环，并验证对应平台 update channel manifest 与 bundle 公钥合同。

## 用户/产品视角的验收步骤

1. 在已有同版本异构 bundle 状态的机器上启动 NextClaw Desktop。
2. 观察 launcher 不再因为 `bundle arch mismatch` 直接退出。
3. 确认启动准备阶段会清理不兼容 active pointer，并安装当前 launcher 架构兼容的 seed 或远端 bundle。
4. 点击左上角更新并重启后，应用应回到可用窗口，而不是停留在退出状态。

## 可维护性总结汇总

- 已使用 `post-edit-maintainability-review` 做收尾判断。
- 代码增减报告：新增 70 行，删除 50 行，净增 20 行。
- 非测试代码增减报告：新增 35 行，删除 48 行，净增 -13 行。
- 正向减债动作：删除。删除了低价值 packaged seed 日志 helper 与计时拼接，保留核心启动诊断，使修复后的 bootstrap owner 更聚焦。
- 目录和文件组织未新增新文件，未扩大桌面服务目录结构。

## NPM 包发布记录

- 不涉及 NPM 包发布。
