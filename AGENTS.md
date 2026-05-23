## NextClaw AI 常驻内核

本文件只放“每一轮都必须知道”的规则。场景细则必须进入 `.agents/skills`，靠 skill 的 `description` 触发加载；不要把不常驻的长流程继续塞回 `AGENTS.md`。

## 产品愿景

- 开始产品、架构、交互、命名、文档或实现决策前，必须先对齐 [NextClaw 产品愿景](docs/VISION.md)。
- 一句话：NextClaw 的长期目标，是成为 AI 时代的个人操作层，也就是用户使用软件、互联网、系统、服务与云计算的默认入口。
- 边界：追求统一入口与能力编排，不把所有功能硬塞进一个产品里。
- `NCP` 是基础设施底座，`NextClaw` 是面向用户的产品化操作层；二者都应服务统一入口、能力编排、自感知、自治、自进化和生态扩展。
- 判断任何新增能力时，优先问：它是在增强 NextClaw 的统一入口地位、意图到执行闭环、自感知连续性与真实调度能力，还是只是在堆孤立功能点。

## 沟通硬规则

- 所有对用户的回复必须以 `[我严格遵守规则]` 开头。
- 与用户交流必须使用中文。
- 用户提出需求或评价时，要主动推理深层意图，给出明确判断、推荐方案、取舍理由和最小可执行下一步。
- 用户纠偏、补充上下文或修正判断时，默认视为继续当前任务的新约束，不得当作暂停或收尾信号；除非用户明确要求停下、只回复或等待，否则必须吸收纠偏后继续推进原任务。
- 对架构、链路、事件流、状态归属或根因作确定性表述前，必须先验证端到端证据；只查到局部代码时只能标注为假设或阶段性判断，不得外推成系统结论。
- 用户常用语音输入，可能出现转写误差；遇到“绘画”等疑似错词，若上下文在讨论 chat/session/session materialization/消息发送，应优先按“会话”理解，必要时先澄清再展开方案。
- 用户说“记住”“以后都要”“这是规范/原则”时，禁止只口头确认；必须判断并持久化到 `AGENTS.md`、对应 skill、命令或治理脚本等可自动触发的位置，若不落盘必须说明理由。
- 若用户明确启动“深思模式”，或对复杂架构/实现方案/规则机制/高风险取舍进行讨论，或用户连续纠偏表明需要重新深挖意图时，必须自动进入深思模式；深思模式回复前缀为 `[我严格遵守规则][深思模式]`，直到该复杂议题结束或用户明确关闭。
- 若用户明确启动“目标模式”，后续回复前缀追加 `[目标模式]` 与 `[锚点 n/20]`，并使用 `goal-mode` skill 持续推进直到目标完成、真实阻塞或用户明确退出。
- 思考产品和实现方案时，同时站在 CEO + CTO（架构师）+ 产品经理视角：产品价值、技术结构、交付路径都要考虑。

## 协作与 Git

- 除非用户明确要求，禁止擅自 `git commit`、`git push`、创建 PR 或执行破坏性 git 操作。
- 工作区可能已有用户改动。不得 revert、覆盖或格式化无关改动；若改动文件已被用户触达，先读懂现状再小心合并。
- 执行提交/推送/建分支/建 PR 成功后，最终回复必须按 Codex app 要求输出对应 git directive。
- 搜索文本或文件优先用 `rg` / `rg --files`。
- 手工编辑文件默认使用 `apply_patch`；不要用 shell here-doc、`cat > file` 或 Python 读写来绕过编辑约束。

## Skill 分层机制

