# Bibo 对话架构整体交付记录

## 关联入口

- 合同：[`BIBO-EDGE-2026-09-29`](../../work/2026-09-29-bibo-edge-conversation/acceptance-contract.md)
- 唯一恢复入口：[当前执行状态](../../work/2026-09-29-bibo-edge-conversation/current-state.md)
- 整体候选设计：[Bibo 响应、存储与运行架构](../../designs/2026-09-28-bibo-personal-space-persistence-and-latency.design.md)
- 状态：进行中；下面的观察不等于已交付。

## 原始输入与约束

- 2026-09-28 起的 Bibo 对话：用户报告新旧会话发消息后首字均超过 10 秒，随后在既有会话发送时遭遇“Bibo 正在处理上一条消息”，尽管一小时未发消息。用户提供了会话 URL `https://app.bibo.bot/chat/446a45ad-e9e0-44bf-8a63-e4af7d57239a` 与截图；此链接及图片是故障样本，不是授权公开用户数据。对应 BE-02、BE-03。
- 用户提供的[架构讨论原文](/Users/peiwang/.codex/attachments/9ed3f2d5-38c1-4e74-bef8-d740a0d199c7/已粘贴的文本.txt)是讨论材料；原意是比较 Worker/DO、共享 Node、每用户容器、共享按需容器，而非只优化 Docker 构建。先前 AI 对 1–3 秒冷启动及价格的说法是待验证假设，不能算实测。对应 BE-01、BE-02、BE-06、BE-07。
- 随后用户明确认可：普通聊天先走共享热/边缘路径，真正需要独立 OS 的长任务才按需启执行器；若采用共享容器备选，最小常驻数量先为 0；纯聊天最好完全不启动容器。用户要求同时考虑状态、软件安装、长期 HTTP 服务的生命周期。长期服务尚不是现有 Bibo 功能承诺；架构须可扩展。对应 BE-01、BE-04。
- 用户要求将 NextClaw 重构纳入决策，但必须保持它独立、通用、可拓展；精准拆解存储/宿主层，少改经过验证的逻辑；旧用户升级后仍正常。对应 BE-03、BE-04、BE-05。
- 2026-09-29 用户明确委托低监督完成整体方案、实现、提交及上线，授权必要动作，要求大型交付链路、事前设计验证、防止旧功能破坏，最终交付成品。此授权替代旧设计中“尚未批准实施或发布”的状态。对应 BE-08。
- 2026-09-29 最后补充：成功须“体验没有任何退化”，首字显著加速，纯聊天不启动容器、成本降低，并给尽量多的可核实数字；AI 自审证据满意后才交付。对应 BE-01、BE-02、BE-03、BE-06、BE-08。
- 原有 Bibo 延迟修复的合入与部署授权，以及后续“部署上线”指令在前文已经给出；本次更广泛的明确授权覆盖交付链路。凭据和用户数据不复制进日志。

## 过程记录

### 2026-09-29：建立整体责任

- 对照原始讨论、产品愿景及当前代码调查，确立上述合同。当前设计仍是候选，只有单次 15.3 秒首字样本，没有生产分位数；所有量化结论必须另取样。
- 现有 worktree 的假忙补丁尚未通过维护性审查，且落后 master 17 个提交；不直接混入发布。主工作区另有活跃 WIP，保持隔离。
- 新文档的 planned-path preflight 已通过：`pnpm preflight:governance -- docs/work/2026-09-29-bibo-edge-conversation/acceptance-contract.md docs/work/2026-09-29-bibo-edge-conversation/current-state.md docs/logs/2026-09-29-bibo-edge-conversation/README.md docs/plans/2026-09-29-bibo-edge-conversation.plan.md`。文档路径不受文件角色检查约束；命名采用日期主题，既有文件未改名。

### 2026-09-29：现网历史延迟的初步取证

