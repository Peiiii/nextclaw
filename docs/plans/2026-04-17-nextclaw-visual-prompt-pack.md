# NextClaw 首批宣传图 Prompt Pack

## 用途

这份文档用于把首批两张宣传图从 brief 进一步推进到“可直接交给其它 AI 生图工具”的阶段。

适用场景：

- 交给通用图像模型直接生成
- 交给设计师作为 AI 辅助出稿基线
- 交给不同平台分别做首轮探索

本包默认服务两张图：

- 图一：总价值海报
- 图二：统一入口解释图

对应 brief：

- [2026-04-17-nextclaw-first-visual-briefs.md](./2026-04-17-nextclaw-first-visual-briefs.md)
- [2026-04-17-nextclaw-marketing-visual-asset-plan.md](./2026-04-17-nextclaw-marketing-visual-asset-plan.md)

## 使用原则

- 先跑英文 prompt 版本，通常更稳定
- 中文版图中文字建议后期手工排版，不建议第一轮完全依赖模型直接拼中文
- 每张图先出 `2-4` 个构图方向，再挑最有势能的一张深化
- 第一轮重点看构图、气质和层级，不要先纠结局部 UI 细节
- 如果模型不擅长长文本渲染，就让它只出视觉，不在图里强塞完整副标题
- 第一轮也必须让人一眼认出这是 `NextClaw`，不能只做泛 AI 产品海报
- 默认必须上传真实 NextClaw 截图作为参考图，再让模型做海报化重组
- 如果模型不支持参考图，这套 prompt 只能拿来探索氛围，不能拿来出正式主视觉

## 这次失败的根因

上一版 prompt 的问题不是“不够华丽”，而是“不够像 NextClaw”。

根因有三个：

1. 没有把真实 NextClaw UI 作为硬锚点
2. 太强调“统一入口”和“高级感”，却没强调“必须像我们的真实产品”
3. 模型被允许自由发挥，于是自动收敛成最常见的泛 AI SaaS 概念图

这类图的问题在于：

- 即使写上 `NextClaw`，用户也不会相信这是 NextClaw
- 即使画得好看，也不能承担产品传播
- 即使有氛围，也没有产品身份

所以从这一版开始，策略改成：

**先让图明显像 NextClaw，再让它变得高级。**

## 必须使用的参考图

首批生成时，默认至少上传这三张：

- [images/screenshots/nextclaw-chat-page-en.png](/Users/peiwang/Projects/nextbot/images/screenshots/nextclaw-chat-page-en.png)
- [images/screenshots/nextclaw-providers-page-en.png](/Users/peiwang/Projects/nextbot/images/screenshots/nextclaw-providers-page-en.png)
- [images/screenshots/nextclaw-channels-page-en.png](/Users/peiwang/Projects/nextbot/images/screenshots/nextclaw-channels-page-en.png)

如需补充远程/浏览器感，可追加：

- [images/screenshots/nextclaw-micro-browser-dock-en.png](/Users/peiwang/Projects/nextbot/images/screenshots/nextclaw-micro-browser-dock-en.png)

使用要求：

- `chat` 图提供真实会话主界面锚点
- `providers` 图提供模型控制锚点
- `channels` 图提供多入口锚点
- 生成结果必须保留这些界面的可识别结构语言，而不是重新发明一个假 dashboard

## 硬性识别约束

下面这些句子建议追加到所有正式 prompt 里：

- must visibly resemble the real NextClaw product UI
- must use the provided screenshots as structural references
- do not invent a generic fake dashboard
- preserve recognizable layout language from the real product
- if the result could belong to any generic AI startup, it is a failed result

## 全局风格约束

所有图统一追加这些约束：

- premium product marketing visual
- futuristic but restrained
- not cheap cyberpunk
- realistic product UI feeling
- clean hierarchy
- clear focal point
- no clutter
- no watermark
- no gibberish text

统一避免项：

