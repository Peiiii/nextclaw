# v0.18.28 Codex/Claude Code NARP Stdio Wrapper

## 迭代完成说明

本轮完成 Codex 与 Claude Code 通过 NARP stdio 接入的第一阶段实现。

- 新增 `@nextclaw/nextclaw-narp-stdio-runtime-wrapper`，作为 ACP stdio 到 NextClaw NCP runtime 的通用 wrapper，不修改既有 stdio client。
- 新增 `@nextclaw/nextclaw-narp-runtime-codex-sdk`，提供 `nextclaw-codex-narp` bin，内部复用旧 Codex NCP runtime 包。
- 新增 `@nextclaw/nextclaw-narp-runtime-claude-code-sdk`，提供 `nextclaw-claude-code-narp` bin，内部复用旧 Claude Code NCP runtime 包。
- 更正一次实现漂移：撤回 kernel/service 中对 `codex` / `claude` 的硬编码 entry 创建和 provider kind 跳过逻辑。
- NARP 接入边界调整为：核心只识别通用 `narp-stdio` runtime type；`codex` / `claude` 只应来自外部 runtime entry 配置、安装/修复流程、marketplace metadata 或各自 NARP wrapper 包。
- 更新 workspace build/lint/tsc 脚本与 lockfile，使新包进入工作区验证链路。
- 保持旧 SDK 包与 `nextclaw-ncp-runtime-stdio-client` 不变，避免影响仍在使用的旧路径。
- 后续修正：Codex/Claude Code NARP skill 的 runtime entry 模板补齐图标字段；根因是新 NARP stdio 路径改为通用 `narp-stdio` entry 后，不再走旧插件 descriptor 的 icon 声明，而模板又没有把已有 app resource 写入 entry。

## 测试/验证/验收方式

已执行并通过：

- `pnpm -C packages/nextclaw-narp-stdio-runtime-wrapper test`
- `pnpm -C packages/nextclaw-narp-stdio-runtime-wrapper tsc`
- `pnpm -C packages/nextclaw-narp-stdio-runtime-wrapper lint`
- `pnpm -C packages/nextclaw-narp-stdio-runtime-wrapper build`
- `pnpm -C packages/extensions/nextclaw-narp-runtime-codex-sdk test`
- `pnpm -C packages/extensions/nextclaw-narp-runtime-codex-sdk tsc`
- `pnpm -C packages/extensions/nextclaw-narp-runtime-codex-sdk lint`
- `pnpm -C packages/extensions/nextclaw-narp-runtime-codex-sdk build`
- `pnpm -C packages/extensions/nextclaw-narp-runtime-claude-code-sdk test`
- `pnpm -C packages/extensions/nextclaw-narp-runtime-claude-code-sdk tsc`
- `pnpm -C packages/extensions/nextclaw-narp-runtime-claude-code-sdk lint`
- `pnpm -C packages/extensions/nextclaw-narp-runtime-claude-code-sdk build`
- `pnpm -C packages/nextclaw-kernel test src/agent-runtime/agent-runtime-entry-resolver.utils.test.ts`
- `pnpm -C packages/nextclaw-kernel lint`
- `pnpm -C packages/nextclaw-service lint`
- `pnpm lint:new-code:package-public-imports`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths <NARP wrapper files and runtime-entry integration files>`
- `node -e '<parse ~/.nextclaw/config.json and print codex/claude entry icons>'`
- `node packages/nextclaw/dist/cli/app/index.js agents runtimes --json`
- `node packages/nextclaw/dist/cli/app/index.js skills update skills/codex-narp-runtime --meta skills/codex-narp-runtime/marketplace.json --api-base https://marketplace-api.nextclaw.io`
- `node packages/nextclaw/dist/cli/app/index.js skills update skills/claude-code-narp-runtime --meta skills/claude-code-narp-runtime/marketplace.json --api-base https://marketplace-api.nextclaw.io`
- `/tmp` 临时目录安装冒烟：`codex-narp-runtime` 与 `claude-code-narp-runtime` 均可从 marketplace 安装，且安装后的 `SKILL.md` 包含对应 `icon` 字段。
- `test -f packages/nextclaw-ui/public/runtime-icons/codex-openai.svg && test -f packages/nextclaw-ui/public/runtime-icons/claude.ico && test -f packages/nextclaw/ui-dist/runtime-icons/codex-openai.svg && test -f packages/nextclaw/ui-dist/runtime-icons/claude.ico`

