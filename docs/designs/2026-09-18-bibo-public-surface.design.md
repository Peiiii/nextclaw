# Bibo 官网与域名设计：第一版可交互预览

> 状态：设计已进入本地视觉原型实现；视觉偏好待用户验收。承接[产品讨论](../thoughts/2026-09-18-bibo-hosted-companion.thought.md)。不代表托管服务已经上线。

## 目标与边界

访客从官网认识 Bibo，通过一段可操作的示例理解“同一个搭档，记得背景、持续推进、带回结果”，形成温暖、聪明、可靠的第一印象。当前交付完整响应式官网与明确标注的交互演示，不虚构在线 AI、注册、订阅或已连接的第三方服务。

官网以英文建立国际化视觉版本，提供中文切换；这是本轮可逆设计选择，不冻结市场定位。所有用户表面使用 Bibo 品牌。

## 证据

- 2026-09-18 访问 `https://bibo.bot` 返回 HTTP 200，HTML 标题仍为 `NextClaw - Your Long-Term Personal AI Partner`。
- 仓库域名总表记录该域名曾绑定 NextClaw Landing；尚未读取 Cloudflare 当前域名配置，不能由此断言全部线上拓扑。
- 已确认单一 Bibo、官方托管、品牌独立。产品账号、配额和运行服务仍未形成已验证 Bibo 入口。
- 本轮仅在 `apps/bibo-site` 新建独立静态站；不改现有 landing 或域名绑定。

## 域名规划

| 地址 | 推荐职责 | 本轮状态 |
| --- | --- | --- |
| `bibo.bot` | 公开官网、产品介绍与常见问题 | 本地原型 |
| `www.bibo.bot` | 永久重定向到根域名并保留路径 | 规划，不改 DNS |
| `app.bibo.bot` | 登录、首次认识与日常协作 | 保留规划，不虚构可用入口 |
| `bibo.bot/help` | 面向用户的帮助 | 有内容再建设 |
| `bibo.bot/privacy`、`/terms` | 与真实运营主体和数据处理一致的条款 | 上线前准备，不生成假条款 |
| `status.bibo.bot` | 独立的服务状态 | 正式服务上线时建设 |

不为尚不存在的功能预建 console、agents、cloud、docs、api 等用户入口。前端 API 的域名是后续部署决定。公开分享或可执行用户内容要单独设计隔离来源，不能因为品牌统一就继承应用登录权限。

比较：根域名直接作为登录后应用，品牌记忆最短，但公开页面、鉴权与动态工作区容易耦合；官网加 app 子域名稍多一次跳转，但公开介绍和私有协作职责稳定，可独立迭代。当前推荐后者。老用户通过清晰的打开入口直达 app，不必反复阅读官网。

## 视觉体系

视觉命题：聪明、能干、有判断力的长期搭档。用户明确纠偏：不做蠢萌角色，也不要求写实；亲近感来自清楚表达和可靠行动。采用抽象、有方向感的 Bibo 符号，与真实 HTML 工作过程并置。

- 主色为鲜明橙色，搭配近黑文字与干净浅色画布；橙色集中于身份、重点和主行动。
- 大字号紧凑无衬线标题搭配少量衬线斜体，建立编辑式层次；正文不小于 16px。
- 一张原创抽象品牌生图负责视觉记忆点，真实 HTML 任务卡负责解释产品；无萌宠、眼睛、玩偶和拟人卖萌，不把整张网页生成成图片。
- 圆角、边框、空间和按钮共享 token，留白用于区分信息层级。
- 首屏大标题与主角场景形成非对称布局，下方以叙事和产品演示交替，避免整页相同卡片。
- 动效服务状态变化和轻微入场；遵守 reduced-motion，正文无需动画才能读到。

## 页面结构

1. 顶部 Bibo 标识、工作方式、使用场景、常见问题、语言与主要体验入口。
2. 首屏：一句生活价值主张、具体能力解释、演示入口；右侧原创形象与任务结果卡。
3. 一条简洁能力带：持续记得、离开后推进、需要时找用户。
4. 可切换的三类场景演示：工作研究、生活规划、持续学习。示例数据明确标记；各场景拥有请求、处理过程与结果，用户控制步骤。
5. 长期关系说明：记得偏好、承担持续关注、用户决定边界；用具体交流呈现，少写能力名词。
6. FAQ：一个 Bibo、云端工作方式、用户控制、当前预览范围。
7. 收束到同一个体验入口与简洁品牌页脚。暂不虚构付费价格、用户数量、合作品牌、客户背书或注册成功。

