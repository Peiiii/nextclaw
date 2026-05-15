# Skill Marketplace 精选货架式展示方案讨论稿

## 1. 文档状态

- 状态：讨论稿
- 日期：2026-05-15
- 范围：NextClaw 主产品内 Skill Marketplace 的前端展示与信息架构
- 不做范围：不定义完整实现计划、不引入个性化推荐算法、不设计评分评论体系、不改变 skill 安装链路

本方案先回答一个问题：如何把当前 Skill Marketplace 从“平铺目录”升级为更有发现感的“能力入口”，同时避免伪推荐、过度装饰和工作台效率下降。

## 2. 背景判断

当前 Skill Marketplace 更接近管理列表：搜索、排序、Marketplace / Installed tabs、列表卡片和安装按钮。这种形态稳定、清楚、适合已知目标用户，但对“我不知道有哪些能力、我想让 NextClaw 变会什么”的用户不够友好。

从 NextClaw 产品愿景看，Skill Marketplace 不只是一个下载页。它应该服务：

- 统一入口：用户通过 NextClaw 发现并接入新能力。
- 能力编排：skill 不是孤立包，而是用户目标到执行链路的一部分。
- 开箱即用：新用户进入后能快速理解 NextClaw 能扩展什么。
- 自感知与自治：后续可逐步让系统基于本地状态提示缺失能力，但第一阶段不假装已有算法。

因此，本方案的核心不是“做得像 App Store”，而是学习应用商店的信息架构：搜索、分类、精选、可信标识、详情页决策信息和更新动态。

## 3. 外部应用商店参考

### 3.1 Apple App Store

Apple 的发现体系大致由 Search、Categories、Today、Apps / Games tabs、产品详情页组成。Apple 官方说明里，Search 会利用产品页 metadata，Categories 帮助用户按主要功能浏览，Today tab 则通过编辑故事、集合、新发布、每日推荐等方式做策展式发现。

可借鉴点：

- 搜索服务明确目标用户，分类服务泛目标用户。
- Today / Discover 不是算法列表，而是编辑策展和故事化解释。
- 产品详情页强调名称、图标、简介、截图、描述、更新说明、评价等决策信息。
- 分类选择强调“用户自然会去哪里找”，这对 skill 场景分类很重要。

不宜直接照搬：

- 大面积营销化 Hero。
- 依赖评分、评论、榜单的消费型商店结构。
- 用故事内容替代操作效率。

参考：

