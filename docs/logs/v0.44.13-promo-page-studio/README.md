# v0.44.13 Promo Page Studio

## 迭代完成说明

- 将既有 `nextclaw-product-visual-assets` skill 扩展为可复用的 Promo Page Studio，不新增平行宣传页 skill；同一 owner 统一负责真实截图、AI 氛围素材、整页 HTML 预览和视觉审稿。
- 固化“内容优先”合同：每个模块先声明叙事任务、信息增量、用户 takeaway 和证据，背景图片只提供氛围，不能代替内容或产品证据。
- 新增十二类可枚举的区块布局原型目录。渲染器已实现 `stacked-proof`、`split-proof`、`anchored-overlap` 和 `step-sequence` 四类，并要求 brief 记录候选原型、最终选择与理由；未实现原型会被明确阻断。
- 将截图流程拆成选图、完整性、裁切、比例和拼接五个可审查环节；事实卡片必须使用可追溯的真实产品图，默认完整展示并保持源图比例，禁止用随机裁切或 AI 伪造 UI。
- 固化“五星挑刺法·冻结标尺版”：每个独立模块固定给出五个问题、绝对分数、模块指数、全局排序和未解决项；修改前后使用同一标尺，分数改善必须能指向可见证据。
- 提供自包含的 HTML 模板、Island 主题示例 brief、真实界面参考和氛围参考，使后续功能宣传可从结构化 brief 稳定复用，而不是依赖一次性手工排版。

2026-08-30 双栏平衡续更：

- 用户复审发现 `split-proof` 虽然几何列宽接近均分，但文字栏前景只占约 `27.6%` 高度，媒体栏约 `64.4%`，左侧形成没有阅读方向的死空白。根因是原合同只约束列宽、四象限重量和主动留白，没有要求逐栏复核实际前景占用率。
- 为 `split-proof` 增加 `balancePlan`：记录文字栏与媒体栏填充率、共同对齐锚点、空白作用和失败后的备用原型；渲染器阻断缺少计划、任一栏低于 `0.35` 或高于 `0.85`、以及两栏差值超过 `0.25` 的 brief。
- 模板把双栏的三个证据标签改成纵向信息组。标签必须推进 claim，不允许使用装饰、重复口号或假数据填空。
- Mini App 代表页复验中，左栏填充率提升到约 `50.5%`，与右栏的差值从 `36.8pp` 降到 `13.9pp`；桌面两栏中心相差约 `15px`，390px 窄屏相差约 `8px`。

## 测试/验证/验收方式

- 使用 `skill-creator` 自带的 `quick_validate.py` 校验 `.agents/skills/nextclaw-product-visual-assets`，结果通过。
- `pnpm exec eslint .agents/skills/nextclaw-product-visual-assets/scripts/render-promo-page.mjs` 通过。
- `pnpm check:skill-progressive-loading` 通过，38 个项目 skill 的渐进加载预算保持合格。
- `pnpm lint:new-code:governance` 与 `pnpm check:governance-backlog-ratchet` 通过。
- 示例 brief 与 Mini App 代表性 brief 均成功渲染为自包含 HTML；反向用例证明“最终原型不在候选中”和“选择已登记但尚未实现的原型”都会被渲染器阻断。
- 桌面与窄屏预览完成视觉检查；审稿同时检查内容代表性、截图完整度、构图平衡、留白、视觉层级和跨模块一致性。
- 双栏续更的正向示例和 Mini App brief 均成功渲染；缺少 `balancePlan` 以及 `copyFillRatio=0.2` 的反向用例均被明确阻断。
- 续更再次通过 skill validator、渲染器 ESLint、渐进加载、new-code governance、backlog ratchet 和定向 maintainability 检查；无阻塞 finding。

## 发布/部署方式

- 本轮仅沉淀项目内 Skill、参考合同、模板、示例资产、渲染器和迭代记录，通过范围化提交合入 `master`。
- 不涉及官网部署、桌面发布、数据库迁移、Runtime 更新或外部服务配置。
- 变更只影响内部 AI 生成与审稿流程，不改变用户可见产品、公共 API、安装/运行行为，因此不新增 changeset。

## 用户/产品视角的验收步骤

1. 使用 `nextclaw-product-visual-assets` skill，为一个新的 NextClaw 功能准备结构化 brief。
2. 确认每个模块先说明要传达的内容，再选择最多三个布局候选，并记录最终原型与选择理由。
3. 运行 `node scripts/render-promo-page.mjs --brief <brief.json> --out <preview.html>`，确认输出是可直接预览的自包含 HTML。
4. 检查事实截图完整可读、裁切有来源、比例未被拉伸，AI 生成图只承担背景或明确标注的概念视觉。
5. 交付前执行五星挑刺法，确认每个模块都有五个问题和绝对评分，即使达到交付线也不省略审稿结果。
6. 对双栏卡片隐藏背景后分别估算两栏前景包围盒填充率；确认差值不超过 `0.25`，视觉重量没有因高密度截图坠向单侧。

## 可维护性总结汇总

- 宣传页面能力继续归现有产品视觉资产 owner；新增 reference 按内容证据、构图留白、布局原型、艺术方向和外部资产合同分层，主 `SKILL.md` 只保留路由与硬门禁。
- 模板负责视觉表达，JSON brief 负责内容和布局决策，渲染脚本负责验证与装配，三者没有复制产品 UI 或建立第二套运行时状态。
- 外部设计规范只吸收可执行原则，并保留来源、许可证或用途说明；不复制第三方完整 Skill，也不把通用设计规则塞回 `AGENTS.md`。
- diff-only maintainability 检查无阻塞 finding；已知边界是十二种原型中当前只实现四种，文档明确标记状态，后续按真实需求补充，不用静默 fallback 冒充支持。
- 双栏续更只扩展现有布局原型、构图 reference、brief 合同和同一渲染器，没有新增 Skill、平行模板或治理入口；新增的模型能力补丁带复核与删除条件。

## NPM 包发布记录

不涉及 NPM 包发布。本轮为项目内 Skill 与治理资产更新，没有新增 changeset，也不改变任何发布包内容。
