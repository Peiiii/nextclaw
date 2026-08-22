## NextClaw AI 常驻内核

> `CLAUDE.md` 是指向本文件的软链接。永远只修改 `AGENTS.md`，禁止维护平行副本。

本文件只保留每轮都必须知道的规则。场景流程归 `.agents/skills`，长合同归 skill 的条件 references，确定性规则归脚本；不要把专项细节复制回常驻上下文。

## 产品愿景

- 开始产品、架构、交互、命名、文档或实现决策前，先对齐 [NextClaw 产品愿景](docs/VISION.md)。
- NextClaw 的长期目标是成为 AI 时代的个人操作层：用户使用软件、互联网、系统、服务与云计算的默认入口。
- `NCP` 是基础设施底座，`NextClaw` 是产品化操作层；优先增强统一入口、意图到执行、自感知连续性、自治、自进化和生态扩展，不堆孤立功能。

## 沟通与推进

- 所有用户可见回复以 `[我严格遵守规则]` 开头并使用中文。
- 主动推理用户深层意图，给出明确判断、关键取舍、依据原则和最小可执行下一步。
- 用户纠偏、补充上下文或修正判断时，视为当前任务的新约束并继续推进；除非用户明确暂停、只讨论或等待，不得把纠偏当成收尾信号。
- 架构、链路、事件流、状态归属和根因结论必须有端到端证据；只有局部证据时明确标注阶段性判断。
- 用户常用语音输入；“绘画”等疑似错词在 chat/session 上下文中优先理解为“会话”，歧义会改变结果时再澄清。
- 用户说“记住”“以后都要”“这是规范/原则”时，必须判断并持久化到正确规则 owner；不落盘时说明原因。
- 思考产品和实现时同时考虑用户价值、技术结构和交付路径。

## 深思与目标模式

- 复杂架构、规则机制、高风险取舍或连续纠偏自动进入深思模式；回复前缀变为 `[我严格遵守规则][深思模式]`，完成复杂判断后退出。
- 用户明确启动目标模式时使用 `goal-mode`，回复前缀再追加 `[目标模式][锚点 n/20]`，持续到完成、真实阻塞或用户退出。

## 协作与 Git 安全

- 未经用户明确要求，不得 commit、push、建 PR、发布、部署或执行破坏性 Git 操作。
- 未经用户明确要求，或未提前说明影响并获得同意，不得重启 NextClaw 宿主、服务、桌面应用或当前运行实例；优先热更新、刷新或隔离验证。
- 工作区可能有用户或其它任务的改动；不得覆盖、revert、格式化或混入无关改动。触达已修改文件前先读懂现状并做双向范围审计。
- 默认主工作区必须常驻本地 `master`；隔离开发或发布不得把它切到保护、功能或 release 分支。发布回流只能在该工作区保持 `master` 的前提下安全 fast-forward；无法 fast-forward 时停止并保留隔离分支。
- 用户要求提交时，由 `development-delivery` 编排，先使用 `nextclaw-release-notes` 和 `nextclaw-iteration-log-governance` 判断 changeset、迭代记录和 NPM 记录，再精确 stage/commit。
- 面向 `master` 的交付默认先进入本地 `master`，再由本地 `master` 推送 `origin/master`；例外必须说明回流方案。
- 成功执行提交、推送、建分支或 PR 后，最终回复输出 Codex app 对应 directive。
- 涉及用户私有远程主机、VPS、部署或线上诊断时，若 `.local/remote-environments.private.md` 存在，先只读加载匹配条目；凭据只用于用户授权任务中的交互式认证，不得回显、提交或复制到其它文件、回复、日志和外部系统，验证到事实变化时才原地更新。
- 搜索优先 `rg` / `rg --files`；手工编辑默认使用 `apply_patch`。

## Skill 渐进式加载

- Skill 的目标是渐进加载，不是组成默认全家桶。普通源码、脚本、测试或运行链路任务开始时只加载 `development-lifecycle`；它按 Task Understanding、Design、Implementation、Validation、Review、Delivery、Retrospective 顺序只路由当前阶段 owner，不预读未来阶段。
- 用户明确只要求任务理解/代码调查、方案设计、验证、code review、交付发布或复盘时，可直接加载对应的 `development-task-understanding`、`development-design`、`development-validation`、`development-review`、`development-delivery`、`development-retrospective`；修改规则系统时加载 `nextclaw-agent-instructions-governance`。
- 其它专项 skill 只按明确意图或真实触达面加载。不要因为未来阶段“可能会用”而预读，也不要因一个任务同时符合多个泛词就加载多个相邻原则 skill。
- 同一逻辑任务内已经完整读取且未变化的 skill 不重复读取；skill 的 references 只在入口写明的条件成立时读取，禁止批量读取整个 references 目录。
- Lifecycle 只向当前阶段路由；阶段 owner 不得直接调用其它阶段或回链 lifecycle，专项 skill 不得回链上游。一个判断分支最多要求一个直接下游；多个 skill 看似同时适用时，选择拥有当前决策的单一 owner。
- 新增或重写 skill 时，先查职责重叠；能删除、合并或改为 reference 时不新增独立入口。项目内 skill 和设计文档默认使用中文。

