# Single HTML Panel Apps Design

日期：2026-05-26

相关文档：

- [NextClaw 产品愿景](../VISION.md)
- [Web/Desktop Browser Panel Design](./2026-04-17-web-desktop-browser-panel-design.md)
- [Workspace Templates Plan](./workspace-templates.plan.md)

## 1. 背景

本设计沉淀一次关于 NextClaw 下一个轻量扩展形态的讨论。

讨论起点不是“再加一个右侧 iframe 功能”，而是一个更上层的产品问题：

**NextClaw 如何让用户和 AI 低成本生成、使用、保留或丢弃一些真的能用的小应用，而不把主产品变成功能堆叠。**

当前已经存在几类扩展或能力载体：

- `skills`：面向 AI 的过程能力，回答“怎么做事”。
- `plugin / connector / runtime`：面向系统的外部能力，回答“能接入什么”。
- 右侧 `DocBrowser`：面向用户的信息面板，已经证明 dock / float / tabs / iframe 这类交互可以和主聊天区共存。

但还缺一种更轻、更直接的界面扩展载体：用户或 AI 可以生成一个单页 HTML，小成本挂到 NextClaw 里，用完也能直接删除。

这个方向暂命名为 **Panel Apps**。第一版只讨论 **Single HTML Panel Apps**。

## 2. 上位目标

这项能力必须服务 NextClaw 的长期愿景，而不是制造一个孤立功能点。

目标包括：

- 增强 NextClaw 作为个人操作层的统一入口地位。
- 让 Vibe Coding 产物有一个自然宿主，而不是必须部署服务器、开发桌面应用或塞进主产品。
- 给 AI 生成的临时或半持久交互界面一个低成本落点。
- 让轻量小工具可以进入 NextClaw 的工作台，但不要求它们变成正式内置功能。
- 为未来 bridge / SDK / system API 留边界，但第一版不急着开放系统能力。

这不是传统 App Store，也不是插件系统替代品。它是一种轻量界面表面。

## 3. 核心结论

第一版只做单文件 HTML 应用。

文件发现合同：

```text
<agents.defaults.workspace>/panels/*.panel.html
```

默认路径为：

```text
~/.nextclaw/workspace/panels/*.panel.html
```

这里的 `workspace` 明确指 NextClaw 配置里的 `agents.defaults.workspace`，不是 pnpm workspace，也不是 chat session 绑定的 `projectRoot`。

示例结构：

```text
workspace/
  AGENTS.md
  memory/
  skills/
  panels/
    todo.panel.html
    project-dashboard.panel.html
```

第一版不扫描项目目录，不扫描 `sessionProjectRoot`，不引入多来源合并。未来如果要支持项目级 panel，可以另行设计：

```text
<sessionProjectRoot>/.agents/panels/*.panel.html
```

但它不属于第一版。

## 4. 产品形态

### 4.1 入口

第一版入口放在左下角设置菜单中。

推荐菜单项：

```text
Panel Apps / 面板应用
```

点击后打开右侧面板。这个入口适合作为早期实验入口：不打扰主工作流，同时足够容易发现。

长期如果 Panel Apps 被证明是核心能力，可以再评估是否提升为一级入口、快捷入口或会话相关入口。

### 4.2 右侧面板

右侧面板复用现有 `DocBrowser` 已经跑通的产品经验：

- docked right panel
- floating mode 可延后，不作为首版硬要求
- 顶部标题和关闭按钮
- 内容区承载列表页或 iframe 详情页

第一版建议新增一个 Panel Apps 列表页：

- 展示所有发现到的 `*.panel.html`
- 列表项显示文件名派生标题
- 点击列表项后在同一个右侧面板中打开该 HTML
- 提供返回列表、刷新列表、刷新当前应用三个最小动作

不建议第一版直接把每个 panel app 都做成复杂多标签。可以先保持“列表页 -> 当前 app 详情页”的简单模型。未来如果复用 browser tab 模型，应确保 tab owner 是右侧面板能力 owner，而不是为 panel apps 另造一套平行标签系统。

## 5. 首版能力边界

第一版包含：

- 后端读取 `agents.defaults.workspace`。
- 后端发现 `panels/*.panel.html`。
- 后端返回 panel app 列表。
- 后端提供可被 iframe 加载的单个 panel HTML 内容 URL。
- 前端设置菜单增加入口。
- 前端右侧面板展示列表页。
- 前端 iframe 打开单个 HTML。
- 基础空状态和错误状态。

第一版不包含：

