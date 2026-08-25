# Development Skill 生命周期重构

## 迭代完成说明

本轮把项目核心开发 skill 从多个命名不一致的平级入口重构为一条标准生命周期：`development-lifecycle` 是唯一默认流程 owner，Discovery、Design、Implementation、Validation、Review、Delivery、Retrospective 分别由七个统一命名的阶段 owner 承担。

前一轮渐进加载治理已经解决默认全家桶、入口膨胀和依赖循环，但调查、设计、验证、code review、guard 与发布流程仍需要使用者自行还原为开发过程，Implementation、Delivery、Retrospective 也缺少对称 owner。本轮在不回退渐进加载成果的前提下，把生命周期升级为一级信息架构。

主要结果：

- 建立一个生命周期 owner 和七个阶段 owner，统一进入、输入、输出、返工和越权边界；
- Validation 只证明行为和合同，Review 统一承担 findings-first 与 diff-only maintainability 自动检查；
- Delivery 统一结果交接和授权边界，NPM/runtime、Desktop 等发布合同继续由 NextClaw 专项 owner 承担；
- Retrospective 默认轻量执行，只有重复、可复用或高影响经验才进入知识、迭代、规则、测试或 script owner；
- 通用阶段使用 `development-*`，只有依赖 NextClaw 产品、NCP、Kernel、仓库命令或发布合同的能力使用 `nextclaw-`；
- AGENTS、commands、package script 和活动 skill 引用全部切换到新名称；历史设计与迭代记录保留原名作为事实记录；
- skill 渐进加载检查新增生命周期拓扑、阶段越权、目录/frontmatter 一致和精确退役名称验证。

Review 期间发现少数专项 skill 仍自行编排 validation/guard/交付，已统一改为“完成当前领域 slice 后返回生命周期”，避免专项入口重新获得阶段切换权。

同批次后续探索进一步校准了第一阶段的语义：原 `development-discovery` 更名为 `development-task-understanding`，明确它只理解已经进入任务上下文的用户输入并调查现状，不承担主动发现新需求。另新增两个暂不接入生命周期、禁止隐式触发的探索入口：`autonomous-requirement-discovery` 用于从愿景、产品现状和用户信号形成可验证需求假设，`iterative-quality-convergence` 用于观察真实产物并围绕最大质量差距持续改进。两者先独立验证，不提前冻结融合方案。

同批次继续增加了一个可空的 lifecycle observer 插槽，以及按需加载的 `development-task-telemetry` Skill。它用可见的 `nextclaw.dev/v1` 英文 marker 声明 task / phase 边界，确定性脚本再从 Codex rollout 的累计 usage 快照计算任务级、阶段级 Token、模型、effort、工具轮次和时间。禁用只需清空 observer；Skill 仍可被用户显式调用做历史报告，也不改变 lifecycle 的阶段判断和完成门。后续补齐 AI 查询 owner：用户只需在对话中要求查看，AI 自己定位并运行报告；显式要求收尾汇报时由根 AI 聚合一次，默认和子 Agent 均不额外刷屏。一级索引实测只增加 183 个 description 字符，正文保持条件加载，因此没有为了节省很小的常驻索引牺牲独立发现与管理。

同批次收尾补齐了独立于 NextClaw 产品的本地开发任务大盘：根目录命令启动只绑定 `127.0.0.1` 的只读服务，按当前 Git workspace、协议启用日期和增量缓存筛选 Codex rollout，并展示任务、阶段、模型、Token、耗时和数据质量。任务协议新增可读的 `name` 字段，大盘与文本报告均以名称为主、稳定 ID 为辅；历史 marker 保持兼容并明确显示为未命名，不从聊天正文猜测标题。

2026-08-25 同批补充任务类型：lifecycle 在 Task Understanding 冻结 `feature`、`bugfix` 或 `small-change`，telemetry 只记录既有判断；文本报告与本地大盘展示类型，历史 marker 保持未知且不通过名称反推。Design 门同步收敛：功能必须进入 Design；Bug 在根因、修复路径和验证判定明确且满足其余低风险条件时可以跳过；琐碎改动也只有满足完整低风险门才可直接实现。Bug 修复另增加可选复现门：不确定时先做最小充分复现，证据已锁定根因与修后判定时可以显式跳过；时间、环境和 Token 成本只影响复现层级，不能单独降低证明门槛。

设计依据：[`docs/designs/2026-08-14-development-skill-lifecycle.design.md`](../../designs/2026-08-14-development-skill-lifecycle.design.md)。

任务遥测设计依据：[`docs/designs/2026-08-14-development-task-phase-tracing.design.md`](../../designs/2026-08-14-development-task-phase-tracing.design.md)。

## 测试/验证/验收方式