- 原仓库 CLI 使用本机 Wrangler OAuth 查询 Cloudflare Observability 返回 403，属于权限失败。改用已连接的 Cloudflare API 只读工具，直接查询同一 `workers/observability/telemetry/query` 接口；未输出 token、消息正文或用户标识。
- 过去 24 小时（2026-09-27 17:12 至 2026-09-28 17:12 UTC）日志查询报告 `samplingLevel=1`，因此样本不完整且可能偏。可配对的 `run.first-delta` 只有 **10 次**：首 delta 中位数 **3.441 秒**，最慢 **15.261 秒**；按 nearest-rank 定义 p95/p99 均为 **15.261 秒**，但 n=10 不足以稳定估计尾分位。配对的接受到首次模型请求中位数约 **2.36 秒**（排序第 5/6 位 2.077/2.647 秒），最慢 **14.746 秒**。样本中存在多轮模型调用，因此“首模型请求后到首字”不能简单等同模型本身时间。
- 同一抽样日志有 22 个 `run.finished`、1 个 `run.rejected`；38 条可配对模型响应头耗时中位约 **0.9 秒**。首字极慢样本里模型前平台耗时足以解释大部分等待，但这仍是阶段性判断，不可外推全部用户或分位。
- 现网未部署 `run.harness-ready` 埋点，容器历史日志无法分离 Kernel 启动与容器恢复；需补充可比较样本和冷/热分类。此次只读取现网，无修改或部署。

### 2026-09-29：边缘可移植性探索的预设判定

- 问题：现有 `@nextclaw/ncp-agent-runtime-next` 的真实依赖图能否在 Worker 中加载并完成模型/工具循环？完整 `@nextclaw/kernel` 入口有哪些不可移植依赖？
- 先用浏览器平台 bundle 和源码依赖审计定位阻塞，再在真实 Worker 环境运行最小模型/工具纵向路径；仅 bundle 成功不足以通过。若需要复制 Agent 语义、移除 NextClaw Node 能力或超过 Workers 资源限制，则返回设计选择共享 Node 备选，不能默认推进边缘生产切换。
- 此探索不迁移生产数据、不对外发布；结果与偏差在本节续记。
- 首轮 `esbuild --platform=browser --conditions=development`：`@nextclaw/ncp-agent-runtime-next` 有 8 个 Node builtin 解析阻塞，主要是自身 `node:crypto`/`node:perf_hooks`，以及旧 runtime 根入口带入 `node:fs`、`node:path` 的本地资产/用户内容实现。把 Node builtin 临时标为 external 后产物约 315 KiB，但仍保留本地文件模块，**不是 Worker 可运行证明**。完整 `@nextclaw/kernel` 根入口出现 452 个解析错误（只打印前 12 个），连外置 `node:*` 后仍由第三方 Node SDK 带入 `child_process` 等模块。证据说明必须建立真正可移植的窄入口，不能把完整 Kernel 直接放进 Worker。探针产物仅在 `/tmp`，未改源码或生产。
- 第二轮在 **本地 workerd** 用 `nodejs_compat` 实际加载 `@nextclaw/ncp-agent-runtime-next`，执行其 `DefaultNcpAgentRuntime.run`：伪模型流产生 `run.started → message.text-start/delta/end → message.completed → run.finished`，assistant 最终消息为 `worker runtime ok`，无 `run.error`；一次本地观测运行约 **7 毫秒**。这推翻了“旧 runtime 根入口含 Node 依赖就无法在 Worker 加载”的过强推断，但只证明 Agent 循环的最小切片，未证明真实模型、工具、上下文、长期状态和生产资源限额。旧版 Wrangler 的本地 workerd 最高支持兼容日期 2026-02-19，目标线上日期是 2026-09-24；正式纵向验证须用版本匹配的 Wrangler。
- 第三轮沿同一公共 runtime 通过线上 Bibo 模型代理发起**真实流式模型请求**，模型回复“边缘运行验证成功。”，NCP 事件正常以 `run.finished` 结束，无运行错误；本地 Worker 计时 **4.544 秒**（n=1，含真实模型及网络，不能推出 p95 或相对加速）。复用 `@nextclaw/ncp-toolkit` 的 `DefaultNcpAgentConversationStateManager` 也能在 workerd 加载；适配 `getSnapshot()` 将活动中的 `streamingMessage` 包含在 runtime 视图后，完整收敛为 final 消息。Kernel 自身也使用这两个公共组件，说明现有通用合同可以成为双宿主共用路径。
- 工具轮次暴露真实 Worker 兼容阻塞：给 `NcpTool.parameters` 传 JSON Schema 时，当前公共 runtime 调用 Ajv 的运行时 `compile()`，workerd 报 `Code generation from strings disallowed for this context`，工具未执行。使用 NCP 既有 `NcpTool.validateArgs` 合同做无动态代码生成的参数验证，并在模型输入构建器独立提供同一工具的 OpenAI Schema 后，本地工具调用、工具结果、第二轮模型与最终消息都通过，`toolInvoked=true`、`modelCalls=2`、无 `run.error`。正式实现须让一个工具定义同时生成供模型看的 Schema 与 Worker 可执行验证，避免这项实验中的两处手写定义漂移；Node 现有 Ajv 路径不得被削弱。
- 对旧假忙补丁运行一次定向 diff-only maintainability guard，报告 3 个 `max-statements` 错误（空间处理、执行编排、runner 计时所在函数）和 4 个警告；该补丁不能按现状提交上线。先前设计指出的并发根因仍成立，需在保持语义前提下收敛状态与函数职责。

