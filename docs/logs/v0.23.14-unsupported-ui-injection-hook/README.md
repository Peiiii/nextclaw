# v0.23.14 不受支持的 UI 注入口与 Skin Studio

## 迭代完成说明

- NextClaw UI 在 React 应用启动前请求 `/api/ui-inject.js`；server 从活动 `$NEXTCLAW_HOME` 读取 `ui-inject.js`，不存在时返回空脚本，存在时返回最新内容，响应固定为 `Cache-Control: no-store`。
- 产品主干只保留一个不受支持的同源 JavaScript 逃生口，没有增加皮肤 CLI、设置页、manifest、数据库、浏览器扩展或兼容层。写入、切换或删除脚本后刷新即可生效，不需要重启 NextClaw。
- 原单皮肤 Skill `@nextclaw/abyssal-compass-theme` 已由通用 `@nextclaw/nextclaw-skin-studio` 替代并从公开 Marketplace 下架。Skin Studio 提供 `list/status/apply/custom/create-project/apply-project/remove`、本地图片嵌入、未知 owner 冲突保护和旧 Abyssal marker 迁移。
- 新 Skill 已发布到 Marketplace；公开详情为 `install.kind=marketplace`，旧 Skill 详情为 `404`、搜索为零结果。新 Skill 位于“最近发布”首位。
- 设计文档已更新为“一处官方注入口 + 一个通用 Skill”的最终方案：`docs/designs/2026-07-16-unsupported-ui-injection-hook.design.md`。

### 上游皮肤失真问题的根因与修复

- 用户可见现象：初版目录只有六款原创几何皮肤，原仓库最有辨识度的易烊千玺、桥本有菜、迪丽热巴、初音未来、KUN、Jinx、ENFP 等人物主题全部缺失。
- 根因通过上游全历史和逐图审计确认：实现只读取了当前 README 的抽象描述，没有固定源版本、没有追踪 `7777e9f` 中的历史人物标签、没有建立逐项视觉 fidelity matrix；随后又未经用户确认把“高保真迁移”错误改写成“规避第三方素材的原创配色灵感”。当前上游还重排了画廊路径，易烊千玺从历史 `skin-02`/`skin-08` 移到当前 `skin-04`，只看文件名更容易漏项。
- 修复把 `skins.json` 改为固定上游 commit 的 11 项目录，易烊千玺排在首项；每项记录真实路径、当前/历史标签、素材类型和 SHA-256。应用时只下载用户选择的一张固定上游图片，校验后嵌入本地 `ui-inject.js`；下载或哈希失败直接报错，不回退为抽象图形。
- Marketplace 包不二次打包肖像/IP 图片；人物与角色来源、非背书和不属于上游 MIT 软件许可的边界在 Skill、市场文案和 notices 中同时披露。
- `code-investigation-workflow`、`nextclaw-marketplace-skill-integration` 与 `nextclaw-validation-workflow` 已增加外部目录高保真迁移规则，后续必须固定源版本、逐项对照高辨识度内容并逐款做真实整页截图。

### 全产品皮肤覆盖与运行态修复