- manifest。
- 多文件应用。
- build pipeline。
- npm package app。
- marketplace。
- 安装、卸载、版本管理。
- 数据库注册。
- SDK。
- bridge。
- 调用 NextClaw API 的权限系统。
- 项目级 panel 来源。
- 后台运行能力。
- 自动注入脚本。

这个边界的意义是把产品原语先跑通：**一个 HTML 文件能被 NextClaw 发现并打开。**

## 6. 发现与访问合同

### 6.1 文件发现

Panel App 的唯一首版来源是：

```text
resolveWorkspacePath(config.agents.defaults.workspace)/panels
```

只识别直接子文件：

```text
*.panel.html
```

不递归扫描子目录。

文件名派生展示名：

```text
todo.panel.html -> todo
project-dashboard.panel.html -> project dashboard
```

后续如需更好的标题，可以再引入 `<title>` 解析或 manifest；第一版不做。

### 6.2 访问方式

后端应提供受控读取入口，而不是让前端直接拼本地文件路径。

推荐 API 形态：

```text
GET /api/panel-apps
GET /api/panel-apps/:id/content
```

其中 `id` 由后端根据文件名生成，前端不直接传任意路径。

原因：

- 避免把本地路径读权限暴露给前端。
- 避免相对路径绕过。
- 让未来权限、hash、mtime、缓存、项目级来源合并有稳定边界。

## 7. 安全边界

第一版默认把 Panel Apps 视为用户本地信任内容，但仍然不能无边界放开。

iframe 建议使用 sandbox：

```text
sandbox="allow-scripts allow-forms"
```

是否允许 `allow-same-origin` 需要实现阶段再结合内容 URL 方式确认。默认应偏保守，除非首版渲染确实需要同源能力。

第一版不向 iframe 注入 NextClaw bridge，不开放系统 API，不允许 panel app 直接获得会话上下文。这样可以先避开权限系统和用户数据泄漏问题。

如果用户自己在 HTML 中写 `fetch` 请求，它只能按浏览器同源、CORS 与服务端认证规则运行；这不被定义为正式 Panel App SDK。

## 8. Owner 与分层

### 8.1 正确 owner

Panel Apps 的文件发现 owner 应在 kernel manager，而不是 server 或前端。

推荐领域 owner：

```text
PanelAppManager
```

职责：

- 读取配置中的 NextClaw workspace。
- 解析 `panels/` 目录。
- 校验 `*.panel.html` 文件名。
- 生成稳定 id。
- 返回列表 view model。
- 按 id 获取对应 HTML 内容。

不负责：

- iframe 状态。
- 右侧面板 tab 状态。
- panel app 与 AI 的通信。
- 安装、卸载、版本管理。

### 8.2 UI owner

前端应把 Panel Apps 当成右侧浏览/内容面板的一类内容，而不是塞进 chat session workspace panel。

原因：

- chat session workspace panel 当前 owner 是会话内的 child session、文件预览和 cron tab。
- Panel Apps 第一版来源是全局 NextClaw workspace，不属于某个 session 的 `projectRoot`。
- 强行放进 chat workspace panel 会混淆“会话工作区”和“全局轻量应用入口”。

因此推荐在现有 doc/browser 面板能力附近扩展：

- 列表页：`panel-apps` content kind。
- 详情页：`panel-app` content kind。
- 或者在实现阶段将 `DocBrowser` 逐步改名为更通用的 `RightContentPanel` / `ContentBrowser`。

改名不是首版硬要求。首版可以先在现有结构中最小扩展，但要避免把“文档浏览器”继续补丁式膨胀成多个互不相干的职责。

## 9. Kernel 与薄 server 设计

### 9.1 设计原则

Panel Apps 虽然第一版很小，但它已经是一个新的产品实体。它的领域 owner 不应放在 `nextclaw-server`，因为 server 的职责应该始终是薄 HTTP 边界：认证、参数读取、调用 kernel、返回响应。

真正 owner 应进入 `nextclaw-kernel`，成为 kernel 对象图的一部分。

本设计命中的工程原则：