- [Discovery on the App Store and Mac App Store](https://developer.apple.com/app-store/discoverability/)
- [Choosing a category](https://developer.apple.com/app-store/categories/)
- [Creating your product page](https://developer.apple.com/app-store/product-page/)

### 3.2 Google Play

Google Play 的官方说明把发现拆成首页/子导航浏览、搜索、详情页、编辑选择等多种入口。它也明确提到排名和组织会考虑用户相关性、体验质量、编辑价值、广告和整体用户体验。

可借鉴点：

- “相关性”和“质量”是两个不同维度。NextClaw 第一阶段可以先做人工场景相关性，不做个性化。
- 编辑价值可以是手工策展，不必等推荐算法。
- 预安装决策信息也是质量的一部分：图标、标题、截图、描述和链接都在影响用户判断。

不宜直接照搬：

- `For You` 这类个性化文案。我们目前没有推荐算法，也没有足够上下文依据。
- 广告、商业推广、下载量榜单。

参考：

- [App Discovery and Ranking - Play Console Help](https://support.google.com/googleplay/android-developer/answer/9958766?hl=en)

### 3.3 Microsoft Store

Microsoft Store 的公开文档强调主分类、子分类和可选第二分类，核心目标是帮助用户发现并理解应用。

可借鉴点：

- Skill 也需要主场景和可选次场景，而不是只靠自由 tags。
- 分类必须接近用户查找路径，不能只反映内部技术实现。
- 分类可以作为筛选入口，也可以作为货架分组依据。

参考：

- [Categories and subcategories for MSI/EXE app](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/categories-and-subcategories)

### 3.4 华为 AppGallery / 安卓厂商商店

AppGallery 对外强调分类、全球策展、安全、地区兴趣、愿望清单和本地独占活动。这类安卓厂商商店通常比 Apple / Google 更强调设备生态、区域运营和安全可信。

可借鉴点：

- 可信、安全、来源说明在扩展生态里很重要。
- 地区/设备/生态适配是货架维度之一，但 NextClaw 第一阶段可以先不做地域化。
- 愿望清单可以转译为“稍后安装/收藏”，但不是本阶段必要项。

不宜直接照搬：

- 活动、礼包、促销、游戏化运营。
- 过多地区化运营位。

参考：

- [HUAWEI AppGallery](https://consumer.huawei.com/en/mobileservices/appgallery/)

## 4. 当前约束

### 4.1 没有推荐算法

第一阶段不能使用这些文案：

- 为你推荐
- 猜你喜欢
- Personalized
- Recommended for you

可以使用这些更诚实的文案：

- 场景
- 最近更新
- 编辑选择
- NextClaw 官方
- 浏览全部

### 4.2 已有数据与接口

当前 marketplace domain 已有：

- `MarketplaceItemSummary`
- `tags`
- `author`
- `updatedAt`
- `install`

第一阶段补充最小正式契约：后端提供 skill scenes 列表，并支持 `items?scene=<scene>` 过滤。不要复用 recommendation scene 来承载静态货架，否则“上下文推荐”和“人工场景分类”会混在一起。

### 4.3 当前 UI 曾回退过过度设计

项目历史里曾把 Marketplace 做成强装饰化 App Store 风格，后来回退到更常规的信息架构。这个教训应成为本方案边界：

- 学习应用商店的信息分层，不复制消费型商店视觉。
- 不做大面积深色 Hero、不做抢占工作台空间的营销 Banner。
- 保持列表效率和安装/管理动作可见。

## 5. 方案目标

第一阶段目标：

- 让用户进入 Skill Marketplace 后能先按目标理解能力。
- 让没有明确 skill 名称的用户也能发现可安装能力。
- 保留当前完整列表作为兜底，避免货架变成新的信息限制。
- 复用后端 scene / tags / updatedAt / installed 数据，不新增推荐算法。
- 为后续个性化推荐、套装安装、详情页增强预留语义边界。

成功标准：

- 新用户能在首屏看懂“这里是在扩展 NextClaw 能力”，而不是只看到包列表。
- 老用户仍可快速搜索、排序、安装、管理。
- 官方/社区/用户发布的可信差异在卡片上更清楚。
- 没有算法时不出现伪智能推荐文案。

## 6. 细分路线

### 6.1 路线 A：人工策展货架

结构：

- 编辑选择
- 最近更新
- 按场景分类
- 全部技能

优点：

- 最接近传统应用商店。
- 需要独立策展契约；不建议复用 recommendation scenes。
- 视觉和信息结构提升明显。

缺点：

- 需要维护策展列表。
- 如果 skill 数量少或维护不及时，会显得空或过期。
- “编辑选择”和“官方精选”容易概念重复。

适合：

- 公开 marketplace 门户。
- 有明确运营维护者时。

### 6.2 路线 B：场景货架

结构：

- 场景
- 最近更新
- 全部技能

优点：

- 最符合 NextClaw 的意图到执行闭环。
- 不依赖推荐算法。
- 文案可以围绕“你想让 NextClaw 做什么”，而不是围绕包名。
- 与未来自感知推荐可以自然衔接。

缺点：

- 需要为 skill 建立更稳定的场景分类规则。
- 当前 tags 可能不够规范，需要后端治理。

适合：

- NextClaw 主产品内置 Skill Marketplace。
- 新用户和高频使用者共同使用的工作台入口。

### 6.3 路线 C：纯分类首页

结构：

- 搜索
- 分类 chips
- 分类货架
- 最近更新
- 全部技能

优点：

- 最诚实，运营负担低。
- 分类规则清楚后实现简单。
- 不需要人工精选位。

缺点：

- 缺少主观判断力。
- 体验更像目录，不像“能力入口”。

适合：

- 第一版快速低风险改造。
- skill 数量还不够多时的保守方案。

### 6.4 路线 D：状态管理货架

结构：

- 已安装
- 可更新
- 最近使用
- 安装失败可恢复
- 可能缺失的基础能力

优点：

- 工作台效率强。
- 与 NextClaw 自感知方向高度一致。

缺点：

- 发现感弱。
- 依赖更多本地状态和诊断数据。

适合：

- 第二阶段作为右侧或 Installed tab 增强。
- 与运行状态、错误恢复、更新提示结合。

## 7. 推荐路线

推荐采用路线 B，并吸收路线 A/C 的低风险元素：

```text
Skill Marketplace

[搜索框 + 类型/范围切换]

场景
开发与调试 | 浏览器自动化 | 办公协作 | 写作内容 | 本地环境 | 社交平台 | NextClaw 官方

最近更新
横向 4-6 个 skill

全部技能
当前列表形态 + 搜索/排序/安装/管理
```

这不是“首屏精选 + 官方精选”。更准确地说：

- `场景` 是导购入口，解决用户不知道从哪里开始的问题。
- `最近更新` 是数据排序，解决生态活跃感和回访问题。
- `全部技能` 是完整目录兜底，解决精确查找和管理效率。
- `NextClaw 官方` 可以作为一个 scene，也可以后续升级为来源 badge；不要在没有明确契约时同时做两套语义。

## 8. 货架定义

### 8.1 场景

推荐首批场景：

- 开发与调试
- 浏览器自动化
- 办公协作
- 写作与内容
- 本地环境
- 社交平台
- NextClaw 官方

每个场景卡片应展示：

- 场景名
- 一句话收益
- 进入模块的明确 affordance

不展示代表 skill 数量或前几个代表 skill 名称，除非后端 scenes 接口提供稳定计数或样本；前端不能用当前分页结果凑不完整数据。

点击行为：

- 第一阶段：点击场景进入子路由模块页，例如 `/skills/scenes/:scene`，展示该场景的策展结果，并在左上角提供返回上一级；不要把场景点击降级成搜索框填词或列表过滤。
- 后续阶段：子路由模块页升级为更完整的场景详情页，展示完整场景说明、组合建议和安装后使用路径。

### 8.2 最近更新

规则：

- 使用 `updatedAt` 倒序。
- 过滤未发布、隐藏、删除项。
- 已安装项可以显示 installed badge。

价值：

- 给生态活跃感。
- 帮老用户发现更新。
- 不需要算法。

### 8.4 全部技能

继续保留当前列表能力：

- 搜索
- 排序：relevance / updated
- 安装
- 已安装状态
- 卸载或管理
- 打开详情

变化：

- 列表不再承担所有发现职责。
- 完整列表应在货架之后稳定存在，避免用户找不到全集。

## 9. 卡片信息设计

普通 skill 卡片应包含：

- 图标或稳定字母头像
- 名称
- 一句话能力说明
- 场景标签
- 来源 badge：NextClaw 官方 / 用户发布 / 社区
- 安装状态：已安装 / 安装 / 正在安装
- 更新时间或最近更新提示

避免：

- 评分、评论、下载量等当前没有可信数据的字段。
- 大段描述。
- 过多装饰性渐变和营销图。

详情页后续可增强：

- 适用场景
- 示例 prompt
- 安装后从哪里调用
- 权限/风险说明
- README / SKILL.md 摘要
- 最近更新说明

## 10. 数据与治理建议

第一阶段采用最小正式契约，不做推荐算法，也不在前端维护业务映射：

- `GET /api/marketplace/skills/scenes`：返回 `{ scenes: [{ scene, title, description? }] }`。
- `GET /api/marketplace/skills/items?scene=<scene>`：按场景过滤技能。
- `scene` 是唯一场景字段；不要新增 `sceneId`、`sceneIds`、rank、reason、pinned 或关系表。
- 后端负责把 `scene` 映射到 tags 或其它检索条件；前端不能基于当前分页结果做本地 tag 聚合。
- 前端只保留以 `scene` 为 key 的视觉配置，例如图标、卡片跨度和本地化展示文案；这属于展示层，不参与筛选业务。
- 不要给 `scenes` 列表加 `type: "skill"`，因为路由本身已经表达了 skill 语义。

第一阶段可继续使用的非推荐字段：

- `updatedAt`：用于最近更新。
- `installed records`：用于已安装状态。
- `author`：可用于文案展示，但不要把它升级成信任承诺。

不要在第一阶段展示 `已验证`、评分、下载量或推荐原因，除非后端先补充明确可信契约；否则 UI 会制造不存在的数据承诺。

后续若要进入真正个性化，再新增独立语义：

- `contextualSuggestions`
- `missingCapabilities`
- `workspaceRecommended`

不要把它们混到 `recommendations` 里，避免静态策展和上下文推荐语义混淆。

## 11. 交互与布局建议

桌面端：

- 页面仍使用 `PageHeader + Tabs`，保持主产品一致性。
- 首屏不使用大 Hero，改用紧凑导购区。
- 货架横向展示 4-6 个卡片，宽屏可多列，窄屏自动换行或横向滚动。
- `全部技能` 使用现有列表卡片，保证信息密度。
- 第一阶段只改 Marketplace tab；Installed tab 继续保持管理列表，不混入发现货架。

移动/窄宽度：

- 场景入口优先显示为两列按钮或横向 chips。
- 最近更新可以横向滑动。
- 安装按钮保持可触达，不把操作藏进详情。

空状态：

- 如果某个 scene 没有 items，不显示该货架。
- 如果全部场景都为空，回退到当前完整列表。
- 如果 recommendation 接口失败，不阻塞完整列表。

## 12. 分阶段落地建议

### 阶段 1：信息架构改造

- 新增货架布局组件。
- 新增 skill scenes 列表接口。
- 在 skill items 列表接口支持 `scene` 查询。
- 前端首页按 `scenes` 接口渲染场景入口。
- 场景页通过 `/skills/scenes/:scene` 子路由进入，并请求 `items?scene=<scene>`。
- 保留当前完整列表、安装、已安装状态和详情打开链路。

不做：

- 个性化推荐。
- 评分评论。
- 套装安装。
- 复杂详情页重写。

### 阶段 2：详情页增强

- 增加适用场景、示例 prompt、安装后调用方式。
- 增强来源可信信息。
- 为 skill metadata 增加更稳定的 `useCases` / `capability` 字段。

### 阶段 3：状态感知与上下文推荐

- 基于已安装状态提示缺失基础能力。
- 基于当前 workspace / session / runtime 类型做可解释推荐。
- 明确展示推荐原因，例如“当前项目检测到飞书协作配置，因此建议安装 lark 系列”。

## 13. 需要继续讨论的问题

1. 首批场景分类是否采用上文 7 类，还是先收缩到 4-5 类？
2. Skill 卡片是否需要新增“安装后从哪里调用”的短字段？
3. `NextClaw 官方 / 用户发布 / 社区` 的 badge 是否需要后端补契约后再做？
4. 是否要同时覆盖 Plugin Marketplace，还是先只改 Skill Marketplace？

## 14. 初步结论

第一阶段应采用“场景 + 最近更新 + 全部技能”的结构。它吸收应用商店的发现机制，但不照搬消费型商店的强营销视觉；它新增最小 scene 契约，由后端负责 scene 到 tags 的映射，前端只消费 scenes 列表和 `scene` 过滤结果，不制造推荐算法已经存在的假象。

这个方向对 NextClaw 更合适：用户不是来逛商品，而是来扩展自己的个人操作层。