- 用户可见现象：早期版本主要改变背景和少量卡片，真实会话、侧边栏、设置、弹层、代码和过程信息仍大量保留默认外观；会话行还同时给外层容器和内部按钮加背景，hover 时出现两层圆角胶囊。
- 根因不是缺少几个 CSS selector，而是把皮肤误建模为背景图，没有设计 token、语义表面、组件状态、页面配方和独立素材五层合同，也没有使用真实本地数据建立组件覆盖台账。
- 共享 `renderer.js` 现由单一 `SkinRuntime` 负责动态语义标记，覆盖应用壳、侧边栏、导航、会话列表、真实消息、头像、代码块、工具过程、输入器、技能市场卡片、设置表单、选择器、开关、标签页、弹层、提示、骨架与加载态；SPA 跳转、懒加载和弹层挂载后会重新识别。
- 会话行已收敛为唯一外层视觉 owner：内部整行按钮保持透明、无边框、无圆角、无阴影，外层统一表达 hover / selected，并用单一渐变色带增强反馈，不再生成双层容器。
- 原生转圈加载图标由皮肤运行时替换为低饱和、轻微墨边扰动的写意墨焰：未闭合圆势末端汇成双叉火尾，以游龙意象而非具象龙头完成 2.35 秒匀速 360°；不缩放、不发光、不闪珠，`prefers-reduced-motion` 下停止运动。
- 初版语义扫描每 250ms 先删除所有角色再重加，导致龙的 CSS animation 不断回到第 0 帧，看起来像卡顿鬼畜。运行时现改为差量目标集合，只清理真正失效的节点；连续采样 520ms 与 2570ms 时角色保持不变、旋转矩阵持续推进并跨过完整周期。
- 首页 header 原先单独使用 94% 不透明面板，把人物背景在 52px 高度处硬切开。背景 owner 已下沉到同时包含 header 与内容的 page section，人物画布从顶部贯穿页面；header 改为透明且无边框/阴影/模糊，并删除顶部固定主题胶囊，保留更简约的整体画面。
- 真实会话的人物层原先只有右上角 `47% × 330px`，第一条消息后立即回到空白底色。会话画布现改为 page section 的全尺寸 `inset: 0` 底层，人物尺寸按视口高度约束并从 Header 延伸到输入器后方；左侧阅读区由整页渐变保护，底部通过 mask 自然淡出，不再出现插画窗口边界。
- Jinx 原图约 3.2 MB，直接写入 CSS 自定义属性时浏览器会静默丢弃整个 declaration。渲染器改为把内嵌 base64 同步转成 Blob URL、统一回收对象 URL，保留单文件和离线合同的同时让大图正常显示。
- 迪丽热巴、初音未来、KUN、Jinx、ENFP、财神和粉系概念图分别校准人像焦点、缩放与纵向位置，不再复用一组会把人脸裁出视口的参数；People AI 仅保留上半部科幻景观，提前淡出概念图内的假卡片。
- 新增仓库内临时 `replicating-reference-skins` 验收 Skill，把真实数据、组件族、状态矩阵、页面巡检、稳定预览和禁止假 UI 固化为可重复执行的门槛。
- 复盘时发现临时 Skill 曾错误写成“每轮先清理旧标记”，会诱导后续实现重新制造动画重启。规则已修正为按本轮目标集合差量清理，并新增整页共同画布、实际 CSS 像素、跨完整周期和 DOM 身份连续性的强制验收门。
- Marketplace Skill 现自带 `skin-authoring-and-repair-guide.md`，并增加独立个人皮肤工程：用户源码保存在 Skill 目录之外，`skin.css` 与 `skin.js` 可以原样植入任意 CSS、同源 JavaScript、DOM/SVG、布局和动效。Skill 不提供扩展 API 或组件白名单，只负责创建工程、静态语法检查、资源内嵌和原子应用；Marketplace 更新不会覆盖个人源码。指南仍用真实数据、稳定预览和全产品覆盖图帮助 Agent 把“消息、侧边栏、工具展示、输入面板或任何可见区域不对”的反馈落实成真实效果，而不是补丁生成的 `ui-inject.js`。
- 后续对照确认，用户引用的 Jackson Yee 侧边栏来自上游标注为“不可直接导入”的概念效果图；但真实上游运行时仍有整窗沉浸、装饰 chrome、粒子和原生控件深度改造。此前实现虽然 selector 覆盖较多，视觉上仍是默认 NextClaw 统一换色，缺少参考设计的信息分组、装饰密度、图标语言和页面叙事。
- 概念图类皮肤现增加专用艺术指导层：真实会话侧边栏拆出品牌、新任务、搜索、主导航、会话标题、日期分组、真实会话行和底部区语义；不伪造概念图中的项目、任务或身份数据。会话 hover 改为单层扁平编辑感，选中态、日期虚线、图标符号、签名、主题铭牌、印章、粒子、页面纹理和输入器细节共同形成一套完整视觉体系；设置侧栏按真实结构隔离，不误套会话专属配方。

### Marketplace 列表异常的根因与修复

