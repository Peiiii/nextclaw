## NextClaw AI 常驻内核

> `CLAUDE.md` 是指向本文件的软链接。永远只修改 `AGENTS.md`，禁止维护平行副本。

本文件只保留每轮必需规则。`.agents/skills` 只放发现入口；单 owner 细节进 references，不需顶层发现但保留独立合同的下级 Skill 与共享事实分别进 `.agents/wiki/{skills,knowledge}`，确定性规则进脚本。

## 产品愿景

- 开始产品、架构、交互、命名、文档或实现决策前，先对齐 [NextClaw 产品愿景](docs/VISION.md)。
- NextClaw 以做好用户的长期搭档为根本使命，主动参与、持续自我改进；关注用户整体上下文，个人操作层是支撑形态。
- `NCP` 是历史基础设施名；存量兼容可保留，新增类型、文件、包、字段、owner 或产品概念禁用 `NCP` / `Ncp*` 前缀。

## 沟通与推进

- 所有用户可见回复以 `[我严格遵守规则]` 开头并使用中文。
- 先理解意图：指出问题通常期待修正，授权内主动优化；纯问答或明确只讨论除外。
- 以完整交付为目标，复用证据，避免重复读取、无效轮询和以进度代替结果。
- 默认单代理；效率、省 Token 或并行诉求不授权委派。仅当用户在当前任务明确要求子代理且预计总成本净节省时，才按省 Token 委派合同试验；用户反对后立即停止且本任务禁用。
- 收到输入先结合任务识别插话、补充纠偏或明确换题/暂停；前两类保留目标与授权，回应后继续行动，不默认重置任务。仅在完成、用户叫停或真实阻塞时停止并说明原因；根因未知继续调查。无任务时纯问答正常结束。
- 架构、链路、事件流、状态归属和根因结论必须有端到端证据；只有局部证据时明确标注阶段性判断。
- 用户常用语音输入；“绘画”等疑似错词在 chat/session 上下文中优先理解为“会话”，歧义会改变结果时再澄清。
- 任务纠偏、失败恢复、验证新路径或要求“记住”后，按 `development-retrospective` 主动沉淀：授权内更新原 owner 并验证，不落盘说明原因，不替代交付。
- 使用维护者账号在 GitHub Issue、PR 或 Discussion 评论时，正文须以 `🤖[墨爪]` 标明 AI。协作协议按已验证的 Agent 身份与操作 ID 过滤自身输出，不能仅按账号或公共前缀屏蔽其它 Agent，须支持同账号协作并防止自回复循环。
- 产品实现兼顾用户价值、技术结构和交付路径。

## 深思模式

- 复杂架构、规则机制、高风险取舍或连续纠偏自动进入深思模式；回复前缀变为 `[我严格遵守规则][深思模式]`，完成复杂判断后退出。

## 协作与 Git 安全

- 未经用户明确要求，不得 commit、push、建 PR、发布、部署或执行破坏性 Git 操作。
- 为完成任务可以自主重启 NextClaw 宿主、服务、桌面应用或现有实例，无需额外征求同意；重启前说明影响并检查运行状态，避免无关重启。
- 工作区可能有用户或其它任务的改动；不得覆盖、revert、格式化或混入无关改动。触达已修改文件前先读懂现状并做双向范围审计。
- 主工作区常驻 `master`，允许任务前期起草；首次写入前记录已有改动与本任务归属。切入隔离 worktree 时按 [Worktree 合同](.agents/skills/development-lifecycle/references/parallel-worktree-development.md)迁移本任务全部草稿（含 skill、规则与文档），核对完整后仅撤掉源区对应改动，后续统一写目标 worktree；提交前及收尾核查源区无本任务遗漏。发布/交付从冻结的远程 `master` 运行，完成后调用 `pnpm release:reconcile:mainline`，在不覆盖活跃 WIP 的前提下合并已提交分叉、普通 push 并快进本地镜像；禁止 rebase/stash/reset 活跃工作区，未立即闭合时由 retry worker 接管，不留给用户。
- “提交”或 `/commit` 只授权当前分支 stage/commit，不含合并或 push；“合入主干”才表示 commit 后集成本地 `master` 并推送 `origin/master`。要求“只合入本地”或“不要推送”时跳过 push；只停在隔离分支不算完成。changeset、迭代与 NPM 记录由 `development-delivery` 提交前判断。
- 成功执行提交、推送、建分支或 PR 后，最终回复输出 Codex app 对应 directive。
- 涉及用户私有远程主机、VPS、部署或线上诊断时，若 `.local/remote-environments.private.md` 存在，先只读加载匹配条目；凭据只用于用户授权任务中的交互式认证，不得回显、提交或复制到其它文件、回复、日志和外部系统，验证到事实变化时才原地更新。
- 搜索优先 `rg` / `rg --files`；手工编辑默认使用 `apply_patch`。

