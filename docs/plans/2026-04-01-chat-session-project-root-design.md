# Chat Session Project Root Design

**Goal:** 让 NextClaw 的聊天会话重新具备“围绕本地项目工作”的体验，同时避免引入沉重的新实体或 Codex 特判；项目绑定能力必须成为 `native / codex / claude / future runtimes` 共用的最小产品抽象。

**Architecture:** 不新增独立 `Project` 数据模型，直接把“项目 = 本地目录”收敛为会话元数据字段 `project_root`。`session` 仍然是唯一产品主语，`project_root` 只是让会话获得明确的本地目录上下文；运行时、skills、memory、sidebar 视图都围绕这一字段做统一消费与派生。

**Tech Stack:** TypeScript, NextClaw UI, Hono UI router, NCP session API, runtime plugin registry, existing session metadata pipeline

---

## 1. 这份文档解决什么问题

当前 NextClaw 已经集成了 `Codex` 等外部 runtime，但产品体验仍然是“会话中心”，还不是“项目中心”。

这会带来几个直接问题：

- 会话没有稳定的本地目录归属。
- `Codex` 无法像本地同类产品一样围绕某个项目目录提供上下文增强。
- project-specific skills、bootstrap、memory、工具执行目录等能力无法自然收敛。
- 左侧会话列表只能按时间/搜索理解，无法按项目组织。

结果是：

- 我们虽然接入了 runtime 能力，
- 但把最有价值的“围绕项目工作的产品体验”削掉了。

这里真正缺的不是一个 `Codex workingDirectory` 参数，而是一个对所有 runtime 都成立的、足够小但足够有穿透力的产品抽象。

## 2. 一句话结论

**v1 方案：不引入独立 `Project` 实体，不新增 `projects` 表；直接把“项目”定义为 `session.metadata.project_root` 指向的本地目录路径。**

也就是说：

- `session` 仍然是产品主语；
- `project_root` 是会话的可选上下文字段；
- sidebar 的 “project view” 是基于 `project_root` 派生出来的视图，而不是另一套存储模型；
- runtime 的有效工作目录优先取 `project_root`，没有时再回退到全局 workspace。

这是当前最简单、最通用、最可长期演进的方案。

## 2.1 当前实现范围：Phase 1 轻量版

上面描述的是目标抽象与长期方向，但**本次实际交付范围明确收敛为轻量版 phase 1**，先解决最核心的“会话可绑定本地目录，并真正影响 runtime”问题。

本次会做：

- 会话 header 从单一删除按钮升级为“更多操作”菜单
- 菜单内支持：
  - `设置项目目录`
  - `清除项目目录`
  - `删除会话`
- `设置项目目录` 使用服务端驱动的目录选择器，浏览的是运行 NextClaw 服务的那台机器上的目录，而不是浏览器本机目录
- 用户可以在会话创建后的任意时刻设置或清除项目目录
- 设置成功后，header 显示轻量 project badge
- `project_root` 通过现有 session metadata 持久化
- `project_root` 真正接入 `native / codex / claude` 的有效工作目录解析
- runtime prompt 会显式区分：
  - `Current project directory`
  - `NextClaw workspace directory`（仅辅助背景）

本次明确不做：

- 独立 `Project` 实体
- sidebar project 视图
- project 列表/分组/筛选系统
- 自动推断项目目录
- 更重的 project bootstrap 体系

这样做的原因是：

- 先用最小抽象恢复“围绕本地目录工作”的关键体验
- 避免在真正验证价值前提前引入更重的产品结构
- 为未来的 project-first 视图保留自然演进空间，但不预支复杂度

## 3. 设计原则

### 3.1 最小抽象优先

这里最应该避免的，是为了恢复“项目体验”而引入一个比问题本身更复杂的新系统。

因此 v1 明确不做：

- 独立 `Project` 产品实体
- `projectId` / `projects` 表
- project-specific session store
- project-specific runtime registry
- 根据 `cwd`、当前仓库、打开页面、浏览器状态自动推断项目

v1 只承认一个最小事实：

**某个会话可以显式绑定到一个本地目录。**

### 3.2 产品抽象必须 runtime-agnostic

这个能力不能是 `Codex` 特性。

如果我们把它做成：

- `codex.projectPath`
- `codexWorkspace`
- `codexRepoRoot`