- 用户可见现象：全部 Skill 首屏显示 `31 / 36`，滚动到底仍停在 31；继续加载末页时出现 `unsupported skill install kind from marketplace api: builtin`，新发布的 Skill 也没有稳定出现在“最近发布”。
- 根因通过端到端证据确认：官方目录曾残留 5 条历史 `builtin` 记录；国内镜像又以未经规范化的原始 query string 作为永久缓存键，导致同一请求因参数顺序不同命中多份、永不过期且总数不同的快照。UI 的“最近发布”同时错误地从相关性首屏做本地排序，而 `31 / 36` 混用了“已加载数”和“服务端总数”。
- 官方 Marketplace 已清理历史公开 `builtin` 和旧单皮肤 Skill；Worker 公共查询增加 `install_kind = 'marketplace'` 约束，防止非商品记录再次进入公共目录。
- 国内镜像对 query 参数排序后再生成缓存键，默认 TTL 为 10 分钟，过期优先刷新，仅在源站失败时 `stale-if-error`；NextClaw server 额外识别超过 20 分钟的国内快照并回退官方源。
- NextClaw server 保持历史 `builtin` 读取兼容，单条旧记录不再让整个分页失败；未知安装类型仍明确报错。
- UI 的“最近发布”改为独立 `sort=updated&pageSize=6` 查询；全部目录只显示服务端总数，窗口聚焦、重连、重新挂载和无搜索状态下的 30 秒轮询都会刷新目录。
- 这组修复处理了事实源、缓存新鲜度、公共数据合同和 UI 查询语义四层根因，而不是只吞掉末页异常。

## 测试/验证/验收方式