- `node --test scripts/governance/checks/skill-progressive-loading.test.mjs`：7 个测试通过，覆盖最小目录、循环/断链、重复/退役名称、reference frontmatter、精确名称匹配、标准 1+7 拓扑和阶段越权。
- `node --test .agents/skills/development-review/scripts/maintainability-guard-*.test.mjs`：13 个测试通过，证明 Review 自动检查移动后行为保持有效。
- `pnpm check:skill-progressive-loading`：34 个入口、128659 字节入口正文、3936 字符 description、9178 字节 AGENTS、32 条依赖边，结果通过且无循环。
- `pnpm exec eslint ...`：本轮触达的治理脚本、测试和 Review scripts 定向 ESLint 通过。
- `pnpm lint:new-code:governance -- <本轮范围>`：文件/目录命名、模块结构、公共导入、参数变异、上下文解构、owner 和其它新代码治理检查全部通过。
- `pnpm check:governance-backlog-ratchet`：通过，未扩大既有治理债务。
- `pnpm lint:new-code:doc-file-names -- docs/designs/2026-08-14-development-skill-lifecycle.design.md docs/logs/v0.33.6-development-skill-lifecycle/README.md`：文档命名检查通过。
- `bash -n` 与真实执行 `development-implementation/scripts/locate-node-pnpm.sh`：迁移后的 Node/pnpm 恢复入口有效。
- `git diff --check`：无空白错误。
- 同批次探索后续的三个 skill 分别通过 `quick_validate.py`；`pnpm check:skill-progressive-loading` 更新为 36 个入口、137305 字节入口正文、4190 字符 description、9202 字节 AGENTS、32 条依赖边，结果仍通过且无循环。
- 同批次探索后续再次运行 `skill-progressive-loading.test.mjs`，7 个测试通过；定向新代码治理与 backlog ratchet 均通过。
- `node --test .agents/skills/development-task-telemetry/scripts/report-task-phase-usage.test.mjs`：7 个测试通过，覆盖正常阶段归因、返工与幂等 phase、同线程连续任务、跨线程 child lane、冲突后失败关闭与恢复、日志片段/计数器重置，以及公开 CLI 路径。
- telemetry CLI 对真实 Codex rollout `01a00013-b70e-7ca0-976c-87ac852aeca1` 完成只读试算：识别 `46,009,846` 个已观测 Token；该历史任务没有 marker，因此正确输出 0 个 tracked task、0% coverage，没有通过自然语言猜测补标。
- `pnpm check:skill-progressive-loading`：Skill 数预算按本次独立、可显式调用的 telemetry owner 从 36 调整为 37；AI 查询合同补齐后为 37 个 Skill、142571 字节入口正文、4373 字符 description、9202 字节 AGENTS、33 条依赖边，结果通过且 lifecycle 只单向引用 telemetry，不形成依赖环。
- AI 行为前后复核：旧规则会让用户手动执行 CLI；新规则下 AI 自己按 task marker 或 thread/session ID 定位并运行报告，只有用户显式要求时才由根 AI 做一次收尾汇总。
- `node --test .agents/skills/development-task-telemetry/scripts/report-task-phase-usage.test.mjs .agents/skills/development-task-telemetry/scripts/serve-task-telemetry-dashboard.test.mjs`：10 个测试通过，新增覆盖任务名称、历史 marker 兼容、CLI 名称输出、workspace/日期过滤、HTTP 报告和缓存复用。
- 真实运行 `pnpm development-task-telemetry:dashboard -- --no-open --port 4785`：同一 URL 冷启动成功；大盘在真实 Codex sessions 中匹配当前项目日志并正常刷新。浏览器验收确认名称为主信息、ID 为次级信息、旧任务回退可见、无错误态和横向溢出。
- `pnpm lint:new-code:governance`、`pnpm check:skill-progressive-loading`、`pnpm check:governance-backlog-ratchet` 和定向 ESLint 全部通过；当前为 37 个 Skill、144775 字节入口正文、4392 字符 description、9202 字节 AGENTS、33 条依赖边。
- 任务类型补充后，`node --test .agents/skills/development-task-telemetry/scripts/report-task-phase-usage.test.mjs .agents/skills/development-task-telemetry/scripts/serve-task-telemetry-dashboard.test.mjs` 的 11 个测试通过，覆盖三类合法类型、历史缺失类型、reopen 类型冲突、非法类型失败关闭，以及大盘类型列和中文映射；相关脚本定向 ESLint 与 `git diff --check` 通过。
- `pnpm check:skill-progressive-loading` 再次通过：37 个 Skill、158929 字节入口正文、4392 字符 description、10979 字节 AGENTS、35 条依赖边；`pnpm check:governance-backlog-ratchet` 通过，未扩大治理债务。

本轮没有触达 TypeScript、产品运行链路或 UI 行为，因此 tsc、产品测试和真实产品冒烟不适用。

## 发布/部署方式

不涉及产品发布或部署。本轮不添加 changeset；原始重构与同批次探索后续分别通过本地提交闭合，不执行 push、PR、NPM/runtime/Desktop release，也不重启任何 NextClaw 实例。

## 用户/产品视角的验收步骤

