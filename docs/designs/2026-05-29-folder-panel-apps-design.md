# Folder Panel Apps 方案设计

## 背景

当前 Panel App 只支持 `*.panel.html` 单文件形态。它非常适合明确一次性、明确小型、明确不会继续扩展的小工具；但只要应用存在后续扩展、持续维护、更多交互、Service App/Agent 接入、多资源拆分或更清晰代码组织的预期，就不应该继续做成单文件。否则单文件会很快变成难维护的大 HTML。

这个能力的目标不是把 Panel App 变成完整 Web 项目，也不是引入构建系统、npm install、dev server 或通用部署平台，而是给 NextClaw 的右侧应用生态补上一个仍然轻量、可丢弃、可分发的多文件静态形态。

它服务 NextClaw 的长期愿景：让 NextClaw 成为 AI 时代的个人操作层，通过稳定内核和轻量扩展生态承接更多用户自定义工具，而不是把所有具体功能都硬塞进主产品。

## 第一版合同

Panel Apps 同时支持两种形态：

```text
~/.nextclaw/workspace/panels/
  mood-calendar.panel.html

  markdown-manager.panel/
    panel-app.json
    index.html
    app.js
    styles.css
    assets/icon.svg
```

### 单文件形态

- 文件名必须以 `.panel.html` 结尾。
- 只用于明确不会继续扩展的轻量应用。
- 继续从 HTML 标准字段和 `nextclaw-panel-*` meta 中读取标题、描述、图标、Agent capability 和 Service Action 声明。
- 现有 ID、收藏、最近打开、删除、bridge 注入逻辑保持兼容。

### 目录形态

- 目录名必须以 `.panel` 结尾。
- 只要存在后续扩展或持续维护预期，就优先使用目录形态。
- 目录内必须存在 `panel-app.json`，否则不识别为 Panel App。
- `panel-app.json` 是静态 manifest，第一版字段保持克制：

```json
{
  "title": "Markdown 管理器",
  "description": "浏览、编辑和整理本地 Markdown 文件",
  "icon": "assets/icon.svg",
  "entry": "index.html",
  "capabilities": ["agent:generateObject"],
  "actions": ["workspace-files.list", "workspace-files.read"]
}
```

字段约定：

- `id` 可选；系统身份默认来自目录名去掉 `.panel` 后的值。若显式填写 `id`，必须是 kebab-case，且必须等于目录名去掉 `.panel` 后的值，避免 manifest 身份和文件系统身份漂移。
- `title` 必填。
- `description` 可选。
- `icon` 可选，支持 emoji、data/http/https/绝对路径；相对路径会被解析为该 Panel App 的 assets URL。
- `entry` 必填，必须指向目录内的 HTML 文件。
- `capabilities` 可选，仅声明实际使用的 Agent capability。
- `actions` 可选，仅声明实际使用的 Service Action。

## 访问模型

目录应用入口 HTML 仍通过现有内容接口打开：

```text
GET /api/panel-apps/:id/content
```

目录应用静态资源通过新接口读取：

```text
GET /api/panel-apps/:id/assets/*path
```

目录应用 HTML 会由 `PanelAppManager` 注入：

- `window.nextclaw` bridge 脚本。
- `<base href="/api/panel-apps/:id/assets/">`，让 `styles.css`、`app.js`、`assets/icon.svg` 这类相对路径自然指向目录资源接口。

静态资源读取必须拒绝：

- 空路径。
- 绝对路径。
- `..` 路径穿越。
- 目录读取。
- 非目录形态 Panel App 的 assets 请求。

## Owner 与代码结构

- `PanelAppManager` 仍是唯一业务 owner，负责发现、读取、删除、bridge session、授权和 Agent 调用。
- server controller 只新增薄 route，不直接碰 workspace 文件系统。
- UI 列表继续消费 `PanelAppEntry`，不为目录形态新增一套平行业务组件。
- 解析和路径安全这类无状态逻辑放在 `utils/`，避免让 manager 继续膨胀。

建议新增或调整：

```text
packages/nextclaw-kernel/src/utils/panel-app-manifest.utils.ts
packages/nextclaw-kernel/src/utils/panel-app-source.utils.ts
packages/nextclaw-kernel/src/managers/panel-app.manager.ts
packages/nextclaw-server/src/features/panel-apps/controllers/panel-apps.controller.ts
packages/nextclaw-core/src/features/agent/shared/skills/panel-app-creator/SKILL.md
```

## 非目标

第一版不做：

- npm package Panel App。
- Vite/React 构建项目识别。
- 自动安装依赖。
- dev server 托管。
- 文件监听热更新。
- marketplace 分发协议。
- Panel App 自定义后端。

这些能力可以在后续版本沿着同一个目录 manifest 形态演进，但第一版只保证静态多文件应用闭环。

## 验收标准

必须验证：

- 现有 `.panel.html` 仍能被发现和打开。
- `*.panel/panel-app.json` 目录应用能被发现，列表展示标题、描述和图标。
- 目录应用入口 HTML 能打开，并带 bridge 注入。
- 目录应用相对 CSS/JS/图片资源能通过 assets 接口读取。
- 相对 icon 会转换成可用于列表展示的 assets URL。
- 缺少 `panel-app.json` 的目录不会被识别为 Panel App。
- 非法 JSON 或非法 manifest 会返回明确错误。
- assets 路径穿越会被拒绝。
- 删除目录应用会递归删除目录，并清理收藏、最近打开和授权状态。
- 内置 `panel-app-creator` skill 知道何时选择单文件，何时选择目录形态。

## MVP 落地边界

本次 MVP 只落地静态目录应用。目录发现、manifest 校验、入口 HTML 读取、assets 读取、删除和状态清理均由 `PanelAppManager` 通过同 feature 的 source service 完成；server 只暴露薄路由；UI 继续使用同一个应用列表和 iframe 打开链路。
