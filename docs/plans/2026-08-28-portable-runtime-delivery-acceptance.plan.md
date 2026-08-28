# Portable Runtime 产品方向交付验收契约

> 状态：整体目标已重新打开。下文原 macOS MVP 证据仍然有效，但只代表一个执行阶段完成，不再代表 Portable Runtime 产品方向完成。

## 最终结果

用户在不理解 WASM、Component 或 runner 的前提下，可以从 NextClaw 现有应用体系安装并使用一组真实的日常小应用；这些应用以 Rust/WASM 承载逻辑，共用单个低常驻成本的宿主 runner，并真实证明数据、后台运行、组件组合、Agent 调用、权限和应用生命周期主链。

最终交付不再由 AI 自行限定为 macOS 单平台 MVP。macOS 本地链路是第一个已完成切片；整体目标是把 Portable Runtime 做成 NextClaw 中可真实承载常见 Service App、可开发、可分发、可治理的正式产品能力，并完成所有不需要新增用户授权或外部条件的工作。

## 整体验收契约

### 必须成立

1. **普通用户看得懂并能使用。** 应用列表中至少提供「今日清单」「灵感便签」「专注小钟」「联系人整理」四个真实场景入口；技术机制退居折叠说明或开发者验证台。
2. **不是前端演示。** 四个场景沿正式 Panel → Service Action → Kernel → portable runtime → Rust/WASM Component 链路执行，前端不得用本地计时器或假数据冒充后台、持久化或组合调用。
3. **核心机制五脏俱全。** 至少真实覆盖 Action、结构化数据、Resident 后台任务、事件/调度、Provider/Consumer 组合、Agent Tool 入站和明确授权；每种机制都有一个用户可理解的场景承载。
4. **同一能力多入口复用。** Panel 与 Agent 调用同一个 Service Action contract；Agent 必须产生真实工具发现与调用，不能根据提示词模拟结果。
5. **状态与恢复成立。** 清单/便签数据跨 Component、runner 和 NextClaw 重启保持；专注计时在 Panel 关闭后继续，在停用后停止，重新启用或 runner 恢复后从持久游标继续且不重复推进。
6. **组合与边界成立。** 联系人整理由独立 Consumer 经宿主调用 Provider；未声明依赖或未授权调用得到稳定、可理解的拒绝，不绕过宿主直接互调。
7. **共享 runner 是产品资源。** 当前平台只构建和分发一个宿主 runner，所有 App 复用；正常启动不得依赖开发者手工设置 `NEXTCLAW_WASMTIME_RUNNER_PATH`，缺失或不兼容时给出明确诊断。
8. **现有 App 生命周期闭合。** 在干净 `NEXTCLAW_HOME` 中完成安装、显示、启用、授权、调用、停用、重新启用、更新和卸载；明确并验证卸载时 App 数据与授权的真实保留/删除语义。
9. **失败可观察。** capability 拒绝、超时、guest trap、runner 退出和依赖缺失不会表现为无响应或成功；恢复后不丢持久数据、不创建重复 Resident 实例。
10. **交付材料可复验。** 提供一条本地构建/启动路径、场景体验指引、Agent 验收提示词、自动化证据和仍未支持能力，不依赖本次会话口头说明。

### 必须不发生

- 不新增平行的 Wasm App 产品类型、第二套安装器、第二个 Marketplace 或第二份 App 数据 owner。
- 不为每个业务场景向宿主增加专用 API；底层只提供可复用的有限根能力。
- 不为 portable executor 失败静默回退到 `native-process`，也不让 Panel/Agent 感知 executor 类型。
- 不按 App 重复打包 native runner，不把 Rust 编译产物或开发机绝对路径写进 App contract。
- 不把尚未实现的 Secret、Blob、长任务、流、模型/Agent 出站、三平台或生产资源治理宣称为已支持。

### 架构不变量

- `.napp` 身份、安装、版本、更新、卸载和数据生命周期继续由现有 App Package owner 管理。
- NextClaw 产品语义留在 Kernel；runner 只执行 Component 并实现通用 host capability contract。
- WASM guest artifact 与平台无关；native runner 按 OS/arch 属于宿主分发资源，并由一个标准 resolver 发现。
- Service Action 是 Panel、Agent 和后续 CLI 的公共能力边界；授权按真实 caller 执行。
- Resident 的实例、游标和恢复只有一个生命周期 owner；Provider 依赖恢复先于 Consumer/Resident。

### 代表性场景

1. **今日清单：** 在 Panel 新增、完成、删除任务；让 Agent 查询并新增一项；刷新和重启后双方看到相同数据。
2. **灵感便签：** 保存便签并通过与清单共享的结构化数据 Component 读取，证明一个通用能力能承载不同产品入口。
3. **专注小钟：** 开始专注后关闭 Panel，稍后重新打开仍在推进；停用 App 后冻结；重新启用及 runner 恢复后从游标继续。
4. **联系人整理：** 输入混乱联系人，由 Consumer 调用 Provider 规范化；撤掉依赖声明或权限时得到明确拒绝。
5. **安装与恢复：** 干净环境安装包、授权、体验四个场景、更新版本、终止 runner 后恢复、卸载，并核对数据和授权语义。

