# v0.20.24 Service App Runtime Env

## 迭代完成说明

本轮修复自动启动后 runtime stdio 子进程无法解析 `node` 的运行环境漂移问题，覆盖 Service App MCP stdio 与 NARP stdio runtime。

根因：NextClaw 主进程由 LaunchAgent 等自动启动入口拉起时，宿主 `PATH` 可能只有 `/usr/bin:/bin:/usr/sbin:/sbin`。Service App runtime 之前给 MCP stdio transport 传空 env，MCP SDK 只能继承安全默认 env 中的最小 PATH，导致 `command: "node"` 的 Service App 在自动启动后失败为 `spawn node ENOENT`；手动终端启动则可能因为 shell PATH 更完整而表现不同。

修复方式：

- 在 `@nextclaw/core` child-process env owner 中新增 `createRuntimeChildEnv`，为 runtime 子进程生成 append-only PATH。
- PATH 合同保持原顺序，只追加当前 `process.execPath` 所在目录，不读取 shell profile，不猜测 nvm/asdf/fnm。
- Service App MCP stdio 只传 env 覆盖项，避免把 `NODE_OPTIONS` 等父进程 Node 参数污染到 Service App 子进程。
- NARP stdio direct spawn 保留既有全量 env 继承，同时使用同一个 PATH append 规则。
- `McpServiceAppRuntimeService` 的 stdio MCP record 改为使用该 runtime child env。
- `buildStdioRuntimeLaunchEnv` 改为使用该 runtime child env。
- 同责任链内删除空心 `listManifestActions` wrapper，并把 `ServiceAppRecord` 构造改为稳定对象形状；公共 `isServiceAppError` 判断因 server 仍依赖而保留，避免破坏既有 API。
- 规则层同步补强：非功能改动只能接受真实变好的代码；若找不到无争议的正向改动，必须停止压缩并申请豁免。
- 方案文档补充 launch env owner map，明确 core / desktop / adapter / extension 各自的 env 归属。

设计文档：`docs/designs/2026-06-04-unified-runtime-child-env-design.md`。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-core test -- src/features/agent/tools/shell.tools.test.ts --run`
  - 覆盖 `createRuntimeChildEnv` 的 minimal PATH、手动 PATH 顺序、Windows `Path` key、direct spawn 完整 env 继承。
- `pnpm -C packages/nextclaw-kernel test -- --run src/managers/__tests__/service-app.manager.test.ts`
  - 覆盖 minimal PATH、父进程 `NODE_OPTIONS` 不污染子 Node，以及真实 `ServiceAppManager.invokeServiceAction` 的 `command: "node"` MCP Service App 启动。
- `pnpm -C packages/nextclaw-ncp-runtime-stdio-client test -- src/stdio-runtime.test.ts --run`
  - 覆盖 `buildStdioRuntimeLaunchEnv` 保留 direct spawn base env 并补齐当前 Node bin。
  - 结果：通过。
  - 覆盖 minimal PATH、手动 PATH 顺序、重复 node bin 去重、Windows `Path` key、显式 extra env、父进程 `NODE_OPTIONS` 不污染子 Node，以及真实 `ServiceAppManager.invokeServiceAction` 的 `command: "node"` MCP Service App 启动。
- `pnpm -C packages/nextclaw-core tsc`
  - 结果：通过。
- `pnpm -C packages/nextclaw-kernel tsc`
  - 结果：通过。
- `pnpm -C packages/nextclaw-ncp-runtime-stdio-client tsc`
  - 结果：通过。
- `pnpm -C packages/nextclaw-server tsc`
  - 结果：通过。
- `pnpm -C packages/nextclaw-core lint`
  - 结果：通过，保留既有 32 个 warning。
- `pnpm -C packages/nextclaw-kernel lint`
  - 结果：通过。
- `pnpm -C packages/nextclaw-ncp-runtime-stdio-client lint`
  - 结果：通过，保留既有 `stdio-runtime.service.ts` 超长文件 warning。
- `pnpm -C apps/desktop lint`
  - 结果：通过。
- 评估过将 desktop command surface 的 `NEXTCLAW_COMMAND_SURFACE_BIN` 常量改为引用 core 导出；`apps/desktop` 当前 TypeScript module resolution 无法稳定解析 `@nextclaw/core` / `@nextclaw/core/child-process-env`，已撤回代码改动，避免为消除重复字符串扩大 tsconfig 风险。
- `pnpm lint:new-code:governance`
  - 结果：通过。
- `pnpm check:governance-backlog-ratchet`
  - 结果：通过，ratchet status OK。
- `git diff --check`
  - 结果：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --no-fail --paths ...`
  - 结果：生成报告；非测试代码净增 `+20`，未满足非功能 line-change gate，需作为 line-growth exemption 候选处理。

真实当前运行实例尚未用本次源码重启验证，因此现有 `:55667` 上的旧进程仍可能继续显示旧错误。完成源码构建/重启或发布后，验收应在自动启动入口下重新打开 Skills Panel，确认 `skill-scanner.listSkills` 返回 JSON 数据而不是 500 `spawn node ENOENT`。

## 发布/部署方式

本轮未执行发布、部署或桌面打包。改动位于 core env owner、kernel runtime 启动链路、NARP stdio runtime client 与测试，后续随常规包发布进入 runtime。

## 用户/产品视角的验收步骤

1. 通过 LaunchAgent / systemd / Windows Task Scheduler 等自动启动入口启动 NextClaw。
2. 打开 Skills Panel。
3. 确认 `skill-scanner.listSkills` 能返回 skill 列表。
4. 确认 Service App 状态不再出现 `spawn node ENOENT`。
5. 手动终端启动 NextClaw 后重复上述步骤，确认原有手动启动场景未回退。

## 可维护性总结汇总

本轮是非功能 bugfix，遵守“修启动入口 runtime env，不扩大为 manifest resolver / 诊断页 / provider 抽象”的边界。

- 新增 util 是无状态纯函数，职责明确：只生成 runtime 子进程 PATH 增强 env。
- 不引入 provider、factory、shell profile 探测或多套 fallback。
- Service App MCP 与 NARP stdio 复用同一个 core owner，避免 kernel-only 修复造成平行实现。
- 同一 Service App 责任链内删除空心 wrapper，并把 record 构造收敛为稳定对象形状，这是本轮真实正向减债动作。
- 本轮没有继续通过压缩类型、折叠语句或删除公共 API 来满足 line-change gate；已撤回这类指标驱动压缩。
- `post-edit-maintainability-guard --non-feature` 当前阻塞项：非测试代码净增 `+20`。增长主要来自新增 core runtime env owner、显式 public subpath 分发合同、NARP workspace 依赖、模块结构合同声明、治理脚本识别 package exports 子入口，以及规则层补强。
- line-growth exemption 候选理由：剩余增长用于统一两个真实 runtime stdio 启动入口，并保持手动启动、自动启动、direct spawn、MCP env override 与 server 公共 API 兼容；继续压缩会损害清晰度或兼容性。等待用户明确接受前，不把 maintainability gate 视为通过。

## NPM 包发布记录

不涉及 NPM 包发布。本轮需要等后续统一发布携带 `@nextclaw/core`、`@nextclaw/kernel` 与 `@nextclaw/nextclaw-ncp-runtime-stdio-client` 变更。