- 镜像缓存单测：`python3 -m unittest scripts/deploy/nextclaw-net-marketplace-mirror/marketplace-mirror-server-test.py`，5/5 通过；覆盖 query 参数顺序归一化、fresh hit、stale refresh、stale-if-error 和首次 miss 失败。
- Marketplace server 定向测试：`pnpm -C packages/nextclaw-server exec vitest run src/app/router.marketplace-content.test.ts`，7/7 通过；覆盖历史 `builtin` 兼容、国内源优先、陈旧镜像回退和未知安装类型拒绝。
- Server 全量测试：首次在受限沙箱中因 127.0.0.1 监听被系统拒绝而出现 `EPERM`；按真实需求在允许本机端口的环境复跑后，29/29 个测试文件通过，143 个测试通过、2 个跳过。
- Marketplace UI 定向测试：`pnpm -C packages/nextclaw-ui exec vitest run src/features/marketplace`，7 个测试文件、26/26 通过；覆盖独立最近发布查询、刷新策略、总数表达、分页和页面行为。
- UI 全量测试另有 9 个失败，全部位于当前工作区其它聊天改动触达的 3 个测试文件：4 个 `session-conversation-input.streaming` 和 4 个 `chat-conversation-welcome` 因缺少 `QueryClientProvider`，1 个 `chat-session-workspace-panel` 因查询键预期未同步。它们不经过 Marketplace 代码，未在本批次擅自修改；本批次 Marketplace 定向套件仍为 26/26。
- Skin Studio 修正后测试：`node --test tests/skills/nextclaw-skin-studio.test.mjs`，9/9 通过；除 11 款目录、内置应用/定制、未知 owner 保护、旧 Skill 迁移/移除和错误哈希外，新增覆盖个人工程创建、任意 CSS/JavaScript 与本地图片打包、工程路径不泄露、无扩展 API，以及 JavaScript 语法错误时逐字节保留当前活动注入。
- 11 款生成矩阵：固定上游回装副本依次应用 `jackson-yee`、`arina-hashimoto`、`dilraba-violet`、`miku-cyan`、`kun-noir`、`jinx-pop`、`enfp-spark`、`people-ai-red`、`god-of-wealth`、`pink-custom` 与 `gothic-void-crusade`，每次生成的完整 `ui-inject.js` 均通过 `node --check`。
- 真实数据会话验收：源码实例直接使用 `/Users/peiwang/.nextclaw`，只隔离运行态；同一会话页识别 134 个真实会话项，当前会话包含 8 条消息布局、4 条用户消息、4 条助手消息、2 个代码块和 4 个工具过程，无横向溢出。134 个外层 `session-item` 与 134 个透明 `session-content` 一一对应，旧 `session-row` 为 0，选中项只有一个外层视觉表面。
- 跨页面浏览器验收：技能市场真实数据加载后有 26 张可见卡片、4 个集合区、搜索、select 和 2 个 tab；外观设置页识别 2 个 choice、2 个 select、1 个 switch 和 1 个设置分组；真实下拉弹层识别 9 个 option、1 个 selected，三页均无横向溢出。
- 响应式验收：Playwright 以 `390×844` 打开同一真实会话，`scrollWidth=clientWidth=390`、无横向溢出、侧边栏正确收起、header 保持透明；截图为 `/tmp/nextclaw-skin-narrow-final.png`。
- 写意墨焰运行态验收：专用会话列表证明页在 520ms 与跨周期采样点持续保留 `run-indicator`，旋转矩阵持续推进并越过完整 2.35 秒周期，没有被 250ms 语义扫描重置；30px 实际尺寸仍能辨认墨环末端的深色火尾。
- 首页整体画布验收：header 计算样式为透明背景、0 边框、无阴影、无 backdrop filter；人物与渐变由包含 header 和内容的 720px 高 page section 统一承载，固定主题 badge 已不存在。
- 真实会话整页画布验收：运行态 page 为 `944×720`，人物伪层同为 `944×720` 且 `inset=0`，背景尺寸为 `auto 820px`；header 透明、输入器仍在同一画布上，页面横向溢出为 0。
- 上游实物校验：使用 `/tmp/codex-dream-skin-audit` 的固定 commit 作为 `--source-dir` 应用 `jackson-yee`，脚本校验真实 `skin-04.jpg` 后生成 196,528 字节注入文件，状态返回 `skinId=jackson-yee`、`skinName=易烊千玺 · 清透定制`。
- `node --check` 已覆盖 `skin.mjs`、`renderer.js` 与四个 `*-styles.js`：通过。
- `pnpm -C packages/nextclaw-server tsc`、`pnpm -C packages/nextclaw-ui tsc`、`pnpm -C workers/marketplace-api tsc`：通过。
- `pnpm -C packages/nextclaw-server lint`、`pnpm -C packages/nextclaw-ui lint`、`pnpm -C workers/marketplace-api lint`：通过；server 8 条、UI 1 条均为既有 warning，0 error；Worker 0 warning、0 error。
- `pnpm -C packages/nextclaw-server build`、`pnpm -C packages/nextclaw-ui build`、`pnpm -C workers/marketplace-api build`：通过；构建输出只有既有依赖和 bundle size warning。
- Marketplace Skill validator：`python3 .agents/skills/marketplace-skill-publisher/scripts/validate_marketplace_skill.py --skill-dir skills/nextclaw-skin-studio`，0 error、0 warning。
- 初版曾从正式 Marketplace 全新安装到仓库外临时目录，并完成当时六款抽象预设的应用矩阵；这只能证明脚本机制可用，不能证明与源仓库视觉对齐，已被后续 fidelity 验收取代。
- 初版曾在隔离源码实例显示 Violet Orbit 与 Noir Gold；这两款不是源仓库真实人物皮肤，不再作为修正版视觉验收证据。
- 最终 Marketplace 浏览器终态验收使用隔离源码实例，不只验证 API/首屏：滚动到 `atBottom=true`，`scrollTop=1945`、`scrollHeight=2526`、`clientHeight=582`；总数 32、唯一卡片 32、首项为 `@nextclaw/nextclaw-skin-studio`、末项为 `@nextclaw/bird`，无旧 Skill、无 `builtin`、无错误、无残留 loading。
- 公网镜像修复文件已通过远程语法与 SHA-256 校验并安全暂存；当前服务保持 `active`，尚未替换或重启。
- 官方公共 API 终态复核：新 Skill 详情 200、双语 summary 和 `install.kind=marketplace` 正确；旧 Skill 详情 404；最近更新总数 32 且新 Skill 排第一；全部目录一次取回 32 条且 `builtin` 为 0。
- 本轮整页画布与墨焰更新已再次发布到正式 Marketplace：详情接口更新时间为 `2026-07-19T04:09:56.131Z`，文件清单为 11 个且包含四个 `*-styles.js`。从仓库外全新目录安装后，11 款目录、六个 JavaScript 文件语法、易烊千玺应用和生成文件中的全画布/30px 墨焰合同均通过。
- 个人皮肤工程更新已发布到正式 Marketplace：详情接口更新时间为 `2026-07-19T05:20:31.258Z`，最近更新列表中排第一；仓库外安装得到 13 个文件，与本地发布源排除安装元数据后逐字节一致。使用回装副本应用同一个个人工程后，生成的 `ui-inject.js` 与本地副本 SHA-256 同为 `284edc87cfb010c8d69971fe1a3e1335eceb9383a23041bd718fd395c345022c`。
- 真实浏览器执行证明：个人 JavaScript 成功写入 `data-runtime-project=executed` 并创建真实 DOM；个人 CSS 的计算结果为 `width: 73px`、`color: rgb(1, 2, 3)`；共享按钮语义角色仍为 `button`、控制台无 warning/error，且页面不存在 `__NEXTCLAW_SKIN_PROJECT_API__`。
- Jackson 艺术指导层运行态验收继续使用 `/Users/peiwang/.nextclaw` 的 134 条真实会话：4 个日期分组、会话行宽 253px，行内、会话滚动区和整页横向溢出均为 0；滚动到 `scrollTop=1880` 时 134 条会话与 4 个分组角色保持完整。首页、技能市场、模型设置和真实会话四页均加载装饰 chrome，控制台 0 error；设置页不会生成任何会话专属 `sidebar-*` 角色。
- 本轮 Marketplace 更新后详情接口返回 200、`install.kind=marketplace`、更新时间 `2026-07-19T06:04:03.162Z`。仓库外回装得到 15 个发布文件和 1 个安装元数据文件，与本地源排除安装元数据后逐字节一致；回装副本成功应用 `jackson-yee`，生成注入通过 `node --check`，且包含六层样式工厂、概念粒子和会话分组合同。