## 开发与实现边界

- 默认开发流程由 `development-lifecycle` 单独编排；七个 `development-*` 阶段 owner 分别拥有本阶段的进入、决策、产物、证据和退出合同。不要在本文件复制阶段清单。
- 实现优先单一路径、清晰 owner、删除或复用旧实现；必要且清晰的最小增长允许存在，禁止为抵消行数扩大无关范围或损害可读性、类型和协议安全。
- 同一事实、事件、状态变化或传输语义只保留一个 owner 和一条标准主链路；新增 wrapper、adapter、factory、service、manager 前必须证明它减少真实复杂度或隔离真实变化点。
- NextClaw 产品语义默认归 kernel owner；service 只承载宿主、进程、升级、远程访问、CLI/daemon 外壳和环境适配，触达产品语义时调用 kernel。
- “平台 SDK 化”是长期伴随式技术目标：触达可复用的 agent、session、runtime、tool、skill、provider 等核心能力时，优先把稳定语义沉淀为 NCP / kernel 公共 contract，并让 NextClaw 自身通过同一入口消费；不为追求导出数量暴露未稳定内部实现，也不为无关产品改动强加 SDK 工作。阶段路线与验收归 `docs/ROADMAP.md`。
- 业务层传递 owner 或本次调用的数据快照，不把稳定 owner 拆成多层参数、proxy 或同名转发方法。
- 跨 workspace package 只导入 package 根公共入口；禁止消费者用 `exports` 子路径、tsconfig/Vitest/Vite alias 绕过包边界。
- 前端业务状态和编排归 manager/store/presenter；组件与 hook 主要连接和展示。用户文案走 i18n，React 组件类型保持模块级稳定，effect 只同步外部系统。
- Chat 链路默认只建设 NCP 主链路；legacy 只做迁移阻塞修复、删除前清理或用户明确要求的临时保障。
- 触达 NextClaw 自管理命令语义时，同步维护 `docs/USAGE.md`、`packages/nextclaw/resources/USAGE.md` 和 `nextclaw-self-manage` skill，并说明资源同步结果。
- 新增、重命名、移动文件或改变角色/目录边界时使用 `file-organization-governance` 并在首次实质编辑前运行 planned-path preflight；局部修改现有文件不为仪式重复加载目录规则。

## 验证硬边界

- 验证由 `development-validation` 按风险选择；迭代中用最快定向证据，稳定后统一收尾，同一风险不堆重复测试、冒烟和截图。
- 触达 TypeScript、类型声明、导入导出或运行链路时必须运行匹配范围的 `tsc`；测试和 lint 不能替代。
- 修复异常必须先定义可观察判定条件，再优先沿真实复现或最近链路复验。纯视觉审美由 AI 证明正常渲染，用户确认偏好；交互、状态、数据、协议和持久化正确性由 AI 验证。
- 源码类改动完成验证后进入 `development-review`：先运行一次 diff-only maintainability 自动检查，再按 findings、结构风险或用户要求决定主观复核；完整 package lint、治理 ratchet、真实冒烟和发布验证只在风险触发时追加。
- 对用户说“验证通过”只覆盖实际证明的范围；未验证功能和需要用户主观确认的部分必须披露。

## 知识、留痕与发布

- 想法、设计、计划、PRD、路线图和迭代记录使用 `project-knowledge-governance` 分流；设计、计划默认使用带日期和角色后缀的中文文档。
- `docs/logs` 只记录有独立交付意义的提交/发布、跨模块长链路、重要根因、红区或大型治理批次；同批微调更新最近相关迭代，不拆细碎目录。
- 新增或改变用户可见功能时，必须同步更新文档站中面向用户的说明；设计、内部文档、迭代记录和 changeset 都不能替代。仅影响内部实现且没有用户可用路径时，明确记录不适用依据。
- 用户可见产品变化才添加 changeset；纯内部规则、测试、治理和文档不进入用户 changelog。
- 发布必须闭合适用的 migration、deploy、smoke、文档、NPM/runtime/desktop 合同；不适用项说明理由。
- 用户明确要求稳定 NPM 发布或完整发布时，视为授权合同内的提交、tag、GitHub Release、文档和 update channel 闭环；用户限定只发某部分时遵守限定。

## 规则系统维护

- `AGENTS.md` 只放每轮必须知道的高优先级约束；场景流程进 skill，条件细节进 references，确定性检查进 scripts，普通背景进 docs。
- 修改 AGENTS、commands、Rulebook、skill 分层或治理脚本时使用 `nextclaw-agent-instructions-governance`，同步检查文本 owner、命令、脚本和 baseline 是否一致。
- 新增治理脚本前证明问题通用、反复且高影响；禁止为一次性坏味道创建窄检查。
- 规则变更的目标是减少常驻 token、提高触发可靠性和消除重复 owner。高层硬约束与 skill 冲突时，以本文件为准并同步修正 skill。
- 项目元命令统一维护在 `commands/commands.md`；用户使用 `/validate`、`/commit`、`/release-*` 等命令时读取对应条目和 owning skill，不在本文件复制完整命令索引。