## 黄金验收

### A：初次访客

打开首页 → 首屏辨认 Bibo 与核心价值 → 点击主按钮 → 到达明确标注的产品演示 → 选择场景 → 阅读请求并逐步查看过程和结果 → 更换场景后正确重置。成功标准：无需登录可体验完整示例，不能误认为刚执行了真实 AI 工作。

### B：手机阅读与导航

手机打开 → 首屏标题、主按钮和核心视觉完整可见 → 打开导航并选择场景 → 页面到达目标且菜单关闭 → FAQ 可触摸展开 → 返回顶部。成功标准：无横向溢出、遮挡、不可达控制；键盘焦点可见，菜单能用 Escape 关闭。

### C：品牌与语言

切换中文 → 导航、正文、场景和按钮一致切换 → 操作演示保持当前语义 → 刷新保留语言偏好。成功标准：无 NextClaw 用户文案、无混杂的主要交互语言、无承诺不存在的注册或云端服务。

## Owner 与实现审查

单页语义 HTML 承载内容和结构；共享 CSS token 承载视觉；一个页面 controller 管理语言、场景、步骤和菜单。无框架依赖，无后端、凭据或数据提交。演示状态独立于未来生产任务，不为未来建立抽象平台。

方案 Review：检查了演示冒充真实 AI、无后端假注册、未授权替换根域名、品牌泄漏、移动端溢出五个失败点；以明确演示标签、本地独立站和真实可用交互关闭。design-review: passed。design-document: required；plan: not-required，本批本地原型可完整交付。

## 质量收敛

验收维度：品牌辨识、表达可信、视觉层级、交互可达、桌面/移动适配。先运行真实页面并截图，再围绕最大具体差距改进；不以次数或虚构评分证明质量。完成所有必需链路且无高价值缺陷后停止；最终审美交由用户判断。

本轮不自动提交、发布或绑定正式域名。图像提示词、检查结果与必要的迭代证据追加到本文件。

## 实现与验收记录

### 第二轮：保留候选，重做辨识与交互

最新交付约束覆盖下文初稿的切换与共享部署描述：用户要求三个独立网站、三份独立代码、三个端口，不要站内切换。A 位于 `apps/bibo-site`（4178），B 位于 `apps/bibo-sprite-site`（4179），C 位于 `apps/bibo-navigator-site`（4180）。B/C 各自持有完整 HTML/CSS/controller，无跨目录运行依赖；相同示例数据有意保留于各候选，便于独立评估与后续独立演化。

用户要求所有候选代码和素材保留。A 保留原页面与 PNG，无比较入口；B「行动精灵」采用暖白、橙色、有前掠翼轮廓的灵巧角色，点任务后角色接单并交回具体结果；C「任务领航员」采用深墨、青柠、几何风帆角色和任务台，强调沉着与清晰。候选是两条真实视觉方向，不将换色算作新方案。角色采用可动画的原生 SVG，避免再次依赖难以辨认的抽象渲染。

首屏必须明确个人 AI 搭档、官方云端托管、查资料/做计划/持续跟进，并在首屏给出可操作任务。趣味以回应、注视和完成任务的运动构成，不把眨眼当作全部身份。形状在单色和小尺寸仍应保留各自轮廓。当前仅中文候选，A 保留双语。

黄金验收：三个端口分别打开 A/B/C，代码独立且 A 无内容丢失，页面无候选切换；在 B/C 点击任务→即时接单→不超过两秒交回示例结果→切另一任务结果随之变化；快速切换以最后一次为准、重置取消待完成状态；手机与键盘可操作，减少动态效果时保留静态结果。示例显式标注，不能冒充真实云端服务。B/C 各自由单一 controller 管理页面状态；不建设后端。design-review: passed，检查了候选覆盖、明确定位、可控动效、演示真实性与异步竞态；plan: not-required，单批闭环。

