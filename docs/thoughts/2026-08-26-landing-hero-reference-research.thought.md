# NextClaw 官网首屏近期参考调研

## 背景

这次调研由 NextClaw 官网首屏连续调整失焦触发。问题不只是字号、间距或截图大小，而是此前缺少一套可复查的近期参考样本，导致设计判断过度依赖记忆和局部微调。

本调研对齐 [NextClaw 产品愿景](../VISION.md)：首屏首先要让普通用户立刻理解 NextClaw 是什么、能做什么，并通过真实产品界面证明它不是概念产品。调研结果服务于 [首页产品证明设计](../designs/2026-08-26-landing-hero-product-proof.design.md)，但在结构冻结前仍属于 `thought`，不冒充定稿设计。

## 调研口径

- 调研时间：2026-08-26。
- 时间优先：优先采纳 2025-08 至 2026-08 上线、重做或有明确近期活跃证据的产品。
- 用户优先：优先普通用户、个人创作者和个人效率产品；企业后台与开发者工具不进入主参考。
- 真实首屏：直接以官网当前首屏为准，不用记忆、宣传图或二手重绘替代。
- 产品证明：必须检查首屏是否展示真实界面、真实交互入口或可信产品结果。
- 适配性：最终参考必须能服务 NextClaw 的“个人智能搭档 + 桌面工作台”定位，而不是只追求视觉奇观。
- 抓取规格：Chromium，CSS 视口 `1512 × 827`，等待首屏资源约 5–6 秒；该规格对应用户提供的 `3024 × 1654`、DPR 2 桌面截图。

所有原始截图保存在 [`assets/landing-hero-reference-research`](assets/landing-hero-reference-research/)。截图包含现场遇到的 Cookie、恢复账号、下载引导或安全校验遮罩，保留这些失败样本是为了避免后续把不可用画面误当成审美证据。

## 第一轮候选池

| 产品 | 近期证据 | 用户属性 | 本地截图 | 当前判断 |
| --- | --- | --- | --- | --- |
| Gemini | 2026-05-19 全面推出 Neural Expressive 新设计语言 | 大众个人助手 | [截图](assets/landing-hero-reference-research/gemini.png) | 入选交互入口参考；官网直接就是产品入口，但没有证明复杂执行能力 |
| Siri AI | 2026-06-08 发布全新 Siri AI | 大众个人助手 | [截图](assets/landing-hero-reference-research/siri.png) | 入选视觉层级主参考；一个视口只讲一件事，真实产品画面占据下半屏 |
| Qwen App | 2026-01-15 消费级 Agent 重大升级 | 大众个人助手 | [截图](assets/landing-hero-reference-research/qwen.png) | 入选极简入口参考；产品可直接使用，但首屏没有展示任务结果 |
| Krea | 2026-03-02 重做所有界面 | 个人创作者 | [截图](assets/landing-hero-reference-research/krea.png) | 入选氛围与产品融合参考；单视口完整、产品视觉强，但深色创意品牌不宜直接套给 NextClaw |
| VoiceOS | 2026 年持续上线 Agent Mode 与 App Store，当前站点版权为 2026 | 个人效率 / 桌面助手 | [截图](assets/landing-hero-reference-research/voiceos.png) | 入选结构主参考；标题、单一 CTA、大幅桌面产品画面在首屏形成清晰顺序 |
| Oboe | 2025-12-10 发布全面重做版本 | 大众学习产品 | [截图](assets/landing-hero-reference-research/oboe.png) | 入选“产品即官网”参考；直接让用户开始任务，不适合承担 NextClaw 下载型产品的完整结构 |
| Heywa | 2026-03-05 发布消费级视觉回答产品 | 大众发现 / 决策 | [实验室站](assets/landing-hero-reference-research/heywa-labs.png) / [产品站](assets/landing-hero-reference-research/heywa-app.png) | 思想参考；生成式体验方向新，但产品站被 Cookie 遮罩，当前截图不能用于首屏结构复刻 |
| Sekai | 2026-06 有明确消费级增长与融资证据 | 大众创作 / 娱乐 | [截图](assets/landing-hero-reference-research/sekai.png) | 保留观察；产品内容本身丰富，但下载弹窗遮挡首屏，结构证据不合格 |
| FLORA | 2026 年持续更新创作平台 | 创作者 / 团队 | [截图](assets/landing-hero-reference-research/flora.png) | 审美参考；画面编排出色，但 Cookie 遮罩且品牌偏专业创意工具，不做主结构参考 |
| Tolan | 2026 年持续产品更新 | 大众 AI 陪伴 | [截图](assets/landing-hero-reference-research/tolan.png) | 品牌胆量参考；个性极强但几乎不展示产品工作界面，不适合 NextClaw 主参考 |
| tinypad | 2026-07 近期发布 | 大众浏览器工具 | [截图](assets/landing-hero-reference-research/tinypad.png) | 次级结构参考；产品证明明确，但整体完成度与品牌辨识度不足以作为顶级标杆 |
| Manus | 当前站点仍在维护，产品本体早于本轮优先时间窗 | 通用 Agent | [截图](assets/landing-hero-reference-research/manus.png) | 淘汰；恢复账号弹窗污染现场证据，且不满足优先时间口径 |
| Comet | 2026-03-18 发布 iOS 版本 | 大众 AI 浏览器 | [截图](assets/landing-hero-reference-research/comet.png) | 暂不评审；Cloudflare 校验导致无法取得真实首屏 |
| SuperMoney | 2026-03-03 近期发布应用 | 大众个人金融 | [截图](assets/landing-hero-reference-research/supermoney.png) | 淘汰；当前官网首屏视觉过于通用，与 NextClaw 目标不匹配 |

