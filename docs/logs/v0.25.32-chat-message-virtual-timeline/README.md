# v0.25.32 长会话消息分页与动态高度虚拟时间线

## 迭代完成说明

- 会话消息首屏改为读取最新 `80` 条，并通过不透明 cursor 持续向上加载更早消息；服务端统一限制单页最多 `200` 条，并返回真实 `total`、`startCursor` 与 `hasPreviousPage`。
- JSONL journal 继续作为唯一事实源；新增可删除、可重建的消息投影，通过固定宽度 offset 索引随机读取历史页，运行中的未稳定 tail 仍从 journal 增量重放，不引入第二份事实。
- conversation state 新增 `prependHistory` 语义，历史页按消息 ID 去重并保留当前 live/streaming 消息对象身份，避免旧页覆盖实时状态。
- 消息时间线使用共享 `ChatMessageList` 的单条消息展示，通过 `@tanstack/react-virtual` 只挂载视口附近行；inline HTML、Panel App、折叠推理和工具内容引起的高度变化由行根节点动态测量。
- 向上加载由现有唯一 scroll owner 触发，prepend 锚点由 virtualizer 根据稳定消息 key 在布局提交前同步；外层不再延迟补写 `scrollTop`。会话切换时分页请求会取消，分页状态按 session 键控，不会把旧会话页面写入新会话。
- 原因不是单个列表缺少懒加载，而是 journal 读取、API、conversation state 与 DOM 渲染均没有长会话边界。该判断通过端到端源码链路、1000 条真实 journal 的 API 分页和浏览器完整上翻共同确认；修复同时闭合存储读模型、游标合同、状态合并和虚拟渲染，而不是只减少首屏 DOM。
- 完整 owner、数据流、动态高度取舍、迁移与非目标见 `docs/designs/2026-07-18-chat-message-virtual-timeline.design.md`。
- 动态高度回缩的直接根因是 HTML/Panel App 原算法把 `documentElement.clientHeight / scrollHeight` 与自然内容高度一起取最大值：iframe 增高后，旧视口会反过来成为下一次测量下限。现已由 `@nextclaw/shared` 的纯函数统一读取 body 自然高度与 documentElement offset，高度 producer 只保留一套合同；工作区 HTML 与 Panel App 注入脚本都复用它，virtualizer 不增加特判。
- 真实验收还发现测试 HTML 的 `#details { display: grid }` 覆盖了 `hidden`，按钮显示收起但内容仍占布局；已修正本地 fixture，先证明内容确实回缩，再给产品链路判定通过，避免用错误测试数据掩盖结论。
- 后续真实滚动验收捕获到“正常内容 → 整个会话区空白 → 内容恢复”的单帧闪烁。连续截图量化显示修前空白关键帧白色像素占比为 `99.83%`；根因是外层在 `requestAnimationFrame` 中先写入 prepend 后的 `scrollTop`，virtualizer 要到后续滚动事件才更新挂载范围，浏览器因此先绘制了一帧没有消息行覆盖视口的空白区域。现已删除外层补偿，改由 virtualizer 的稳定 key 锚定在 React 布局提交前同步范围与滚动位置，直接消除错误时序而非用遮罩掩盖。
- 扩大验收路径后又定位到两条瞬态竞争：reload 被 provider 整页骨架门串行化为“骨架 → 空会话壳 → 消息”，滚动时父组件的 ResizeObserver 还会读取滞后的 `isAtBottom` state，把刚离开底部的视口抢回去。现已删除整页骨架门，让会话历史与 provider 配置并行加载；sticky-scroll owner 统一接管高度观察并读取同步 ref；virtualizer 使用直接 DOM 定位、尾部初始 offset，并在滚动写入前同步最新容器高度。

## 测试/验证/验收方式