第二轮验收结果：B/C 均在真实浏览器走完研究、周末、跟进的示例结果；B 连续点击研究→跟进，最终显示跟进结果；C 运行中重置后仍保持 idle，无旧结果回写。B 角色打招呼与任务按钮用 Enter 触发成功。B 1440px / 360px、C 桌面 / 390px / 360px 实际渲染，窄屏 scrollWidth 与视口相等。角色也用于页头、页脚与 favicon；调整 C 的眼睛，避免横线造成困倦印象。没有自动循环装饰动画，动效由用户操作触发，减少动态效果通过 CSS 和 matchMedia 分支静态审查，未改变操作系统设置进行实测。

JS syntax 与定向 ESLint 通过；维护性工具仍因 dist 路径报告不适用，人工复核了定时器取消、快速切换、文本安全写入、独立资源链接和非真实服务标识，无阻断项。三份代码按用户要求各自保留，不合并公共运行依赖。A 本轮未修改。没有新的 TypeScript 产物，未执行 tsc；没有部署、提交或推送。视觉偏好仍待用户比较，不能宣称主观上“没有毛病”。复盘落在此设计 owner：品牌必须同时通过“是谁、做什么、如何一起做”的可理解性检查，不能用材质与高级感代替产品表达；本次独立网站约束是本任务偏好，不扩大为全局规则。

落地位置：`apps/bibo-site/dist`，静态 HTML、CSS 与单一页面 controller；本地预览 `http://127.0.0.1:4178/`。本批是独立官网概念原型，无 NextClaw 用户功能变化，因此不修改 NextClaw 文档站、不添加 changeset；不提供 CLI。未接入账号、真实 AI、付费或云端执行。

用户纠偏已纳入品牌 owner：Bibo 应显得能干、有判断力，不能以蠢萌作为品牌中心；不要求写实。舍弃首版角色图，改为橙色背景中的抽象立体 b 符号；首屏通过目标与结果卡表达行动力。该经验属于本产品设计事实，不新增通用规则。

实际验证：桌面 1280px、中英文手机 390px / 英文窄屏 360px 正常渲染；三个场景均走完请求、推进、结果，切换场景重置步骤；键盘方向键可切换，中文刷新保留；手机菜单 Escape 关闭、导航后收起；FAQ 展开显示真实预览边界。修正 360px 英文场景按钮造成的横向溢出，复验页面 scrollWidth 等于 360；提高橙色图片底部注释对比度。浏览器未捕获 error 日志。JS 语法检查及定向 ESLint no-undef / no-unused-vars 通过。

实现 Review：执行 diff-only maintainability 检查，工具因 dist 路径判定不适用；补充人工检查 controller 的单一状态归属、静态数据渲染、事件与菜单关闭路径，未发现阻断问题。文件已经格式化。没有 TypeScript 产物，不适用 tsc。审美偏好由用户看实页确认；未验证真实云端能力，也未部署正式域名。

## 主视觉素材

### 整体设计跃迁批次

第二轮：frame 同时驱动整页主标题与昼夜氛围，四幕采用来信、筛选、守候、回执的不同图形，贯穿同一背景纸条与紫色角色。减少动态效果直接切换，无自动播放、无新增长页。验收四帧视觉/对比度、回退恢复标题及颜色、手机可读；design-review: passed。

用户纠偏：前三轮局部修复不能满足“更惊艳”的目标。本批采用整页互动海报：大字号“交给我，你去忙”、奶油/紫/青柠集中对比、平面角色双手搭相机，统一品牌和示例场景。沿原 controller，保留无真实 AI 声明；不用长页、写实硬件或多版本切换。首轮整体构图，后续依据实页评估故事场景及角色参与，逐轮记录在 v0.56.4 日志。黄金验收：第一眼读懂云端搭档→点击/滑动相机→四帧连续故事→回看与重播；手机角色/文字/操作完整，减少动态效果可完成。design-review: passed；plan: not-required。

### Loop 第二批：连续键盘操作