## 当前核心样本

### 1. Siri AI：首屏视觉层级

值得借鉴：

- 首屏只承担一个叙事，不露出下一节，避免“一页半”。
- 标题并不靠无限放大制造气势；视觉重心由下半屏的真实产品组合承担。
- 产品画面不是塞进厚重的浏览器壳，而是作为整幅构图本身。
- 画面可以在首屏底部有意裁切，但裁切必须显得是构图延续，不能像容器高度错误。

不应照搬：

- Apple 可以依靠系统级品牌认知省略 CTA，NextClaw 仍需要清晰下载入口。
- 手机多卡片组合不适合直接替代 NextClaw 的桌面工作台证明。

### 2. VoiceOS：桌面产品首屏结构

值得借鉴：

- 标题、主 CTA、真实桌面画面的阅读顺序非常直接。
- 桌面画面足够大，并在同一视口内承担主要视觉重量。
- 首屏没有塞三枚同权胶囊，也没有把安装细节抢到主叙事层。

不应照搬：

- 标题表达仍偏功能型，NextClaw 需要保留“长期个人智能搭档”的产品定位。
- 当前展示更像单一语音能力，NextClaw 的截图必须证明多工具、文件与任务结果的统一工作台。

### 3. Krea：环境与产品画面融合

值得借鉴：

- 产品截图不是孤零零贴在背景上，而是被环境、光影和屏幕载体整合成一个完整视觉。
- 真实界面只保留读得清的关键部分，不强迫用户在首屏阅读密集小字。

不应照搬：

- NextClaw 当前浅色、温暖、可信的品牌基调不应切成 Krea 式深黑创意工具皮肤。
- 不应制造并不存在的硬件场景或伪造产品能力。

### 4. Gemini / Qwen / Oboe：产品即入口

三者共同证明一个趋势：面向普通用户的 AI 首页正在减少解释，直接把“你现在可以做什么”变成首屏交互入口。

对 NextClaw 的启发不是一定要在官网嵌入可用输入框，而是文案和截图都要像一个可开始的产品：用户看完应立即知道可以把任务交给它，而不是先读懂 API、模型、安装渠道和技术栈。

