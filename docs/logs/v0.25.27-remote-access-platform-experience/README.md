# v0.25.27 远程访问与 Platform 体验收敛

## 迭代完成说明

- Platform 的“我的实例”页面只保留实例筛选、分页、状态与操作；Remote 额度、余额和充值入口迁入独立“用量与充值”路由，避免把账户级资源能力混入实例 owner。
- “我的实例”统一为服务端分页表格，归档作为状态筛选而不是第二份列表；支持关键字、连接状态、归档状态、页大小、排序、固定操作列以及归档、恢复、永久删除和远程打开。
- Worker 的实例查询收敛到独立 repository/type owner，列表 API 接收分页与筛选参数；远程 Panel App 会话在沙箱域内重写 HTML、模块脚本和样式资源地址，避免跨域远程访问时丢失 CSS 或脚本。
- 左侧栏底部删除大型账户卡片和二级弹层，改为账号、语言、主题、退出四行常驻快捷区；账号优先展示用户名，语言直接切换“中 / EN”，主题支持浅色、深色和跟随系统，并删除页头重复的邮箱与角色信息。
- Platform 中性视觉色从页面硬编码收敛为全局语义 token，浅色与深色主题共用同一组件结构；状态徽标、警告、分享错误、登录页和账号页补齐对应的深色状态色。
- 历史根级页面与基础 UI 迁入 `features/*` 和 `shared/components` owner；登录、分享、账号、市场页与管理页全部使用 kebab-case，并以 feature root 作为应用装配边界。
- 导航配置从 `pages/` 迁入 `app/user-console-navigation.config.ts`，使文件角色与应用路由装配职责一致。
- 中英文远程访问博客补齐“本机远程访问设置 -> Platform 实例管理 -> 远程工作台结果”三段真实截图，公开素材裁掉邮箱与账户区域。
- Git 交付规范补充本地 `master` 优先原则：面向 `origin/master` 的交付默认先闭合本地主干，再从本地 `master` 推送；特殊情况必须披露并完成回流同步。

### 本轮纠偏根因

- 首版紧凑账户入口把“减少视觉噪音”错误实现成把语言藏入弹层，并遗漏主题能力；纠偏后删除弹层，将高频偏好设置直接放回侧栏底部。
- 首次深色预览中，页头仍使用固定浅色 `rgba(249,248,245,0.94)`，而文字已经读取深色 token，造成浅色白条与低对比度。Chrome 桌面截图直接确认该问题；修复将页头背景收敛到 `--color-canvas`，不再保留第二套固定颜色。
- 首次本地预览把 `currentRoute` 固定为实例路由，导致点击导航只改变 URL、不改变标题和内容。修复后预览通过 `location.pathname -> resolveUserConsoleRoute -> route content` 同一条路由投影链更新页面，并逐项点击验收五个入口。
- 这两处都不是通过局部覆盖隐藏症状：主题修复收敛颜色 owner，预览修复收敛路由事实 owner；同时把“主题整页双主题截图完成前不得交付预览”补入 `frontend-style-encapsulation` 验证规则。

## 测试/验证/验收方式

- `pnpm -C apps/platform-console tsc`：通过。
- `pnpm -C apps/platform-console lint`：通过，0 warning。
- `pnpm -C apps/platform-console build`：通过，Vite production build 成功。
- `PLATFORM_CONSOLE_BASE_URL=http://127.0.0.1:4173 pnpm smoke:platform:console`：通过；覆盖五个侧栏路由的 SPA 内容切换、服务端分页/搜索/归档筛选、固定操作列、移动端表格、归档/恢复/删除、远程打开、账号设置、Skill 管理、主题与中英文切换。
- `pnpm -C workers/nextclaw-provider-gateway-api tsc` 与 `lint`：通过。
- `pnpm -C workers/nextclaw-provider-gateway-api test:remote-instances`：通过；覆盖分页、筛选、排序与 repository 查询合同。
- `node workers/nextclaw-provider-gateway-api/tests/remote-panel-app-session.test.mjs`：通过；覆盖远程 Panel App HTML、脚本与样式资源重写。
- `pnpm docs:i18n:check`：通过，82 组英文与中文 Markdown 页面一一镜像。
- `pnpm -C apps/docs build`：通过，中英文 VitePress 页面与三张产品截图完成静态构建。
- Chrome 真实渲染验收：逐项点击“我的实例 / 用量与充值 / 我的 Apps / 我的 Skills / 账号”，URL、页头标题和内容区均同步变化；中英文切换会同步改变导航、页头和表头；浅色与深色主题均完成整页截图验收。深色页头背景为 `rgb(17, 18, 15)`、标题为 `rgb(243, 243, 237)`，页面无白条；桌面侧栏宽度 248px，760px 与 390px 视口均无页面级横向溢出，最新干净重载无应用自身 console error。
- 本地可交互预览保留在 `http://127.0.0.1:4181/`，使用非敏感示例数据展示路由、表格、语言和主题交互。
- maintainability guard：Platform、Worker 与平台冒烟整批检查 50 个文件，`0 error / 4 warning`，总代码 `+5278 / -4076 / net +1202`，非测试代码 `+5066 / -4076 / net +990`。warning 均为预算提示：冒烟目录已有 README 豁免且文件数未增长，主冒烟入口从基线 491 行降到 418 行，`remote.controller.ts` 从 512 行降到 483 行，relay controller 保持 490 行未增长。
- `pnpm check:governance-backlog-ratchet`：通过。
- `pnpm lint:new-code:governance`：全部通过；文件命名、feature root、package public import、class arrow method、React effect、closure owner 与目录结构门禁无新增违规。