### 2026-09-29：旧会话假忙方案 Review（mode=design）

- 审查范围：[并发设计](../../designs/2026-09-28-bibo-chat-space-read-concurrency.design.md) 及其 2026-09-29 精简修订，仅覆盖 BE-03 的假忙止血，不为整体边缘架构放行。
- 从用户原始截图与一小时未发消息的描述反查：打开旧会话 → 页面并行读取空间 → 立即发送 → 聊天被接受 → 输出和保存 → 刷新空间；设计保留这一完整用户链路。`/space` 读与 `/run` 的互斥是已观测根因，读/写分类、runner 单请求约束、取消/失败释放和结构化读的状态语义均有对应处理。
- Findings：无新的方案阻塞项。已知首份实现的 3 个维护性错误属于 Implementation 返工目标，未被方案通过掩盖。`design-review: passed` 仅适用于该止血切片；边缘重构仍需纵向原型与独立方案 Review。

### 2026-09-29：旧会话假忙止血实现与迭代检查

- 将空间请求的纯解析移到 `apps/bibo-hosted/src/app/utils/bibo-space-request.utils.ts`，原有 BiboUserContainer 继续拥有读写互斥和快照。去掉多余的 `spaceReadActive` 状态，仅保留当前容器读取完成信号；聊天接受后等当前读取结束，后续容器读取等聊天终态。历史加载不再触发空间全量刷新，仅真实 `committed` 或已保存恢复后刷新可见空间。
- 新增源码路径已运行 planned-path preflight；`routes/` 下 `*.utils.ts` 被角色检查拒绝，改放已有 app 的 `utils/` 角色路径后通过。未新增第二套会话或运行 owner。
- `pnpm -C apps/bibo-hosted tsc` 通过；`src/app/bibo-hosted.app.test.ts` 14 项通过；`smoke:client` 浏览器冒烟以退出码 0 通过（含 Vite 产物构建）。定向 diff-only maintainability guard 阻断错误从 3 降为 0，仍提示已有目录和接近 400 行的文件预算。
- `pnpm -C apps/bibo-hosted test` 共 43 项中的 42 项通过，1 项 `bibo-space.store.test.ts` 因 Node/tsx 无法加载通过 `workspace-router` → `@/features/chat` 带入的 CSS 而在测试加载阶段失败。该导入链在本次补丁前已经存在，本次不把它算成行为回归，也不把全套测试说成通过。后续须用等价测试环境复验或修复测试边界，再按交付门裁决。
- 源码仍未通过最终 implementation Review 与线上复验；此项不得升为 BE-03 passed。

### 2026-09-29：旧会话假忙修复 Review（mode=implementation）

- Findings：无源码正确性阻断项。逐条核对读取中发送、聊天期间结构化读/容器读、写入互斥、失败读取释放、取消和前端历史加载；`spaceQueue` 保证同一时刻最多一个容器读取信号，`activeRun.finished` 在执行终态统一完成。新增的读失败后再发消息测试通过。
- 自动检查：diff-only maintainability guard 对本次源码路径 0 错误、4 警告（app 目录既有文件数、三个接近行数预算的文件）；定向 ESLint 通过；`git diff --check` 通过。新 `utils` 文件隔离纯请求解析，没有复制空间状态 owner。
- 验证边界：Bibo 三套 TypeScript 配置检查通过，14 项 app 边界测试通过，浏览器 `smoke:client` 通过。全量 test 的 1 项 CSS 加载失败已在上节记录，不能表述为全量通过。原会话的生产真实路径尚未复验，整体合同 BE-03 保持 failed。`implementation-review: passed` 仅对该止血改动的已验证源码生效，发布后仍需 L4 线上验证。