1. 查看 `.agents/skills/development-*`，确认存在 lifecycle 与七个阶段 owner，且名称和阶段职责一致。
2. 查看 `AGENTS.md`，确认普通开发只进入 lifecycle，明确阶段请求可直接进入对应阶段 owner。
3. 查看 `commands/commands.md`，确认 `/close-task`、`/validate`、`/maintainability-review`、`/commit` 和 `/release-*` 已路由到新 owner。
4. 运行 `pnpm check:skill-progressive-loading`，确认 1+7 核心完整、阶段无互相路由、旧名称无活动引用且依赖无环。
5. 检查 NPM、Desktop、runtime integration、产品博客和产品视觉素材 skill，确认深耦合能力使用 `nextclaw-` 前缀。
6. 检查 `autonomous-requirement-discovery` 与 `iterative-quality-convergence`，确认两者保持独立探索入口且 `allow_implicit_invocation: false`，生命周期只把 `development-task-understanding` 作为第一阶段 owner。
7. 检查 lifecycle 的 observer 路径和 telemetry Skill，确认清空 observer 即可停用；直接向 AI 询问任务统计，确认 AI 自己定位和运行报告；运行报告脚本的 `--help`，确认支持显式 rollout、跨线程日志发现、task 筛选以及 text/json 输出。
8. 向 AI 说“打开开发任务统计大盘”，确认 AI 启动并返回本地链接；新任务在列表和详情中显示可读名称与次级 ID，旧任务显示“未命名任务”，刷新不会重新全量解析未变化日志。
9. 启动一个新的功能、Bug 修复或琐碎改动，确认首个 `task=start` marker 包含对应 `type`，文本报告与大盘列表显示“功能 / Bug 修复 / 琐碎改动”；读取历史任务时显示“历史未知”。
10. 对一个根因不确定的 Bug 确认 Task Understanding 选择最小充分复现，并在 Validation 沿同一入口复验；对根因和修后判定均有直接证据的明显 Bug，确认可以记录依据后跳过修前复现。

## 可维护性总结汇总

本轮通过职责收敛减少平级流程 owner：Review 自动脚本没有复制，原 guard 目录整体迁入 Review；Discovery、Design、Implementation 和 Validation 的 references/scripts 以移动为主，未把旧入口原样复制成第二套合同。

自动 maintainability 检查覆盖 14 个脚本文件，结果为 0 error、2 warning：`maintainability-guard-support.mjs` 415/500 行，`skill-progressive-loading.mjs` 416/500 行。前者仍是 Review 自动检查的单一 support owner，后者新增的生命周期拓扑检查与原渐进加载审计属于同一事实域；当前拆分会增加名字和跳转，未形成阻塞 finding。守卫报告的大量净增长来自 Git 尚未暂存时目录移动被视为删除加未跟踪新增，不代表复制了第二份实现。

完整新代码治理首次复验发现迁移后的既有脚本存在参数变异和重复上下文读取，已分别改为返回值式聚合和局部解构；同一入口复验后全部通过。主观 Review 最终为 `no findings`。

目录和文件 planned-path preflight 已在首次编辑前执行；新增设计和迭代路径也分别补充预检。工作区原有 `packages/nextclaw/ui-dist` 生成物变动未触碰、未恢复、未纳入本轮范围。

同批次探索后续没有增加 scripts、references 或 assets，只新增两个用户明确要求的独立 skill 与标准 UI 元信息；职责分别是需求发现与质量收敛，不复制任务理解、Validation 或 Review。自动 maintainability 检查仅提示 `skill-progressive-loading.mjs` 从 416 增至 417 行、接近 500 行预算；新增一行只用于阻止退役名称回流，当前拆分没有收益。条件主观复核结论为无可维护性发现。

telemetry 首版的自动 maintainability 检查先发现单文件 885 行、超过 500 行预算，已按协议解析、Codex rollout adapter、任务聚合和薄 CLI 四个真实 owner 拆分；复验为 0 error。任务聚合文件 452/500 行仍收到接近预算 warning，但其内容是同一个 task/thread 状态机，继续拆分会引入状态搬运和第二 owner，因此本批不再为行数继续拆。其它 warning 来自工作区中未纳入本提交的并发改动。新增 Skill 只把数量预算从 36 精确增加到 37，没有扩大 description 或 AGENTS 常驻索引，也没有向 `AGENTS.md` 添加常驻协议；AI 查询合同只增加在命中 telemetry 后才加载的正文。

大盘后续的 maintainability 检查为 0 error、2 warning：单页渲染脚本 393/400 行，任务聚合器 466/500 行。前者保持一个无框架页面的渲染与刷新 owner，拆成多个模块只会增加文件和跳转；后者本次只增加名称字段与解析后聚合主链。Review 删除了低价值的名称冲突专用 warning 分支，以首个名称为稳定 owner，避免为罕见 reopen 误用扩大状态机。最终主观复核为无 findings。

任务类型补充的 maintainability 检查仍为 0 error、2 warning：单页渲染脚本 399/400 行，任务聚合器 476/500 行。本次增长分别属于既有 UI 映射/列表投影和既有 task 状态机的类型不变量；没有新增 service、adapter、文件或第二事实源，继续拆分反而会产生状态搬运与额外跳转。主观复核关闭了“所有 Bug 强制进入 Design”的流程偏差，并补齐大盘可见类型和非法协议值的回归证据，最终无 findings。

## NPM 包发布记录

不涉及 NPM 包发布。
