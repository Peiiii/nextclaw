# v0.16.74-chat-startup-send-gate

## 迭代完成说明

- 本次修复的是“服务刚启动时，用户一进入聊天页就可能撞上 `ncp agent unavailable during startup`”的问题。
- 在前一版只把前端 send gate 和显式初始化提示补齐之后，本次继续把后端启动链路标准化，避免 `ncpAgent.ready` 再被不相关的启动期 IO 污染。
- 后端新增核心应用 owner：`packages/nextclaw/src/cli/commands/service-support/gateway/nextclaw-app.service.ts`。
  - 启动阶段显式收敛为：
    - `start()`
    - `bootstrapKernel()`
    - `recoverDurableState()`
    - `warmDerivedCapabilities()`
  - `ready` 现在只代表聊天主链已经可用，前端不再需要把 MCP 预热、session search 建索引之类的后台工作误判成“内核还没起来”。
- `packages/nextclaw/src/cli/commands/ncp/create-ui-ncp-agent.service.ts` 不再把“创建内核”“恢复持久化状态”“预热衍生能力”揉成一个大 Promise，而是由 `UiNcpAgentRuntimeService` 在同一文件内显式承载这三个阶段。
- `SessionSearchRuntimeSupport` 调整为只有在初始化完成后才暴露 `session_search` 工具，避免搜索索引还没 ready 时把半初始化能力暴露给运行时。
- MCP runtime support 调整为“创建”和“预热”解耦：
  - 创建阶段只建立 registry / adapter
  - 初始 `prewarmEnabledServers()` 移到派生能力预热阶段
  - `applyMcpConfig()` 仍负责配置变更后的 reconcile + warm
- Gateway 启动主链现在变为：
  - 先快速完成 `bootstrapKernel()` 并激活 deferred NCP agent
  - 再执行 `recoverDurableState()`
  - 最后在 `warmDerivedCapabilities()` 中并行补齐 NCP 衍生能力、插件 hydration、channel 启动和 restart sentinel 唤醒
- 根因是 UI shell 会先启动并对外提供聊天页面，但真正承载聊天发送/流式请求的 NCP agent 仍在 deferred startup 阶段；此时聊天页已经可见，前端又没有显式消费启动态，于是用户会直接看到底层占位错误，而不是产品级的“正在初始化”提示。
- 根因确认方式：
  - 代码链路确认：旧的 `packages/nextclaw/src/cli/commands/service-support/gateway/service-gateway-startup.service.ts` 会先启动 UI shell，再在 deferred startup 阶段等待完整 `createUiNcpAgent()`；其中 `ready` 被 MCP 预热和 session search 初始化一并拖慢。
  - 占位错误确认：`packages/nextclaw/src/cli/commands/service-support/session/service-deferred-ncp-agent.ts` 在 agent 未激活时会直接抛 `ncp agent unavailable during startup`。
  - 前端请求链路确认：聊天页通过 `/api/ncp/agent/*` 直接走 NCP agent client，请求未就绪时不会被转换成显式启动态。
  - 启动期 IO 归因确认：
    - `sessionSearchRuntimeSupport.initialize()` 会做 sqlite 初始化和历史 session 索引回填
    - `mcpRegistryService.prewarmEnabledServers()` 会启动/连接 MCP server 并拉取工具 catalog
    - `DefaultNcpAgentBackend.start()` 本身很轻，说明真正拖慢 ready 的不是 agent 内核，而是被错误绑进去的派生能力 IO