### 2026-09-29：旧会话假忙止血发布

- 局部修复提交 `4d17044ff`；与当时远程主干合并后形成 `b2d3ddc62`，已快进推送到 `origin/master`。合并后 Bibo 三套 TypeScript、14 项 app 边界测试、浏览器 `smoke:client` 复验通过。
- 从干净的冻结主干工作区运行 `pnpm -C apps/bibo-hosted deploy:client`，完成 Worker/UI 发布，容器镜像未重建；线上 Worker 版本 `d91d0d9c-475b-4c1b-83f6-466a08fe2537`，命令总用时 **37.67 秒**。该计时包含预检、前端构建、资源上传和切换；分段时长见部署日志，后续需正式埋点统计完整代码就绪到可用时间。
- 生产真实账号 `smoke:live` 首轮在文件页的旧测试定位超时：实际文件已由 Agent 创建、保存并显示，页面现在默认处于“预览”模式，脚本却直接寻找编辑框。脚本改为点击“编辑”后，第二轮又发现编辑器是 `contenteditable`，不能使用原生输入框的 `inputValue()`。这两次失败均有截图及真实文件状态佐证，并非把失败忽略。
- 修订冒烟定位后第三轮通过：模型代理输出 **52 个内容块，首内容 2.474 秒**；搜索返回 **10 条结果**；搜索对话 **256 个 delta、总 9.815 秒**；文件创建对话 **25 个 delta、总 10.575 秒**，答案与文件持久化、自动预览、桌面和手机刷新均通过。命令总耗时 **61.71 秒**，测试数据按脚本清理。该样本含工具且受模型波动影响，不能作为 BE-02 的无工具首字分位数。
- 此发布仅修复 `/space` 读与 `/run` 假互斥，**不**满足零容器、首字速度、成本或架构目标。原用户一小时前旧会话未以其身份直接发消息，特定会话的复验仍是 BE-03 缺口。

### 2026-09-29：边缘文件与工具接口的第一刀及自审

- 在隔离分支把 Bibo 工具注册拆出为同一 `createBiboSpaceTool` 工厂；Node 原 JSON Schema 路径不变，Worker 模式通过 NCP 现有 `validateArgs` 扩展点避开 Ajv 的动态代码生成。真实本地 workerd 导入实际 Bibo 工具代码后完成伪模型 `task.list` 调用、工具结果和第二轮回答，无 `run.error`。这只证明工具切片，没有替代生产文件工具、搜索或 `show_file`。
- `BiboSpaceService` 增加文件正文存储口；旧 Node 本地读写仍为默认。新增 DO 文件存储草稿按文件 ID 暂存，在 `BiboSpaceStateStore.save` 中与文件索引同事务提交。定向测试覆盖创建、重新打开、更新、移动、删除及失败事务不留半成品；新测试已加入 Bibo 包测试命令。Bibo 三套 TypeScript、14 项定向测试、定向 ESLint 和 `git diff --check` 通过。DO 草稿仍未接入线上类，且 Agent run 级延迟提交/失败回滚、旧文件导入和真实 DO 事务验证未完成。
- 自审发现先前关于文件容量的判断错误：请求校验允许最多 100 万字符，但旧 Node 实际写入还限制 **1 MiB UTF-8**。撤回一度引入的分块扩容草稿，保留原字节上限，并增加多字节文本边界测试，避免因误读合同扩大变更范围。
- 尝试把现有 Kernel `AgentRunModelInputBuilder` 直接载入本地 workerd 失败：`@nextclaw/core`/Kernel 根入口带入原生 `sharp`。把 `sharp` 改为动态 import 的临时实验仍失败，已撤回，工作区无该改动。架构设计据此收敛为真实的宿主无关公共入口；不能让 Bibo 复制压缩投影与模型输入逻辑。
- 为防长任务漂移，新增[可执行计划](../../plans/2026-09-29-bibo-edge-conversation.plan.md)并刷新[当前状态](../../work/2026-09-29-bibo-edge-conversation/current-state.md)。BE-01 至 BE-08 仍全部开放；源码切片未提交、未生产切换。