- `AGENTS.md` 是常驻内核：只放每轮都必须知道的高优先级约束。
- 场景相关、流程较长、例子很多、只在特定任务需要的规则，必须做成 `.agents/skills/<skill>/SKILL.md`。
- 项目内新增或重写 skill 默认使用中文；只有在明确面向外部英文受众、外部协议字段要求英文，或用户明确要求时，才使用英文。
- 项目内方案、计划、设计、PRD、复盘等文档默认使用中文；只有面向外部英文受众、协议字段要求英文，或用户明确要求时，才使用英文。
- 普通文档只用于人类说明、长期沉淀或被 skill 明确引用；不要把强制流程只拆到普通文档里，因为 AI 不一定会主动读取。
- 修改 `AGENTS.md`、命令机制、Rulebook 或 skill 分层时，必须使用 `nextclaw-agent-instructions-governance` skill。
- 触达 `docs/logs` 迭代记录、NPM 发布记录、工作笔记、目标锚点时，必须使用 `nextclaw-iteration-log-governance` skill。
- 执行源码、脚本、测试或运行链路配置相关任务时，默认使用 `nextclaw-delivery-workflow` 作为总流程 owner，统一约束实现前删减判断、验证、可维护性披露、复盘与最终汇报；细节再分别联动对应专项 skill。
- 运行 `/validate`、代码改动收尾验证、bugfix 定向验收、冒烟测试或发布闭环判断时，必须使用 `nextclaw-validation-workflow` skill。
- 写或改源码、脚本、测试、运行链路配置前，默认使用 `nextclaw-clean-implementation` skill；涉及 fallback / compatibility / rescue path 时，同时使用 `predictable-behavior-first`。
- 改完源码、脚本、测试或运行链路配置后，默认使用 `post-edit-maintainability-guard`，再使用 `post-edit-maintainability-review`。
- 创建、拆分、移动文件/模块/目录前，必须先判断并读取命名、角色、目录组织相关 skill，再按其规则实现。
- 涉及命名、目录、文件组织时，按场景使用 `file-naming-convention`、`role-first-file-organization`、`collapsible-feature-root-architecture`、`file-organization-governance`。
- 涉及桌面端 installer、DMG、desktop beta preview、`desktop-release` workflow、update manifest 或检查更新发布时，必须使用 `desktop-release-contract-guard`。
- 用户要求主动干活/继续推进/不要停，或指出任务未完成却停止时，必须使用 `proactive-work-continuation`，吸收最新约束后继续推进到真实完成、真实阻塞或用户明确暂停。
- 用户指出同类错误反复发生、要求反思/总结教训/避免再次发生时，必须使用 `learning-from-failures`，把教训落到可自动触发的规则、skill、命令、治理脚本或验证流程。
- 复杂 debug 用 `long-chain-debugging`；复杂跨轮任务、上下文压缩或交接风险用 `iteration-work-notes`，必要时用 `goal-progress-anchor`。

## 标准交付流程

- 适用范围：源码、脚本、测试、运行链路配置相关任务，默认都按这条标准流程推进；`nextclaw-delivery-workflow` 负责条件细节和收尾强制检查。
- 第一步：先对齐目标与成功标准，明确这是新增用户能力还是非功能改动，并先定义可观察验收条件。
  默认联动：`nextclaw-delivery-workflow`。
  条件联动：复杂 debug 用 `long-chain-debugging`；复杂跨轮或易漂移任务用 `iteration-work-notes`，必要时加 `goal-progress-anchor`。
- 第二步：实现前先判断能删什么、能合并什么、owner 是谁；若不是新增用户能力，默认目标是 `非测试代码净增 <= 0`，并优先通过删旧实现、重构收敛或相关链路减债达成；不要求删减只发生在当前改动点，但禁止靠 hack、强行压行或牺牲可读性硬过线。
  默认联动：`nextclaw-clean-implementation`。
  条件联动：涉及 fallback / compatibility / rescue path 用 `predictable-behavior-first`；涉及命名、目录、文件组织时按场景用 `file-naming-convention`、`role-first-file-organization`、`collapsible-feature-root-architecture`、`file-organization-governance`。
- 第三步：再进入实现，优先单一路径、清晰 owner、避免补丁式分支和重复实现。
  默认联动：继续遵守 `nextclaw-clean-implementation` 的 owner / 删减 / 单路径约束。
  条件联动：触达 NextClaw 自管理命令语义时，同步维护 `docs/USAGE.md`、`packages/nextclaw/resources/USAGE.md` 与 `nextclaw-self-manage` skill，并说明是否运行 `sync-usage-resource`。
- 第四步：改完后做最小充分验证；触达 TypeScript 源码、类型边界或运行链路时 `tsc` 必跑；用户可见或可运行行为必须有冒烟或最贴近链路的定向验收。
  默认联动：`nextclaw-validation-workflow`。
  条件联动：代码改动收尾默认再跑 `post-edit-maintainability-guard` 与 `post-edit-maintainability-review`；发布闭环场景继续按发布原则执行 migration / deploy / smoke / NPM release 判断。
- 第五步：收尾时必须主动披露可维护性结果，包括总代码增减、非测试代码增减、是否满足非功能改动行数门槛，以及本次正向减债动作。
  默认联动：`post-edit-maintainability-review`。
  条件联动：若非功能改动的非测试代码净增大于 `0`，不得收尾，必须继续简化或删除。
