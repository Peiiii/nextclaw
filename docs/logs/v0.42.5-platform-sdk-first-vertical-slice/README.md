# Platform SDK 第一纵向闭环

状态：已提交并完成文档站部署。

本迭代把现有 kernel/NCP agent run 主链收敛为 experimental Harness，并通过独立轻量的 `@nextclaw/harness` package 提供公共入口；同一路径上增加 `nextclaw exec`。Harness 已提供 Agent、Session、Run 与 Contribution API，Contribution 可以使用受限 `IKernel` 注册 tools、context、model providers、runtimes 与 MCP servers。现有 `nextclaw agent`、server、UI、Desktop 和持久化合同保持不变。

- [实施计划](../../plans/2026-08-22-platform-sdk-first-vertical-slice.plan.md)
- [公共能力面设计](../../designs/2026-08-22-platform-sdk-public-surface.design.md)
- [工作记录](./work/working-notes.md)

## 迭代完成说明

- 新增 experimental `@nextclaw/harness`：以 `NextclawHarness`、Agent、Session、Run 和 Contribution 作为进程内嵌入入口，核心执行仍由 Kernel/NCP 的既有主链路承担。
- 新增 `nextclaw exec`：为脚本与 CI 提供 text、JSON、JSONL 输出、stdin、取消和超时适配；交互式 `nextclaw agent` 不改动。
- 生命周期抽象归 `@nextclaw/shared` 根入口；Contribution 的 `setup()` 中可通过 `this.effect()` 注册资源，Harness 释放时逆序清理。
- Kernel 内置的 context、tool、runtime、context-window 与 learning-loop contribution 也已切换到同一抽象，作为真实运行链路的 dogfooding；不再各自维护 cleanup 数组。
- 消费方一律使用 workspace package 根入口：外部 SDK 为 `@nextclaw/harness`，内部复用能力从 `@nextclaw/kernel` 或 `@nextclaw/shared` 根入口导入；不新增 package 子路径或源码 alias。

## 测试/验证/验收方式

- 已通过 `@nextclaw/shared`、`@nextclaw/kernel`、`@nextclaw/harness`、`nextclaw CLI`、`@nextclaw/server`、Desktop 与 marketplace 触达面的 TypeScript 检查，以及 Harness facade、Kernel、CLI exec 定向测试。
- 已通过开发者文档站的 VitePress 构建、公共 package 根入口治理测试、governance backlog 与渐进式 skill 检查，以及 `git diff --check`。
- diff-only maintainability 检查没有报告本批 Harness、公共入口治理或文档代码的问题；工作区并行的观察功能 WIP 仍有独立 findings，未混入本批。

## 发布/部署方式

- 本次先将精确范围提交并推送至 `master`，再触发既有 `docs-deploy.yml` 工作流部署文档站。
- 部署后执行 `pnpm deploy:docs:verify`，确认公开开发者入口与本次提交对应的文档版本可访问。
- 不发布 NPM、runtime channel 或 Desktop：Harness changeset 仅为后续统一 NPM 发布准备，不在本次文档部署中执行 registry 写入。

## 用户/产品视角的验收步骤

1. 打开文档站一级导航的 “NextClaw Harness SDK”。
2. 按 Harness API 页面创建 `new NextclawHarness()`，运行任务并在 `finally` 中释放。
3. 按平台能力页注册 tool、context、model provider、runtime 或 MCP server，并在 Contribution 内使用 `this.effect()` 管理释放。
4. 在脚本或 CI 中执行 `nextclaw exec "任务" --format json`，确认 stdout 是机器可读结果、诊断写入 stderr。

## 可维护性总结汇总

- 本批没有复制 agent loop、session store、event vocabulary 或 Kernel manager graph；Harness facade 只转发白名单公共 contract。
- 将可复用生命周期放回 `@nextclaw/shared`，并收紧跨 workspace 导入为 package 根入口，减少了深层路径与 alias 绕过的扩散风险。
- 新增的 facade、Kernel capability 映射和 exec controller 均只承担边界适配；执行、会话和资源 owner 仍各自唯一。
- 目录结构遵循 feature root；自动守卫已补覆盖 package 子路径和 alias 两种违规方式。

## NPM 包发布记录

本次不涉及 NPM 包发布。`@nextclaw/harness`、`@nextclaw/kernel`、`@nextclaw/shared`、`@nextclaw/service` 与 `nextclaw` 的 changeset 已准备，状态为待统一发布。