- 本次修复命中根因而不是处理表象的方式：
  - 后端把 `ncpAgent` 启动状态纳入 `/api/runtime/bootstrap-status`，不再让聊天页只能靠错误文本猜当前是不是还在启动。
  - 前端聊天页显式读取该状态，在 `ncpAgent` 未 ready 时展示“聊天能力正在初始化”，并只禁用发送按钮，保留输入能力。
  - 同批次收尾时，又把“正在等待服务恢复连接...”这条瞬时恢复提示从聊天区移除；恢复状态仍然保留在统一 runtime lifecycle 中，但不再用一条易闪烁、强打断的横幅干扰聊天主界面。
  - 当 `ncpAgent` ready 后，发送自动恢复；如果启动失败，则展示明确失败信息，而不是继续把底层启动错误原样暴露给用户。
  - 后端进一步把启动合同标准化为唯一 owner + 显式阶段，防止以后再通过“再补一个启动期特判”把 ready 语义搞脏。
  - 同批次续改中，用户要求先建立“启动到可用”的可量化指标后再谈优化；因此本次没有继续直接改启动实现，而是新增冷启动基线测量脚本，先把真实耗时切成可比较的里程碑。
  - 新脚本 `pnpm smoke:startup-readiness -- --runs <n> --criterion <ui-api|auth-status|health|ncp-agent-ready|bootstrap-ready>` 默认在隔离 `NEXTCLAW_HOME` 下冷启动服务，并同时记录 `UI API 可达`、`/api/auth/status ok`、`health ok`、`ncpAgent.ready`、`bootstrap ready` 五个时间点。
  - 后续用户又明确指出 `/api/auth/status` 在刚启动时本身会“直接调用不通”，因此该接口被提升为正式监测节点，不能再只作为泛化的“status 很慢”描述的一部分。
  - 首轮 3 次 `bootstrap-ready` 基线结果表明，`UI API / health / ncpAgent.ready` 中位数约 `1.82s`，而 `bootstrap ready` 中位数约 `26.8s`；这说明当前最大耗时头部不是最开始的 UI/API bring-up，而是 `ncpAgent.ready` 之后到 `bootstrap ready` 之间约 `24s~26s` 的能力水合阶段。
  - 用户真实 `pnpm dev start + /Users/peiwang/.nextclaw` 口径进一步确认：前端 server 约 `4.8s` ready，但 `/api/auth/status` 约 `32.9s` 才 OK，红色窗口约 `28.0s`；根因不是 status 接口业务本身依赖插件，而是插件水合和 bundled channel plugin 动态加载仍在同一个 Node 主进程内抢占启动窗口。
  - 本轮第二刀改为“插件/渠道延迟激活”：`NextclawApp.start()` 在 kernel 和必要状态恢复后立即 `bootstrapStatus.markReady()`，UI 场景默认延迟 `10s` 再后台执行能力水合、plugin gateways、channels 和 restart sentinel。
  - 修复命中根因的方式：主前端、`/api/auth/status`、`/api/health` 和 bootstrap status 不再等待插件水合；插件继续作为后台热插拔能力最终生效。
  - 复测显示，真实 `pnpm dev start` 口径下 `frontendAuthStatusOkMs` 降到约 `2.5s`，`frontendAuthStatusFailureCount=0`；后台 `pluginHydrationReady/channelsReady` 仍约 `23.6s`，因此下一步大头已经从“status 红色窗口”转移到“后台插件激活耗时”。
- 设计文档：
  - [nextclaw app startup standardization design](../../plans/2026-04-19-nextclaw-app-startup-standardization-design.md)
  - [plugin startup lazy activation design](../../designs/2026-04-23-plugin-startup-lazy-activation-design.md)
- 工作笔记：
  - [goal-progress](./work/goal-progress.md)
  - [startup-readiness-baseline](./work/startup-readiness-baseline.md)
  - [working-notes](./work/working-notes.md)

## 测试/验证/验收方式

- 定向单测：
  - `pnpm -C packages/nextclaw exec vitest run src/cli/commands/service-support/gateway/tests/service-gateway-startup.test.ts src/cli/shared/services/gateway/tests/nextclaw-app.service.test.ts src/cli/commands/ncp/session-search/session-search-runtime.service.test.ts src/cli/commands/ncp/runtime/create-ui-ncp-agent.http-runtime.test.ts src/cli/commands/ncp/lifecycle-events/create-ui-ncp-agent-lifecycle-events.test.ts`
  - `pnpm -C packages/nextclaw test -- --run src/cli/shared/services/gateway/tests/service-bootstrap-status.service.test.ts`
  - `pnpm -C packages/nextclaw-ui test -- --run src/components/chat/ncp/page/chat-runtime-bootstrap-state.test.ts`
  - `pnpm smoke:startup-readiness -- --runs 3 --timeout-ms 90000 --criterion bootstrap-ready`
  - `pnpm smoke:startup-readiness -- --runs 1 --timeout-ms 60000 --criterion ncp-agent-ready`
