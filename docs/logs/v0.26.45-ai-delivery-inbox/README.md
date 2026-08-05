# AI 主动送达与收件箱

## 迭代完成说明

- 新增持久化的 AI 主动送达能力。Agent 可调用 `deliver_to_inbox`，直接传 Markdown / 静态 HTML 正文，或传绝对文件路径并在执行时保存 UTF-8 文本快照；`.html` / `.htm` 文件可自动识别类型。
- Kernel `InboxDeliveryManager` 统一拥有创建、查询、呈现、已读、未读、归档、恢复、删除和继续聊状态；`InboxDeliveryStore` 使用版本化 JSON 与临时文件 rename 原子写入。
- `presentedAt` 与 `readAt` 分离：自动阅读层关闭后内容仍未读，但不会再次自动弹；重新标记未读也不会清除已呈现事实。
- 新增 `/api/inbox/deliveries` HTTP 合同、Client SDK `inboxDeliveries` namespace 与轻量 `inbox.delivery.changed` 实时事件。实时事件只携带 ID 和操作类型，正文以 HTTP 权威数据为准。
- 新增全局阅读弹窗，同一时间只显示一个弹窗；多条未读内容在同一窗口中切换。Markdown 复用既有安全 renderer；HTML 使用无额外权限的 sandbox iframe，并注入 CSP、移除脚本、事件处理器与 meta refresh，禁止联网、表单、弹窗、下载和顶层导航。HTML 模式压缩外层标题区，保留内容留白与圆角，但不叠加额外边框线，让报告正文成为视觉主体。
- 新增桌面双栏、移动列表/详情式收件箱，包含未读/全部/已归档筛选、已读切换、归档、恢复、删除和继续聊；桌面侧栏与移动底栏显示未读提示。有可操作未读项时默认展示未读，否则默认展示全部，避免已有历史内容时出现误导性的空状态；用户手动选择的筛选保持不变。
- “继续聊”创建或复用真实 NCP 会话，并通过 `inbox_delivery_id` 会话元数据和 Context Provider 在后续 Agent 运行时注入送达内容，不把报告伪装成用户消息。
- 阅读弹窗初始焦点落在标题，不会误触发上一项/下一项 tooltip；视觉使用轻边框、受控阴影和 24px 圆角，避免此前讨论过的过大阴影与松散边距。
- 新增可重复生成的中英文宣传截图场景，使用真实产品界面分别展示 Markdown 主动送达、HTML 每日 AI 与科技简报与收件箱管理页；6 个标准资产进入 GitHub/文档源目录与 landing 同名镜像，并接入中英文 README 和结果文档。
- 文档站新增“后台结果与主动送达”中英文场景指南，用通知、HTML 每日简报和收件箱管理页三张真实截图解释两种交付形态、未读规则、静态 HTML 边界与“继续聊”链路。
- 新增需求级版本配图证据合同：收件箱 changeset 直接绑定中英文截图，`release:summary` 自动聚合并校验路径、语言、格式、替代文本和文件存在性；`release:version` 在版本化前执行同一检查，未来 release-note skill 默认消费候选图片。
- 修复产品截图脚本中通用 `/api/*` mock 覆盖 `ui-inject.js` 专用响应的问题；专用空 JavaScript 路由现在最后注册，不再产生 `Unexpected token ':'` 页面异常。
- 正式方案见 `docs/designs/2026-08-06-ai-delivery-inbox.design.md`。

## 测试/验证/验收方式

- 定向测试：
  - Kernel：2 个测试文件、11 项通过，覆盖并发持久化、Markdown / HTML 持久化、状态不变量、关联会话、上下文注入、直接正文、文件快照、HTML 后缀推断、显式类型覆盖、参数互斥与非法 UTF-8。
  - Server：1 个测试文件、2 项通过，覆盖列表、状态更新、继续聊与非法 action。
  - Client SDK：`nextclaw-client.test.ts` 共 16 项通过，包含 inbox 路径编码与 GET/PATCH/POST 请求合同。
  - UI：4 个测试文件、10 项通过，覆盖自动呈现、关闭不已读、单一阅读层、安全 Markdown 展示、HTML sandbox / CSP / 静态化、iframe 身份连续性与标题焦点，以及“有未读默认未读、无未读默认全部、显式筛选不被覆盖”的筛选规则。
