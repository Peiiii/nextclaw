# v0.19.17-desktop-command-surface

## 迭代完成说明

本轮补齐桌面安装形态下的 AI 自管理命令面。

根因：NextClaw 的自管理 skill 和 `USAGE.md` 都要求 AI 使用 `nextclaw status --json`、`nextclaw doctor --json`、`nextclaw config ...` 等稳定 CLI 命令，但桌面安装形态此前只提供 Electron app 与桌面托管 runtime，并没有向 AI command tool 暴露同名 `nextclaw` 命令。结果是桌面用户即使已经运行 NextClaw Desktop，AI 仍可能因为找不到全局 NPM CLI 而无法自管理。

修复方式：

- 新增桌面 command surface owner，桌面启动时生成受 NextClaw 管理的 `nextclaw` / `nextclaw.cmd` shim。
- 新增 desktop command bridge，通过桌面 app binary 与当前 active bundle runtime 执行真实 CLI app。
- 在 AI shell tool 的通用命令环境中支持 `NEXTCLAW_COMMAND_SURFACE_BIN`，让桌面 runtime 内的 AI 优先命中桌面托管 `nextclaw`。
- 桌面 command surface 下的 `nextclaw update` 不再误走 NPM runtime updater，而是返回桌面安装形态的明确 blocked 状态。
- 增加 macOS 桌面 smoke 中的 command surface 验证入口，覆盖 `nextclaw --version`、`status --json`、`doctor --json`。

这是针对根因的修复：AI command tool 不需要知道桌面安装细节，也不要求用户额外安装 NPM CLI；安装形态自己提供统一命令面。

## 测试/验证/验收方式

已执行：

```bash
PATH=/opt/homebrew/bin:$PATH pnpm -C apps/desktop tsc
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core tsc
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-service tsc
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core exec tsx --test ../../apps/desktop/src/services/desktop-command-surface.service.test.ts ../../apps/desktop/src/utils/desktop-command-bridge.utils.test.ts ../../apps/desktop/src/services/runtime-process.service.test.ts
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core test -- --run src/features/agent/tools/shell.tools.test.ts
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-service test -- --run src/launcher/tests/npm-runtime-update-command.service.test.ts
PATH=/opt/homebrew/bin:$PATH pnpm -C apps/desktop lint
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core lint
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-service lint
PATH=/opt/homebrew/bin:$PATH pnpm exec eslint apps/desktop/scripts/smoke/command-surface-smoke.mjs
PATH=/opt/homebrew/bin:$PATH pnpm -C apps/desktop build:main
PATH=/opt/homebrew/bin:$PATH pnpm lint:new-code:governance
PATH=/opt/homebrew/bin:$PATH pnpm check:governance-backlog-ratchet
git diff --check
```

已执行临时 command surface bridge smoke：

```bash
PATH=<temp-command-surface-bin>:/usr/bin:/bin <node> apps/desktop/scripts/smoke/command-surface-smoke.mjs --bin-dir <temp-command-surface-bin>
```

观察结果：

- `nextclaw --version` 输出 `0.19.26`。
- `nextclaw status --json` 输出合法状态报告。
- `nextclaw doctor --json` 输出合法 doctor 报告；无 provider 的临时环境下 exitCode 为 `1`，这是预期诊断结果。
- `pnpm lint:new-code:governance` 全部通过。
- `pnpm check:governance-backlog-ratchet` 通过，ratchet status 为 `OK`。
- `git diff --check` 通过。

## 发布/部署方式

本轮未执行发布、部署或 NPM 包发布。

桌面发布前，后续 beta/stable release 仍需通过 desktop release workflow 与更新通道验证。macOS package smoke 已扩展 command surface 验证入口；完整发布仍以 `desktop-release-contract-guard` 的 release gate 为准。

## 用户/产品视角的验收步骤

桌面版启动后，AI command tool 内应能无感执行：

```bash
nextclaw --version
nextclaw status --json
nextclaw doctor --json
```

验收重点：

- 不需要用户额外执行 `npm i -g nextclaw`。
- 不需要系统全局 Node/NPM。
- 不修改用户全局 PATH。
- AI 继续使用同名 `nextclaw ...` 自管理命令。
- 桌面 runtime 内的 `nextclaw` 优先指向当前桌面 command surface，而不是旧的全局 NPM CLI。

## 可维护性总结汇总

本轮遵守单一 owner 方向：桌面安装形态由 `DesktopCommandSurfaceService` 负责提供命令面，`desktop-command-bridge` 只做 runtime 解析与进程转发，AI shell tool 只消费通用 PATH 注入。

正向减债点：

- 避免在 AI command tool 中新增桌面特判。
- 避免要求用户额外安装 NPM CLI 形成双 runtime 事实源。
- 把 desktop command surface 验证写入 smoke/release guard，降低后续回归风险。

维护性结果：

- post-edit maintainability guard：0 errors，3 warnings。
- 维护性告警为：`apps/desktop/scripts` 目录既有超阈值、`apps/desktop/src/main.ts` 接近 400 行预算但本轮净减 1 行、`packages/nextclaw-service/src/service-runtime.service.ts` 接近 600 行预算且本轮仅净增 1 行。
- 本轮变更是新增桌面用户能力，非测试代码净增为预期投入；同时通过抽出 `DesktopBundleServicesFactory` 把 desktop main 拉回预算内。
- 主观可维护性复核结论：命令面 owner、bridge、AI shell PATH 注入、桌面 update blocked 语义、release smoke gate 分层清晰，没有把桌面安装特判泄漏进 AI tool 主链路。

## NPM 包发布记录

不涉及 NPM 包发布。
