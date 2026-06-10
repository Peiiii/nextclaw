# Core 可维护性重构设计

## 背景

本设计用于约束 `packages/nextclaw-core` 后续重构优化。目标不是新增用户功能，而是让 core 更少、更清晰、更可预测：删除非必要遗留结构，收窄无意公开的 API 面，降低平铺目录和大文件的维护成本。

愿景层约束是：core 应服务 NextClaw 作为个人操作层的统一入口、能力编排、自感知和生态扩展。core 不应变成所有功能的垃圾场；它应沉淀稳定合同和基础能力，把运行时编排、产品业务和扩展实现留给各自 owner。

## 已读取规范

- `docs/VISION.md`
- `.agents/skills/nextclaw-delivery-workflow/SKILL.md`
- `.agents/skills/nextclaw-clean-implementation/SKILL.md`
- `.agents/skills/writing-beautiful-code/SKILL.md`
- `.agents/skills/classic-software-design-principles/SKILL.md`
- `.agents/skills/code-investigation-workflow/SKILL.md`
- `.agents/skills/project-knowledge-governance/SKILL.md`
- `.agents/skills/nextclaw-iteration-log-governance/SKILL.md`
- `.agents/skills/role-first-file-organization/SKILL.md`
- `.agents/skills/file-naming-convention/SKILL.md`
- `.agents/skills/collapsible-feature-root-architecture/SKILL.md`
- `.agents/skills/file-organization-governance/SKILL.md`

## 审计范围与证据

审计命令覆盖了 core 目录结构、文件规模、公共出口、外部 `@nextclaw/core` 消费、空目录、legacy/fallback/alias 命中点，以及 file organization governance。

关键事实：

- `packages/nextclaw-core/module-structure.config.json` 声明协议为 `app-l2`，根入口只允许 contract-only。
- `packages/nextclaw-core/src` 当前约 157 个 TS/TSX 文件，总计约 20540 行。
- feature 规模前三：
  - `features/agent`：41 文件，约 5950 行。
  - `features/config`：29 文件，约 4239 行。
  - `features/llm-providers`：13 文件，约 2699 行。
- 平铺热点：
  - `features/config/configs`：28 个源文件。
  - `features/agent/tools`：17 个源文件。
  - `features/llm-providers/providers`：9 个源文件。
- 大文件热点：
  - `features/config/configs/schema.ts`：753 行。
  - `features/llm-providers/providers/openai_provider.ts`：554 行。
  - `features/session/stores/session.store.ts`：506 行。
  - `features/agent/tools/shell.tools.ts`：367 行。
  - `features/agent/tools/web.tools.ts`：358 行。
- 外部源码层 root import/export 消费：
  - 约 221 个文件触达 `@nextclaw/core` 根入口。
  - 主要消费者：`packages/nextclaw-kernel` 66 个文件，`packages/nextclaw-service` 64 个文件，`packages/nextclaw-server` 44 个文件。
  - 常见符号：`Config`、`saveConfig`、`ConfigSchema`、`loadConfig`、`MessageBus`、`getConfigPath`、`getDataDir`、`APP_NAME`、`ExtensionChannelBinding`、`BaseChannel`。
- 源码层未发现外部直接 import `@nextclaw/core/child-process-env`；该子入口主要是 package export / 发布合同。
- `packages/nextclaw-core/src/index.ts` 只 re-export `app/index.ts`；`app/index.ts` 又对 13 个 feature/shared 入口做 `export *`。
- 空目录：
  - `features/agent/features/content`
  - `features/command-registry/services`
  - `features/extensions/services`
  - `features/runtime-context/types`
  - `features/session/managers`
  - `features/typed-event-bus/services`
  - `features/typed-event-bus/types`
- `command-registry` 的当前生产 owner 已在 kernel：源码引用集中到 `packages/nextclaw-kernel/src/services/command-registry.service.ts` 及相关调用方，core 内仅剩空目录。

## 当前结构判断

core 当前不是缺少分层，而是存在四类维护压力：

1. 公共面过宽：`export *` 让内部工具、worker、provider 细节、测试友好类型容易被无意公开。
2. 角色目录混合：`config/configs` 同时承载 schema、loader、migration、runtime resolution、secrets、UI hints、action manifest。
3. 大 owner 过重：`schema.ts`、`openai_provider.ts`、`session.store.ts`、`shell.tools.ts`、`web.tools.ts` 都已经接近或超过应主动拆解的维护阈值。
4. 迁移残影未清：空目录、旧 feature root、非 kebab 文件名和 legacy/fallback 代码混在一起，增加后续判断成本。

但这里不能简单地把 core 当成普通内部包处理。`@nextclaw/core` 已经是多个 workspace 包和 channel extension 的公共 SDK 合同，因此重构必须先区分“稳定公共合同”和“内部实现细节”。

## 设计原则