已知未通过项：

- `pnpm -C packages/nextclaw-kernel tsc` 与 `pnpm -C packages/nextclaw-service tsc` 被当前工作区里缺失/迁移中的 context-compaction 文件阻断，失败点不属于本轮 NARP 改动。
- `pnpm lint:new-code:governance` 被当前变更集里的既有 `packages/nextclaw-core/src/features/runtime-context/*` 相对导入规则阻断，失败点不属于本轮 NARP 改动。

## 发布/部署方式

本轮未执行发布、部署、远程 migration 或线上冒烟。

当前实现是新增本地 workspace 包与 bin 入口。下一阶段需要在安装/修复或 smoke 配置中显式写入 `codex` / `claude` 的 `narp-stdio` runtime entries，确认两个 launcher 可被 PATH 找到后，再做真实 NARP stdio 链路冒烟。

## 用户/产品视角的验收步骤

- 检查方案文档确认方向为 `-narp`，不是 `-acp`。
- 检查新包命名确认体现 wrapper 职责，而不是把它伪装成 agent。
- 检查旧 Codex/Claude Code SDK runtime 包和旧 stdio client 无改动。
- 在显式配置 runtime entries 后，检查 runtime listing 中 `codex` 和 `claude` 的 entry type 为 `narp-stdio`，命令分别为 `nextclaw-codex-narp` 与 `nextclaw-claude-code-narp`。
- 检查 runtime listing 中 `codex` 和 `claude` 的 entry icon 分别为 `app://runtime-icons/codex-openai.svg` 与 `app://runtime-icons/claude.ico`。
- 构建新包后确认两个新 bin 入口存在：
  - `nextclaw-codex-narp`
  - `nextclaw-claude-code-narp`

## 可维护性总结汇总

本轮是新增接入能力，生产代码存在净增长；已通过新包隔离把影响范围限制在 NARP wrapper 与 provider wrapper 层，没有直接改旧 SDK 包或旧 stdio client。

- maintainability guard：16 个源码/测试文件，Errors 0，Warnings 0。
- 行数：total +1025 / -22 / net +1003；non-test +638 / -22 / net +616。
- 抽象边界：通用 stdio/ACP 到 NCP 的职责在 `nextclaw-narp-stdio-runtime-wrapper`，provider 配置映射分别留在 Codex 与 Claude Code wrapper 包。
- 命名与目录：采用 `services/`、`controllers/`、`types/` 分层；package 和 bin 均使用 `narp` 命名。
- 已使用 `post-edit-maintainability-guard` 和人工可维护性复核。
- 后续图标修正没有新增源码复杂度；图标仍由 runtime entry / setup skill 持有，未把 Codex/Claude Code provider 身份硬编码回 core/kernel/service。

## NPM 包发布记录

本轮未发布 NPM 包。

Marketplace skill 已更新：

- `@nextclaw/codex-narp-runtime`：`updatedAt=2026-05-13T17:28:54.162Z`
- `@nextclaw/claude-code-narp-runtime`：`updatedAt=2026-05-13T17:28:54.150Z`

待后续统一发布或接入配置落地后评估发布：

- `@nextclaw/nextclaw-narp-stdio-runtime-wrapper`
- `@nextclaw/nextclaw-narp-runtime-codex-sdk`
- `@nextclaw/nextclaw-narp-runtime-claude-code-sdk`