- cheap neon cyberpunk
- chaotic logo collage
- fantasy cosmos
- generic chatbot bubbles
- overly abstract neural network art
- low-end sci-fi poster look
- unreadable tiny labels
- random extra devices

---

## 图一：总价值海报

### 目标

让用户第一眼建立这个认知：

**NextClaw 是个人 AI 操作层，而不是普通聊天壳。**

### 英文主 Prompt

```text
Create a premium website hero image for NextClaw, using the provided real NextClaw screenshots as mandatory references.

The image must clearly look like NextClaw, not a generic AI dashboard. It should show NextClaw as a unified control console that brings together AI providers, communication channels, automation, remote access, and project context in one place.

Visual direction:
- dark premium product environment
- central elegant control-console composition built from recognizable NextClaw UI elements as the main focal point
- surrounding connected capability nodes for providers, channels, automation, remote access, and work context
- subtle luminous routing lines showing orchestration
- realistic interface panels based on the actual NextClaw product, not fantasy sci-fi
- restrained futuristic mood, clear hierarchy, cinematic but clean

Composition:
- wide hero composition
- centered main console
- strong negative space for headline area
- supporting modules arranged in a radial or semi-radial way
- the central system must feel like the brain of the whole product
- viewers should still recognize real chat, providers, and channels sections from NextClaw

Style:
- high-end SaaS/product launch visual
- polished UI marketing composition built from a real product
- premium glass and display surfaces
- graphite, charcoal, deep navy base
- cyan or aqua highlights
- slight warm accents only if needed

Must communicate:
- one entry point
- orchestration
- control
- product maturity
- real product identity

Avoid:
- cheap cyberpunk neon
- logo spam
- generic chatbot art
- fake made-up dashboard UI
- cosmic background
- clutter
- game poster vibes
- watermark
- nonsense text
```

### 英文增强版 Prompt

```text
Use case: ui-mockup
Asset type: landing page hero for an AI product
Input images: Image 1 = real NextClaw chat UI reference; Image 2 = real NextClaw providers UI reference; Image 3 = real NextClaw channels UI reference
Primary request: create a flagship marketing hero image for NextClaw, positioned as a personal AI operating layer rather than a simple chatbot. The image must communicate that one unified console controls AI providers, communication channels, automation, remote access, and real work context. It must visibly resemble the real NextClaw product and should feel like a premium composition built from the real UI, not a generic imagined dashboard.
Scene/backdrop: a dark premium environment with layered depth, subtle gradients, and calm atmospheric lighting
Subject: a central polished NextClaw console composition built from recognizable real interface sections, surrounded by connected modules representing providers, channels, automation, remote access, and project context
Style/medium: premium product launch visual, cinematic UI mockup, realistic interface-led marketing art
Composition/framing: wide and centered, strong focal point in the middle, ample negative space, balanced radial composition, product-first
Lighting/mood: confident, controlled, intelligent, modern, clean
Color palette: deep graphite, black, muted navy, cyan and aqua highlights, tiny warm accents
Materials/textures: glassy UI cards, subtle screen reflections, elegant routing lines, polished surfaces
Constraints: must look like a real product ecosystem; must emphasize orchestration and entry-point power; keep it legible and premium; preserve recognizable layout language from the provided screenshots; if it looks like a generic AI startup image, the result is wrong
Avoid: cheap cyberpunk, abstract neural-art look, cluttered logos, fantasy space visuals, generic AI chat bubbles, fake invented dashboard UI, low-quality text rendering, watermark
```

### 中文理解版 Prompt

