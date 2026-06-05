---
name: panel-app-react-vite-creator
description: Create or update an engineering-style NextClaw Panel App using pnpm, Vite, React, TypeScript, and Tailwind CSS, then build it into a static .panel directory. Use when the user asks for a modern frontend stack, React Panel App, Vite app, Tailwind UI, or reusable/buildable Panel App project, and when the requested Panel App has complex UI/state, AI chat or Agent Run workflows, charts, filters, forms, or needs TypeScript access to App Client types.
description_zh: 使用 pnpm、Vite、React、TypeScript、Tailwind CSS 创建或修改工程化 NextClaw Panel App，并构建成静态 .panel 目录。适用于用户要求现代前端技术栈、React Panel App、Vite 应用、Tailwind UI、可维护/可构建的 Panel App 工程，或 Panel App 明显包含复杂 UI/状态、AI 对话/Agent Run、图表、筛选、表单，或需要 TypeScript 获取 App Client 类型的场景。
---

# React/Vite/TypeScript/Tailwind/pnpm Panel App Creator

本 skill 只负责工程化前端源码和静态产物交付。Panel App 的 manifest、Client SDK、Service Actions、Agent bridge 和授权规则仍以 `panel-app-creator` 为准；需要这些能力时必须同时读取 `panel-app-creator`。

## 核心原则

- 工程化 Panel App 推荐栈是 `React + Vite + TypeScript + Tailwind CSS + pnpm` 一整套，缺一不可；除非用户明确指定其它技术栈或有清楚环境约束，不要只选其中一部分。
- 使用 `pnpm`，不要使用 Bun、npm 或 yarn，除非用户明确指定。
- 本 skill 是复杂或可维护 Panel App 的工程化默认路径；极小、一次性、无明显构建收益的静态面板仍交给 `panel-app-creator` 轻量目录式实现。
- 开发期可以使用 Vite dev server；交付给 NextClaw 的必须是 build 后的静态 `.panel` 目录。
- 不要让 NextClaw 宿主运行 `vite dev`、Node server 或 Bun server。
- 源码工程可以放在用户指定位置；最终产物必须复制或构建到 `~/.nextclaw/workspace/panels/<app-id>.panel/`。
- 运行期目录里可以包含构建产物和 `panel-app.json`，不要依赖运行期 `node_modules`。
- Vite 必须配置 `base: "./"`，避免资源路径指向 NextClaw host 根路径。
- 构建出来的应用运行在 sandbox iframe 中，不具备普通同源网页能力；不要使用 `localStorage`、`sessionStorage`、cookie、IndexedDB 或默认启用浏览器持久化的状态库插件。需要持久化时按 `panel-app-creator` 选择 Service App、App Client 或导出/导入 JSON。

## 推荐目录

源码工程示例：

```text
my-panel-src/
  package.json
  vite.config.ts
  src/
  public/
```

交付产物示例：

```text
~/.nextclaw/workspace/panels/my-panel.panel/
  panel-app.json
  index.html
  assets/
```

如果用户没有指定源码位置，优先在 workspace 之外或用户当前工作目录下创建源码工程，不要把完整 npm 工程直接当作最终 `.panel` 交付目录。最终 `.panel` 应保持静态产物形态。

## 创建流程

1. 先确定 `app-id`，必须 kebab-case，例如 `data-reviewer`。
2. 创建 Vite React TS 工程：

```bash
pnpm create vite <app-id>-src --template react-ts
cd <app-id>-src
pnpm install
pnpm add -D tailwindcss @tailwindcss/vite
```

3. 配置 `vite.config.ts`：

```ts
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
});
```

4. 在 `src/index.css` 引入 Tailwind：

```css
@import "tailwindcss";
```

5. 开发 UI 时遵守 Panel App 侧栏约束：默认按 `320px-480px` 窄面板设计，不能横向溢出。
6. 如果要调用 NextClaw 能力，先读取 `panel-app-creator`，按其推荐路径写代码。
7. 构建：

```bash
pnpm build
```

8. 把 `dist/` 内容同步到最终 `.panel` 目录，并写入 `panel-app.json`：

```json
{
  "id": "data-reviewer",
  "title": "Data Reviewer",
  "description": "Review and analyze local data in a focused panel.",
  "icon": "📊",
  "entry": "index.html"
}
```

只有实际使用 `window.nextclaw.client` 时才加 `"client": true`。调用 Service Actions 时仍按 `panel-app-creator` 的当前规则声明 `actions` 并使用推荐 bridge。

## App Client 类型接入

使用 `window.nextclaw.client` 时，开发期优先安装 `@nextclaw/client-sdk` 作为类型来源：

```bash
pnpm add -D @nextclaw/client-sdk
```

在源码工程新增 `src/nextclaw-env.d.ts`：

```ts
import type { NextClawAppClient } from "@nextclaw/client-sdk";

declare global {
  interface Window {
    nextclaw?: {
      client?: NextClawAppClient;
    } & Record<string, unknown>;
  }
}

export {};
```

只允许 `import type` 使用 SDK 类型。Panel App 运行时不要 import、new 或 create `@nextclaw/client-sdk`，真实 client 必须来自宿主同步注入的 `window.nextclaw.client`：

```ts
const client = window.nextclaw?.client;
if (!client) {
  throw new Error("NextClaw App Client 未授权或不可用。");
}
```

需要 API 形状时读取已安装包里的 `@nextclaw/client-sdk` 声明和 README，优先查看 `NextClawAppClient`，让 TypeScript 检查参数和返回值。不要凭记忆写 `panelApps.*`、`serviceApps.*`、旧事件名或不存在的 namespace。

## 验收

必须运行：

```bash
nextclaw app check ~/.nextclaw/workspace/panels/<app-id>.panel
```

如果修改了源码工程，还应运行：

```bash
pnpm build
```

交付说明中告诉用户刷新 Panel Apps 列表或重新打开 Panel App；不要要求重启 NextClaw，除非有明确证据表明宿主进程异常。