## 发布/部署方式

- Marketplace Skill `@nextclaw/nextclaw-skin-studio` 已发布；旧 `@nextclaw/abyssal-compass-theme` 已从公开目录下架。
- 个人皮肤工程能力已通过同一 Marketplace 条目的 `skills update` 更新，不需要发布新的 Skill 或增加产品部署；用户更新/重新安装 Skill 后即可使用 `create-project` 与 `apply-project`。
- Jackson 艺术指导增强已通过同一 Marketplace 条目再次执行 `skills update`；本轮只更新 Skill 文件，不发布 NextClaw 主产品、不重启线上服务。
- 官方 Marketplace 当前公开目录为 32 条，新 Skill 位于最近发布首位，旧 Skill 详情为 404。
- Worker 查询约束的源码、类型、lint 和 build 已通过；当前环境没有 `CLOUDFLARE_API_TOKEN`，尚未部署 Worker。现有公开数据已通过历史记录清理恢复正确，长期防回归仍需后续 Worker 部署。
- 国内镜像修复已暂存至 ECS，替换活动文件和服务短重启需要用户知情许可；在许可前没有改动线上运行服务。
- 本次没有执行 NextClaw NPM 发布或 GitHub release。后续统一发布时由 changeset 驱动 `@nextclaw/server`、`@nextclaw/ui` 与 `nextclaw` patch 版本。
- 不涉及数据库 migration。

## 用户/产品视角的验收步骤

1. 在 Skill Marketplace 的“最近发布”看到 `NextClaw Skin Studio`，或搜索 `skin` / `皮肤` / `appearance`。
2. 安装 `@nextclaw/nextclaw-skin-studio`；安装本身不修改界面。
3. 对 Agent 说“有哪些 NextClaw 皮肤”，确认返回 11 款源仓库对齐皮肤，并能看到易烊千玺、桥本有菜、迪丽热巴、初音未来、KUN、Jinx 与 ENFP。
4. 说“应用易烊千玺皮肤”，刷新桌面端或浏览器页面，确认人物主视觉和清透配色生效；同一实例连接的浏览器无需扩展。
5. 说“基于 Gothic Void Crusade，把主色改成青色”或提供本地 PNG/JPEG/WebP，刷新后确认自定义皮肤生效。
6. 说“当前是什么皮肤”查看状态；说“恢复默认界面”后刷新，确认默认 UI 恢复。
7. 说“给我创建一个个人皮肤”，确认 Agent 在 Skill 之外创建 `skin.json`、`skin.css` 与 `skin.js`；继续要求修改消息、侧边栏、工具过程、输入器、SVG 或动效时，Agent 应直接编辑个人源码并重新应用，不等待官方组件 API。
8. 在“全部 Skill”持续滚动到底：总数应为 32，终态应加载 32 张唯一卡片，不出现 `builtin` 错误或持续 loading。
9. 使用者必须知晓 `ui-inject.js` 与个人 `skin.js` 拥有页面同源权限，NextClaw 不保证安全性、DOM 稳定性、可靠性或跨版本兼容。

## 可维护性总结汇总