### 2026-09-29：完整边缘链路与发布前自审

- NextClaw Core 与 Kernel 将模型输入、压缩检查点、用户问答和工具 Schema 的稳定语义切出可移植公共入口。Bibo 的 Worker 使用同一 NCP Runtime 和 Kernel 模型输入/压缩实现；Node Harness 仍通过原入口消费，未把 Bibo 规则写入通用内核。Core/Kernel TypeScript、生产构建和相关 62 项定向测试通过；本地 workerd 的真实模型与工具轮次已通过。生产兼容仍待发布后验证。
- Bibo 用户 DO 增加边缘对话、边缘文件和会话存储；一次成功运行在同一事务提交 NCP 消息、UI 历史、个人空间和客户端请求回执。失败时不发布暂存的文件/消息；客户端刷新重试会用同一回执避免重复提交。新增/旧会话纯聊天路径不调用 `containerFetch`；容器启动次数与边缘成功运行次数经管理状态接口分别计数，待生产前后差值证明。
- 旧容器状态经只读导出、逐项校验、DO 分批写入及回读后才发布 `conversationMode=edge`。导出覆盖 NCP journal、结构化索引、文件正文、未索引 UTF-8 工作区文本、身份/记忆与 Agent 送达；不支持的二进制/链接条目明确失败并保持旧路径。反向导入与快照恢复已有定向测试。Cloudflare DO 每次多键操作上限为 128，已按 100 键分批在同一事务提交；260 条历史消息和 151 个工作区文本的迁移与删除测试通过。逐账号迁移工具会在私有报告中记录 127 个生产账号的状态与结果，尚未执行。
- 同一生产站点、相同模型和短无工具提问的控制样本共 40 次：38 次成功、2 次在首字之后提交失败；成功请求首字 p50 **3.686 秒**、p95 **6.633 秒**、p99 **7.661 秒**。新会话 19/21 成功、p95 7.661 秒；续聊 19/19 成功、p95 4.613 秒。数据文件 `/tmp/bibo-baseline-live-20260929*.json` 仅作本机审计，未存用户消息或凭据。样本不大，发布后须按相同脚本及冷热分组对照。
- Bibo 包三套 `tsc`、Core/Kernel `tsc`、Worker dry-run bundle、前端构建通过；Bibo 包完整测试 68 项通过、1 项 CSS 加载器在 Node/tsx 测试启动阶段失败，属于先前已存在的同一测试环境问题。改动覆盖的 Bibo 27 项定向测试全部通过。首次 diff-only 维护性检查有 7 个阻断项，按职责拆出会话路由、迁移和空间存储后复查为 **0 错误、7 警告**；大文件由 424 行缩至 417 行，警告仍需后续治理，不把它称为已解决。
- 公开 Cloudflare 2026-08 单价与 DeepSeek 2026-09 模型价格已经核对；尚缺生产边缘运行资源计数和对照结果，不在此时宣称降费达标。完整源码提交、主干合入、生产部署及迁移均未执行，BE-01 至 BE-08 仍保持开放。

### 2026-09-29：生产迁移、速度/成本对照与兼容性回归

