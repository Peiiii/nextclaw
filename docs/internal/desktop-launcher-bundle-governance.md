# Desktop Launcher / Bundle 治理约定

> 常态文档：桌面 launcher、seed bundle、product bundle、update manifest、验证脚本、发布 workflow 一律遵守本文件。

## 核心原则

- `launcher version` 不是 `minimumLauncherVersion`。
- `minimumLauncherVersion` / `launcherCompatibility.minVersion` 表示“兼容性下限”，不是“当前 launcher 发版号镜像”。
- 默认目标是 `launcher` 与 `bundle` 尽可能解耦，让用户后续主要通过更新 `bundle` 获得能力升级，而不是被迫重下整个 launcher。
- 只有确认发生 `launcher-side contract break` 时，才允许抬高某个 channel 的最低 launcher 版本。

## 唯一受控来源

- stable / beta 的 launcher floor 只认 [`apps/desktop/desktop-launcher-compatibility.json`](../../apps/desktop/desktop-launcher-compatibility.json)。
- 任何脚本、workflow、验证工具、手动验收包、README、skill 或发布说明，都不得从 [`apps/desktop/package.json`](../../apps/desktop/package.json) 当前版本自动推导 `minimumLauncherVersion`。

## 默认行为

- `stable` bundle 默认继续兼容当前 stable floor。
- `beta` bundle 默认继续兼容当前 beta floor。
- `seed bundle` 属于 release contract 的一部分，也必须走同一套 channel floor。
- 本地打包入口若未显式传 channel，只允许明确地把 `stable` 当默认值；正式 release 与 CI 验证必须显式传 channel，避免隐藏语义。

## 只有这些情况才允许抬高 floor

- 新 bundle 依赖新的 launcher-owned 生命周期或恢复逻辑。
- 新 bundle manifest / layout / entrypoint 合同导致旧 launcher 无法正确读取。
- 新 launcher-side 安全合同、验签合同或状态迁移合同使旧 launcher 无法安全承载。

以下情况默认禁止抬高 floor：

- 纯 UI 变化
- runtime / server / plugin 变化
- 普通 bugfix
- 重构
- “这次也刚好发了更高版本 launcher”

## 实施要求

- 构建 product bundle：通过 `resolveGovernedMinimumLauncherVersion` 或等效受控入口解析 channel floor。
- 构建 update manifest：同上。
- 构建 seed bundle：同上。
- 本地更新烟测、手动验收支持脚本：stable / beta manifest 与 bundle 内部 `launcherCompatibility.minVersion` 都必须与各自 channel floor 一致。
- release / validate workflow：禁止写死历史 floor，必须动态读取 governed floor，或显式传 channel 让脚本自己读取。
- CI / workflow 若只是想拿纯净 floor 值，必须直接调用 [`print-minimum-launcher-version.service.mjs`](../../apps/desktop/scripts/update/services/print-minimum-launcher-version.service.mjs) 这类纯 stdout 脚本；不要用 `pnpm run` 包装后再命令替换，避免把包管理器 banner / script 前缀误当成版本号。

## 变更 floor 时的必做动作

1. 更新 [`apps/desktop/desktop-launcher-compatibility.json`](../../apps/desktop/desktop-launcher-compatibility.json)。
2. 在迭代日志 / 发布说明中写清楚旧 launcher 缺什么、为什么不能兼容。
3. 补一条贴近真实链路的验证，证明如果不抬高 floor，旧 launcher 会在具体合同点失效。

## 自检清单

- 这次改动是不是只是 bundle 内部变化，而不是 launcher-side break？
- 有没有任何地方还在用 `apps/desktop/package.json` 版本去填 `minimumLauncherVersion`？
- manifest 和 bundle 内部 manifest 的兼容下限是否一致？
- release workflow、本地打包脚本、人工验收脚本是否全部对齐到同一 source of truth？