## 发布/部署方式

本轮先在本地 `master` 完成源码提交，再部署 Cloudflare Worker 与 Platform Pages，并在生产冒烟通过后从本地 `master` 推送 `origin/master`。文档站由 `master` push 触发同一份静态产物的 Cloudflare 与阿里云双目标 CI 部署。实际 commit、部署 URL 与线上验收结果在部署完成后回填。

## 用户/产品视角的验收步骤

1. 登录 Platform，进入“我的实例”，确认首屏直接进入实例表格，不再先经过额度和充值模块。
2. 点击左侧“用量与充值”，确认免费额度、付费余额、Remote 每日用量和充值状态集中展示。
3. 查看左下角快捷区，确认账号、语言、主题、退出四行直接可见；点击账号进入账号页，切换“中 / EN”后导航、页头和内容文案同步变化。
4. 依次切换浅色、深色和跟随系统，确认页头、侧栏、内容表面、文字、表格与状态控件使用同一主题，不出现固定浅色白块。
5. 依次点击五个侧栏导航，确认 URL、页头标题和内容区同步变化；在 760px 和 390px 宽度下确认页面不横向溢出。
6. 打开博客本地预览，依次确认本机设置、Platform 实例表格和远程 Panel App 三张图均正常加载。

## 可维护性总结汇总

- `post-edit-maintainability-review` 结论：通过，无阻塞 finding；职责从混合 dashboard 收敛为实例页、用量页、远程实例 action manager、服务端 repository 与共享 DataTable 等明确 owner。
- 本轮是实例表格、独立用量页、远程资源加载修复、真实主题能力和侧栏快捷区等新增用户能力，允许存在正向生产代码增量；预算 warning 均未扩大既有热点，没有通过压行或转移复杂度规避。
- 正向减债动作：删除不再匹配页面职责的 `WorkbenchSummaryStrip` 与首页额度/充值编排，直接复用现有 `RemoteQuotaCard`、余额字段和 locale owner，没有复制 API、query 或计量逻辑。
- 侧栏底部作为 console shell 的独立展示组件存在，删除弹层 state、document pointer listener 和 Escape listener；账号导航、语言、主题和退出均保持直接语义与键盘焦点。
- 主题偏好由 `features/preferences/stores/theme.store.ts` 通过 Zustand persist 拥有；App 里的 effect 只同步 `matchMedia` 与 `<html>.dark` 这一外部浏览器系统，不承载业务编排。
- 语义色 token 作为主题 owner 统一替代 Platform 内的暖中性色硬编码，组件继续只消费 token；没有为深色主题复制第二套页面或条件 JSX。
- 左侧导航把五个无差异圆点替换为实例、用量、Apps、Skills 与账号语义图标；图标留在 shell owner 内，没有引入新的图标依赖或远距离抽象。
- 共享 `DataTable` 只拥有列、排序、固定列、空态、加载态和横向滚动等业务无关表格能力；实例筛选、分页 query 和操作语义仍留在 dashboard feature，没有把业务规则塞入基础组件。
- 远程实例操作收敛到 `RemoteInstanceActionsManager`，组件只订阅状态并调用 commands；Worker 保持 controller -> repository 单一路径，没有继续扩张旧 `remote.repository.ts`。

## NPM 包发布记录

不涉及 NPM 包发布。`@nextclaw/platform-console` 与文档站均为私有部署型应用，本轮没有添加 `.changeset`。