- 产品主干仍只有一个 server 读取入口和一个 UI 启动加载点；没有引入皮肤 owner、schema、资源系统或第二条状态链路。
- Skin Studio 的预设收敛为数据，语义与生命周期收敛到单一 `renderer.js`，视觉配方按基础、导航、内容和控件四层拆分，所有写操作收敛到单一 `skin.mjs`；新增皮肤不需要复制 Skill、脚本或 Marketplace 条目。
- Marketplace 修复复用现有查询和国内/官方回退 owner，没有增加平行 cache service 或额外 UI store；删除了“从相关性首屏伪造最近发布”的本地排序路径。
- `post-edit-maintainability-guard` 对 18 个本批次实现/测试文件的统计为：总新增 955 行、删除 84 行、净增 871 行；排除测试后新增 670 行、删除 83 行、净增 587 行。本次包含明确新增用户能力，增长主要位于可独立删除的 Skin Studio 数据、渲染器和脚本，不进入产品主干皮肤 owner。
- Guard 为 0 error、4 warning：`packages/nextclaw-server/src/app` 仍是 17 个直接文件且已有豁免、数量未增长；Marketplace 路由测试从 506 行增至 658 行但仍低于测试预算 900；`marketplace-catalog.utils.ts` 为 347/400；镜像脚本为 400/500。后两者是后续拆分观察点，本次没有新增抽象或平行链路来掩盖文件增长。
- 本轮全产品皮肤扩展一度把 `renderer.js` 推到 1022 行并触发文件增量预算错误；最终将稳定视觉配方拆为 `foundation-styles.js`、`navigation-styles.js`、`content-styles.js` 与 `control-styles.js`，`renderer.js` 回落到 261 行且继续是唯一语义/生命周期 owner。最新 guard 为 0 error、2 个与本轮无关的既有/生成物 warning（Cytoscape bundle 与产品截图脚本），新代码治理和 backlog ratchet 均通过。
- 新代码治理、治理 backlog ratchet 和 generated-clean 均通过。治理检查曾发现新 Python 测试文件不是 kebab-case，已改为 `marketplace-mirror-server-test.py` 后复跑通过。
- 个人工程能力新增后，`skin.mjs` 一度增长到 477 行并接近文件预算；收尾时把纯工程格式、读取和校验职责收敛到 176 行的 `skin-project.mjs`，命令编排入口回落到 340 行。当前 guard 为 0 error；仅测试文件从 155 行增至 283 行产生一条低于 900 行预算的增长提示，未为此制造测试 helper 层。
- 本轮个人工程增减统计：全部任务文件新增 599 行、删除 43 行、净增 556 行；排除测试后新增 471 行、删除 43 行、净增 428 行。增长属于新的用户可见能力，主要是 127 行作者指南、176 行个人工程校验 owner 和相应设计/元数据；没有把复杂度放入 NextClaw 产品主干。
- 本轮参考皮肤艺术指导增强的 guard 统计为：总新增 412 行、删除 10 行、净增 402 行；排除测试后新增 405 行、删除 10 行、净增 395 行。增长属于新的用户可见表现能力，并且仍完全位于可独立卸载的 Marketplace Skill。最初 339 行的单一概念样式文件触发 80% 预算警告，收尾时按变化原因拆为 229 行的 `concept-navigation-styles.js` 与 123 行的 `concept-decoration-styles.js`；最终 maintainability guard、定向 ESLint、新代码治理和 backlog ratchet 均 0 error、0 warning。
- 可维护性复核结论：通过；本次顺手减债：是。正向动作包括删除按“本机已知 Skill”过滤上游分页的旧辅助路径、删除最近发布的本地伪排序、复用现有 Marketplace fetch/fallback owner，并把所有皮肤状态变更收敛到一个脚本。no maintainability findings；保留上述 4 个非阻塞 warning 作为明确观察点。

## NPM 包发布记录

- `@nextclaw/server`：需要 patch，待统一发布；包含 UI 注入口、Marketplace 历史类型兼容和陈旧国内镜像回退。
- `@nextclaw/ui`：需要 patch，待统一发布；包含 UI 注入口加载、最近发布查询、目录刷新和总数表达修复。
- `nextclaw`：需要 patch，待统一发布；聚合上述产品能力。
- `@nextclaw/marketplace-api-worker`：非 NPM 发布包；源码防回归改动待凭据可用时部署。
- 本轮 Skin Studio 皮肤目录、渲染器和说明文件位于仓库根部独立 Marketplace 发布源 `skills/`，不属于任一 NPM 包的 `files` 清单；正式 Marketplace 已独立更新，因此本轮不新增 changeset。
- 本次未执行 NPM 发布。