- `deletion-first`：先删空目录、无意义 barrel、无调用方导出和旧迁移残影，再考虑新增结构。
- `single-domain-owner`：同一事实只能有一个 owner。config、provider catalog、tool contract、session persistence、runtime path/env 分别归各自 owner。
- `visible-main-flow`：大文件拆分必须让主流程更可见，不能把一个线性流程拆成一串私有跳转。
- `boundary-only-defense`：兼容、fallback、alias 只允许保留在真实外部边界。内部重构不得为了少改调用方保留双入口。
- `root 保边界，角色文件回角色目录`：scope root 只保稳定入口；角色实现回 `services/`、`stores/`、`utils/`、`providers/`、`tools/`、`types/`。
- `explicit-public-api`：core 根入口应逐步从 `export *` 收敛为显式导出清单。

## 目标结构

### 公共合同面

core 根入口应只导出稳定公共合同，按语义分为：

- config contract：`Config`、`ConfigSchema`、load/save、config path、config diff/reload、secrets、agent profiles。
- runtime path/env contract：workspace/data/run/skills/panels/logs 路径与 child process env。
- channel extension contract：`BaseChannel`、`MessageBus`、inbound/outbound message types、extension channel metadata。
- provider contract：provider spec/catalog、LLM response/stream/tool-call contract、thinking/model helpers。
- tool contract：`Tool`、`normalizeToolParams`、core tool classes、tool execution context。
- session contract：session message/event/list types、session-request utilities、session-search manager surface。
- logging contract：logger runtime、file sink、log kind/path helpers。

内部 worker host、provider implementation helper、schema UI label tables、migration helper、test-only shape 不应通过 root `export *` 暴露。

### Config feature

`features/config` 应从 `configs/` 混合目录收敛为清晰角色结构：

```text
features/config/
├── index.ts
├── configs/
│   ├── brand.ts
│   ├── config-schema.config.ts
│   ├── panels.config.ts
│   └── service-apps.config.ts
├── services/
│   ├── config-loader.service.ts
│   ├── config-secrets.service.ts
│   └── config-agent-profiles.service.ts
├── utils/
│   ├── config-schema-hints.utils.ts
│   ├── config-schema-labels.utils.ts
│   ├── config-schema-help.utils.ts
│   ├── config-reload.utils.ts
│   ├── config-redact.utils.ts
│   ├── provider-runtime-resolution.utils.ts
│   ├── agent-avatar.utils.ts
│   └── agent-profile-runtime-fields.utils.ts
```

拆分边界：

- `schema.ts` 的 Zod schema 主体保留为 schema owner，但 provider matching / schema response builder / hints / labels / help 不继续塞在同一文件。
- `loader.ts` 目前包含 path、load/save、migration、safe persist、builtin key ensure。后续应拆成 loader service 加 migration utils，但不要新增空心 class。
- `secrets.ts` 内部已有 `ConfigSecretResolver` class，适合成为 service；纯 path/ref helper 可进入 utils。
- `agent-profiles.ts` 同时有 profile resolve/create/update/remove 和 avatar read re-export，后续应与 `agent-avatar.ts` 分清 profile service 与 avatar utils。

### Agent tools

`features/agent/tools` 不应按脚本建议拆成 `general/other`，也不能在当前 module contract 下新增 `tools/<domain>/` 子目录。正确方向是保持 direct `*.tools.ts` 文件，并在单文件过大时先抽同目录纯 utils：

```text
features/agent/tools/
├── base.tools.ts
├── filesystem.tools.ts
├── shell.tools.ts
├── web.tools.ts
├── message.tools.ts
├── spawn.tools.ts
├── subagents.tools.ts
├── cron.tools.ts
├── memory.tools.ts
├── gateway.tools.ts
└── registry.tools.ts
```

拆分边界：

- 工具 class 仍留在 `*.tools.ts`。
- 大量无状态解析、格式化、截断、安全检查，若仅服务同一工具，可进入同目录 direct `*.utils.ts`。
- 不新增 `ToolService` / `ToolManager` 包一层，因为 tool class 本身已经是 agent-facing owner。

### LLM providers

`features/llm-providers/providers/openai_provider.ts` 先改名为 `openai.provider.ts`，同步测试命名。

后续拆分方向：

- provider class 保留请求主流程和 API 选择策略。
- chat completions / responses 的 payload、stream state、normalizer 已在 shared openai utils 中，不再复制。
- fallback policy 保持在 provider 真实外部协议边界，不下沉到调用方。
- `registry.ts` 目前是 provider catalog owner，可保留，但根出口应显式导出需要的 registry API。

### Session 与 session-search

`session.store.ts` 包含持久化、legacy line 读取、event projection、history window normalization。这里存在大文件压力，但 legacy 读取属于持久化边界，不能在没有数据迁移证据时删除。

后续拆分方向：

- session store 保留文件 IO 和 session lifecycle。
- legacy line parser / event projection 可进入 `utils/session-journal-line.utils.ts`。
- history window normalization 可进入 `utils/session-history-window.utils.ts`，前提是测试先覆盖 assistant/tool-call block 行为。