- TypeScript：`@nextclaw/shared`、`@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/client-sdk`、`@nextclaw/ui` 全部通过。
- ESLint：上述五个包全部通过；本轮新增代码 0 error、0 warning。
- 生产构建：上述五个包全部通过。Server 仅有第三方依赖既有的 `eval` / Axios 类型导出提示；UI 仅有既有 Browserslist 数据与大 chunk 提示。
- 隔离 Kernel/API 冒烟：在临时 home 中完成创建、GET 列表、PATCH 呈现、POST 继续聊、真实 session 创建和 Kernel 重建后持久化恢复；结果为 HTTP 200、单项恢复、呈现后仍未读、继续聊后已读。
- 真实页面与视觉验收：隔离端口启动真实 Server + Vite 页面；1280×800 下同一阅读窗依次展示两项，关闭两项后 reload 不再弹但收件箱仍显示“2 项未读”；桌面双栏和 390×844 移动列表布局通过；初始焦点为标题且 tooltip 数量为 0。
- HTML 浏览器验收：隔离端口启动源码 Vite 页面并送入静态 HTML；真实阅读窗中内联样式生效，iframe `sandbox` 不授予额外权限，脚本、事件属性与 meta refresh 被移除，远程图片以 `csp` 原因失败且没有远程响应。
- 隔离页面验收没有启动完整 Agent runtime，因此浏览器同时记录到其他应用接口和资源的预期 404/503；这些请求未经过 Inbox API，收件箱创建、读取、状态更新、继续聊与页面交互均按独立链路验收通过。
- 治理：`pnpm lint:new-code:governance` 与 `pnpm check:governance-backlog-ratchet` 通过。
- 可维护性守卫：本功能相关新增目录均有合法 role 与 owner；全工作区守卫仍被并行用户改动 `packages/nextclaw-ncp-runtime-stdio-client/src/stdio-runtime.service.ts` 的既有超长文件继续增长阻断，本轮未触碰或覆盖该改动。
- 生成物：构建后 `pnpm check:generated-clean` 通过。
- 宣传素材：`inbox-delivery-*`、`inbox-html-delivery-*`、`inbox-page-*` 6 个场景按雾蓝主题、1512×828 CSS 视口与 2x 输出生成；源资产和 landing 镜像通过尺寸、哈希与人工构图检查。HTML 阅读窗确认保留留白与圆角且无额外边框，管理页确认“全部”筛选下可见 3 条送达记录。
- 宣传页面：`@nextclaw/landing` 与 `@nextclaw/docs` 生产构建通过；截图脚本定向 ESLint 通过。
- 截图配置：`inbox-delivery-scenes.config.test.mjs` 3 项通过，覆盖场景 ID / 输出路径唯一性、HTML 报告内容和管理页 3 条记录 / 2 条未读数据。
- 发布证据：`release-summary.test.mjs` 3 项通过；`pnpm release:summary -- --json` 能发现本需求 6 张中英文图片且无合同错误。

## 发布/部署方式

- 已随 `nextclaw@0.28.0` 稳定版统一发布；Shared、Kernel、Server、Client SDK 与 UI 的公共合同同步升级并发布。
- 文档站中英文场景指南、版本说明、结构化 JSON 与通知 / Markdown / HTML / 收件箱管理真实截图已经部署；HTML 版本说明采用“每日 AI 与科技简报”场景。
- stable runtime workflow `31032968267` 已完成四个平台运行包、GitHub Release 资产、gh-pages 与公共 manifest 发布。
- 不涉及数据库 migration 或线上后端服务部署；GitHub Release 事件同时发布了 Desktop `0.0.237` 安装资产与 stable 桌面更新通道。

## 用户/产品视角的验收步骤