第三轮把末帧结果由泛泛的“建议看看首次引导”改为静态示例的具体变化（3 步引导）、小团队首发关联和“先跑通，再加功能”的建议；移除不是真实链接的 ↗。来源卡关键词同步。原示例披露保持，360px 字数与布局验收，不声称用户理解率已经改善。design-review: passed；plan: not-required。

第二轮采用手机画面横滑翻帧：40px、水平主导、700ms 内；纵向滚动与缩放保留。兼容点击去重，pointercancel 放弃，原 exposing 防重入，右滑首帧不动，左滑末帧重播；键鼠入口不变。与增加一排导航按钮相比，无新增平铺内容且复用已有方向动画。验收真实触控前进/回看/取消/纵向滚动、不双跳、减少动态效果；design-review: passed，plan: not-required。

快门原生 disabled 会丢焦点，导致 Enter 后方向键失效。过渡时用 aria-disabled 表达忙碌，由既有 exposing 守卫阻止重入；仅首帧上一帧保留原生 disabled。验收：Enter 后焦点仍在原按钮→方向键继续，连续快速按键只推进一次；减少动态效果直接推进。原 controller 单一状态，design-review: passed，plan: not-required。

### Loop 首批：移动端首屏入口

线上 360×740 快门底部为 785px，且手机隐藏动作标签。采用局部响应式修正：减少标题区空白，保留角色完整轮廓、原故事正文和既有动画；画面底部明确轻点继续。放弃缩小整台相机（降低文字可读性）与增加悬浮操作条（产生第二操作区）。黄金验收：手机打开无需滚动看到完整快门→轻点画面推进四帧→回退→末帧重播；所有内容无遮挡，桌面布局保持。角色、字号与主体叙事不重做。单 CSS owner 和原 controller，design-review: passed；plan: not-required。

### G：Bibo 搭档相机（第五轮）

整体设计实验第三轮：首帧纸条可用鼠标拖给角色，松手命中角色才推进；拖错或 Escape 回到原位。快门、点击画面、键盘和角色按钮提供等价入口，递交纸条朝角色收拢，移动端继续轻点/滑动。只扩展现有帧 controller，拖动临时对象在取消、页面隐藏和完成时清理；用户无需拖动即可体验。design-review: passed；验收见本批第三轮日志。

切帧优化：用户认可结构，要求更友好、更有创意的动画。原黑色遮幕替换为 Bibo 拨片：眼神和手先朝方向运动，内容轻移淡出（160ms），新内容从另一侧落位（440ms），背景与持续纸条自然过渡；向后方向相反，末帧重播仍向前。总时长 600ms，期间避免重入，减少动态效果立即切换。四段细进度带说明当前位置。验收覆盖前进/回退/重播、连续操作、页面恢复、手机与减少动态效果静态分支。单 owner 复用现有帧模型和计时器，design-review: passed；plan: not-required。

拨片动画验证：真实浏览器前进到第二帧、回退第一帧、390px Enter 切帧可完成；动画结束恢复按钮且无控制台 error。初始页面加载可能与工具的即时输入交叠，收紧 pageshow 恢复仅处理 persisted 页面，避免普通加载重置交互；页面隐藏取消 Web Animations 与计时器。旧遮幕已删除。定向 ESLint 通过，维护性工具仍对 dist 不适用；人工复查了方向、锁、清理与减少动态效果分支。动效喜好仍需用户直接体验确认。

用户认可 E 的紫色平面形象，要求完整可见；否定其它部分，提出角色用两只小手扒住模拟视频/相机边缘、逐帧展示搭档感。新建 `apps/bibo-camera-site`（4184），保留 A-F。采用一台平面取景器与四个手动快门瞬间，同一请求、背景纸条与信息节点在取景器中连续改变，不增加长页模块。

主链路：打开看到完整紫色角色与两手搭框→按快门→从随口交代到结合背景查资料→按快门→用户离开、Bibo 继续关注→按快门→只带回相关变化→重看/返回上一帧。每帧最多一个主意思，保留明确个人 AI 身份与示例标记；静态预设不是实时 AI。角色注视指针，按快门时眨眼与轻微探身，减少动态效果立即切换。不用真实视频、相机权限、音效或写实硬件。状态 owner 为页面 controller，只有 frame 索引与拍摄过渡标志；重复按键期间锁定，支持方向键、原生按钮与 dialog。