`session-search-worker-host.utils.ts` 是模块级 worker runtime 状态。可以收敛成 worker runtime controller class，但这是中风险行为改动，必须先覆盖 worker start/query/session-updated/dispose 的真实链路测试。

### 空目录与历史残影

可直接删除候选：

- `features/command-registry/services`
- `features/typed-event-bus/services`
- `features/typed-event-bus/types`
- `features/agent/features/content`
- `features/extensions/services`
- `features/runtime-context/types`
- `features/session/managers`

删除前仅需确认这些目录没有被 module-structure contract 或脚本硬编码。当前源码引用审计未发现 core 内生产引用。

## 明确不做

- 不为了目录数量把 `agent/tools` 拆成 `general/other`。
- 不为了净减行数删除公开 contract、显式类型名、兼容边界或迁移保护。
- 不把 `ConfigSchema` 等高频公共符号迁出 root 入口。
- 不新增空心 service/manager，只为满足命名治理。
- 不把 `@nextclaw/core` 的所有消费者一次性改成子入口 import；这会扩大变更面，应先稳定显式 root export。
- 不在没有真实数据迁移证据时删除 session/config 里的 legacy reader。

## 推荐执行批次

### 批次 1：无行为减债

目标：删除明显残影，修正命名和测试落位，不改变运行语义。

- 删除空目录。
- `openai_provider.ts` -> `openai.provider.ts`，同步测试文件名与 imports。
- 测试文件按被测 owner 留在合规 role 目录，并带角色后缀，例如 `*.config.test.ts`、`*.utils.test.ts`、`*.service.test.ts`；不新增 `config/__tests__` 或 `tools/__tests__`。
- 跑 core tsc、相关 vitest、governance。

### 批次 2：显式公共面

目标：从 `export *` 收敛到显式 root export，但保留已确认公共符号。

- 以 221 个外部源码消费文件为基准生成 root public export 清单。
- 先替换 `app/index.ts` 与 feature `index.ts` 的高风险 `export *`。
- 保留高频公共符号：`Config`、`ConfigSchema`、`loadConfig`、`saveConfig`、`BaseChannel`、`MessageBus`、provider catalog、runtime paths/env、tool contract、session contract、logging contract。
- 对无外部调用方的内部 helper 不再 root export。

### 批次 3：config 结构收敛

目标：把最大平铺目录拆成 configs / service / utils / tests，不改变配置文件格式。

- `schema.ts` 先拆 provider matching 和 schema response builder。
- `loader.ts` 拆 migration / safe persist。
- `secrets.ts`、`agent-profiles.ts` 按 service/utils 分离。
- `schema.help.ts`、`schema.hints.ts`、`schema.labels.ts` 统一命名为 `config-schema-*.utils.ts` 并进入 `utils/`；不新增 `schemas/` 这类非标准角色目录。

### 批次 4：agent tools 结构收敛

目标：在当前 module contract 允许范围内整理 tool owner，保留 direct `*.tools.ts` 文件，不新增 `tools/<domain>/` 子目录。

- 对 `shell.tools.ts`、`web.tools.ts` 提取同目录无状态 utils。
- 检查 `features/agent/index.ts` 是否仍需要逐一 root export 每个 tool class。

### 批次 5：session/session-search 行为边界优化

目标：拆大 store 和 worker host，但只在测试覆盖后推进。

- 为 session history window、legacy journal line、session-search worker lifecycle 补定向测试。
- 再拆 `session.store.ts` 和 `session-search-worker-host.utils.ts`。

## 验证合同

每个批次至少执行：

- `pnpm -C packages/nextclaw-core tsc`
- affected vitest，例如 core config/tools/provider/session-search 定向测试
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/file-organization-governance/scripts/enhanced-check-organization.js packages/nextclaw-core/src`

若触达 public export：

- 额外跑 `pnpm -C packages/nextclaw-kernel tsc`
- 额外跑 `pnpm -C packages/nextclaw-server tsc`
- 额外跑 `pnpm -C packages/nextclaw-service tsc`

若触达 tool 行为：

- 跑对应 tool vitest。
- 做最小 agent tool schema smoke，确认工具名、参数 schema、执行返回未漂移。

若触达 session/session-search：

- 跑 session store、session-search worker/controller/manager 测试。
- 做一次真实或近真实 session search smoke，确认索引、查询、session-updated、dispose 均可观察。

## 可维护性成功标准

- 非新增用户能力，因此每个批次非测试代码净增默认应 `<= 0`。
- 删除空目录、无意义 barrel、无调用方 root export、旧测试平铺是优先减债手段。
- 如果某批次必须净增，必须说明新增的是稳定 contract / owner 边界，而不是补丁式 helper。
- 重构后治理脚本不应继续报 `config/configs` 和 `agent/tools` 平铺热点。
- root public API 比当前更显式，内部实现被 root 无意导出的风险下降。

## 升级条件

本文是设计文档。进入执行前应升级或补充为 `docs/plans/YYYY-MM-DD-core-maintainability-refactor.plan.md`，列出具体文件迁移表、每批次 touched files、验证命令和回滚边界。