1. 让 AI 完成一份报告，并调用 `deliver_to_inbox` 传入 Markdown `content`、显式 `contentType: "html"` 的 HTML 正文，或绝对 `filePath`；`.html` / `.htm` 文件应自动按 HTML 展示。
2. 保持界面打开，确认只出现一个阅读弹窗；若有多项，使用上一项/下一项在同一窗口切换。
3. 点击右上角关闭或“稍后阅读”，确认内容仍在收件箱显示未读；刷新或再次进入后，同一项不会重复自动弹出。
4. 打开收件箱，检查未读、全部、已归档筛选及 Markdown / HTML 正文；确认 HTML 样式可见，但脚本和远程资源不执行；验证标记未读、归档、恢复和删除。
5. 点击“继续聊”，确认进入新的关联会话；发送后续问题，确认 AI 能理解送达报告内容。
6. 在移动端重复打开列表和详情，确认底部导航未读提示、返回动作和操作区可用。

## 可维护性总结汇总

- 可维护性复核结论：本功能通过；全工作区自动守卫存在一项与本轮无关的并行改动红项，已独立披露。
- 代码增减：生产源码 `+1741/-18`，测试源码 `+539/-0`，合计源码 `+2280/-18`；另新增中文设计文档、changeset、provider 目录预算说明与本迭代记录。
- 这是跨 Shared、Kernel、Server、SDK、UI 的新增用户能力，生产代码净增符合新增能力豁免。增长集中在明确 owner 和端到端合同，没有新增兼容路径或复制旧实现。
- 正向减债：把收件箱页面拆成页级编排、列表面板与阅读面板；React Query 继续作为服务端事实 owner，Zustand 仅保存弹窗 UI 状态；工具、API、事件和界面共用唯一 Kernel mutation owner。
- 目录预算：Tool Provider、Context Provider 和 Client SDK services 都是稳定扩展点的同角色扁平目录，已有或新增明确预算说明；没有为了通过预算制造单文件假子树。
- 宣传截图接入没有继续扩大已超预算的总脚本：`refresh-product-screenshots.mjs` 保持基线 811 行，页面路由安装职责收敛到既有 browser helper，场景数据与行为由独立配置拥有。
- 版本配图关联复用现有 changeset 作为需求 owner，没有新增平行 manifest；聚合脚本只产生证据底稿，最终公开文案仍由 release-note skill 审阅。
- 版本证据自动化是新增发布能力，新增聚合脚本 166 行和定向测试 96 行，同时让既有 release scope 复用同一 owner、删除旧 changeset 解析分支；该批非测试代码 `+174/-32`、净增 142 行，没有复制发布说明生成器或扩张结构化 release-note JSON 协议。
- 收件箱实现本身没有新增可维护性问题。
- HTML、智能默认筛选与宣传场景跟进批次的定向可维护性守卫检查 19 个源码/测试文件，结果为 0 error、2 warning；合计 `+738/-103`，排除测试后 `+515/-98`、净增 417 行。增长属于新增用户能力，集中在既有工具入口、共享合同、Store 校验、单一正文 renderer 和可重复截图场景，没有新增 manager/service、平行存储或兼容分支；安全包装位于展示边界，原始正文仍只有一个事实来源。两项 warning 分别是 Inbox 截图场景配置由 115 行增至 284 行，以及总截图入口虽从 811 行减至 810 行但仍高于预算；前者仍低于 500 行且内容均为同一功能的声明式双语场景，后者没有继续增长。后续若继续增加第四类 Inbox 场景，应提取报告 fixture；总入口的场景细节继续留在独立配置中。

## NPM 包发布记录

- `@nextclaw/shared@0.4.17`：已发布，包含 Inbox Delivery 公共合同、会话元数据 key 与实时事件类型。
- `@nextclaw/kernel@0.6.20`：已发布，包含持久化 owner、Agent 工具、Tool Provider 与 Context Provider。
- `@nextclaw/server@0.15.20`：已发布，包含 Inbox Delivery HTTP API。
- `@nextclaw/client-sdk@0.5.20`：已发布，包含 `inboxDeliveries` namespace。
- `@nextclaw/ui@0.15.21`：已发布，包含全局阅读层、收件箱页面、导航入口、未读提示与中英文文案。
- `nextclaw@0.28.0`：已发布到 `latest`；registry、真实隔离安装、CLI 版本与 stable 更新检查均已验证。