- 定向测试：kernel `21`、NCP toolkit `20`、server `16`、UI `48`，共 `105` 个用例通过；覆盖投影重建、稳定页与未稳定 tail、完成事件替换、损坏恢复、游标错误、prepend 去重、会话切换取消、滚动锚点、重试、10000 行有界挂载与动态高度测量。
- TypeScript：`@nextclaw/ncp`、`@nextclaw/ncp-toolkit`、`@nextclaw/ncp-react`、`@nextclaw/client-sdk`、`@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/ui` 的 `tsc` 全部通过。
- package lint：上述受影响包均为 `0 error`；剩余 warning 为既有复杂度/测试文件预算或 guard 已披露的近预算提示，没有本批新增 lint error。
- 生产构建：NCP、NCP toolkit、NCP React、client SDK、kernel、server 与 UI 构建通过；server 仍输出第三方 protobuf `eval`、Lark SDK axios 类型警告，UI 仍输出既有 chunk size 与 caniuse 数据提示。
- 隔离源码 API 冒烟：独立 home、独立端口 `18937` 的源码实例导入 `1000` 条消息后，连续 `13` 页读取结果为 `loaded=1000`、`unique=1000`、`total=1000`、`exactOrder=true`，非法 cursor 返回 HTTP `400 / INVALID_CURSOR`。
- 真实浏览器验收：首屏仅挂载 `12` 行；连续向上滚动时挂载数保持在 `12–21` 行，最终到达 `message 1`；每页前插后阅读锚点保持稳定，再次向上滚动不再重复加载。实测可见行高为 `97–137px`，动态测量生效，控制台无 error。
- 真实本地实例验收：在当前源码 UI `http://127.0.0.1:5174`、真实 `~/.nextclaw` 中建立 `1200` 条混合消息会话。API 连续 `15` 页得到 `loaded=1200 / unique=1200 / exactOrder=true / hasPreviousPage=false`；浏览器连续上翻 `15` 步到“短消息 1”，终态 `scrollTop=0`、无 loading/alert，挂载行数始终为 `11–20`。
- 闪烁修复 A/B：在同一真实会话、同一首屏位置和同一触顶手势下连续采集 `24` 帧；修前出现 `1` 个 `whiteRatio=0.9983` 的空白帧，修后空白帧为 `0`，修后各帧 `whiteRatio=0.8643–0.8809`。随后连续触顶 `14` 次到“短消息 1”，每页首条可见消息按 `1040、960…80、1` 稳定推进，挂载行数保持 `11–20`。
- 扩展瞬态 A/B：修前 reload 连续出现整页白、整页骨架、真实壳空消息区和错误范围内容四种画面；修后移除骨架与错误范围中间帧，真实消息首次出现即稳定在最新消息。滚动分别覆盖回到底部、上滚 `1000`、上滚 `6000` 和跨页上滚，全部连续帧 `blankFrames=0`，挂载 `11–20` 行；跨页后锚点保持。inline HTML 行从 `401px` 展开到 `771px` 再回到 `401px`，两段连续帧同样为 `0` 空帧，滚动位置未被抢回。
- 闪烁修正工程验证：`@nextclaw/agent-chat-ui` sticky-scroll 定向 `4` 个用例、`@nextclaw/ui` 会话/虚拟列表定向 `33` 个用例通过；两个 package 的 `tsc`、完整 ESLint 与生产构建通过。agent-chat-ui 全量 Vitest 为 `229 passed / 3 failed`，UI 全量 Vitest 为 `776 passed / 14 failed`；失败集中在同一脏工作区的公共 contract、jsdom selection、文件操作 class、会话创建参数、欢迎页 QueryClient、工作台旧文案和旧 query key 测试，与本次触达文件和闪烁链路无关，已保留为并行任务收口缺口而未越界修改。
- 最新源码热更新后的真实瞬态复验：reload 连续采集 `50` 帧，前 `5` 帧为浏览器文档清空和无消息加载壳，未再出现整页灰色骨架；消息从第 `6` 帧首次出现，后续 `45` 帧画面指标完全一致，空白帧为 `0`。从底部一次上滚约 `6000px` 连续采集 `32` 帧，空白帧为 `0`，滚动位置从 `14512` 到 `8525`，挂载行数从 `11` 到 `20`，动态高度更新后没有被抢回底部。
- 动态 HTML A/B：有效收起基线为 iframe `278px`、虚拟行 `401px`；展开后为内容 `1303px`、受容器上限约束的虚拟行 `771px`；再次收起回到 `278px / 401px`。相邻行无可见重叠，iframe 未因高度变化更换业务 key 或父级结构。
- 真实 Panel App：同屏渲染“唐诗卡片”，源码实例返回的注入脚本已使用共享自然高度算法；点击“下一首”后标题从“登鹳雀楼”变为“望庐山瀑布”，iframe 保持 `489px`，同屏虚拟挂载行数为 `17`。
- 隔离源码实例验收结束后已停止，没有重启或影响用户当前运行实例。
- `lint:new-code:governance`、governance backlog ratchet 与 maintainability guard 均通过。