- 从冻结的远程 `master` 完整构建并部署边缘会话实现，首次容器镜像发布耗时约 **309.72 秒**；后续只改 Worker/前端的 `deploy:client` 耗时约 **42–45 秒**，不再重建容器镜像。当前生产 Worker 版本为 `5bbee09c-6cd3-473a-b287-b31593e0165b`，对应源码 `a41574b8f`；后续主干 `4edc7b6a5` 只修过时测试，不影响生产代码。
- 生产 127 个账号全部盘点，4 个含旧状态的账号经只读导出、导入和回读校验后切换，复扫为 **4 edge、0 legacy、0 failed**；旧 R2 快照保留。迁移恢复路径的定向测试通过，未为测试回滚而再次改写真实用户权威状态。私有报告只保留在本机权限受限目录，不在文档记录用户 ID/内容。
- 最终生产全链路冒烟通过真实模型流、搜索、文件精确正文、自动预览 `show_file`、异步提问、桌面/手机刷新。自动预览曾因 Worker 打包后同 ID 事件键对象按引用比较而不发事件，已改为稳定 key ID 匹配，重新部署后独立展示冒烟 4.325 秒通过。偶发 `save-edge` 错误已有安全分类日志，后续样本未复现，但尚不能判定根除。
- 同账号、同模型、同短无工具问句的旧路径 **40 次中 38 次提交**，成功首字 p50/p95/p99 为 **3.686/6.633/7.661 秒**；新路径 **80/80 提交**，为 **1.418/3.540/8.525 秒**。整体 p95 下降 **46.6%**，未达到 BE-02 预定的 50%；新会话 p95 从 7.661 降至 3.540 秒，续聊从 4.613 降至 3.453 秒。两组处于不同时间段、样本数不同，不是随机并行 A/B。服务端 DO 接受请求至首次模型调用的 p95 从 **3.084 秒**降至 **1 毫秒**；剩余尾部主要在模型/网络段。
- 80 次边缘纯聊天使成功计数 **17→97**、容器启动计数 **1→1**，模型调用累计增加 80。82 条无工具生产日志的运行墙钟合计 **98.73 秒**，约 **120 秒/百条**；不是实测 CPU 或 Cloudflare 账单。[架构成本表](../../designs/2026-09-28-bibo-personal-space-persistence-and-latency.design.md#粗略成本边界非报价)按千名月活、每人每月 300/900/1800 条同负载补齐 A/B/E 平台费用，模型与搜索另列，并明确容器池情景范围与共享包含额度。
- NextClaw 当前源码在独立 Node 宿主完成真实 NCP `native` + DeepSeek 聊天，服务重启后同会话正确回忆标记；测试实例随后停止。Core/Kernel/NCP runtime/NextClaw CLI TypeScript 检查通过，Kernel **710/710**、Core 定向 **22/22** 通过。Bibo 包完整 **87/87** 通过；Node/tsx 默认不认识 CSS 导入，测试时使用 `/tmp` 的仅忽略 `.css` 的临时 loader，产品源码未为此改动。隔离实例的 `codex-sub/gpt-6-luna` 曾在 120 秒超时，此 provider 未由这次真实宿主冒烟证明。
- 闲置超过一小时的旧会话已找到，但压测账号触发产品每小时 100 条限额；此次返回的是限额消息而非假 `RUN_BUSY`。待滚动窗口释放后发消息验证上下文与容器计数，不以限额响应冒充旧会话通过。

## 迭代完成说明

进行中。边缘架构已上线，全部可迁移旧账号已切换；假忙根因和服务端模型前耗时已定位并处理。整体 p95 改进仍比验收线少约 3.4 个百分点，旧会话实例与包发布仍需闭合。

## 测试/验证/验收方式

进行中。生产 40 次旧路径与 80 次新路径的无工具样本、完整 Bibo 冒烟、迁移复扫、NextClaw 独立 Node 实例和自动化回归均已记录；旧闲置会话与总体 p95 门槛尚未通过，生产回滚未触发。

## 发布/部署方式

用户已授权。整体架构已从远程主干部署并复验，容器完整发布约 310 秒，后续 Worker/前端发布约 42–45 秒。适用的 NextClaw 稳定包/runtime 仍待发布；发布细分耗时待用可获得的日志补齐。

## 用户/产品视角的验收步骤

已在线上验证新会话秒级首字、对话文件与刷新续聊；仍需对一小时前的旧会话发消息并核对没有假忙/容器启动。NextClaw 当前源码的旧会话重启恢复通过，已发布包的真实升级尚未验收。延时与费用对照见本记录和设计表。

## 可维护性总结汇总

边缘实现只从 NextClaw 公共运行/输入/上下文合同抽真实宿主边界；旧 Node 路径保留并由完整 Kernel 回归覆盖。源码已做 diff-only 维护性检查并清零错误，保留已记录的大文件/目录预算警告；文件组织 preflight 已运行。最终文档和发布范围仍待 Review。

## NPM 包发布记录

适用：Core/Kernel 的公共可移植能力和 NextClaw 依赖闭包发生兼容新增，须按稳定产品包流程发布并做已安装版本升级验证。当前尚未 dispatch；版本、Actions 运行、manifest 与真实安装结果待记录。