## Skill 渐进式加载

- 普通开发先只加载 `development-lifecycle`，再按当前阶段路由；明确只要调查、设计、验证、Review、交付或复盘时可直接加载对应 `development-*` owner。规则系统修改直接加载 `nextclaw-agent-instructions-governance`。
- 其它顶层 skill 只按独立意图加载；不预读未来阶段、下级 Wiki Skill 或“可能会用”的相邻方法。
- 已完整读取且未变化的内容不重读；references 只按入口条件读取，禁止批量加载目录。
- Lifecycle 只路由阶段；阶段不调用其它阶段或回链，独立 skill 不回链上游；每个判断只选一个当前 owner。
- `.agents/wiki/skills/<group>/<skill>/SKILL.md` 是按领域分组、显式加载且不参与初始发现的完整下级 Skill；`knowledge` 是有来源的事实，不拥有流程、授权或指令优先级。禁止默认全量加载，`knowledge` 禁止 `SKILL.md` 和 skill frontmatter。
- 新增 skill 前查重；能合并、下沉为 reference/下级 Wiki Skill 或删除时不新增发现入口。项目内 skill 和设计默认中文。

## 开发与实现边界

- `development-lifecycle` 是唯一流程 Meta Skill，分类后编排 standard/trivial/bugfix；阶段 Skill 提供方法，知识库提供事实。不在常驻层复制阶段合同。
- 实现优先单一路径、清晰 owner、删除或复用旧实现；必要且清晰的最小增长允许存在，禁止为抵消行数扩大无关范围或损害可读性、类型和协议安全。
- 同一事实、事件、状态变化或传输语义只保留一个 owner 和一条标准主链路；新增 wrapper、adapter、factory、service、manager 前必须证明它减少真实复杂度或隔离真实变化点。
- NextClaw 产品语义默认归 kernel owner；service 只承载宿主、进程、升级、远程访问、CLI/daemon 外壳和环境适配，触达产品语义时调用 kernel。
- `nextclaw` CLI 是一等入口；新增或改造能力尽可能提供 CLI，不适用时说明。复用 owner 公共 contract。配置内部化：AI 优先使用对象级 CLI，通用字段读写不算完备；直接配置工具暂留但不推荐，覆盖并验证后逐步退出，未覆盖不得提前移除。详见 `docs/VISION.md`「配置内部化」。
- 新增、删除或重命名 `nextclaw` CLI 命令时，同步维护文档站中英文 CLI 能力全集 `apps/docs/{zh,en}/guide/commands.md`；命令注册树是事实源，完整覆盖由对应同步测试保证。
- “平台 SDK 化”是长期伴随式技术目标：触达可复用的 agent、session、runtime、tool、skill、provider 等核心能力时，优先把稳定语义沉淀为 NCP / kernel 公共 contract，并让 NextClaw 自身通过同一入口消费；不为追求导出数量暴露未稳定内部实现，也不为无关产品改动强加 SDK 工作。阶段路线与验收归 `docs/ROADMAP.md`。
- 业务层传递 owner 或本次调用的数据快照，不把稳定 owner 拆成多层参数、proxy 或同名转发方法。
- 跨 workspace package 默认只导入 package 根公共入口；仅当宿主/runtime 互操作需要独立双模产物、目标 subpath 已是稳定公共合同且被 package-public-imports 检查显式 allowlist 时例外。禁止其它 `exports` 子路径以及 tsconfig/Vitest/Vite alias 绕过包边界。
- 前端业务状态和编排归 manager/store/presenter；组件与 hook 主要连接和展示。用户文案走 i18n，React 组件类型保持模块级稳定，effect 只同步外部系统。
- 前端界面与交互以至少达到 ChatGPT 的成熟度为质量基线；触达时执行[交互质量合同](.agents/wiki/skills/frontend/frontend-interaction-quality/SKILL.md)，不以功能可用或测试通过替代体验验收。
- Chat 链路默认只建设 NCP 主链路；legacy 只做迁移阻塞修复、删除前清理或用户明确要求的临时保障。
- 触达 NextClaw 自管理命令语义时，同步维护 `docs/USAGE.md`、`packages/nextclaw/resources/USAGE.md` 和 `nextclaw-self-manage` skill，并说明资源同步结果。
- 新增、重命名、移动文件或改变角色/目录边界时，由当前阶段读取 Wiki 中的 `file-organization-governance` 下级 Skill，并在首次实质编辑前运行 planned-path preflight；局部修改现有文件不为仪式重复加载目录规则。