```text
请基于我提供的真实 NextClaw 截图，生成一张高端产品主视觉海报。它不是普通聊天工具，而是一个“个人 AI 操作层”产品。

画面核心是一个位于中心的 NextClaw 控制台，中枢感非常强。这个中枢必须明显保留真实 NextClaw 界面的结构特征，不能随便编一个通用控制台。周围通过有秩序的连接关系延展出五类能力模块：模型提供商、消息渠道、自动化、远程访问、项目上下文。

整体需要传达：
- 一个入口
- 统一调度
- 统一控制
- AI 进入真实工作流
- 这就是 NextClaw 本身，而不是别的泛 AI 产品

风格要求：
- 深色高端科技产品感
- 有未来感，但克制，不廉价
- 要像高级产品发布视觉，不要像游戏海报
- 必须使用真实 NextClaw 界面做锚点，不是纯抽象概念图
- 画面干净，层级清晰，中间主体非常明确

避免：
- 赛博朋克霓虹堆砌
- logo 大拼贴
- 宇宙星空背景
- 普通聊天气泡感
- 凭空虚构的通用 AI 控制台
- 乱七八糟的无意义文字
- 水印
```

### 图内文字建议

如果模型支持可靠英文排字，可尝试：

- `NextClaw Is Your Personal AI Operating Layer`

如果模型文字不稳定：

- 第一轮不要强制出完整标题
- 先生成纯视觉版
- 后期再手工排字

### 推荐变体方向

#### 变体 A：中枢控制台最强版

- 强调中心主控制台
- 周边模块相对克制
- 更适合官网首屏

#### 变体 B：能力扩散最强版

- 周边能力节点更明显
- 更适合 README 与社交传播

#### 变体 C：更克制高级版

- 信息更少
- 空间感更强
- 更适合英文官网和 GitHub 社交卡片

---

## 图二：统一入口解释图

### 目标

把 NextClaw 的价值讲清楚，让用户看完后能转述：

**用户先进入 NextClaw，再由 NextClaw 去连接模型、渠道、自动化和远程工作流。**

### 英文主 Prompt

```text
Create a premium product explanation graphic for NextClaw, using the provided real NextClaw screenshots as structural references.

The image should clearly look like NextClaw and explain how NextClaw acts as one central entry point that unifies AI providers, communication channels, automation, remote access, and project context.

Visual structure:
- one central NextClaw hub in the middle
- five surrounding modules clearly separated but visually connected
- each module should feel like a polished product panel derived from the real UI, not a plain box diagram
- use elegant lines, spacing, and hierarchy to show orchestration
- the whole composition should feel like a product ecosystem map, not a technical architecture slide
- viewers should still recognize real NextClaw interface language

Style:
- dark premium UI infographic
- clean and structured
- high-end product marketing diagram
- realistic interface cards
- legible, balanced, organized

Must communicate:
- one entry point
- connected product capabilities
- clarity and control
- this is the real NextClaw product

Avoid:
- tiny unreadable text
- plain architecture-chart look
- cluttered network map
- generic cloud diagram
- fake generic dashboard
- cheap neon cyberpunk
- watermark
```

### 英文增强版 Prompt

```text
Use case: infographic-diagram
Asset type: website explanation graphic for an AI product
Input images: Image 1 = real NextClaw chat UI reference; Image 2 = real NextClaw providers UI reference; Image 3 = real NextClaw channels UI reference
Primary request: create a refined product explanation graphic for NextClaw that shows how one unified console connects AI providers, communication channels, automation, remote access, and project context into a single user-facing entry point. The result must visibly resemble the real NextClaw product and preserve recognizable interface language from the provided screenshots.
Scene/backdrop: dark interface environment with subtle depth, clean grid hints, premium product mood
Subject: a central NextClaw hub surrounded by five structured capability modules, all visually connected in an elegant orchestration layout
Style/medium: premium infographic mixed with realistic product UI panels
Composition/framing: center-focused diagram, balanced spacing, clear hierarchy, readable modules, each module distinct but tied to the core
Lighting/mood: intelligent, trustworthy, organized, modern
Color palette: graphite, deep navy, cyan, teal, restrained warm highlights
Materials/textures: glass-like interface cards, subtle luminous lines, polished digital surfaces
Constraints: must explain product value clearly; should feel productized and beautiful; should not look like a raw technical architecture slide; should clearly feel built from the real product rather than a made-up dashboard
Avoid: cluttered maps, dense tiny labels, cloud-architecture style boxes, cheap cyberpunk, random extra modules, fake generic UI, watermark
```