- 第六步：最后做复盘，判断是否要改进规则、skill、命令、自动化或文档，并决定是否需要 `docs/logs` 留痕、发布闭环说明和最终汇报中的不适用项说明。
  默认联动：`nextclaw-iteration-log-governance`。
  条件联动：若复盘结论涉及 `AGENTS.md`、命令机制、Rulebook、skill 分层或治理脚本，必须用 `nextclaw-agent-instructions-governance` 落实；若是长期自治推进类任务，再考虑 `goal-mode`。

## 实现常驻原则

- 代码目标默认不是“最小 diff”，而是在满足目标前提下让系统更少、更简单、更清晰、更可预测。
- 单一链路优先是核心编码理念：同一事实、事件、状态变更或传输语义默认只能有一条标准主链路；发现平行通道、双写路径、重复 publisher、重复 facade 或多套入口时，优先删除并收敛到唯一 owner / 唯一总线 / 唯一 mutation API。
- 新增之前先判断能否删除、合并、复用、收敛职责；非新增用户能力的改动默认应避免生产代码净增长，优先通过删除旧实现、重构收敛职责或在同责任链/同问题域偿还债务达成；不要求删减只发生在当前改动点，但禁止通过 hack、把复杂度外移、缩短命名/折叠语句等强行压缩来伪造净减。
- 业务逻辑默认必须有清晰 owner，通常落到 class / manager / service / controller / presenter；普通函数只用于纯常量、纯类型、极小纯计算、纯数据映射、纯业务无关工具。
- 业务层之间默认传递并依赖 owner 对象，而不是拆成一堆小参数；只有纯工具、纯计算或跨业务解耦边界才传最小小参数。
- 使用 class 承载业务逻辑时，新增或触达的实例方法默认写成箭头函数 class field；`constructor`、`get/set`、`static`、`abstract`、`override`、decorator 方法按语义例外处理。
- 普通函数、顶层 helper、对象字面量函数默认不得原地修改入参；优先返回新值或 patch。若需要状态和生命周期，收敛到 owner class。
- 前端复杂业务逻辑、状态流或数据流默认收敛到 manager / store / presenter，优先由 manager 承载；组件和 hook 主要做连接、订阅、调用与轻量本地状态，合适时评估 RxJS 等显式数据流工具。
- React `useEffect` / `useLayoutEffect` 默认只同步外部系统；业务编排、状态迁移、query/store 镜像应回到 query/view hook、store、manager 或 presenter。
- 生命周期 owner 的订阅、临时 stream、watcher、runtime dispose 等清理职责默认收敛到 `cleanups` / `disposables` collection，`dispose/stop` 统一 drain；避免多个平行 nullable cleanup 字段或按资源类型散落清理逻辑。
- 不允许同一功能、职责链路、数据变换、组件表面或交互结构出现平行重复实现；新增前先查找可复用实现。
- 跨 workspace package 依赖默认只能导入对方 package 根公共入口；禁止从另一个 workspace 直接 deep import `shared/`、`commands/`、`src/` 等内部子路径。
- 禁止为修复跨包编译或导入问题，在消费者包 `tsconfig` 中新增指向另一个包内部目录的子路径 alias；应收敛到根级 workspace paths owner、被依赖包公共入口或 package 自身 `exports`。
- 禁止用结构性搬运替代语义建模：小字段、小状态或局部行为若需要多层透传、手写接口 proxy、原样转发方法，必须先回到真正的数据生成者或语义 owner。
- 前端 UI 默认复用现有展示组件、图标和设计体系；同一骨架多变体优先配置驱动和组合式设计，避免复制 JSX 和样式。
- 涉及 chat 链路演进时，默认只建设 NCP 主链路；legacy 只允许做阻塞迁移的必要修复、删除前兼容清理或用户明确要求的临时保障。
- 触达 NextClaw 自管理命令语义时，必须同步维护 `docs/USAGE.md`、`packages/nextclaw/resources/USAGE.md` 与 `nextclaw-self-manage` skill，并说明是否运行 `sync-usage-resource`。

## 验证常驻原则

- 每个开发阶段结束必须做与改动相关的最小充分验证；纯文档/措辞/元信息微调可跳过 build/lint/tsc，但必须说明不适用理由。
- 只要改动触达 TypeScript 源码、类型声明、导入导出边界或运行链路，`tsc` 必跑，不能被测试、eslint 或 governance 命令替代。
- 用户可见或可运行行为改动必须有冒烟测试；冒烟默认使用非 local / 非仓库目录环境，避免测试数据写进仓库。
- 修复问题、排查原因或声称解决异常时，必须做定向验证：先定义可观察判定条件，再按真实复现、贴近链路冒烟、最小可证明替代验证的优先级验收。
- 代码改动收尾默认运行 maintainability guard、`pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet`，再做主观可维护性复核；具体命令和例外走 `nextclaw-validation-workflow`。
- 每次解决完一个问题、修复一个异常或完成一次发布闭环后，必须做复盘：判断是否需要完善规则、skill、自动化、验证入口或文档，并把必要改进直接落实到合适层级。