那么后续 `Claude`、`native`、未来任何 runtime 都会重复发明同一抽象。

正确做法是：

- 把目录绑定能力放到 `session metadata`
- 让所有 runtime 通过同一字段消费

### 3.3 行为必须明确、可预测

依据 `predictable-behavior-first`，这里必须避免：

- 自动猜项目
- 依赖当前仓库 `cwd`
- 会话进入不同环境后行为漂移
- 读接口偷偷触发目录扫描、能力注册、外部探测

因此本方案坚持：

- `project_root` 必须由用户显式设置
- 系统不做隐式推断
- 会话如果没有绑定目录，就明确走全局 workspace
- 如果目录失效，就明确暴露失效状态，不做静默 rescue

## 4. 为什么不是独立 Project 实体

从长期看，独立 `Project` 实体当然可以想象出很多扩展能力，但当前阶段引入它是不必要的。

原因有三：

### 4.1 当前问题的真相源就是本地目录

你当前想恢复的体验，本质上不是：

- 项目协作对象
- 云端业务对象
- 知识空间对象

而是：

- “这个会话到底在围绕哪个本地目录工作”

既然真相源是目录，就不该先引入一个更高层对象再去包它。

### 4.2 独立实体会提前制造同步问题

一旦有 `Project` 实体，就会立刻出现：

- 项目和目录谁是真相源
- 目录重命名怎么同步
- 多会话如何共享 project metadata
- session 和 project 的生命周期差异

这些问题当前都不是必须解。

### 4.3 侧边栏 project 视图本质上是派生视图

用户想看到的是“按项目看会话”，这不等于产品内部必须先有 `Project` 表。

只要 `session.metadata.project_root` 存在：

- 我们就能把会话按目录分组；
- 就能做 project-first 的 sidebar；
- 也能为运行时提供稳定目录上下文。

所以 v1 正确方向是：

**先让 `project_root` 成为强语义字段，再看未来是否真的需要独立实体。**

## 5. 数据模型

### 5.1 新增字段

在会话元数据中新增：

```json
{
  "project_root": "/absolute/path/to/project"
}
```

语义约束：

- 值必须是本地绝对目录路径
- 值为空时视为未绑定项目
- 这是会话的唯一项目真相源

### 5.2 不新增持久化实体

v1 不新增：

- `Project` type
- `projects` collection/table
- `project_id`

### 5.3 前端展示字段

前端列表适配层可以从 `project_root` 派生：

- `projectRoot`
- `projectName`

其中：

- `projectRoot` 为真实值
- `projectName` 仅为 `basename(projectRoot)` 的展示值，不是持久化真相源

## 6. 会话行为约束

### 6.1 当前 phase 1 的修改规则

当前轻量版**允许用户在会话任意阶段修改或清除 `project_root`**。

这是一个有意识的阶段性选择：

- 用户明确希望第一版先支持“任何时候都可以设置”
- 这样交互最轻，认知成本最低
- 也更容易验证真实使用习惯

但产品语义必须明确：

- 修改项目目录只影响**后续消息 / 后续工具执行**
- 不会改写历史消息的语义
- 不会尝试重放历史 run

未来如果发现“会话中途换目录”会显著制造理解歧义，再考虑升级为“首条消息后锁定”或“切换目录时提示克隆新会话”。

### 6.2 未绑定项目的会话

如果会话没有 `project_root`：

- 它仍然是合法会话
- runtime 使用全局 workspace
- 未来若引入 project 视图，可归入“未绑定项目”

## 7. Runtime Contract

### 7.1 有效工作目录

统一规则：

```text
effective_working_directory =
  session.metadata.project_root
  ?? runtime/plugin configured workingDirectory
  ?? global workspace
```

注意：

- `project_root` 是用户对该会话的显式绑定，优先级必须最高。
- plugin 层的 `workingDirectory` 退化为“无项目绑定时的 runtime 默认值”。
- 全局 workspace 是最后兜底，不再承担“项目语义”。

### 7.2 runtime prompt / bootstrap

`buildRuntimeUserPrompt(...)` 的 `workspace` 参数应使用 `effective_working_directory`。

这意味着：

- bootstrap files
- requested skills
- project-specific skills loader
- memory tools

都自然围绕该目录运行，而不是继续围绕全局 workspace。

