# NextClaw Wasm Apps MVP 实现计划

> **给 Claude：** 必须使用 `superpowers:executing-plans`，按任务逐步执行这份计划。

**目标：** 在现有 NextClaw 产品中落出第一版 `NextClaw Wasm Apps` 能力，支持应用安装、UI 装载、Wasmtime 执行、最小权限授权，以及一个 JS-first 示例应用跑通。

**架构：** 不再做独立 demo 宿主，而是在 NextClaw 内部落一个最小可用的 `Wasm App Host`。产品壳继续复用现有 NextClaw UI / Server / CLI，真正执行 Wasm 模块时通过独立 `Wasmtime Runner` 进程完成。应用执行模块第一版按 `JS/TS -> Wasm` 路线走，暂不以 `node:wasi` 作为正式底座。

**技术栈：** TypeScript、React、Hono、Vitest、Wasmtime、JS/TS -> Wasm 工具链（MVP 默认按 `javy-js` 路线设计）、pnpm workspace。

---

## 范围护栏

- MVP 是 `NextClaw Wasm Apps` 的第一版，不追求通用标准。
- 不做独立于 NextClaw 的新产品壳。
- 不做任意 Node/Python 项目迁移层。
- 不以 `node:wasi` 作为正式执行底座。
- 只支持一个示例应用。
- 只支持五类宿主能力：
  - `storage`
  - `documentAccess`
  - `allowedDomains`
  - `capabilities.llm`
  - `capabilities.hostUi`

## 建议的落点

```text
packages/
  nextclaw-server/
    src/ui/wasm-apps/...
  nextclaw-ui/
    src/components/wasm-apps/...
  nextclaw/
    src/cli/commands/wasm-apps/...

apps/
  nextclaw-wasmtime-runner/
    ...

examples/
  nextclaw-wasm-apps/
    hello-notes/
      manifest.json
      main/app.wasm
      ui/index.html
      assets/icon.png
```

这里的关键选择是：

- `NextClaw` 继续做宿主
- `Wasmtime Runner` 独立成可管理的 sidecar / 本地进程
- 示例应用单独放在 `examples/nextclaw-wasm-apps`

## 任务 1：冻结包格式与宿主 contract

**文件：**
- 新建：`docs/plans/2026-04-18-nextclaw-wasm-apps-freeze.md`（如已存在则更新）
- 新建：`packages/nextclaw-server/src/ui/wasm-apps/nextclaw-wasm-app-manifest.ts`
- 新建：`packages/nextclaw-server/src/ui/wasm-apps/nextclaw-wasm-app-manifest.test.ts`

**步骤 1：先写失败的 manifest 测试**

最小 contract 至少校验这些字段：

- `id`
- `name`
- `version`
- `main.entry`
- `main.kind`
- `ui.entry`
- `permissions`

**步骤 2：运行测试，确认先失败**

```bash
pnpm -C packages/nextclaw-server test nextclaw-wasm-app-manifest.test.ts
```

**步骤 3：实现最小 manifest 类型与解析器**

第一版先收敛：

```ts
type NextClawWasmAppManifest = {
  id: string;
  name: string;
  version: string;
  main: { entry: string; kind: "javy-js" };
  ui: { entry: string };
  permissions: {
    storage?: boolean;
    allowedDomains?: string[];
    documentAccess?: Array<{ id: string; mode: "read" | "read-write" }>;
    capabilities?: {
      llm?: boolean;
      hostUi?: string[];
    };
  };
};
```

**步骤 4：补文档引用**

让设计文档、冻结稿、实现计划相互引用，防止后续分裂。

## 任务 2：在 NextClaw Server 内加入 Wasm App Host 基础能力

**文件：**
- 新建：`packages/nextclaw-server/src/ui/wasm-apps/wasm-app-registry.service.ts`
- 新建：`packages/nextclaw-server/src/ui/wasm-apps/wasm-app-permission.service.ts`
- 新建：`packages/nextclaw-server/src/ui/wasm-apps/wasm-app-runner-client.service.ts`
- 新建：`packages/nextclaw-server/src/ui/ui-routes/wasm-apps.controller.ts`
- 新建对应测试文件

**步骤 1：先写失败的 registry / permission / route 测试**

覆盖最小能力：

- 列出本地已安装 Wasm Apps
- 安装本地示例应用
- 查询权限状态
- 授予目录权限
- 调 Wasmtime Runner 执行一个 action

**步骤 2：实现 Host 基础服务**