design-review: passed；plan: not-required。验收：四帧与计数一致、首次返回禁用、末帧重看、过渡重入不跳帧、角色与手完整可见、360px/桌面可读无遮挡、键盘与弹窗焦点正确。审美验收交用户，旧版不覆盖。

G 验收记录：1280×900 首屏与四帧、360×800 首帧/研究/结果的真实浏览器检查；点击快门、点击画面、Enter 与右方向键推进，上一帧返回、末帧重看和 dialog Escape 返回焦点均验证。窄屏 scrollWidth=360，手部横向边界均在视口内；发现研究卡片关键词互相遮挡后改成三张窄卡并列。切换期间由 exposing 锁定，两个计时器分别负责遮幕中换帧、结束后恢复按钮；pagehide 清计时器，pageshow 恢复可操作状态。定向 ESLint、JS syntax 通过，浏览器无 error；维护性脚本对 dist 不适用，人工审查状态、异步锁与屏幕阅读器当前帧可见性。减少动态效果仅静态分支审查，未切系统偏好实测。本轮不改变旧候选、不提交、不部署。视觉方向待用户验收，不能把交互检查等同于品牌审美通过。

### E/F：单场景的数字搭档（第四轮）

用户否定写实机械角色、选择题演示与文档/PPT 式平铺信息。新增两个独立静态站：E `bibo-edge-site` 4182，奶油黄/紫色、角色从边缘探头；F `bibo-orbit-site` 4183，深夜蓝/冰蓝、中心数字生物与关注空间。A-D 原样保留。原生可变形几何角色是交互界面本体，不使用硬件材质和写实插画。两者都只有一个持续场景，无功能卡片、长介绍和分屏卖点。

体验：首次看见身份和一句核心价值→鼠标或触摸唤起角色回应→点击唯一体验按钮，把预设跟进任务交出去→角色退到边缘/收拢，场景暂时安静→2 秒后携带一条明确标注的示例更新回来→可收下或重来。次级说明用原生 dialog 按需展开，支持 Escape 和焦点返回。pointer-follow 不影响点击目标与文本阅读；减少动态效果静止呈现状态。每站独立 HTML/CSS/controller，单一状态 owner，无后台和数据收集。

design-review: passed；plan: not-required。验收：两站 360px 与桌面无溢出、角色点击/键盘/触控均可到达、等待有可见状态、取消清定时器、结果不冒充真实执行、弹窗关闭回焦点、旧站不变。重点由用户判断两种整体感知与角色偏好，不以功能测试代替审美。

E/F 实测：桌面初始场景、任务等待到示例返回、收下后恢复、取消、原生 dialog 的 Escape 关闭与焦点返回均走通；360px 检查发现 E 角色/气泡遮挡正文、F 气泡压住副标题，调整尺寸和位置后截图复验。窄屏无横向溢出，F Enter 打招呼有效。两份 controller 定向 ESLint 通过；maintainability 对 dist 不适用，人工检查定时器、独立资源、DOM 安全写入和状态 owner。减少动态效果已提供代码分支，未实测操作系统设置。仍为平面几何形体的交互概念，品牌独创性和审美偏好待用户评估；不宣称与既有品牌无相似性。A-D 不改，E/F 分别保留独立代码与端口，没有站内版本切换。

### D：思绪工作桌（第三轮）

保留 A/B/C 全部产物，D 独立目录 `apps/bibo-workshop-site`、端口 4181。问题不是配色，而是缺少可以记住的协作瞬间。比较迎宾角色、任务巡逻和思绪工作桌后选择后者：访客选择散落念头→交给 Bibo→卡片收拢→同一批念头按现在行动、持续关注、需要决定组织成结果；可修改选择并重做。不是任意文本智能解析，不冒充真实 AI。

形象采用原创蓝色夹持式机械精灵，轮廓与收拢纸片有关；概念图用 imagegen 内置工具生成，网页动作由控制器驱动。布局用整幅蓝色工作桌承载角色、任务卡与整理结果，放弃左右分栏聊天框。首屏清楚说明个人 AI、云端托管、具体用途与预览边界。风险 L2；单页独立 controller 为选择与整理状态唯一 owner，无后台、存储、外部提交。