- 类型检查：
  - `pnpm -C packages/nextclaw tsc`
  - `pnpm -C packages/nextclaw-ui tsc`
  - `pnpm -C packages/nextclaw-server tsc`
- 定向 lint：
  - `pnpm -C packages/nextclaw exec eslint src/cli/commands/ncp/create-ui-ncp-agent.service.ts src/cli/commands/ncp/session-search/session-search-runtime.service.ts src/cli/commands/ncp/session-search/session-search-runtime.service.test.ts src/cli/shared/services/gateway/nextclaw-app.service.ts src/cli/shared/services/gateway/service-gateway-startup.service.ts src/cli/shared/services/gateway/service-capability-hydration.service.ts src/cli/shared/services/gateway/service-gateway-bootstrap.service.ts src/cli/shared/services/gateway/service-gateway-runtime-lifecycle.service.ts src/cli/shared/services/gateway/service-ui-shell-grace.ts src/cli/shared/services/gateway/tests/service-gateway-startup.test.ts src/cli/shared/services/gateway/tests/nextclaw-app.service.test.ts src/cli/commands/service.ts`
- 治理/维护性检查：
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw/src/cli/shared/services/gateway/nextclaw-app.service.ts packages/nextclaw/src/cli/shared/services/gateway/service-bootstrap-status.service.ts packages/nextclaw/src/cli/shared/services/gateway/service-gateway-runtime-lifecycle.service.ts scripts/smoke/startup-readiness/startup-readiness-runner.mjs`
  - `pnpm lint:new-code:governance`
  - `pnpm check:governance-backlog-ratchet`
- 当前验证结论：
  - 定向单测通过。
  - 后端启动标准化相关新增/受影响定向 vitest 通过，`12` 个测试通过。
  - 聊天恢复提示去除后的前端定向 vitest 通过，`2` 个测试文件、`13` 个测试通过。
  - `smoke:startup-readiness` 可正常执行，并能输出冷启动阶段基线。
  - `bootstrap-ready` 三轮基线：
    - `uiApiReachableMs`：`2043 / 1815 / 1815`
    - `authStatusOkMs`：`2043 / 1815 / 1815`
    - `healthOkMs`：`2043 / 1815 / 1815`
    - `ncpAgentReadyMs`：`2043 / 1815 / 1815`
    - `bootstrapReadyMs`：`27867 / 24707 / 24802`
  - 第一刀架构调整后，`bootstrap-ready` 改为 core app 可用口径，不再等待插件水合；三轮复测 `bootstrapReadyMs` 为 `2439 / 1616 / 2020`，中位数约 `2.0s`。
  - 后台插件完成口径继续保留：单轮复测 `pluginHydrationReadyMs=25080ms`、`channelsReadyMs=25080ms`，后续继续按该口径优化热插拔插件加载速度。
  - 真实 `pnpm dev start` + 默认 HOME 延迟激活后复测：
    - `uiApiReachableMs=2039ms`
    - `authStatusOkMs=2039ms`
    - `healthOkMs=2039ms`
    - `ncpAgentReadyMs=2039ms`
    - `bootstrapReadyMs=2039ms`
    - `frontendServerReadyMs=2475ms`
    - `frontendAuthStatusOkMs=2475ms`
    - `frontendAuthStatusFailureCount=0`
    - `pluginHydrationReadyMs=23646ms`
    - `channelsReadyMs=23646ms`
  - 拆分瀑布流输出模块后补充复测：
    - `pnpm smoke:startup-readiness -- --dev-runner --home /Users/peiwang/.nextclaw --runs 1 --timeout-ms 90000 --criterion frontend-auth-status`
    - `uiApiReachableMs=2645ms`
    - `authStatusOkMs=2645ms`
    - `frontendServerReadyMs=2866ms`
    - `frontendAuthStatusOkMs=2866ms`
    - `frontendAuthStatusFailureCount=0`
  - 新版 `smoke:startup-readiness` 输出瀑布流：外部 observed milestones 加后端 `startup-trace` spans；最新样本显示 post-ready delay 为 `10000ms`，`hydrate_capabilities` 为 `11378ms`，后台插件激活是下一阶段大头。
  - 新增脚本相关 ESLint 通过。
  - 本次针对新增脚本与入口的维护性守卫通过，无 error / warning。
  - 已新增仓库级 skill：
    - `.agents/skills/startup-readiness-governance/SKILL.md`
    - 目的：把启动可用性测量、长期目标维护与优化优先级排序沉淀成复用机制
  - 受影响包类型检查通过。
  - 后端定向 ESLint 无 error，仅剩仓库内其它历史文件的 warning，不在本次启动链路新增范围内。
  - `check:governance-backlog-ratchet` 通过。
  - `lint:new-code:governance` 未通过，但当前阻塞项来自工作树里其它并行中的 apps / workers 改动；本次启动链路新引入文件已按后缀规范收敛为 `*.service.ts`。
  - `post-edit-maintainability-guard --non-feature` 未通过。原因是该守卫把本次后端启动标准化按“纯非功能改动”统计，而本次实际上引入了用户可见的启动能力合同变化：聊天主链更早 ready、派生能力改为后台预热。该结果保留记录，不冒充通过。
  - 最新 targeted 维护性守卫通过：
    - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`
    - 结果：`Errors: 0`，`Warnings: 1`
    - 剩余 warning：`scripts/smoke/startup-readiness/startup-readiness-runner.mjs` 本轮增长明显；已将瀑布流格式化拆到 `startup-readiness-waterfall.mjs`，剩余增长来自 dev-runner/frontend-status 测量流程。
  - 最新 `pnpm lint:new-code:governance` 未通过：
    - 当前阻塞项为既有 `packages/nextclaw/src/cli/shared/services/gateway/*` 与 `packages/nextclaw/src/cli/shared/services/runtime/*` 位于 `shared/services` 嵌套目录下，触发 module-structure-drift。
    - 本轮已撤回原先写入 openclaw loader 的静态 gate 改动，避免继续扩大 oversized loader 和 file-role-boundary 问题。