### 交付与授权边界

- 当前阶段已完成：macOS 开发平台的源码构建、本地宿主资源装配、`.napp` 安装和干净环境验收。
- 整体目标仍需完成：跨平台构建与装配、开发者创建/构建/打包闭环、通用根能力与常见场景、完整生命周期和生产治理中当前可实施的部分。
- 未获授权不执行：commit、push、PR、NPM/Desktop 发布、部署或公开安装包分发；但必须先把这些动作之前的产物和验证准备完整。

### 真实边界

- 用户已明确暂不追求 Python/JavaScript 等多语言 SDK；官方开发路径先以 Rust 为唯一主路径。
- commit、push、PR、公开发布和部署需要用户明确授权，当前只准备到可执行状态。
- Windows/Linux 的真实运行验证需要相应环境；本地可以完成的源码、CI、交叉构建和包合同不因此排除。
- Agent OS、Node REPL 与新 DSL 属于更上层方向，不替代当前 Portable Runtime 产品闭环；是否纳入由后续产品事实决定。

## 阶段图

| 阶段 | 可验收结果 | 进入下一阶段的门 | 状态 |
| --- | --- | --- | --- |
| 0. 契约与现状审计 | 完成唯一验收事实源，区分已证实与未闭合链路 | 所有当前缺口均映射到本契约 | 已完成 |
| 1. 单平台运行时产品化 | 共享 runner 可由标准资源路径构建、发现、诊断，不依赖手工环境变量 | 干净环境可启动 portable App；缺失 runner 明确失败 | 已完成 |
| 2. 产品场景与机制闭环 | 四个日常 App 真实覆盖 Action/Data、Resident、Provider、Agent 与权限 | 五个代表性场景逐项通过 | 已完成（live Agent 采用既有成功证据） |
| 3. 生命周期与恢复闭环 | 安装、启停、runner 恢复、卸载及数据/授权语义可重复；本地内置包不伪装 registry 更新 | 干净实例的真实 UI/API 结果与自动化合同一致 | 已完成 |
| 4. macOS 切片验证与 Review | 首个产品切片形成可重复证据 | macOS 已证实能力不回退 | 已完成 |
| 5. 完整差距重审与合同收敛 | 所有当前可做工作进入阶段图，排除项只剩真实边界 | 不再存在 AI 自定范围形成的“80% 完成” | 进行中 |
| 6. 常见能力与产品场景闭环 | 常见 Service App 场景由有限根能力真实承载 | 关键能力和失败边界达到计划要求 | 未开始 |
| 7. 跨平台与开发者闭环 | Rust 开发者路径、构建、包和三平台装配可用 | 当前可完成的平台与 CI 证据闭合 | 未开始 |
| 8. 生产治理与交付准备 | 生命周期、资源、安全、诊断、兼容和发布前产物闭合 | 只剩待授权外部动作或真实环境阻塞 | 未开始 |

## 阶段 3 验收证据

- 在全新 `NEXTCLAW_HOME` 中，内置包以禁用状态出现；启用后首次 Panel 写入触发真实授权，并写入「生命周期验收数据」。
- 停用后 Resident 在 `eventCount=209` 冻结并写入 `stoppedAt`；重新启用后实例代次 `1→2`、计数继续增长，业务记录保持。
- 终止共享 runner PID 后，最初发现常驻角色被误报为 running；修复退出通知后再次注入故障，实例代次 `4→5`、计数 `285→287`，新 runner PID 出现且数据保持，Provider/Consumer 合同继续可发现。
- 默认卸载返回 `dataRemoved=false`，代码和 App 记录移除而受管数据文件仍在；恢复内置包并启用后，实例代次到 6，原记录重新出现。
- 显式 `purgeData=true` 后返回 `dataRemoved=true`，App 记录与精确实例目录均消失。
- 内置本地 fixture 调用 registry update 返回明确 404；它没有远端发布元数据，因此该实际入口不适用于本地 MVP。更新、回滚和数据保持机制由现有 App Package 自动化合同覆盖，本轮不伪造第二版本或宣称远端更新成功。
- 本轮还修复了发布者校验在实例物化阶段失败时遗留不可变版本目录的问题，并增加回归测试；失败安装不再阻塞后续合法恢复。

## 新发现与契约变更