落地与自评：首轮截图发现首屏引导过长，把互动推到页面下方；压缩头部与标题留白。修正隐藏属性被布局样式覆盖的风险，并让收拢动作只作用于已选纸片。真实浏览器验证空选禁用与提示、Enter 选择、单项结果、四项结果、重新摊开、Escape 取消、390px 无横向溢出。返回选择时把焦点移到整理按钮，避免焦点停在隐藏节点。控制台无 error；定向 ESLint 与 JS syntax 通过，维护性工具对 dist 不适用，已人工检查选中集合、定时器取消、结果渲染与独立资源引用。减少动态效果为 CSS/matchMedia 分支静态审查，未做系统设置切换。无 TS 产物，未执行 tsc。

停止理由：已从“角色贴在对话框上”推进到“同一桌面里的输入、收拢、结果”，核心状态与可达性有证据；角色是否足够巧妙和喜欢，是下一步用户比较项，不以自评分宣称审美通过。A/B/C 未触碰；D 未提交、未部署。复盘只更新本设计 owner，不增加全局规则。

生成素材：`apps/bibo-workshop-site/dist/bibo.png`，使用内置 imagegen，透明背景角色。提示词：

> Use case: stylized-concept. Create one original brand character cutout for Bibo, a competent personal AI helper, isolated on a truly transparent background. Full compact character, 3/4 front view, no scene no letters no text. Memorable industrial character design: a small cobalt-blue spring-loaded binder creature, its body a thick sculptural inverted U arch with two asymmetrical short gripping feet and a continuous open space under the arch. Its purpose is to gather scattered thoughts. A wide dark inset face panel at the upper curved bridge has two small alert warm-white rectangular eyes, one subtly raised. Two thin folded mechanical arms extend forward, gently holding one tiny blank pale-yellow paper slip. Intelligent attentive posture leaning forward, strong clear contour. No big cute eyes, no smiley mouth, no human head, no antenna, no humanoid robot, no Baymax, no animal ears, no plastic toy baby proportions. Editorial 3D character art with tactile matte blue enamel, crisp slightly imperfect crafted edges, subtle shaded dimension, warm white eye glow only, high design quality, restrained playful personality, not photorealistic. Large subject centered with generous transparent margins. No background shadow plane. It should feel like a useful little living desk tool with real intent, not a generic chatbot blob.

验收：首屏理解产品身份→选一到四个念头→点击整理→1.2 秒内看到包含所选项的具体下一步→重新摊开保留选择；空选给出明确提示、禁用整理；处理时禁止改变选择，重置取消 pending；键盘与手机可用、减少动态效果立即呈现结果；A/B/C 无改动。design-review: passed，检查范围、可理解性、演示真实性、定时器取消与可达入口。plan: not-required。质量重点：角色轮廓、协作瞬间、内容清楚、真实行为，审美仍交用户判断。

成品：`apps/bibo-site/dist/bibo-companion.png`。AI 生成概念视觉，不是真实产品截图。

生成提示词：

> Use case: ads-marketing. One sophisticated abstract brand key visual for Bibo, an exceptionally capable personal AI partner. User direction: competent, intelligent, purposeful, NOT cute, NOT naive, NOT mascot, NOT realistic photography. Create a bold editorial illustration / dimensional graphic, landscape 3:2. A single oversized clean sculptural lowercase b-like ribbon monogram made from warm ivory folded continuous material. Confident crisp geometry, forward leaning energy, beautiful deep shadows and subtle print grain. Monogram floats diagonally center-right over a vivid vermilion orange field with darker orange architectural curved bands and restrained concentric embossed arcs suggesting clear focus and organized motion. Limited palette burnt orange, ivory, deep ink. Swiss graphic design meets contemporary editorial art, collectible design studio aesthetic. Strong silhouette, asymmetric composition, absolutely no face, eyes, limbs, toy, animal, character, chrome, robot, neon, stars, text blocks or UI. Upper left and lower quarter remain relatively clear for live HTML task cards. No legible typography except the abstract b-shaped form. The impression must be calm intelligence and ability to deliver important work, not domestic cuteness.
