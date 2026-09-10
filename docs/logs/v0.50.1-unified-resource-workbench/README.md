# 统一资源协议与工作台交付记录

## 迭代完成说明

2026-09-11，本地实现完成，用户已授权验收后合入主干；不涉及 NPM 包发布。正式名称为 **NextClaw 资源协议（NextClaw Resource Protocol）**。

- 资源身份、展示视图与承载容器分离；会话工作台、全局右侧栏和会话悬浮共用外壳、尺寸、停靠、收起、最大化及恢复能力。
- 左侧页面固定、跨位置动作、Markdown 链接、图标降级、历史与滚动记忆消费统一资源身份；更多操作统一为竖三点，鼠标悬停、键盘聚焦或菜单展开时显示，触屏保留入口。
- 会话、Panel App、文件、集合和路由页接入；对象目录覆盖定时任务、收件箱结果、默认及项目 Skill、Agent、项目、服务应用、MCP 连接与项目工作项。对象读取真实 owner 的白名单快照，不序列化凭据，也不把读取当作执行授权。
- AI 的 `resource_list` / `resource_resolve`、对象引用上下文和 CLI `nextclaw resources list` / `resolve` 消费同一 kernel 目录。

设计与完整验收合同分别见 [设计](../../designs/2026-09-11-unified-workbench-views.design.md) 和 [验收计划](../../plans/2026-09-11-unified-workbench-views.plan.md)。

关键根因与修正：原资源路由没有覆盖系统对象；对象 Markdown 资产被误当作不支持的文件格式；弹窗内菜单挂在 body 导致指针/焦点边界拦截；同名对象快照可能共享阅读身份。分别补齐对象解析与展示、原文预览、最近模态容器内菜单，以及 URI 级阅读身份。只运行 Vite 并代理安装版后端不能验证新的 AI 合同，现已改为源码 `pnpm dev` 使用原数据。

## 测试/验证/验收方式

- UI 全量结果：1341 通过、31 失败。使用相同测试环境对基线 `c7c001942` 的只读源码检出运行：1269 通过、62 失败；当前 31 个失败均能按完整测试名称在基线复现，没有新增失败断言。不能将其表述为全量全绿。
- 全量后新增的 URI 阅读身份和工作台最大化修正：2 文件 8 测试通过；另外真实 Markdown/菜单/窄屏相关定向 8 文件 28 测试通过。工作台 URI 冷启动已真实验证：直接进入资源链接后转到准确父会话并展示 390×844 最大化概览，无空白页或资源错误。
- kernel 资源目录、Skill 来源、凭据排除、AI 工具/上下文和显示工具：5 文件 27 测试通过。CLI 资源命令及中英文命令全集：4 测试通过。
- 受影响 UI、agent-chat-ui、kernel、server、nextclaw 的 TypeScript 检查通过；shared 构建和 UI production build 通过。UI 构建保留原有分块体积提示。
- diff-only maintainability：0 错误、22 警告，主要是已记录目录例外及接近预算文件；本次收敛旧浮动/侧栏实现，不扩散为任意布局或插件框架。局部 ESLint 修正后无阻断错误。
- 实际浏览器已验证普通 Panel App、对象菜单与主区、390×844 窄屏、浮层边界、实例保留及左侧固定；真实 AI 验收会话 `ncp-mtvw2bii-6yljjeoi` 实际调用两次 `resource_list`，返回可点击定时任务/Skill URI。随后从 Skill 页“添加到聊天”，持久化消息包含 `system_object` 和不可变资产引用，模型准确回复名称、内容概要与原 URI。未执行 Skill、运行定时任务或发送外部消息。

临时对照报告位于 `/tmp/nextclaw-ui-baseline-validation.json` 与 `/tmp/unified-resource-ui-current.json`；该目录不是产品依赖。

## 发布/部署方式

用户已授权验收后提交、合入主干并推送；本次不部署或发布 NPM。提交前新增代码治理、backlog ratchet、差异维护性及受影响类型检查均通过。隔离分支先与最新远程主干集成，复验交叉点后普通推送，并运行主线协调器安全同步本地主镜像。

在隔离工作区 `nextbot-unified-workbench-views` 使用标准 `pnpm dev`；前端 5186、后端 55667，`NEXTCLAW_HOME=/Users/peiwang/.nextclaw`。进程、代理与原会话 SQLite 路径已核实，不使用复制或独立测试数据。预览保留运行。无数据库迁移或公共 API 删除；未来正式发布仍需按对应发布合同执行。

## 用户/产品视角的验收步骤

1. 打开 `http://127.0.0.1:5186/chat`，继续使用原会话与应用数据。
2. 在定时任务、Skill 等资源入口打开更多操作，试验主区/侧栏/悬浮、复制链接、添加到聊天与左侧固定；上下文工作台子页提供最大化，主路由专属页不显示不支持的容器。
3. 打开验收会话 `/chat/sid_bmNwLW10dncyYmlpLTZ5bGpqZW9p`，点击模型实际生成的两个资源链接，核对图标和内容，再检查第二轮引用回复。
4. 滚动、切换模式、收起恢复及前进后退，检查阅读位置；在左侧页面行悬停检查竖三点。触屏和键盘仍能访问菜单。

用户主观验收重点为操作直觉、布局密度和视觉偏好；客观行为不能依赖用户代测。失效对象显示资源级错误与重试，不承诺已删除资源仍可重建当前对象。