## 核心判断

第一轮 14 个产品、15 张现场截图中，没有一个可以整页无脑复制。结构 A/B 使用同一张 NextClaw 真实截图、同一 `1512 × 827` 视口完成：

1. [左右基线](assets/landing-hero-reference-research/nextclaw-left-right-baseline.png)：真实工作台完整可辨，标题与行动区互不争抢，满足用户已经认可的阅读关系。
2. [VoiceOS 式纵向候选](assets/landing-hero-reference-research/nextclaw-voiceos-stack-candidate.png)：标题和 CTA 集中，但工作台被压到折线下，只露出上半截，形成错误裁切感。
3. [最终左右方案](assets/landing-hero-reference-research/nextclaw-selected-left-right.png)：在左右基线上缩小标题、把产品图由约 55% 放大到约 62%、删除技术安装说明，仍保持标题两行与首屏独占。

因此，**最终结构 owner 是经 A/B 验证后的 NextClaw 左右基线，不切换为 VoiceOS 纵向结构**。外部样本仍各自只约束一个明确维度：Siri AI 约束首屏边界，VoiceOS 约束行动层级，Krea 约束截图质感，Gemini / Qwen / Oboe 约束内容减法。

## 推荐倾向

保持用户已经认可过的桌面端“文字 + 产品证明”关系，并采用已经完成 A/B 的最终左右方案：

- 首屏自然 `min-height: 100svh`，不写死像素高度；内容过高时允许页面自然增长。
- 同一首屏内只出现导航、核心定位、极短说明、主次两个动作、真实产品画面；安装技术细节退出主视觉层，只保留“安装完成即可使用，无需额外配置”。
- 产品图必须在 `1512 × 827` 视口内成为视觉主体，不能只露一个“头”，也不能让下一节进入首屏。
- 桌面端优先验证标题最多两行、产品画面完整可辨、CTA 不碎行；移动端再独立收敛，不把桌面硬缩小。
- 截图周围不再加厚重拟浏览器框；只保留极轻边界、圆角和与背景一致的阴影。

## 未决问题

- 当前 NextClaw 产品截图的任务内容是否足够普通用户化；如果截图内部仍以技术文档和密集数据为主，外层布局再好也无法成为顶级首屏。
- 是否需要为官网专门准备一条真实、清晰、可公开的用户任务会话，而不是继续复用开发过程截图。

## 升级条件

结构结论已升级到现有首页设计文档并完成实现。后续只有在取得更强、真实、普通用户任务截图时，才升级产品证明内容；不再重新打开首屏结构方案空间。

## 来源

- [Google：Gemini 2026 全新界面语言](https://blog.google/innovation-and-ai/products/gemini-app/next-evolution-gemini-app/)
- [Apple：Siri AI，2026-06-08](https://www.apple.com/newsroom/2026/06/apple-introduces-siri-ai-a-profoundly-more-capable-and-personal-assistant/)
- [Alibaba：Qwen App 消费级 Agent 升级，2026-01-15](https://www.alibabagroup.com/en-US/document-1948497434959151104)
- [Krea：全界面重做，2026-03-02](https://www.krea.ai/blog/redesign)
- [Oboe：全面重做，2025-12-10](https://oboe.com/blog/introducing-the-all-new-oboe)
- [VoiceOS 当前官网](https://www.voiceos.com/)
- [Heywa 当前官网](https://heywalabs.com/)
- [Heywa 消费产品](https://heywa.ai/)
- [Sekai 当前官网](https://sekai.ai/)
- [FLORA 当前官网](https://flora.ai/)
- [Tolan 当前官网](https://www.tolans.com/)
- [tinypad 当前官网](https://www.tinypad.app/)
- [Manus 当前官网](https://manus.im/)
- [Comet 当前官网](https://www.perplexity.ai/comet)
- [SuperMoney 当前官网](https://www.supermoney.com/)
