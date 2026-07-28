# Agent Runtime 的 NextClaw 上下文注入

## 迭代完成说明

本轮补齐了 Native、Codex 与 Claude Code agent runtime 的 NextClaw 产品上下文合同，并提供按 runtime 配置的命令行入口。

- kernel 继续作为产品指令、工作区上下文和 skill 信息的唯一事实来源。
- runtime 配置新增 `config.injectNextclawContext`，缺省值为开启，只有显式 `false` 才关闭。
- NCP/NARP stdio 链路透传 `contextBlocks`，不在 provider 或 CLI 中重建上下文。
- Codex 使用 `developerInstructions` 追加产品上下文，不设置 `baseInstructions`。
- Claude Code 使用 `{ type: "preset", preset: "claude_code", append }`，保留原生 preset。
- CLI 新增 `nextclaw agents runtime config <runtime-id>`，支持查询和修改注入开关；配置变化登记为等待手动重启。
- `--json` 写入模式保持纯 JSON 输出，同时仍记录 pending restart。
- 用户说明、安装包内 `USAGE.md` 资源和内置 `nextclaw-self-manage` skill 已同步。
- 已添加 `.changeset/agent-runtime-nextclaw-context.md`。

## 测试/验证/验收方式

- 10 个受影响 TypeScript package 的 `tsc --noEmit` 全部通过。
- 10 个受影响 package 的正式构建全部通过。
- 7 组定向测试共 74 个用例通过，覆盖：
  - runtime 配置缺省开启与显式关闭；
  - Native/NARP 注入开关；
  - NCP 到 stdio `_meta.nextclaw_narp.contextBlocks` 的跨进程传输；
  - agent-side NARP wrapper 的上下文恢复；
  - Codex `thread/start` 与 `thread/resume` 的 `developerInstructions`，以及不覆盖 `baseInstructions`；
  - Claude Code `claude_code` preset 的 `append` 与无上下文时不设置 `systemPrompt`；
  - CLI 查询、写入、未知 runtime、非法布尔值和静默 pending-restart 通知。
- 最终构建产物的 CLI 隔离冒烟通过：默认值为 `true`，写入/查询一致，JSON 可直接解析，非法布尔值和未知 runtime 均拒绝。
- 最终构建产物的 Codex NARP 真机冒烟通过：模型只返回注入上下文中指定的唯一标记。
- Claude Code NARP 真机冒烟在本机 `claude 2.1.139` 上 180 秒无活动后超时；对照检查中 `claude auth status` 正常，但绕过 NextClaw 直接执行 Claude CLI 也在 60 秒内零输出超时，因此可将缺口定位在本机 Claude 上游响应，而不是本次 wrapper 注入链路。协议映射、preset 保留与 append 行为已由 7 个 wrapper 测试覆盖。
- `pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet`、本任务路径 ESLint 和 `git diff --check` 均通过。
- maintainability guard：0 error，保留 5 个历史/趋势警告。

## 发布/部署方式

- 本轮由当前本地提交闭合；未执行 push、NPM 发布、部署或 NextClaw 宿主重启。
- 代码已完成本地构建验证；配置命令只在隔离的临时 `NEXTCLAW_HOME` 中执行。
- 发布时应由统一 Changesets 流程发布下方列出的 patch 包。

## 用户/产品视角的验收步骤

1. 运行 `nextclaw agents runtime config codex --json`，确认 `injectNextclawContext` 缺省为 `true`。
2. 在 Codex 或 Claude Code runtime 中发起会话，确认它能感知 NextClaw 产品指令、当前工作区上下文和已提供的 skill 信息，同时仍保留原生 runtime 行为。
3. 运行 `nextclaw agents runtime config codex --inject-nextclaw-context false`，手动重启 gateway 后确认该 runtime 不再收到 NextClaw 上下文。
4. 将开关重新设为 `true` 并手动重启，确认注入恢复。
5. 对 `native`、`claude-code` 或其它已登记 runtime 使用同一命令，确认配置彼此独立。

## 可维护性总结汇总

- 可维护性复核结论：通过。
- 本次是新增用户能力，代码增减报告为 `+661 / -44 / 净增 +617`；排除测试后为 `+257 / -37 / 净增 +220`。
- 通用层只扩展 `contextBlocks` 合同和透传，provider-specific 映射留在各自 wrapper，没有在 kernel/core 增加 Codex/Claude 分支。
- NARP context 合并复用单一纯函数；stdio prompt metadata 映射收回类型 owner，使历史超长的 `stdio-runtime.service.ts` 本次保持零增长。
- CLI 复用统一 config mutation 与 restart owner，没有增加第二套配置写入路径。
- 测试文件按行为拆分 describe，消除了本轮引入的超长测试回调 lint 警告。
- maintainability guard 的 5 个警告均为非阻塞趋势项：Codex app-server service 接近 600 行预算、stdio service 历史超长但未增长、stdio 测试接近预算、commands 目录历史扁平、agent command 测试本轮增长明显。

## NPM 包发布记录

以下包需要 patch，当前均未发布，状态为 `待统一发布`：

- `@nextclaw/ncp`
- `@nextclaw/core`
- `@nextclaw/kernel`
- `@nextclaw/service`
- `@nextclaw/nextclaw-ncp-runtime-stdio-client`
- `@nextclaw/nextclaw-narp-stdio-runtime-wrapper`
- `@nextclaw/nextclaw-ncp-runtime-codex-sdk`
- `@nextclaw/nextclaw-narp-runtime-codex-sdk`
- `@nextclaw/nextclaw-narp-runtime-claude-code-sdk`
- `nextclaw`