- `ownership-topology`：`NextclawKernel` 显式持有长期业务 owner，server 只消费 kernel host。
- `stable-collaboration-path`：Panel Apps manager 直接持有 `ConfigManager`，不让 server 读取 workspace 后再传给它。
- `fact-source-ownership`：workspace 配置事实来自 kernel 的 `ConfigManager`，Panel Apps manager 自己从稳定协作者读取并推导 panels 路径。
- `information-expert`：`PanelAppManager` 最知道 workspace panels 目录、文件名规则、id 映射和读取范围。
- `complete-owner`：发现、校验、id 生成、列表 view model、按 id 获取内容应由同一个领域 owner 闭合。
- `cqs-pure-read`：列表和内容读取都是纯查询，不暗中安装、注册或修改状态。
- `simple-structure-first`：第一版不引入 repository / store / registry 持久层，因为没有数据库状态，也没有跨进程缓存不变量。
- `responsibility-surface-minimization`：server controller 只传 HTTP path 里的 `id`；workspace 路径解析由 kernel manager 内部完成。

因此推荐新增 kernel manager：

```text
packages/nextclaw-kernel/src/managers/panel-app.manager.ts
packages/nextclaw-kernel/src/managers/__tests__/panel-app.manager.test.ts
```

并在 kernel 公共出口暴露：

```text
packages/nextclaw-kernel/src/index.ts
```

server 只新增薄 controller 和路由：

```text
packages/nextclaw-server/src/features/panel-apps/
  controllers/
    panel-apps.controller.ts
    panel-apps.controller.test.ts
  index.ts
```

server 不新增 `services/`。如果 server feature 下出现 `panel-apps.service.ts`，说明 owner 又放错了。

### 9.2 Kernel manager owner

推荐 owner：

```ts
class PanelAppManager {
  listPanelApps = async (): Promise<PanelAppList> => {}
  getPanelAppContent = async (id: string): Promise<PanelAppContent> => {}
}
```

构造参数使用稳定业务依赖直连：

```ts
constructor(private readonly params: { configManager: ConfigManager }) {}
```

不要把 `workspacePath`、`panelsDir`、`resolveWorkspacePath`、`readFile` 等细碎函数全部从外部注入进来。那些是这个 manager 自己应该知道和维护的领域细节。

manager 内部职责：

- 通过 `configManager.config` 读取当前配置。
- 使用既有 `getWorkspacePathFromConfig` / `resolveWorkspacePath` 这类 config/path owner 解析 workspace。
- 得到 `panelsDir = join(workspacePath, "panels")`。
- 列出直接子文件。
- 只接受文件名满足 `*.panel.html` 的普通文件。
- 为每个文件生成稳定 id。
- 按 id 找回对应文件。
- 获取 HTML 内容并返回 content type 所需数据。

推荐 kernel domain 类型：

```ts
export type PanelAppEntry = {
  id: string;
  fileName: string;
  title: string;
  contentPath: string;
  updatedAt: string;
  sizeBytes: number;
};

export type PanelAppList = {
  workspacePath: string;
  panelsPath: string;
  entries: PanelAppEntry[];
};

export type PanelAppContent = {
  id: string;
  fileName: string;
  html: string;
  contentType: "text/html; charset=utf-8";
};
```

`contentPath` 由后端生成，例如：

```text
/api/panel-apps/:id/content
```

这里存在一个边界取舍：`contentPath` 是 HTTP 表示层字段，看起来像 server 责任。但第一版可以让 kernel manager 使用固定 public route contract 生成它，因为这是 Panel App 对 UI 的稳定打开入口，不是 server 临时细节。如果后续出现多宿主差异，再把 `contentPath` 映射收回 server controller。

`NextclawKernel` 中新增，属性名也显式带 `Manager`：

```ts
readonly panelAppManager: PanelAppManager;
```

初始化位置在 `configManager` 之后：

```ts
this.panelAppManager = new PanelAppManager({
  configManager: this.configManager,
});
```

`UiKernelHost` 增加 `panelAppManager`，server controller 通过 `options.kernel.panelAppManager` 调用。测试里的 `createRouterTestKernel()` 提供默认 stub，避免每个无关 router test 都手写。

### 9.3 id 与路径安全

第一版不要把任意路径交给前端，也不要让 `:id` 直接等于未经约束的相对路径。

推荐 id 规则：

```text
base64url(fileName)
```

读取内容时：

1. decode id 得到 `fileName`。
2. 校验它不含 `/`、`\`、空字节。
3. 校验它满足 `*.panel.html`。
4. 拼接到 `panelsDir`。
5. `stat` 确认是普通文件。

这比维护内存 registry 简单，也避免列表刷新后 id 失效。id 只代表文件名，不代表任意路径。

如果实现想进一步保守，也可以只允许正则：

```text
^[a-zA-Z0-9._-]+\.panel\.html$
```

但不建议第一版限制过窄到只允许 kebab-case，因为用户或 AI 可能会自然生成 `todo.panel.html`、`project_dashboard.panel.html` 这类文件。展示名可以规整，文件名合同只要保证安全即可。

### 9.4 薄 server controller 与路由

controller 只负责 HTTP 翻译：

```ts
class PanelAppsRoutesController {
  constructor(private readonly panelAppManager: PanelAppManager) {}