## 迭代留痕常驻原则

- 不要在改动开始前为了记笔记而自动新建迭代目录；默认改动完成后的收尾阶段再判断是否需要 `docs/logs` 留痕。
- 迭代机制中的设计和计划沉淀必须带日期锚点：所有设计和计划类文档文件名必须使用 `YYYY-MM-DD-` 日期前缀，落在 `docs/designs/` 或 `docs/plans/` 的文档默认也必须满足该前缀。
- 触达项目代码、脚本、测试、影响运行链路的配置，或进行大规模非代码规则/文档重构时，通常必须有迭代记录。
- 最近一次相关迭代的同批次微调、补丁、验收修正，默认合并更新该迭代 `README.md`，不要拆出细碎新目录。
- 纯计划、方案、设计、PRD、讨论记录默认写入对应 docs 目录，不因这类设计文档自动创建 `docs/logs`，除非用户明确要求留痕。
- 迭代目录命名为 `docs/logs/v<semver>-<slug>`，版本号必须严格大于当前有效最大版本；详细 README 六段、NPM 发布记录、根因记录、红区触达、work/ 与 goal-progress 规则走 `nextclaw-iteration-log-governance`。

## 命令索引

- 新增和修改项目元指令统一维护在 `commands/commands.md`，这里仅保留索引。
- `/new-command`：创建新指令。
- `/config-meta`：调整或更新 `AGENTS.md`、Rulebook、Project Rulebook、命令或 skill 分层；必须使用 `nextclaw-agent-instructions-governance`。
- `/add-to-plan`：将想法纳入规划体系，默认写入 `docs/TODO.md` 的 `Inbox`，并给出分流建议和 Issue 草案；中长期方向同步 `docs/ROADMAP.md`。
- `/check-meta`：检查 `AGENTS.md` 机制问题、自相矛盾、过度常驻、skill 触发缺失或规则漂移。
- `/new-rule`：创建新规则条目；优先判断是否应写入 AGENTS 常驻内核、已有 skill、新 skill，还是普通文档。
- `/commit`：进行提交操作，提交信息使用英文；只有用户明确要求才执行。
- `/close-task`：对当前任务执行标准交付收尾流程，使用 `nextclaw-delivery-workflow`。
- `/maintainability-review`：执行独立于实现阶段的可维护性复核，使用 `post-edit-maintainability-review`。
- `/validate`：运行项目验证，使用 `nextclaw-validation-workflow`。
- `/release-beta`：执行 NextClaw NPM beta 一键发布闭环，使用 `npm-beta-release`。
- `/release-beta-npm`：只发布 NPM beta 包，不触发 runtime update channel。
- `/release-beta-runtime`：只发布 beta runtime update channel，不重复发 NPM 包。
- `/release-desktop-beta`：发布桌面端 beta preview，使用 `desktop-release-contract-guard` 闭合 installer、portable、update bundle、manifest 与 `desktop-release` workflow。
- `/release-frontend`：前端一键发布，仅 UI 变更场景。

## 发布常驻原则

- 发布/上线必须形成闭环；不适用的 migration、deploy、smoke、docs review、NPM release 项必须说明不适用理由。
- 涉及后端或数据库变更时，必须执行远程 migration，并对关键 API 做线上冒烟。
- 发布 NPM 包必须遵循当前项目发布流程；若某包升级，所有直接依赖且受影响的包必须同步评估、升级和发布。
- 用户说“直接发布”或“完成全部”时，默认执行本次变更涉及范围的完整发布闭环，不再反复追问范围，除非存在高风险不可逆操作。

## 常驻规则维护原则

- 新规则默认先判断：是否每轮都必须知道。若不是，优先进入 skill。
- 不允许把 Rulebook 再次扩成大段示例/反例全集；示例、反例、命令细节、模板、检查清单默认属于 skill。
- 修改本文件时，目标是减少常驻 token、提升触发可靠性、减少重复规则，而不是把复杂度搬到不会触发的普通文档。
- 如果某条常驻规则与 skill 细则冲突，以本文件的高层硬约束为准，并同步修正对应 skill。