除此之外，prompt 暴露给模型的语义也必须调整：

- `project_root` 存在时，它应成为“当前项目”的主语
- `NextClaw workspace` 仍可提供给模型，但只能作为宿主环境背景，不得替代当前项目语义
- 即使当前项目目录下没有 `AGENTS.md` / `SOUL.md` 等 bootstrap 文件，也必须显式告诉模型当前项目目录是什么，避免模型退回到“只看见 workspace”的状态

换句话说，不能只把 `cwd` 设对，还要把“你现在围绕哪个项目工作”说清楚。

### 7.3 多 runtime 一致性

`native / codex / claude / future runtimes` 都只消费：

- `project_root`
- `session_type`
- 其它既有 session metadata

不为任何单一 runtime 设计额外的 project 字段。

## 8. API 与契约调整

### 8.1 Session Patch API

现有 `SessionPatchUpdate` 目前只显式支持：

- `label`
- `preferredModel`
- `preferredThinking`
- `sessionType`

v1 应新增：

- `projectRoot?: string | null`

行为：

- 非空字符串：绑定目录
- `null` 或空值：清空绑定
- 若会话已锁定：返回明确错误

### 8.2 绑定校验

绑定时必须校验：

- 路径可被标准化为绝对路径
- 路径存在
- 路径是目录

不满足时，返回显式错误，不写入 session metadata。

### 8.3 会话摘要输出

后端摘要与前端适配层应把 `project_root` 读出来，供：

- sidebar 分组
- session header
- project picker 默认值

使用。

## 9. Sidebar 设计

### 9.1 视图模型

左侧 sidebar 由当前单一“时间序视图”升级为两种视图：

- `recent`
- `project`

默认保持 `recent`，避免打断现有路径。

### 9.2 Project View 结构

`project` 视图下：

- 顶层节点是 project group
- group key 直接使用 `project_root`
- group label 默认使用目录名
- 组内展示属于该目录的会话

未绑定目录的会话统一归入：

- `Unassigned`
- 或 `No Project`

### 9.3 为什么 project view 做成派生视图

因为这里真正需要的是“组织方式”，不是另一套会话系统。

把它做成派生视图可以保证：

- 不引入额外状态同步
- 列表刷新逻辑不分叉
- 搜索、选中、路由跳转仍围绕原有 session key

## 10. 会话创建与编辑 UX

### 10.1 新建会话

新建会话时提供一个轻量的 project picker：

- 可手动输入服务端目录
- 或通过目录选择器浏览服务端机器目录

如果用户不选：

- 会话仍可创建
- 但不具备 project-bound 行为

### 10.2 已存在未开始会话

对“尚未发送首条用户消息”的会话：

- 允许编辑 `project_root`

### 10.3 已开始会话

当前轻量版对已经有首条用户消息的会话仍然允许修改或清除 `project_root`，但语义必须明确：

- 只影响后续消息与后续工具执行
- 不追溯改写历史消息语义
- 不尝试重放历史 run

未来如果这条路径在真实使用中产生明显歧义，再考虑升级为“已开始会话只允许克隆新会话再切目录”。

## 11. 目录失效与异常处理

### 11.1 目录失效

如果 session 已绑定的目录后来被删除、移动或不可访问：

- 不自动改绑
- 不回退到别的路径
- 不猜测用户是不是想用当前仓库目录

系统行为应为：

- UI 明确标记该 project 不可用
- runtime 在需要访问该目录时显式失败

### 11.2 为什么不自动修复

自动修复会制造两个严重问题：

- 用户不知道系统实际上在用哪个目录
- 机器环境变化会导致会话行为漂移

这违背“行为可预测”的基本原则。

## 12. 对现有代码边界的影响

### 12.1 服务端

主要影响：

- [`packages/nextclaw-server/src/ui/session-preference-patch.ts`](../../packages/nextclaw-server/src/ui/session-preference-patch.ts)
- [`packages/nextclaw-server/src/ui/router/ncp-session.controller.ts`](../../packages/nextclaw-server/src/ui/router/ncp-session.controller.ts)
- [`packages/nextclaw-server/src/ui/session-list-metadata.ts`](../../packages/nextclaw-server/src/ui/session-list-metadata.ts)
- [`packages/nextclaw-server/src/ui/types.ts`](../../packages/nextclaw-server/src/ui/types.ts)