  readonly list = async (c: Context) => {}
  readonly getPanelAppContent = async (c: Context) => {}
}
```

路由挂载：

```text
GET /api/panel-apps
GET /api/panel-apps/:id/content
```

`GET /api/panel-apps` 返回标准 JSON `ok(payload)`。

`GET /api/panel-apps/:id/content` 直接返回 `text/html; charset=utf-8`，而不是包在 JSON 里。这样 iframe 可以直接加载 URL。错误时返回普通错误响应即可。

这个 endpoint 仍然在 `/api/*` 认证保护下，沿用现有 router auth 中间件。

server 层不做：

- workspace 解析。
- panels 目录扫描。
- id decode。
- 文件名规则校验。
- HTML 读取。
- 内容缓存。

这些都属于 `PanelAppManager`。

### 9.5 Client SDK 与 UI API

因为前端现在通过 `@nextclaw/client-sdk` 的 `NextClawClient` 统一访问 API，Panel Apps 也应该接入同一层，而不是在 UI 里手写 fetch。

推荐新增：

```text
packages/nextclaw-client-sdk/src/services/panel-apps.service.ts
```

并在 `NextClawClient` 上暴露：

```ts
readonly panelApps: PanelAppsClientService;
```

UI 侧再新增轻量 wrapper：

```text
packages/nextclaw-ui/src/shared/lib/api/utils/panel-apps.utils.ts
```

首版只需要：

```ts
listPanelApps(): Promise<PanelAppListView>
```

iframe 的 `src` 直接使用 server 返回的 `contentPath`，不需要 client SDK 去读取 HTML 内容。

共享类型有两层：

```text
packages/nextclaw-kernel/src/managers/panel-app.manager.ts
packages/nextclaw-server/src/shared/types/server-api.types.ts
```

kernel 类型是领域事实；server API 类型可以复用或别名这些类型，用于 client SDK 对外导出。不要让 server 自己重新定义一套字段清单，避免领域合同漂移。

如果 TS 依赖方向允许，`server-api.types.ts` 可以：

```ts
export type {
  PanelAppEntry as PanelAppEntryView,
  PanelAppList as PanelAppListView,
} from "@nextclaw/kernel";
```

如果构建边界不适合这样导出，则在 server types 中保留同名 API view 类型，但必须把它视为 kernel contract 的投影，并由 controller 测试覆盖字段一致性。

### 9.6 init 与目录创建

`panels/` 是 workspace 模板的一部分，推荐由 `WorkspaceManager.createWorkspaceTemplates()` 创建：

```text
workspace/
  panels/
```

同时，`PanelAppManager.listPanelApps()` 可以保证读取语义稳定：

- 如果 workspace 不存在，按现有 init 流程通常已创建；manager 不负责创建整个 workspace。
- 如果 `panels/` 不存在，manager 返回空列表。

推荐实现：`init` 创建，manager 读路径时如果目录不存在返回空列表，不在查询路径里隐式创建。这样 `listPanelApps` 保持纯读，符合 `cqs-pure-read`。

如果产品希望“打开 Panel Apps 入口后自动出现 panels 目录”，也应由明确的 init/backfill 动作承担，而不是普通查询接口偷偷修改文件系统。

### 9.7 验证重点

后端至少需要覆盖：

- kernel manager 单测覆盖列表和内容读取主逻辑。
- 空 `panels/` 返回空 entries。
- 只列出直接子层 `*.panel.html`。
- 忽略子目录、非 HTML、`*.html`、`*.panel.htm`。
- id 不能读取 `../x`、带 slash 的路径、非 panel 后缀文件。
- server controller 测试覆盖 content endpoint 返回 `text/html; charset=utf-8`。
- 删除文件后 content endpoint 返回 404 或结构化错误。

首版不需要测试 bridge、SDK 注入、项目级 panel，因为这些不是第一版能力。

## 10. 内置 skill 设计

Panel Apps 需要配套一个内置 skill，否则 AI 不会稳定知道：当用户想要一个轻量交互界面时，可以直接生成 `*.panel.html`。

推荐新增 builtin skill：

```text
packages/nextclaw-core/src/features/agent/shared/skills/panel-app-creator/SKILL.md
```

skill 名称：

```text
panel-app-creator
```

description 应覆盖真实触发语境：

```text
Use when the user asks to create, modify, or brainstorm a lightweight NextClaw Panel App, single-file HTML app, right-side panel tool, disposable UI, dashboard, calculator, form, todo board, visualization, or AI-generated mini app inside the NextClaw workspace panels directory.
```

项目内 skill 默认中文，因此正文用中文。

skill 应告诉 AI：

- Panel App 第一版是单文件 HTML。
- 文件应写到 `<agents.defaults.workspace>/panels/*.panel.html`。
- 默认 workspace 是 `~/.nextclaw/workspace`，但应优先通过 NextClaw 配置或已知环境确认真实 workspace。
- 不要写 manifest。
- 不要创建多文件应用。
- 不要假设 bridge / SDK 已存在。
- HTML 可以内联 CSS/JS。
- 文件名建议使用 kebab-case，并以 `.panel.html` 结尾。
- 如果用户要求 AI 功能，第一版只能在 UI 上放按钮或说明，不要伪造 NextClaw bridge。
- 生成后提示用户从设置菜单打开 `面板应用 / Panel Apps`。

这个 skill 不是实现 Panel Apps 的开发流程 skill，而是用户使用能力时的创作 skill。它让 NextClaw 可以“自己给自己开发一个小面板”，但仍然遵守第一版运行时边界。

是否需要把它加入 `AGENTS.md`：不需要。它不是每一轮都必须知道的规则。只要 description 足够明确，SkillsLoader 会在用户要求创建小面板、小应用、HTML 工具、dashboard 等场景时触发。

如果未来要让用户通过 `/new-panel-app` 之类命令生成面板，再考虑命令入口；第一版不需要。

## 11. 未来演进

只有第一版被证明有真实价值后，才考虑后续能力：

1. **Project Panel Apps**
   从 `sessionProjectRoot/.agents/panels/*.panel.html` 发现项目级面板，并在列表中区分 global / project 来源。

2. **Bridge**
   通过 `postMessage` 暴露极少数受控能力，例如获取当前主题、触发一次 AI 意图、请求当前 session 摘要。

3. **Manifest**
   为标题、图标、描述、权限声明、推荐尺寸提供显式合同。

4. **AI 生成闭环**
   用户说“给我做一个 xxx 小面板”，AI 生成 `*.panel.html` 到 workspace panels 目录，NextClaw 自动刷新并打开。

5. **Marketplace**
   只有当 panel apps 有稳定 manifest、权限模型和安装流程后再考虑。

这些都不进入第一版。

## 12. 验收标准

第一版完成时，至少满足：

- 在 `~/.nextclaw/workspace/panels/todo.panel.html` 放入单文件 HTML 后，NextClaw 能在 Panel Apps 列表中发现它。
- 点击列表项后，右侧面板能 iframe 打开该 HTML。
- 删除或重命名文件后，刷新列表能反映变化。
- 没有任何 panel 文件时，有清晰空状态。
- HTML 读取只允许 `panels/*.panel.html` 范围，不接受任意路径读取。
- 不需要部署服务器、不需要 build、不需要 manifest。
- 不触碰 chat session `projectRoot` 语义。
- 不向 iframe 暴露 NextClaw SDK 或系统 API。

一句话验收：

**用户或 AI 创建一个 `*.panel.html` 文件后，NextClaw 可以立刻把它作为右侧轻量应用打开；不用安装、部署或把它变成主产品功能。**

## 13. 实现前待 review 问题

实现前还需要确认：

1. 面板列表入口文案使用 `Panel Apps`、`Panels`，还是中文 `面板应用`。
2. 首版是否复用 `DocBrowser` 状态，还是先引入更通用的右侧 content panel 命名。
3. iframe sandbox 是否允许 `allow-same-origin`。
4. HTML 内容 URL 是否直接返回文件内容，还是通过临时 blob/data URL 渲染。
5. `panels/` 目录是否由 `init` 自动创建，还是首次发现时懒创建。

推荐默认：

- 文案：中文环境显示 `面板应用`，英文环境显示 `Panel Apps`。
- 状态：先复用右侧 browser/content panel 的已有能力，避免首版重写右侧面板。
- sandbox：默认不加 `allow-same-origin`，除非实现验证必须打开。
- 内容 URL：由后端提供受控 content endpoint。
- 目录创建：`init` 创建 `panels/`，服务端发现时也可保证目录存在。