## 发布/部署方式

- 变更由 `.changeset/add-chat-message-virtual-timeline.md` 记录，后续随受影响 workspace package 的 patch 版本统一发布。
- 本次未执行 NPM 发布、线上部署、Git push、Git commit 或当前 NextClaw 实例重启。
- API 压测仍使用隔离源码实例；此外在用户当前的源码开发实例 `5174 / 18792` 使用真实 home 写入了可长期复验的会话 fixture。没有手工重启宿主、服务或桌面应用，源码 watcher 自行消费改动。

## 用户/产品视角的验收步骤

1. 打开消息数量明显超过首屏页大小的已有会话，确认初次进入时直接显示最新消息且滚动位于底部。
2. 持续向上滚动，确认较早消息分批出现，当前正在阅读的首条可见消息不会因前插而跳走。
3. 一直滚动到最早消息，确认到达会话开头后不会重复请求或重复插入相同消息。
4. 在长会话中展开/收起推理或工具内容，打开 inline HTML / Panel App，并触发其内部高度变化，确认消息之间不重叠、不留错误空白，滚动范围随高度更新。
5. 在底部等待流式回复，确认仍会贴底；主动向上阅读后，流式追加不会抢回滚动位置。
6. 在加载较早消息时切换到另一会话，确认旧会话响应不会注入新会话，加载态和错误态也不会跨会话残留。

## 可维护性总结汇总

- `post-edit-maintainability-guard` 最终为 `0 error / 15 warning`；`post-edit-maintainability-review` 已完成，没有阻塞交付的 owner、重复链路或预算问题。
- 动态回缩补强的定向 guard 检查 `7` 个文件为 `0 error / 0 warning`；代码增减 `+106 / -34 / net +72`，排除测试后为 `+32 / -24 / net +8`。剩余净增来自跨 UI/kernel 共用的环境无关高度原语与公共出口；它删除了两处重复算法，并让 Panel App 注入脚本和工作区 HTML 不能再次漂移。该批属于长会话新增能力的验收补强，不套用纯 bugfix 的 `net <= 0` 门槛。
- 本次是新增用户能力，不适用非功能改动的生产语义净增 `<= 0` 门槛。当前共享脏工作区的 guard 统计为非测试 `+3286 / -1510 / net +1776`，其中包含并行任务改动，不能当作本批独占净增；本批通过文件预算和精确 owner 复核，而不是用工作区总行数假装精确归因。
- 正向减债：消息容器从原有大组件继续拆出稳定 timeline utility、virtualizer hook 与 view-model cache owner；分页请求状态再拆为独立 session-keyed history hook，conversation 主 hook 降到约百行，并删除业务状态修复型 effect。
- kernel 将 journal 行解析、投影序列化与随机分页读取拆成独立 owner；journal store 保持在 `400` 行预算内，消息投影新文件保持在 `400` 行预算内，session manager 保持在 `600` 行预算内。
- NCP toolkit 把历史合并收敛为纯数据变换，并把 tool-call Map mutation 移回拥有这些 Map 的 manager；server 把新增分页 controller 测试移出接近预算的根路由测试文件。
- 单一事实链保持清晰：journal 是持久化事实 owner，投影只做可重建读取加速，conversation manager 只做消息状态合并，scroll container 只做物理滚动表面、顶部触发和贴底协调，virtualizer 统一负责挂载范围、测量与 prepend 锚定。
- 闪烁修正删除了外层延迟高度补偿，仅在 virtualizer 增加现成锚定选项，生产语义代码净减 `6` 行；定向 maintainability guard 检查 `4` 个文件为 `0 error / 0 warning`。guard 相对 `HEAD` 的同批长会话功能总量为 `+323 / -21 / net +302`，排除测试为 `+125 / -11 / net +114`；本次微调本身没有新增生产分支、文件或抽象。
- reload/滚动瞬态补强的定向 maintainability guard 为 `0 error / 2 warning`；总代码 `+681 / -431 / net +250`，排除测试后为 `+395 / -396 / net -1`。正向减债来自删除 `86` 行整页 skeleton、重复 ResizeObserver、无效空态分支及多余回调/DOM 层；消息 container 从基线 `498` 行降到 `462` 行。两个 warning 都是接近既有文件预算的提示，没有新增超预算文件。
- 剩余 warning 主要是贴近预算的既有 owner/test 文件和已登记目录例外；本批没有新增超预算文件、平行渲染实现、嵌套滚动容器或第二套消息状态。

