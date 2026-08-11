# v0.31.2 系统对象显式引用

## 迭代完成说明

本轮把收件箱报告“继续聊”从专用会话魔法改造成统一、可见的系统对象引用，并让定时任务进入同一套 `@` 资源选择机制。正式设计见 [系统对象引用设计](../../designs/2026-08-11-system-object-references.design.md)。

根因是旧实现把产品语义绑定在 Inbox 专用 `/continue` 动作、`conversationSessionId` 和隐藏的 session metadata/context provider 上：按钮必须先等待后端创建或复用会话，成功后才跳转；AI 能理解报告依赖用户不可见的上下文注入。代码链路审计确认页面与弹窗共同依赖这条专用链路，持久化模型、Kernel manager、Server、SDK 和 UI 都带有 Inbox→Session 耦合。这不是单纯按钮事件丢失，而是“继续聊”同时承担资源解析、会话创建、上下文注入和导航，失败时入口留在原页面，成功后用户也看不到真实输入。

修复直接命中该根因：

- shared 定义 `nextclaw://objects/<type>/<id>` URI、统一发现/解析合同和唯一运行时校验函数；
- Kernel `SystemObjectReferenceManager` 注册领域 provider，首批支持 `inbox-delivery` 与 `cron-job`，显式 resolve 时生成 SHA-256 标识的 Asset Store 文本快照；
- NCP context provider 只读取当前消息里可见 token 携带的已解析快照，不读取 live 业务对象，也不允许静默 fallback；
- `@` 面板通过统一 discovery API 展示 provider-owned 资源组；默认态进入“收件箱报告”或“定时任务”后组内浏览，关键词搜索按组返回且每组独立限流，选择后先 resolve，再插入用户可见 `system_object` token；
- 收件箱页面与阅读弹窗都进入 `/chat/draft` 并发送同一种 system-object draft intent；
- Inbox store 从 v1 迁移到 v2 并清除旧 `conversationSessionId`，同时删除 Inbox `/continue` API、SDK 方法、manager 会话逻辑和专用 context provider。
- `@` 根目录把原“文件与文件夹”混合入口拆成“文件”和“文件夹”：文件模式中目录只负责导航、文件负责引用；文件夹模式只浏览目录并通过置顶“引用当前文件夹”完成选择，项目根目录使用稳定的 `.` 引用；全局和组内搜索均按类型过滤并分别成段。

用户验收发现初版虽然统一了对象传输协议，却把所有类型平铺进同一个“系统对象”区。复盘确认根因是设计阶段跳过了默认浏览、信息架构、组内搜索和规模化场景。规则机制同步修正：不新增平行 skill，而由 `nextclaw-solution-design` 继续作为唯一设计 owner；新增按需加载的“功能设计关”，并让用户可见 L2 功能在存在真实信息架构/工作流设计空间时也进入该 owner。skill 总数保持不变。

## 测试/验证/验收方式

- 六包 TypeScript 检查通过：`@nextclaw/shared`、`@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/client-sdk`、`@nextclaw/agent-chat-ui`、`@nextclaw/ui`。
- 5 层定向回归共 98 项通过：Kernel 17、Server 9、Client SDK 18、Agent Chat UI 3、NextClaw UI 51。
- 交互测试覆盖：收件箱页面与弹窗两个“继续聊”入口、草稿 intent 消费、可见 token 插入、文件/文件夹独立入口、文件夹当前目录引用与根目录 `.` 往返、资源组导航/返回、组内过滤、跨组 section、每组独立 limit、inline metadata 往返和 URI/对象身份不一致拒绝。
- 真实开发实例 `http://127.0.0.1:18792` 验证根目录返回 `groups + total`，两个组分别为 18 份报告和 7 个定时任务且不平铺 items；进入 cron 组返回组内对象，POST resolve 返回 200、SHA-256 version 与 Asset Store URI。
- 应用内浏览器控制通道在本地 Vite 导航、DOM 与截图读取时均超时，因此没有把真实浏览器点击冒充为通过；真实交互行为由 DOM 测试覆盖，HTTP 运行链路由实际实例覆盖。
- 六个相关 package lint 均无 error；仓库既有复杂度 warning 未在本轮扩大为阻塞项。
- NextClaw UI production build 通过；仅报告既有 Browserslist 数据与 chunk-size 提示。
- 规则系统 `check:skill-progressive-loading` 通过：skill 数保持 33，入口无依赖环；`nextclaw-solution-design` 入口从 44 行增至 46 行，功能设计细节只在命中用户可见功能时按需加载。Skill Creator 的 Python `quick_validate.py` 因当前两个 Python 环境均缺少 PyYAML 未能启动，未冒充为通过；项目自有 frontmatter、链接、命名、依赖和体积审计已通过。

## 发布/部署方式

本轮未执行 commit、push、发布、部署或服务/桌面应用重启。当前开发 watcher 自动加载源码变更；正式交付由后续统一 changeset 发布流程完成。

## 用户/产品视角的验收步骤

1. 在任意聊天输入框输入 `@`，确认“文件”和“文件夹”是两个独立入口，“收件箱报告”和“定时任务”只显示为资源分类，不再平铺所有对象。
2. 进入“文件”，确认目录行只进入下一级、文件行才添加引用；进入“文件夹”，确认列表不出现文件，并能通过“引用当前文件夹”选择项目根目录或任意子目录。
3. 从根目录及两个入口分别搜索，确认文件和文件夹按各自标题分组且不会交叉出现；再进入两个系统对象分类，确认只浏览该类对象并能返回。
4. 发送带引用的问题，确认 AI 能基于被引用快照回答；修改或删除 live 对象不应改变已经发送消息的快照语义。
5. 分别从收件箱管理页和自动弹出的阅读窗点击“继续聊”，确认都进入草稿页，并在输入框里看到报告引用；发送前用户可删除它。
6. 模拟对象已删除、provider 未注册或快照不可用，确认界面显示明确错误，运行时不静默改读 live 对象。

## 可维护性总结汇总

本轮完成了明确减债：删除 Inbox→Session 专用主链路，把系统对象身份、provider、显式 resolve、不可变 snapshot、composer token 和 runtime context 分别交给单一 owner；UI 与 Kernel 共用 shared 运行时校验，避免协议漂移。

首次 diff-only maintainability guard 发现输入组件和 inline-token 工具首次越过文件预算。修正后新增 `use-system-object-reference-select` hook，并把 composer 序列化从混合工具拆到独立 utils；本次分组纠偏又移除 token composer 的参数原地 mutation，并把产品插件装配从状态 hook 收敛到 `chat-input-product-plugin-adapters.utils.ts`。文件/文件夹拆分后，再把同时服务 `@` 与 `/` 面板的 Panel App 排序和条目构造移入 `panel-app-input-surface-items.utils.ts`，避免资源引用插件承担第二种资源的共享实现。最终 guard 为 Errors 0；仍提示引用条目工具接近预算、交互测试因覆盖新增状态而增长，以及若干既有目录预算例外，这些文件职责仍内聚，未为机械消除 warning 继续切碎。由于改动跨模块且改变 owner/文件边界，已按条件完成主观复核，结论为无本次新增可维护性阻塞问题。

## NPM 包发布记录

本轮尚未发布 NPM 包。`.changeset/fix-inbox-continue-chat.md` 已为以下包声明 patch，状态均为待统一发布：

- `@nextclaw/shared`
- `@nextclaw/kernel`
- `@nextclaw/server`
- `@nextclaw/client-sdk`
- `@nextclaw/agent-chat-ui`
- `@nextclaw/ui`