## 可维护性总结汇总

产品目录与快照归 kernel，原业务 owner 保留对象事实与执行权限；UI 编排归 PageResourceManager、既有导航/工作台 manager；组件只展示与连接。持久化阅读状态有界并容忍浏览器存储拒绝。对象 URI、文件来源路径和引用资产不可互相替代。

红区关注：工作台/全局视图状态交接、Markdown scheme 与文件来源、安全白名单、模态菜单焦点，以及 AI 引用与工具目录。均有定向证据；现有全量失败未在本任务范围内扩大修复。已把“对象盘点不能停留在页面集合”和“必须验证源码后端 AI 往返”补回本次原设计/验收 owner，不新增常驻规则。

## NPM 包发布记录

未发布。已准备 `.changeset/unified-resource-workbench.md`，涉及 UI、agent-chat-ui、kernel、shared、server 和 nextclaw；原有其他 changeset 保留。没有生成 tag、GitHub Release 或更新频道产物。

## 合入前复核

公共模块入口、视图存储 IO owner 和类方法合同已补齐；普通预览阶段的检查未覆盖全部提交门，这次新增代码治理暴露的项已修复，没有降低检查标准。共享资源入口优先导出稳定身份常量，避免 UI 装配循环导致注册键提前读取；实际浏览器及资源回归已重验。最新全量 UI 1341 通过、31 基线失败、无新增失败；存储/菜单定向 28 项与 kernel 目录/上下文 10 项通过。CLI 源码启动别名与现有 tsconfig 对齐并完成真实健康检查。

集成候选 `a098e244b` 已包含远程主干 `12c56e7db`；交叉点 UI 11 文件 86 测试、kernel 3 文件 28 测试通过。主干新增运行状态测试的旧 onClose 参数已移除，修后该文件 6 项通过；UI、kernel、server、CLI 类型检查和 UI/kernel 构建通过。真实 5186 Skill 资源主区加载正确、无错误提示，原数据服务健康检查 200。合入使用普通 push，随后调用协调器同步本地主镜像，不发布产品。


## 合入后用户验收补丁（2026-09-11，当前源码预览）

- Panel App 对象 provider 已接入唯一 kernel 注册表；使用 entry.id 精确解析只读快照，原始应用页链接保留既有 URI。appId 加入可检索描述，避免中文标题造成英文 appId 查询遗漏。元数据不携带 HTML、客户端 token 或凭据。
- 注册仅持有 provider，新增纯元数据 listTypes；AI 工具定义直接告知当前类型，无参 resource_list 返回 objectTypes，不调用实例列表。指定类型只查询该 provider。UI 计数浏览和类型内部的读取后过滤仍存在，不声称已实现存储层分页。普通文件/会话/页面 URI 不以目录收录为条件，规则补回既有 AI 输出协议 owner。
- 普通 Panel App 链接默认打开全局停靠侧栏，已有视图复用及明确主区入口不变。Agent 头像固有几何由共享资源图标组件固定为 1em，实际 Markdown 样式下自然 128px 图片由 128×128 修为 16×16，普通正文配图仍使用原规则。
- 验证：kernel 2 文件 12 项、UI 3 文件 19 项通过；UI/kernel tsc、11 个触达源码/测试文件 targeted ESLint、git diff --check 通过。差异维护性 0 错误、2 个既有目录预算例外，无新增目录或 provider 层。结构复核无未关闭 findings。未重复此前全量 UI 检查；其 31 个基线失败不能表述为已修复。
- 原数据 5186 预览实际 AI 会话 ncp-mtvw2bii-6yljjeoi：05:56 运行可直接感知九种已注册对象类型及“文件无需目录收录”边界；resource_list 指定 panel-app + novel-reader + limit=1 实际返回 total=1。模型第一次最终摘要错误沿用历史空结果，核对持久化工具结果后，第二次单次查询正确回答 total=1 与真实 URI。没有用模型口头结论代替工具证据。
- 实际点击 nextclaw://panel-app/novel-reader：主区会话 URL 不变，global-resources 内加载原应用 iframe；点击 objects/panel-app URI：同一侧栏显示读书笔记只读快照和 Open application 链接。修复源码由标准 pnpm dev 提供，原数据未复制；预览继续运行。
- 复盘落点：现有设计、用户文档与回归测试，区分类型发现、实例检索和链接解析；不新增常驻规则。常规验收修复不另写产品博客。用户随后明确授权本轮验证后合入主干。提交范围为本轮 16 个补丁文件，不包含其它任务改动；不发布 NPM。提交前新增代码治理和 backlog ratchet 通过；先集成远程背压修复 865317e98，再复验 kernel 交叉点，普通推送后由主线协调器同步本地主镜像。

集成候选 09bc9a610 复验：kernel 资源/上下文/事件队列 18 项通过，kernel/server tsc 通过。新增原生背压测试首次因隔离工作区缺 runner 失败；使用 NEXTCLAW_WASMTIME_RUNNER_PATH 指向主工作区现有 darwin-arm64 产物后，真实 resident 启动与背压断言通过（1 项）。未修改测试或创建替代 runner。5186 原数据接口仍精确返回 novel-reader 对象 total=1；UI 源码未受远程提交影响，复用本轮 19 项定向及类型检查证据。