## 红区触达与减债记录

### NCP conversation state

- 本次是否减债：是。
- 说明：新增历史合并测试移到独立文件；历史合并变为纯函数；tool-call 跟踪 mutation 回归 manager owner。主 manager 保持在 `600` 行预算内。
- 下一步拆分缝：后续可继续沿 run lifecycle 与 message streaming handler 拆分，但本次不扩大为跨域重构。

### Kernel session journal

- 本次是否减债：是。
- 说明：journal store、journal utility、session manager 和新 projection store 均回到各自预算内；解析状态由内部 parser owner 管理，投影序列化和 cursor 逻辑为纯 utility。
- 下一步拆分缝：若投影继续增长，优先将 meta 校验与底层随机文件读取拆成 projection storage owner。

### Server session API

- 本次是否减债：是。
- 说明：新增分页边界测试落在 feature controller 的 `__tests__`，根路由测试相对基线净减；公共 API 类型文件保持在 `900` 行预算内。
- 下一步拆分缝：后续按 sessions / providers / runtime 领域拆分共享 API 类型总文件。

### UI chat timeline

- 本次是否减债：是。
- 说明：消息容器相对基线净减，分页 history hook 与 virtualizer hook 各自独立；没有复制消息 JSX，HTML 与 Panel App 继续复用既有展示组件。
- 下一步拆分缝：后续可将消息 view-model adapter 独立成 feature adapter 文件，并继续拆分接近预算的 container 测试 fixture。

## NPM 包发布记录

- `@nextclaw/ncp`：需要 patch，新增消息页信息与历史 prepend 公共合同，待统一发布。
- `@nextclaw/ncp-toolkit`：需要 patch，实现历史消息去重前插并保持 live 消息身份，待统一发布。
- `@nextclaw/ncp-react`：需要 patch，向 UI 暴露稳定的历史前插 action，待统一发布。
- `@nextclaw/client-sdk`：需要 patch，支持 `limit / cursor / signal` 消息页请求，待统一发布。
- `@nextclaw/kernel`：需要 patch，新增可重建 journal 消息投影、游标分页和真实 total，待统一发布。
- `@nextclaw/server`：需要 patch，新增有界消息分页 HTTP 合同与 `INVALID_CURSOR` 映射，待统一发布。
- `@nextclaw/shared`：需要 patch，新增 HTML 与 Panel App 共同使用的自然内容高度读取原语，待统一发布。
- `@nextclaw/ui`：需要 patch，新增向上加载、滚动锚点、错误重试和动态高度虚拟时间线，待统一发布。
- Changeset：`.changeset/add-chat-message-virtual-timeline.md`。
- 本次未执行 NPM 发布。
