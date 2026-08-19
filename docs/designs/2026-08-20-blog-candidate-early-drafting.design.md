# 博客候选与提前成稿机制设计

## 背景与可观察问题

NextClaw 已经有产品博客写作 skill 和正式中英文博客目录，但当前生命周期只会稳定判断 changeset、release notes 与迭代记录。一个具备独立用户价值和真实证据的功能，往往要到发布或用户再次提出时才开始整理文章，开发期已经形成的指标、截图机会和关键边界容易丢失。

本设计要解决的不是“每次改代码都写博客”，而是让值得公开讲述的成果在事实最清楚时完成候选判断，并允许在尚未发布产品或文章之前形成可复核草稿。

## 当前 owner 与约束

- `development-delivery`：每项开发任务都会经过的结果交接 owner，已经负责 changeset、迭代记录和专项交付路由。
- `nextclaw-product-blog-storytelling`：产品博客的事实、结构、边界和配图 owner。
- `user-facing-content-boundary`：公开正文的事实源、用户视角、截图和语言边界。
- `apps/docs/{zh,en}/blog`：正式站点内容；文件进入这里后会参与站点构建，不能承担未发布草稿。
- 发布、部署、更新博客索引与导航仍属于外部交付，不因本地草稿完成而自动获得授权。

## 候选方案

### 方案 A：只在正式发布阶段判断博客

优点是入口最少，缺点是错过开发完成后证据最完整的时间点，也无法满足提前准备。放弃。

### 方案 B：在 Delivery 做候选门，博客 skill 管理内部草稿

每项完成验证和 Review 的结果进入 Delivery 时，先判断是否具备独立叙事价值；适用时由博客 skill 在内部草稿目录成稿，正式发布再迁入站点目录。

优点是复用现有生命周期入口，不新增平行阶段；事实已经稳定，又早于 release。草稿与发布权限明确分离。采用。

### 方案 C：所有用户可见 changeset 自动生成博客

优点是不会遗漏，缺点是会产生大量没有独立阅读价值的文章，混淆 changelog 与博客，并增加维护噪音。放弃。

## 关键决策

### 1. 候选门归 Delivery，写作归产品博客 skill

Delivery 只回答“这项成果是否值得形成内容候选、现在能否成稿”，不负责写作细节。命中后才路由 `nextclaw-product-blog-storytelling`。不新增 `development-content` 阶段，也不把规则放进每轮必读的 `AGENTS.md`。

### 2. 最早成稿时间是证据稳定，而不是版本发布

只有实现已经通过适用 Validation 和 Review、主要事实不会因已知修改失效时，才允许写结果型博客。无需等待 commit、版本发布或部署。若后续实现或测量环境变化，发布前必须重新核对数据。

### 3. 博客候选不是 changeset 的同义词

满足以下任一强信号，并且有可公开核查证据时，才进入候选：

- 明显改变一个具体用户任务，并能用 before/after 说明结果；
- 解决 AI 原生产品中特有且可复用的问题，例如长会话、工具调用、自治或连续性；
- 有稳定指标、真实界面或运行链路支撑，而不只是实现清单；
- 能解释一个对用户有意义的产品取舍或边界。

常规修复、内部重构、只有 changeset 而没有独立故事、证据不稳定或涉及不可公开数据时跳过。

### 4. 草稿与发布是两个状态和两个授权边界

- `candidate`：只在交付结论中说明候选主题和缺失证据，不创建文件。
- `draft-ready`：写入 `docs/blog-drafts/YYYY-MM-DD-<topic>.blog-draft.md`，正文达到可编辑、可事实复核状态，但不会进入站点构建；需要随某项产品变化发布时，由该 changeset 显式绑定。
- `published`：经明确发布授权后，按实际发布日期形成 `apps/docs/zh/blog` 与 `apps/docs/en/blog` 正式文章，并更新两种语言的 index、sidebar 和适用链接。

内部草稿路径不新增为通用项目知识层；它由产品博客 skill 单独拥有，避免污染 thought/design/plan/log 的升级链路。

### 5. Changeset 绑定是发布发现 owner

只把草稿放进目录，release notes 无法知道它属于哪个发布批次；只把义务留在 changeset，version 阶段消费 changeset 后又会丢失。需要随某项产品变化一起发布的草稿，必须同时使用持久草稿元数据和 changeset 指针。

草稿 frontmatter：

```yaml
releaseBlogTarget: next-stable
releaseBlogChangeset: <changeset-id>
releaseBlogState: draft
```

对应 changeset 指令：

```md
<!-- release-note-blog: docs/blog-drafts/<file>.blog-draft.md -->
```

`release:summary` 与现有 release-note image 相同，解析未发布 changeset、校验指针和草稿元数据一致，并在 JSON 和人类摘要中返回绑定博客。指令行不会混入 changeset 的用户摘要。changeset 被 version 阶段消费后，`next-stable` 草稿仍作为持久发布义务被扫描，不会随 changeset 一起消失。

发布准备完成后，草稿迁入正式中英文站点内容，frontmatter 改为：

```yaml
releaseBlogState: ready
releaseBlogZhPath: apps/docs/zh/blog/<file>.md
releaseBlogEnPath: apps/docs/en/blog/<file>.md
```

