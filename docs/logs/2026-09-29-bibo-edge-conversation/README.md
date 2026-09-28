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

## 迭代完成说明

进行中。旧会话假忙局部修复已经上线；新架构和迁移尚未完成。根因阶段性定位为每条消息必经用户容器/完整 Harness 初始化，旧会话假忙来自 `/space` 读锁与 `/run` 冲突。完整延迟占比和性能分位数未定位，后续按真实链路分段测量。

## 测试/验证/验收方式

进行中。局部修复的生产模型、搜索、文件、桌面和手机链路冒烟通过；生产分位数、升级回归、迁移和回滚演练仍待记录，不能用单样本替代。

## 发布/部署方式

用户已授权。局部假忙止血已从冻结的远程主干部署；整体架构仍须在迁移和灰度合同通过后发布并复验，记录构建/上传/切换/冒烟耗时。

## 用户/产品视角的验收步骤

待线上验证：新旧会话秒级首字、无假忙；对话中使用文件，刷新续聊；NextClaw 旧用户升级后原有能力可用；查看同负载延时和单用户费用对照。

## 可维护性总结汇总

进行中，尚未修改架构源码。目标为复用单一 NextClaw 对话语义并仅抽真实宿主边界；旧假忙补丁曾有维护性 finding，需返工审查。文件组织 planned-path preflight 已运行，源码 diff-only 检查和主观 Review 待实施后执行。

## NPM 包发布记录

待判定。若改动已发布的 NextClaw 包且需要旧用户获得能力与兼容修复，按稳定包发布合同处理；当前无本批包发布结果。