### 中文理解版 Prompt

```text
请基于我提供的真实 NextClaw 截图，生成一张高端产品解释图。它要讲清楚：NextClaw 是一个统一入口，用户先进入 NextClaw，再由 NextClaw 去连接模型、消息渠道、自动化、远程访问和项目工作上下文。

画面结构要求：
- 正中心是 NextClaw 中枢
- 周围有五个能力模块
- 每个模块都要像真实 NextClaw 产品卡片或产品面板，不是普通框图
- 中心和外围之间要有优雅、清晰、有秩序的连接关系
- 整体要像高端产品信息图，而不是技术架构图
- 画面必须保留可识别的真实 NextClaw 界面语言，不能凭空发明一个通用 AI 仪表盘

风格要求：
- 深色高端界面风
- 清晰、理性、结构化
- 既有解释力，也有产品质感
- 要有真实 UI 产品感，不要只是 PPT 框线

避免：
- 字太小看不清
- 纯技术架构图气质
- 杂乱网络图
- 廉价赛博朋克
- 水印
```

### 模块文案建议

如果模型能稳定处理英文短词，可尝试只放短词，不放长句：

- `Providers`
- `Channels`
- `Automation`
- `Remote Access`
- `Project Context`

如果想增强说明，但又怕模型文字崩掉，建议后期再补字。

### 推荐变体方向

#### 变体 A：信息图最强版

- 更强调结构
- 更适合官网中段

#### 变体 B：产品卡片更强版

- 更像真实 UI 系统
- 更适合长帖配图

#### 变体 C：极简高端版

- 模块更少字
- 构图更强
- 更适合演示和品牌感建立

---

## 给不同模型的使用建议

### 如果是偏写实 / 产品感强的模型

优先使用：

- 英文增强版 Prompt
- 强调 `premium product launch visual`、`realistic interface panels`
- 一定上传真实 NextClaw 截图作为参考图

### 如果是偏概念 / 氛围强的模型

要额外补一句：

- `must feel like a real software product, not abstract sci-fi art`

### 如果模型文字能力弱

建议：

- 不要强制让它输出完整标题
- 先拿构图和氛围
- 标题副标题后期手工加

### 如果模型容易画脏

额外追加：

- minimal clutter
- clean spacing
- reduced visual noise
- single focal point

---

## 第一轮出图建议

建议先跑这 6 张：

- 图一 A
- 图一 B
- 图一 C
- 图二 A
- 图二 B
- 图二 C

第一轮只看三件事：

- 有没有“中枢”感
- 有没有“统一入口”感
- 有没有“高级产品”感
- 有没有人一眼就能认出这是 NextClaw

不要第一轮就盯字体和小细节。

## 第二轮筛选标准

选图时优先保留：

- 一眼能看懂结构的
- 中心主体最强的
- 不像普通聊天工具海报的
- 不像廉价 AI 概念图的
- 明显带有真实 NextClaw 界面痕迹的

优先淘汰：

- 太像游戏海报
- 太像架构图
- 太像截图拼贴
- 太像普通 SaaS banner
- 看不出任何 NextClaw 产品锚点的

## 交给设计师时怎么说

可以直接给设计师这句话：

`这不是一般的 AI 聊天产品海报。它必须同时让人感到“这是一个统一入口”和“这是个真实成熟的产品系统”，而不是纯概念、纯截图、或者纯炫技。`

## 长期目标对齐 / 可维护性推进

这份 prompt pack 的目的不是扩写更多图，而是把最重要的两张图推进到可外部执行的状态。

这一步保持了“少而强”的推进原则：

- 只推进首批两张
- 每张只给必要的主 prompt、增强版 prompt 和变体方向
- 让后续外部出图、设计深化和多平台适配都共享同一个母体

本次不涉及代码改动，因此代码可维护性评估不适用。