`ready` 必须同时满足：中英文文件存在、两个博客 index 都包含文章、VitePress 中英文 sidebar 都包含路由。它表示站点源码已具备发布条件，不表示线上部署已经完成。

### 6. 产品发布闭环是遗漏阻断门

普通 `pnpm release:summary -- --json` 保持可用于提前发现草稿，不因 `draft` 状态失败。NPM version 与 publish 也不能被博客等下游材料前置阻塞。稳定产品发布达到 `NPM_READY` 后、进入 runtime/docs 闭环前，`ensureProductReleaseArtifacts` 使用严格模式扫描持久草稿；任一绑定仍为 `draft`、路径缺失、正式文章缺语言或缺入口时直接失败。

绑定合同不提供静默 `defer` 状态。是否把一篇候选绑定到某次 changeset，在开发交付时决定；一旦绑定，解除绑定或删除草稿就是显式的代码审查变更，不能由发布脚本悄悄忽略。线上文档验证通过后才删除内部草稿。这样硬保证只作用于已经声明“随这个变化发布”的文章，不强迫所有博客候选跟随版本发布。

### 7. 草稿正文必须可以独立成立

草稿正文只写未来读者会看到的内容，不混入候选打分、内部决策过程、私有路径、会话 ID 或发布操作说明；机器读取的发布状态只放在 frontmatter。证据来源、候选判断和配图取舍留在设计、迭代记录或协作结果中。

## 本次文章主线

一句话事实：在约 44.5 MB、每条消息含大量工具参数与结果的压力会话中，NextClaw 通过“摘要先行、按消息加载详情、渐进渲染”把最新消息可见时间从约 6.94 秒降到 1.13–1.73 秒，同时保留完整工具数据。

它服务的用户任务是：长期运行的 Agent 会话即使积累大量工具调用，也能先快速恢复阅读，再按需检查完整执行过程。

传播目标是结果营销，不是技术科普。标题直接使用“从 6.94 秒到最快 1.13 秒、提速约 6 倍”，正文先给 before/after 和用户收益，只保留解释“数据没有丢、为什么日常会话不受影响”所需的最少实现信息；完整根因和架构细节留在性能设计与迭代记录中。

文章使用本地隔离开发环境的真实测量，必须明确测试范围，不把单机结果写成所有环境的绝对保证。当前源码已经完成，但尚未正式发布，因此草稿使用“当前开发版本”表述。

## 配图判断

候选形式：

1. before/after 指标信息图：最适合解释 13 MB 到 262 KB、6.94 秒到 1.13–1.73 秒的变化；
2. 真实压力会话截图：适合证明 500 次工具调用的汇总、展开与“继续显示 40 项”交互；
3. 抽象 AI 氛围图：无法证明性能和查看体验，不采用。

当前先完成无图草稿。正式发布前优先补一张真实默认或雾蓝主题截图，并可增加一张简洁的 before/after 信息图；截图必须来自保留的真实压力会话，且不得暴露本地私有信息。

## 实施范围

- 在 `development-delivery` 增加博客候选判断与专项路由，不改变既有提交、changeset 和发布授权语义；
- 在 `nextclaw-product-blog-storytelling` 增加提前成稿时机、候选标准、草稿路径、changeset 绑定和发布迁移合同；
- 扩展 `release:summary` 聚合并校验 changeset 指针与持久草稿元数据；稳定产品发布在 `NPM_READY` 后严格阻断未转成 `ready` 的绑定草稿；
- 新增一篇内部中文博客草稿；
- 不修改 `AGENTS.md`、commands、正式博客索引、站点导航或英文正式文章。

## 验证标准

- 生命周期仍只有一个 Delivery owner，没有新增平行阶段或循环依赖；
- `pnpm check:skill-progressive-loading` 通过；
- 新路径 planned-path preflight 通过，正式站点构建不会包含内部草稿；
- 普通 release summary 可以发现 `draft` 绑定且不会污染 changeset 摘要；严格模式对 `draft` 失败；完整 `ready` 夹具通过；
- 文章中的数字能追溯到已提交的设计与迭代记录，且不含私有路径、真实会话 ID 或未发布承诺；
- 公开正文通过用户内容边界与中文语感检查；
- `git diff --check` 通过且不触碰无关 WIP。

## 非目标

- 本次不发布文章、不更新官网导航、不生成图片；
- 不为每个 changeset 自动创建博客；
- 不创建新的 lifecycle 阶段、脚本或候选数据库；
- 不承诺当前单机性能数字在所有硬件与数据分布下完全一致。

## 实现后验证记录

- 真实 `release:summary -- --json` 已把 `chat-heavy-tool-payload-loading` 与草稿关联为 `next-stable / draft`，changeset 用户摘要不包含绑定指令；
- 严格模式对当前草稿返回非零退出码和明确错误；
- 测试证明 changeset 进入 prerelease/被消费后，持久草稿仍会被产品闭环发现并阻断；
- 测试证明 `ready` 状态只有在中英文正式文件、两个 blog index 和中英文 sidebar 都存在时通过；
- NPM 的 `release:version` 保持原流程，严格博客门接在 `ensureProductReleaseArtifacts`，位于 `NPM_READY` 之后；
- release summary 9 项测试与 stable release 18 项测试通过，目标 ESLint、语法检查、skill progressive-loading、命名治理、diff check 和 scoped maintainability 检查通过。
