# v0.9.13 NPM latest 整体发布

## 迭代完成说明

本次按“整体发布 / 直接发布”执行稳定 NPM latest 发布闭环。发布前确认 `release:report:health` 指出 `nextclaw@0.19.25` 未发布且多个 runtime 依赖存在已发布 tag 后源码漂移，因此没有只发布 `nextclaw`，而是通过仓库发布入口生成 full public workspace batch。

发布中 `@nextclaw/service` 的 TypeScript 检查暴露 `BuiltinNarpRuntimeProviderService` 依赖面过宽：该服务只需要 `loadConfig()`，但构造函数要求完整 `ConfigManager`，导致 CLI runtime list 路径无法传入最小只读配置 owner。已将构造依赖收敛为 `Pick<ConfigManager, "loadConfig">`，并在 CLI 调用点传入只包含 `loadConfig` 的对象，修复目标命中真实根因而不是绕过类型检查。

## 测试/验证/验收方式

- `pnpm release:auto`：生成全量 public workspace changeset、执行版本化、发布前 batch build/tsc；首次在 `@nextclaw/service` tsc 阶段被阻断。
- `pnpm -C packages/nextclaw-kernel build && pnpm -C packages/nextclaw-service tsc`：修复后通过。
- `pnpm -C packages/nextclaw-service lint`：通过，无 error；保留 16 个既有 warning。
- `pnpm release:publish`：47 个 package build/tsc、publish、registry verify 通过。
- `npm view nextclaw version`：`0.19.26`。
- `npm view nextclaw dist-tags --json`：`latest` 指向 `0.19.26`，`beta` 保持 `0.18.12-beta.22`。
- 隔离 prefix 安装 `nextclaw@latest` 后运行 `nextclaw --version`：输出 `0.19.26`。
- 隔离 `NEXTCLAW_HOME` 且不设置 update public key 环境变量运行 `nextclaw update --check`：输出当前 launcher `0.19.26`，runtime 已是最新 `0.19.26`。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `pnpm release:report:health`：`Repository release health is clean.`。

## 发布/部署方式

通过仓库 NPM 发布入口执行：

```bash
pnpm release:auto
pnpm release:publish
```

本次不涉及数据库 migration、后端远程部署或 Cloudflare worker 部署。稳定 NPM runtime update channel 未单独触发：本次真实安装态 `update --check` 已验证 published package 内置 public key 可发现，且 stable runtime 当前已是 `0.19.26`。

## 用户/产品视角的验收步骤

用户可通过 NPM latest 安装并验证：

```bash
npm install -g nextclaw@latest
nextclaw --version
NEXTCLAW_HOME="$(mktemp -d)" nextclaw update --check
```

期望结果：`nextclaw --version` 输出 `0.19.26`；`update --check` 能在无自定义 public key 环境变量时完成检查，并报告 runtime 已是最新或给出可用更新。

## 可维护性总结汇总

已使用 `post-edit-maintainability-guard` 与 `post-edit-maintainability-review` 口径完成复核。源码修复只触达两个文件，总计新增 2 行、删除 2 行、净增 0 行；非测试代码同样净增 0 行。正向减债动作是必要解耦与依赖面收敛：`BuiltinNarpRuntimeProviderService` 从完整 `ConfigManager` 收窄为只读 `loadConfig` contract，减少 CLI 列表路径对 kernel runtime provider 的不必要耦合。

本次没有新增文件层级、平行实现或 fallback。保留债务：`packages/nextclaw-service` 仍有既有 lint warning，与本次发布阻断无关，未在本次 release window 内扩大修复范围。

## NPM 包发布记录

本次发布 47 个 public workspace package，全部 registry 验证通过。核心用户入口：

- `nextclaw@0.19.26`，dist-tag: `latest`
- `@nextclaw/kernel@0.1.12`
- `@nextclaw/service@0.1.15`
- `@nextclaw/server@0.12.23`
- `@nextclaw/ui@0.12.32`
- `@nextclaw/core@0.12.22`
- `@nextclaw/runtime@0.2.54`
- `@nextclaw/ncp@0.5.15`
- `@nextclaw/ncp-toolkit@0.5.20`

其余发布包覆盖 NCP runtime、channel runtime、channel plugins/extensions、client SDK、app runtime、agent chat、remote、shared、mcp 与 compatibility packages。发布后 `release:report:health` 为 clean。
