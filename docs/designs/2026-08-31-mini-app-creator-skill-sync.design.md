# Mini App Creator Skill 机制同步设计

## 背景

NextClaw 已经把 schema v2 Mini App 的 Service 主链扩展为两种真实运行形态：

- `runtime.profile: wasi` 的 Portable Runtime，以 Rust/WASI Component、宿主能力绑定和通用 `.napp` 为主链；
- `runtime.profile: native-process` 的本地进程 Service，用于必须依赖 Node、Python、系统命令、驱动或外部守护进程的场景。

当前内置 `nextclaw-app-creator`、`service-app-creator` 与 `nextclaw-app-publisher` 仍把 schema v2 Service 等同于 `command/args + MCP stdio + native-process`，甚至断言不存在 schema v2 WASI Service 合同。Panel creator 也仍把散落的 workspace 目录当作唯一交付位置。结果是 Agent 会绕过现有 Portable Runtime、误判发布资格，并把开发工具链依赖错误扩散为最终用户运行依赖。

## 目标

让内置 App creator/publisher skills 与当前 Mini App 产品合同一致，同时保持以下边界：

- 安装和运行已经构建好的 Portable App 不要求最终用户安装 Rust、Cargo、Wasmtime 或系统 Node；
- 只有在本机创建并构建 Rust/WASI Guest 时，开发机器才需要 `cargo`、`rustc` 和 `wasm32-wasip2`；
- Portable Runtime 是自包含、可分发 Service 的优先路径，但不是所有 Mini App 或所有开发环境的强制路径；
- Panel-only 与明确需要宿主进程的 native-process Service 继续受支持。
- Mini App 的组件组成与 Service runtime 是两条正交维度，不能把 Panel-only、Portable WASI、native-process 当成三个并列类型。

## Owner 与主链路

### 总入口

`nextclaw-app-creator` 先拥有用户工作流到组件组成的路由：

1. Panel-only；
2. Service-only；
3. Panel + Service。

只有组成中存在 Service 时，它才进入第二条维度，在 Portable WASI 与 native-process 之间选择。两种 Service runtime 都可以与 Service-only 或 Panel + Service 组合，不能和 Panel-only 直接并列比较。

它不复制 `service-app.json`、WIT、MCP 或发布字段细节。涉及 Service 时只读取 `service-app-creator`。

### Service 专项入口

`service-app-creator` 保持为唯一 Service 创建 skill，不新增 `portable-service-app-creator` 平行入口。它只完成运行形态判断，然后按条件读取：

- `references/portable-wasi-service-app.md`：schema v2 包根、Rust/WASI scaffold、WIT、能力声明、Action/Resident/Provider、完整 CLI 验证链；
- `references/native-process-service-app.md`：workspace loose Service 与 schema v2 native-process component、MCP stdio、宿主权限和验证链。

这样 Portable 细节不会进入每个本地 Node helper 的上下文，native-process 细节也不会污染 Portable 创建任务。

### Panel 专项入口

`panel-app-creator` 与 `panel-app-react-vite-creator` 继续拥有 UI、sandbox、bridge 和前端工程合同，但明确两种落点：

- 完整或可发布 Mini App：写入包根 `panels/<panel-id>.panel/`，由根 `manifest.json.components` 引用；
- 明确只做本机 loose Panel：写入 workspace `panels/<panel-id>.panel/`。

Panel 调用 Service Action 继续使用当前 `window.nextclaw.serviceActions.*` 合同，不因 Service 运行时从 native-process 变为 WASI 而分叉。

### 发布入口

`nextclaw-app-publisher` 接受合法的 Panel-only、Service-only 与 Panel + Service schema v2 包；当包中存在 Service 时，再按 `wasi` 或 `native-process` runtime、distribution 和 artifact 合同校验。它不得再把任意 Service component 等同于 native-process，也不得把 Rust 构建依赖说成最终用户安装依赖。

## 选择与放弃

采用“现有 Service skill 内条件分流”，不新增平行 skill。新增平行 skill 会让总入口、显式 Service 请求和发布前修复出现重复 owner，并增加触发冲突。

不把全部 Portable Runtime 文档复制进 `SKILL.md`。只有形态判断、工具链边界和每次都需要的命令门留在入口，长格式、WIT 和生命周期细节下沉到对应 reference。

不修改 Mini App runtime、CLI 或公开开发文档。它们已经提供当前事实源；本批修复的是内置 Agent 消费链。

## 验收契约

- contract-id：`mini-app-skill-sync-v1`
- parent-goal：内置 Agent 能按当前 Mini App 机制创建、验证和发布应用，不强制普通用户或最终用户安装 Rust。
- scope-revision：1；用户已确认 Portable Runtime 不应无条件强制 Rust。

| ID | Required | 合同 | 状态 | 证据 |
| --- | --- | --- | --- | --- |
| MAS-01 | true | 总 creator 先在 Panel-only、Service-only、Panel + Service 之间判断组件组成，仅对存在的 Service 在 Portable WASI 与 native-process 之间路由 | passed | loader 定向测试覆盖三种组件组成、两种 Service runtime 及两条正交维度声明 |
| MAS-02 | true | Service creator 同时覆盖两种 runtime，Portable 分支包含 schema v2 包根、WIT、能力和完整 CLI 验证链 | passed | loader 定向测试读取两份条件 reference，并断言 scaffold、WIT、capabilities 与 CLI 链 |
| MAS-03 | true | publisher 接受合法 WASI Service 发布，不再保留“schema v2 不支持 WASI”的错误合同 | passed | publisher 定向断言覆盖 `wasi-component`、`mcp`，并排除旧错误陈述 |
| MAS-04 | true | Panel creator 区分 package-root 与 loose workspace 交付，同时保持统一 bridge 合同 | passed | Panel creator loader 断言覆盖包根、loose workspace 与 runtime-agnostic bridge |
| MAS-05 | true | 文案明确区分创作者构建工具链和最终用户运行依赖 | passed | creator、Service creator 与 publisher 定向断言均覆盖该边界 |
| MAS-06 | true | loader 定向测试、skill 渐进加载治理与匹配范围类型检查通过 | passed | `skills.test.ts` 16/16、`check:skill-progressive-loading`、`@nextclaw/core tsc` 均通过 |
| MAS-07 | true | 真实 scaffold 或等价 CLI 测试证明文档中的 package shape 与当前实现一致 | passed | `app-scaffold.service.test.ts` 4/4；离线 `nextclaw app doctor --profile wasi --json` 确认当前工具链合同 |

## 验证与回退

- 用 loader 测试同时断言新合同存在、已知错误断言不存在；
- 运行 `pnpm check:skill-progressive-loading` 验证 frontmatter、链接、循环和入口体积；
- 运行 `@nextclaw/core` 匹配范围测试与类型检查；
- 运行 Rust/WASI scaffold 定向测试，并对生成包执行可用的 `app check`；有工具链时再执行 build/test，不把本机缺少 Rust 错报为最终用户运行缺陷；
- 若入口体积或触发成本明显上升，优先继续下沉条件细节，不回退到否认 Portable Runtime 的旧合同。

本次仅修改内置 skill 消费链，不改变宿主启动或运行时代码，因此不启动、不重启 NextClaw；离线 CLI 与 scaffold 测试已覆盖所需事实源。

## 非目标

- 不改变 runtime、WIT ABI、CLI 参数或 Marketplace 审核策略；
- 不删除 native-process Service；
- 不要求纯 Panel App 使用 Rust；
- 不在本批引入新的远程构建服务或捆绑 Rust 编译器。