## 验证硬边界

- 验证由 `development-validation` 按风险选择；迭代中用最快定向证据，稳定后统一收尾，同一风险不堆重复测试、冒烟和截图。
- 触达 TypeScript、类型声明、导入导出或运行链路时必须运行匹配范围的 `tsc`；测试和 lint 不能替代。
- 修复异常必须先定义可观察判定条件，再优先沿真实复现或最近链路复验。纯视觉审美由 AI 证明正常渲染，用户确认偏好；交互、状态、数据、协议和持久化正确性由 AI 验证。
- 源码类改动完成验证后进入 `development-review`：先运行一次 diff-only maintainability 自动检查，再按 findings、结构风险或用户要求决定主观复核；完整 package lint、治理 ratchet、真实冒烟和发布验证只在风险触发时追加。
- 对用户说“验证通过”只覆盖实际证明的范围；未验证功能和需要用户主观确认的部分必须披露。

## 知识、留痕与发布

- 想法、设计、计划、PRD、路线图和迭代记录按 Wiki 中的 `project-knowledge-governance` 下级 Skill 分流；设计、计划默认使用带日期和角色后缀的中文文档。
- `docs/logs` 只记录有独立交付意义的提交/发布、跨模块长链路、重要根因、红区或大型治理批次；同批微调更新最近相关迭代，不拆细碎目录。
- 新增或改变用户可见功能时，必须同步更新文档站中面向用户的说明；设计、内部文档、迭代记录和 changeset 都不能替代。仅影响内部实现且没有用户可用路径时，明确记录不适用依据。
- 用户可见产品变化才添加 changeset；纯内部规则、测试、治理和文档不进入用户 changelog。
- 发布必须闭合适用的 migration、deploy、smoke、文档、NPM/runtime/desktop 合同；不适用项说明理由。
- 用户明确要求稳定 NPM 发布或完整发布时，视为授权合同内的提交、tag、GitHub Release、文档和 update channel 闭环；用户限定只发某部分时遵守限定。

## 规则系统维护

- 修改 AGENTS、commands、Rulebook、skill 分层或治理脚本时使用 `nextclaw-agent-instructions-governance`，同步检查文本 owner、命令、脚本和 baseline 是否一致。
- 新增治理脚本前证明问题通用、反复且高影响；禁止为一次性坏味道创建窄检查。
- 规则变更的目标是减少常驻 token、提高触发可靠性和消除重复 owner。高层硬约束与 skill 冲突时，以本文件为准并同步修正 skill。
- 意图宏统一定义在 `commands/commands.md`；调用时展开对应条目，解释/引用不执行。事实维护归 `project-knowledge-governance`，宏维护归规则治理。