## 发布/部署方式

- 本次为代码修复，无额外部署脚本变更。
- 按正常前端/UI 服务发布流程打包并发布包含本次提交的构建即可。
- 若需要做上线前人工确认，优先在本地或测试环境验证“冷启动后立刻打开聊天页”的场景。

## 用户/产品视角的验收步骤

1. 启动 NextClaw 服务或桌面端。
2. 在服务刚进入 UI 可访问状态时，立刻打开聊天页。
3. 确认页面顶部出现“聊天能力正在初始化”提示。
4. 确认输入框仍可输入文本、选择技能、编辑内容。
5. 确认发送按钮在初始化完成前不可点击。
6. 等待初始化完成后，确认发送按钮自动恢复可用。
7. 发送一条消息，确认不会再直接看到 `ncp agent unavailable during startup`。
8. 在服务冷启动期间观察后端状态，确认 `ncpAgent.ready` 会先于 MCP 预热和 session search 建索引完成。
9. 在服务 ready 后再触发 MCP 或 session search 相关能力，确认它们不再阻塞聊天主链 ready。
10. 运行 `pnpm smoke:startup-readiness -- --runs 3 --criterion bootstrap-ready`，确认脚本能稳定输出多轮 `UI API / auth status / health / ncpAgent.ready / bootstrap ready` 时间点，并据此比较后续优化前后的改善幅度。

## 可维护性总结汇总