- **事实：** 当前 `日常小工具箱` v0.5.2 已真实证明四个产品场景和多数机制，但 runner 发现依赖开发路径。**影响：** 只能称为技术/体验 Demo，不能称为本地产品 MVP。**决定：** 把共享 runner 产品化设为阶段 1，不继续增加浅层 Demo。
- **事实：** 完整平台能力表还包含 Secret、Blob、长任务、流与模型/Agent 出站。**影响：** 原契约把它们列为非目标后仍宣称任务完成，造成用户所说的 80% 偏差。**决定：** 全部恢复为整体目标中的待审计工作，按价值、依赖和可验证性分阶段推进。
- **事实：** 共享 runner 已由产品构建脚本同步到 `nextclaw/resources/native/darwin-arm64`，Distribution 注入 Kernel，并在无 override 的隔离实例中完成 Action 发现。**影响：** 开发路径依赖已删除。**决定：** 阶段 1 通过，后续真实场景统一使用该 shipped path。
- **事实：** 最终分发路径上的四个 Panel 已完成真实写入、后台连续运行和 Provider 组合；既有真实 Agent 会话已成功调用同一 State Tool，本次额外 CLI live 调用因模型 120 秒无输出被终止。**影响：** 本地机制和历史端到端证据充分，当前模型可用性没有新增肯定证据。**决定：** 阶段 2 通过，但最终报告披露本次 live 模型未完成，不把它写成 runtime 失败或新的成功。
- **事实：** runner 空闲退出时没有 pending request，旧 client 不会通知 runtime，导致 Resident 定时器在新 runner 中丢失。**影响：** Action 能恢复会掩盖常驻角色未恢复。**决定：** runner 退出成为显式生命周期事件，由 portable runtime 按 Provider→Resident 顺序重建持久角色，并以真实 PID 故障注入验收。
- **事实：** 内置 App 卸载会设置 suppression；这是“用户明确移除内置 App”的既有语义，源码目录直装又会被 retained publisher owner 拒绝。**影响：** 本地 fixture 没有普通用户的“一键重装内置 App”入口。**决定：** 阶段 3 用受控 bootstrap 恢复验证数据语义，并把用户可见恢复入口列为后续产品缺口，不把内部恢复步骤包装成已交付体验。

## 契约 Review

- 已补入最容易造成“只做了 80%”的安装、更新、卸载、数据、权限、Agent、失败和 runner 分发链路。
- 多语言仍按用户明确选择排除；三平台、通用 host capability、开发者闭环和生产治理不能再作为 AI 自定噪声删除，必须作为整体目标中的未关闭项逐项裁决。
- 没有把测试命令、文件布局或 Wasmtime 内部 API 写成验收合同；这些由实现和 Validation 决定。

## 阶段 4 验收证据

- 7 个受影响 TypeScript package 的 `tsc` 全部通过；App Runtime、Kernel、Server、UI、Distribution 和产品构建脚本共 103 个不重复的定向测试通过。
- Rust runner 的格式检查、release build/test 和 `pnpm portable-runtime:build` 通过；产品构建生成 1 个约 25.98 MB 的 macOS arm64 runner 和 5 个 guest Component。
- 中英文用户文档构建通过；新增的验收契约 skill 通过结构校验和 38-skill 渐进加载预算。
- diff-only maintainability Review 首轮发现 3 个错误；提取安装合同并压缩 Kernel 装配后复验为 0 error。剩余 warning 均为既有或接近预算的热点，没有新增违规。
- `git diff --check` 通过；changeset 状态可解析。5177 体验实例保持健康，应用 v0.5.2 已启用，5 个 Panel 可见，Provider 与 Resident 为 running。
- 本轮没有执行 commit、push、PR、发布或部署；这些仍需用户明确授权。

## 尚未关闭

- 内置 App 被用户卸载后的可见恢复入口；不影响 portable runtime 机制，但影响内置体验包生命周期的完整产品体验。
- 本地 fixture 没有远端 registry 版本，未进行真实在线 update；已有机制测试不能替代后续 registry/发布验收。
- Secret、Blob/file、长任务 progress/cancel、stream/event、Component → model/Agent 等常见能力尚未形成完整根能力与产品场景证据。
- Rust 开发者创建、调试、构建、验证、打包和安装尚未形成一条正式 CLI/SDK 主链。
- Windows/Linux runner、宿主装配与跨平台合同尚未闭合；相应真实运行环境证据仍缺失。
- 资源配额、取消、超时、错误诊断、WIT 兼容、升级迁移和分发恢复尚未达到生产采用要求。
- 等价 Node workload 的内存、启动、调用和密度数据尚未形成可复验基线。
- fuel/epoch/StoreLimits 资源治理 spike 未能在当前同步 Component 调用中形成可靠的可终止行为，已完整撤回而非作为兜底保留。CPU、内存、timeout/cancel 仍需采用可真实终止且不拖垮共享 runner 的执行隔离方案。
- Rust runner 构建合同已覆盖 macOS arm64/x64、Linux arm64/x64 与 Windows x64，并新增 macOS/Linux/Windows 原生 CI 矩阵；本机只真实运行了 macOS arm64，另外两平台的运行证据必须由对应 CI/环境提供。
- `nextclaw app check/dev/call` 已支持 `wasi-component`，会从所属 schema v2 Mini App 读取权限和 Component 路径；真实 CLI 已完成 check、action discovery 与持久数据读取。
- 构建时直接覆盖正在运行的 runner 会造成 macOS executable vnode 退出等待；产品资源同步已改为临时文件写入后原子替换，并增加回归测试。
- commit、push、PR、公开发布和部署未获授权，不属于当前可自动执行范围。