### 12.2 前端

主要影响：

- [`packages/nextclaw-ui/src/api/types.ts`](../../packages/nextclaw-ui/src/api/types.ts)
- [`packages/nextclaw-ui/src/components/chat/ncp/ncp-session-adapter.ts`](../../packages/nextclaw-ui/src/components/chat/ncp/ncp-session-adapter.ts)
- [`packages/nextclaw-ui/src/components/chat/ncp/use-ncp-session-list-view.ts`](../../packages/nextclaw-ui/src/components/chat/ncp/use-ncp-session-list-view.ts)
- [`packages/nextclaw-ui/src/components/chat/ChatSidebar.tsx`](../../packages/nextclaw-ui/src/components/chat/ChatSidebar.tsx)
- [`packages/nextclaw-ui/src/components/chat/stores/chat-session-list.store.ts`](../../packages/nextclaw-ui/src/components/chat/stores/chat-session-list.store.ts)

### 12.3 Runtime

主要影响：

- [`packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk/src/index.ts`](../../packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk/src/index.ts)
- [`packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk/src/codex-input-builder.ts`](../../packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk/src/codex-input-builder.ts)
- [`packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk/src/claude-runtime-context.ts`](../../packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk/src/claude-runtime-context.ts)
- [`packages/nextclaw-openclaw-compat/src/plugins/runtime.ts`](../../packages/nextclaw-openclaw-compat/src/plugins/runtime.ts)
- [`packages/nextclaw-core/src/agent/bootstrap-context.ts`](../../packages/nextclaw-core/src/agent/bootstrap-context.ts)
- [`packages/nextclaw-core/src/agent/runtime-user-prompt.ts`](../../packages/nextclaw-core/src/agent/runtime-user-prompt.ts)

后续 `claude` 与 `native` runtime 也应消费相同字段，但不需要新抽象层。

## 12.4 Remote-aware Path Picker

由于 NextClaw 可能部署在远程机器上，前端页面所在设备与服务端文件系统并不一定是同一台机器，所以项目目录选择不能依赖浏览器或桌面本地文件选择器。

本方案补充一条全局能力：

- 服务端提供纯读的路径浏览接口
- 前端复用统一的路径选择对话框
- 当前先以“目录选择”为目标，未来可以自然扩展到文件选择

这样做的好处是：

- 产品语义正确，避免“UI 选了本机目录，但 runtime 实际跑在远程服务器”
- 能被会话项目目录之外的其他场景复用
- 保持抽象足够小，不引入新的 Project 模型

## 13. v1 不做什么

v1 明确不做：

- 独立 Project 实体和管理页
- 自动扫描本地目录生成项目列表
- 根据 git repo 状态自动猜项目
- 多目录 workspace project
- 一个会话同时绑定多个项目
- project-specific provider 配置
- 已开始会话的 project 重绑
- 以 project 为中心的复杂权限系统

## 14. 推进顺序建议

### Phase 1: 打通最小真相源

- 增加 `project_root` patch 能力
- 会话摘要输出并适配 `project_root`
- runtime 改为消费 `effective_working_directory`

### Phase 2: 恢复最小产品体验

- 新建会话支持绑定目录
- 会话 header 展示当前 project
- 已锁定会话显示不可编辑状态

### Phase 3: 提升组织效率

- sidebar 增加 `project` 视图
- 未绑定项目分组
- 搜索与筛选在 project view 下继续成立

## 15. 最终判断

这件事的关键，不是“给 Codex 增加一个更像本地产品的参数”，而是：

**让 NextClaw 的 `session` 恢复对本地项目目录的明确归属。**

一旦 `project_root` 成为会话的一等上下文字段：

- runtime 会重新获得稳定工作目录
- skills / memory / bootstrap 会重新围绕项目组织
- sidebar 可以自然切出 project 视图
- 产品保持简单，没有过度抽象

这是当前最符合 NextClaw 方向的方案：

- 抽象更少
- 通用性足够
- 不做 Codex 特判
- 可预测
- 后续真要升级成更高层 `Project` 实体，也不会推翻今天的数据模型

因为今天的最小事实始终成立：

**一个会话，可以显式绑定到一个本地目录。**