- 是否已尽最大努力优化可维护性：否。
  - 阻碍约束：本次工作在一个已有大量并行改动的脏工作树中完成，且后端启动标准化需要引入显式 owner 与阶段 action；即便已经把底层 runtime owner 回收到原有 `create-ui-ncp-agent.service.ts`，净增仍为正。
  - 但本轮续改已经先把“怎么测”独立成脚本，而不是继续把诊断逻辑硬塞进产品代码；这让后续优化有了稳定基线，也避免重复写一次性诊断 patch。
  - 本轮继续把该机制收敛成 skill，而不是只留下一条命令；这降低了后续重复解释测量口径与记录方式的成本。
  - 本轮最新收尾已撤回非必要的 openclaw static gate 代码，避免把次要优化塞进已有 oversized loader；同时把 smoke 瀑布流输出拆到独立 `startup-readiness-waterfall.mjs`，减少 runner 继续膨胀。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是，但未完全达成守卫要求。
  - 本次优先选择了“收回唯一 owner + 收紧 ready 合同 + 把派生能力 IO 后置”的方案，没有走错误字符串匹配、隐式 fallback 或双路径兜底；这让行为更可预测，但总代码仍净增。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：否。
  - 本次新增了 `NextclawApp` 启动 owner 和 `UiNcpAgentRuntimeService` 阶段化实现，总代码量净增；其必要性在于把启动链路从一个语义混杂的大 Promise 收敛成显式阶段合同。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：部分做到。
  - 好处是把“聊天页可见”和“聊天 plane ready”拆成两个明确层次，避免继续把底层报错当 UI 状态。
  - 后端也把“内核启动”“持久化恢复”“衍生能力预热”拆成明确阶段，并把核心 owner 收敛到 `NextclawApp` / `UiNcpAgentRuntimeService`，避免再把 MCP prewarm、session search initialize 直接塞进 ready 语义。
  - 不足是 `packages/nextclaw/src/cli/commands/service.ts` 仍是超预算大文件，本次只是把启动链路继续外提了一步，还没彻底解决根层 orchestration 体积问题。
- 目录结构与文件组织是否满足当前项目治理要求：未完全满足。
  - 本次触达的启动文件已按 `*.service.ts` 收口；但 `packages/nextclaw/src/cli/commands/service.ts` 与若干历史目录预算问题仍然存在。
  - 下一步整理入口：继续把 `service.ts` 的 orchestration 分批下沉，直到根命令文件不再承担过多启动流程拼接。
- 独立维护性复核结论：
  - 可维护性复核结论：通过，但保留明确 watchpoint。
  - 本次是用户可见启动能力修复，不是纯非功能重构；主链路行为更明确，插件/渠道不再阻塞 status。
  - 已顺手减债：撤回非必要 static gate，避免 openclaw loader 继续膨胀；拆分瀑布流输出模块，避免 smoke runner 承载格式化细节。
  - 保留 watchpoint：`packages/nextclaw/src/cli/shared/services/gateway/*` 的目录结构仍触发 module-structure-drift，后续需要单独治理 shared/services 嵌套目录边界。
- 代码增减报告：
  - 本次针对当前启动链路实现范围的维护性守卫统计为：总变更 `+672 / -180 / net +492`。
  - 本轮测量优先续改的局部守卫统计为：总变更 `+581 / -0 / net +581`。
  - 最新 targeted 守卫统计为：总变更 `+534 / -30 / net +504`。
- 非测试代码增减报告：
  - 本次针对当前启动链路实现范围的维护性守卫统计为：非测试代码 `+672 / -180 / net +492`。
  - 本轮测量优先续改的局部守卫统计为：非测试代码 `+581 / -0 / net +581`。
  - 最新 targeted 守卫统计为：非测试代码 `+368 / -30 / net +338`。

## NPM 包发布记录

- 本次是否需要发包：需要。
- 需要发布哪些包：
  - `nextclaw`
- 每个包当前是否已经发布：
  - `nextclaw`：未发布，待统一发布
- 未发布原因：
  - 本次只完成实现与验证，尚未进入下一次 CLI / gateway 统一发布批次
- 阻塞或触发条件：
  - 下一次包含 gateway / startup 行为变化的统一发布时，需要把本次后端启动标准化一起带上