服务层职责收敛为：

- `WasmAppRegistryService`
  - 扫描与安装应用
- `WasmAppPermissionService`
  - 存储和校验权限
- `WasmAppRunnerClientService`
  - 与 Wasmtime Runner 通信

**步骤 3：暴露最小 API**

第一版先提供：

- `GET /api/wasm-apps`
- `POST /api/wasm-apps/install`
- `GET /api/wasm-apps/:appId/permissions`
- `POST /api/wasm-apps/:appId/permissions/document-access/:scopeId`
- `POST /api/wasm-apps/:appId/run`

## 任务 3：实现独立 Wasmtime Runner

**文件：**
- 新建：`apps/nextclaw-wasmtime-runner/...`
- 新建：runner README / build / smoke 脚本

**步骤 1：明确 runner 边界**

Runner 只负责：

- 加载 manifest 指向的 Wasm 模块
- 注入有限 host functions
- 执行 action
- 返回结果与日志

Runner 不负责：

- UI
- 安装
- 权限展示
- 应用市场

**步骤 2：定义 Host -> Runner 协议**

最小请求模型：

```json
{
  "appId": "com.example.notes",
  "manifestPath": "...",
  "action": "summarize-notes",
  "permissions": {
    "documentAccess": { "notes_dir": "/abs/path" },
    "allowedDomains": ["api.example.com"],
    "capabilities": {
      "llm": false,
      "hostUi": []
    }
  }
}
```

**步骤 3：定义最小 host functions**

第一版只给：

- `storage.get`
- `storage.set`
- `document.readText`
- `document.list`
- `network.getJson`
- `llm.complete`
- `host.log`

**步骤 4：用 Wasmtime 跑通 hello-notes**

要求：

- 示例应用的 Wasm 模块可以读授权目录
- 未授权目录必须失败
- 不在白名单里的域名必须失败

## 任务 4：在 NextClaw UI 中加入 Wasm Apps 入口与容器

**文件：**
- 新建：`packages/nextclaw-ui/src/components/wasm-apps/...`
- 修改：`packages/nextclaw-ui/src/app.tsx`
- 新建对应测试

**步骤 1：先做最小入口**

第一版只需要：

- 应用列表页
- 应用详情页
- 权限授权面板
- 应用 UI 容器页

**步骤 2：实现 UI 装载**

第一版允许两种低成本实现之一：

- route 容器
- iframe 容器

实现阶段选择当前工程成本更低的一种，但要确保：

- UI 不能绕过宿主直接拿高权限
- 所有动作都通过 Host bridge 回到 NextClaw

**步骤 3：应用运行链路打通**

链路必须是：

`Wasm App UI -> NextClaw UI bridge -> NextClaw Server -> Wasmtime Runner -> result`

## 任务 5：提供一个 JS-first 示例应用

**文件：**
- 新建：`examples/nextclaw-wasm-apps/hello-notes/...`
- 新建对应 README

**示例应用要求：**

- UI：一个简单面板
- Wasm 模块：JS/TS 逻辑编译进 Wasm
- 权限：
  - 一个只读 `documentAccess`
  - 可选一个 `allowedDomains` API
- 动作：
  - `summarize-notes`

**验收要求：**

- 安装后能在 NextClaw 里看到它
- 可以授权一个目录
- UI 能发起动作
- Runner 能返回结果
- 卸载后入口消失

## 任务 6：补齐验证与文档

**验证最小集：**

```bash
pnpm -C packages/nextclaw-server test
pnpm -C packages/nextclaw-ui test
pnpm -C packages/nextclaw-server tsc
pnpm -C packages/nextclaw-ui tsc
pnpm -C apps/nextclaw-wasmtime-runner test
pnpm -C apps/nextclaw-wasmtime-runner smoke
```

**还需要补齐：**

- Wasm Apps 用户说明
- 开发者示例说明
- Runner 的本地调试说明

## MVP 完成判定

只有同时满足下面这些条件，才算 MVP 成立：

1. NextClaw 中出现 Wasm Apps 入口
2. 可以安装一个本地示例应用
3. 可以授予最小权限
4. 应用 UI 可以被装载
5. Wasmtime Runner 可以执行应用逻辑
6. 未授权资源访问被拒绝
7. 应用可以被卸载

## 当前明确不做

- 不做通用标准导出
- 不做复杂 marketplace
- 不做任意现有项目迁移
- 不做系统级自动化
- 不做多语言全覆盖
- 不做复杂多应用协同
