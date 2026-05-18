# v0.18.78 Windows Stdio Console Window

## 迭代完成说明

本次修复 Windows 桌面版启动时短暂弹出两个命令行窗口的问题。根因定位到 NARP stdio runtime 的启动期能力 probe：应用启动后会对 stdio runtime 做短生命周期探测，这类子进程之前没有设置 `windowsHide: true`，因此即使主窗口和 API smoke 都正常，Windows 仍可能看到一闪而过的 console 窗口。

修复方式是直接在 `stdio-runtime.service.ts` 和 `stdio-runtime-probe.utils.ts` 的 stdio 子进程 `spawn` options 上补齐 `windowsHide: true`。这比继续改 packaging、updater 或扩展启动链路更贴近根因，因为用户反馈的“两次短暂弹窗”与 stdio probe 的短生命周期和数量特征一致。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ncp-runtime-stdio-client tsc`
- `pnpm -C packages/nextclaw-ncp-runtime-stdio-client exec vitest run src/stdio-runtime.test.ts`
- `pnpm -C packages/nextclaw-ncp-runtime-stdio-client lint`
- `git diff --check -- .agents/skills/desktop-release-contract-guard/SKILL.md packages/nextclaw-ncp-runtime-stdio-client/src/stdio-runtime.service.ts packages/nextclaw-ncp-runtime-stdio-client/src/stdio-runtime-probe.utils.ts`
- 静态审计确认 `stdio-runtime.service.ts` 与 `stdio-runtime-probe.utils.ts` 的 stdio `spawn` 均包含 `windowsHide: true`。
- `pnpm check:governance-backlog-ratchet`

`pnpm lint:new-code:governance` 已运行，但被既有 app-l1 module-structure 规则挡住：该规则把 `packages/nextclaw-ncp-runtime-stdio-client/src` 下既有根文件识别为不在白名单内的根文件。本次未扩大该结构问题，且可维护性门禁显示非测试代码净增为 0。

## 发布/部署方式

需要重新发布 Windows desktop preview beta，让用户在 Windows 真机上验证启动时不再出现短暂命令行窗口。发布前后必须继续按 desktop release contract 检查 workflow、Windows smoke 日志、release asset 和 beta update manifest。

发布身份必须同步变化：本次不能只发布新的 `desktop-beta` tag，还必须让桌面安装器版本和 runtime bundle 版本递增。否则 Windows 侧可能继续运行同名/同版本安装器或同一 `versions/<runtimeVersion>` 缓存目录中的旧包，用户无法可靠判断自己测到的是新二进制。

同时，`desktop:package:verify` 必须能在 clean clone 中自给自足地构建 UI 的 NCP workspace 依赖。不能依赖本地已有 `dist/`，否则本地验证和 GitHub release runner 之间会再次出现“我这边过了、干净环境不过”的漂移。

Windows 安装器 smoke 也必须验证真实 NSIS 安装路径，而不是只验证 `win-unpacked`。若同一个 job 先跑 unpacked GUI smoke 再跑 installer smoke，安装器 smoke 必须先清理残留的 `NextClaw Desktop.exe` 进程，并显式传递 `/S /currentuser /D=<installDir>`；`/D=` 必须作为单条命令行字符串的最后一项传给 NSIS，避免 PowerShell 数组参数 quoting 改变带空格目录的解析。否则安装器失败会混入上一轮 portable smoke 的残留状态，无法准确判断是安装器坏、安装后启动坏，还是测试脚本污染。

最新 CI 证据显示，安装器安装后的真实 app 已能在 Windows runner 上完成 GUI + API smoke，最快约 `4.6s`；失败曾发生在 smoke 后的 cleanup uninstaller 或目录删除返回非零。后续判定应区分“安装/启动失败”和“清理失败”：前者挡 release，后者在已通过真实安装启动 smoke 后只作为 cleanup warning 记录，不能伪装成包不可启动。预安装清理仍然必须硬失败，因为脏目标目录会污染安装结果。ephemeral CI runner 上的 post-smoke cleanup 不应再调用 NSIS uninstaller，只做进程停止和安装目录 best-effort 删除，避免 uninstaller 的非零退出码覆盖真实 smoke 结果。

## 用户/产品视角的验收步骤

1. 在 Windows 安装新的 desktop beta。
2. 冷启动 NextClaw Desktop。
3. 观察启动过程中不应出现短暂命令行窗口。
4. 主窗口应在启动阈值内进入真实 UI，不能长期停留在 starting shell。
5. 创建或打开对话，确认 runtime session type 列表和基础 NCP API 正常。

## 可维护性总结汇总

本次修复遵守最小责任边界：只改 stdio 子进程启动 owner，没有继续扩大到 packaging、updater、extension 或 remote helper。非测试代码净增为 0。`post-edit-maintainability-guard` 已运行，通过非功能改动净增长门禁；剩余警告是 `stdio-runtime.service.ts` 既有文件超预算，后续应作为独立结构治理处理。

## NPM 包发布记录

不涉及 NPM 包发布。此次面向 desktop preview beta，需要发布桌面安装包和 update bundle，不需要发布 NPM 包。
