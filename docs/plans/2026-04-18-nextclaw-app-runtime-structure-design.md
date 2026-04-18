# NextClaw App Runtime 目录结构设计

## 这份文档回答什么

这份文档只收敛一件事：

**`NextClaw App Runtime` 第一阶段应该放在哪、以什么目录结构组织、示例应用放在哪。**

它不讨论完整产品接入，也不讨论传播层、市场层或主产品 UI 集成，只讨论技术能力原型本身的结构边界。

## 结论先行

第一阶段推荐采用下面这套结构：

```text
packages/
  nextclaw-app-runtime/
    package.json
    tsconfig.json
    README.md
    src/
      cli.ts
      commands/
        run.command.ts
        dev.command.ts
        inspect.command.ts
      manifest/
        app-manifest.types.ts
        app-manifest.utils.ts
        app-manifest.service.ts
      host/
        app-host.service.ts
        app-instance.service.ts
      runtime/
        main-runner.types.ts
        main-runner.service.ts
        wasm-main-runner.service.ts
      permissions/
        permissions.types.ts
        document-access.service.ts
        allowed-domains.service.ts
        storage.service.ts
        capabilities.service.ts
      ui/
        ui-server.service.ts
        ui-entry-resolver.service.ts
      bridge/
        host-bridge.types.ts
        host-bridge.server.ts
      sidecar/
        wasmtime-sidecar-client.service.ts
        wasmtime-sidecar.types.ts
      logs/
        app-log.types.ts
        app-log.service.ts

apps/
  examples/
    hello-notes/
      manifest.json
      main/
        app.wasm
      ui/
        index.html
      assets/
        icon.png
```

## 为什么放在 `packages/`

第一阶段的 `nextclaw-app-runtime` 更像：

- 一个 CLI
- 一个 runtime tool
- 一个技术能力包

而不是：

- 一个独立产品 app
- 一个需要单独部署的前端应用
- 一个已经要接入主产品的功能模块

所以它放在 `packages/` 比放在 `apps/` 更符合当前仓库语义。

它的角色更接近：

- `vite`
- `wrangler`
- `eslint`
- `tsup`

这种“带 CLI 的技术包”。

## 为什么不直接接入现有 NextClaw 体系

当前阶段的目标不是产品整合，而是技术能力验证。

因此第一阶段明确不做：

- 接入 `packages/nextclaw-server`
- 接入 `packages/nextclaw-ui`
- 接入 `packages/nextclaw`
- 接入现有主产品菜单、路由和运行链路

当前更合理的目标是先让下面这种命令成立：

```bash
napp inspect ./apps/examples/hello-notes
napp run ./apps/examples/hello-notes
napp dev ./apps/examples/hello-notes
```

也就是说：

- 先把 app runtime 本身做出来
- 先把 app host 能力跑通
- 先把 app 目录结构、权限、bridge、main 执行链路跑通

后面是否接回主产品，再单独讨论。

## 为什么示例应用放在 `apps/examples/`

这里有两个约束：

1. 不新增一个新的一级目录 `examples/`
2. 示例应用不应和 runtime package 混在一起

因此最稳妥的做法就是：

```text
apps/
  examples/
    hello-notes/
```

这么放有几个好处：

- 不污染仓库一级目录
- 示例应用和技术能力包角色分开
- 以后如果要加多个示例，也很自然

例如未来可以扩展成：

```text
apps/
  examples/
    hello-notes/
    api-panel/
    doc-organizer/
```

## `nextclaw-app-runtime` 包内的角色划分

这部分只讨论角色，不讨论具体实现细节。

### `commands/`

只放 CLI 命令入口。

建议第一阶段只有：

- `run.command.ts`
- `dev.command.ts`
- `inspect.command.ts`

不要把具体逻辑堆进 `cli.ts`。

### `manifest/`

只放应用描述文件相关能力。

包括：

- 类型定义
- 校验
- 读取
- 归一化

### `host/`

这是宿主编排层。

职责包括：

- 创建应用实例
- 串起 manifest、权限、runtime、UI、bridge
- 作为 CLI 命令真正调用的宿主入口

### `runtime/`

这是包内部的角色词，不是应用包里的目录名。

这里可以合理使用 `runtime/`，因为它描述的是：

- 宿主如何执行 `main`
- 宿主如何选择执行实现

而不是应用自己的资源目录。

### `permissions/`

只放权限与资源边界相关逻辑。

建议按权限角色拆开，而不是堆成一个大 `security.service.ts`。

### `ui/`

只放应用展示层的装载与本地服务逻辑。

例如：

- 解析 `ui/index.html`
- 提供本地访问地址

### `bridge/`

只放宿主与应用 UI 之间的通信协议和桥接服务。

### `sidecar/`

只放与 Wasmtime sidecar 的通信部分。

这样可以把“Wasm 执行本体”和“CLI/Host 编排层”分开。

### `logs/`

如果第一阶段需要输出统一日志，就单独放。

## 应用目录结构为什么是 `main / ui / assets`

第一阶段应用目录推荐采用：

```text
manifest.json
main/
ui/
assets/
```

原因如下：

### `main/`

比 `logic/` 更清晰。

`logic` 太宽，几乎任何代码都可以叫 logic；而 `main` 更像成熟插件/扩展体系里对主执行入口的命名。

### `ui/`

最自然，几乎不需要解释。

### `assets/`

也是常见且稳定的目录名。

## 第一阶段建议的 CLI 体验

先只做三条命令：

```bash
napp inspect <app-dir>
napp run <app-dir>
napp dev <app-dir>
```

### `inspect`

只检查应用结构和声明，不真正运行。

### `run`

运行应用，启动宿主、main 执行、UI 服务和 bridge。

### `dev`

在 `run` 基础上提供更适合调试的输出。

## 第一阶段的最小文件清单

如果现在开始实现，建议先从下面这些文件起步：

```text
packages/nextclaw-app-runtime/src/cli.ts
packages/nextclaw-app-runtime/src/commands/run.command.ts
packages/nextclaw-app-runtime/src/commands/dev.command.ts
packages/nextclaw-app-runtime/src/commands/inspect.command.ts

packages/nextclaw-app-runtime/src/manifest/app-manifest.types.ts
packages/nextclaw-app-runtime/src/manifest/app-manifest.utils.ts
packages/nextclaw-app-runtime/src/manifest/app-manifest.service.ts

packages/nextclaw-app-runtime/src/host/app-host.service.ts
packages/nextclaw-app-runtime/src/host/app-instance.service.ts

packages/nextclaw-app-runtime/src/runtime/main-runner.types.ts
packages/nextclaw-app-runtime/src/runtime/main-runner.service.ts
packages/nextclaw-app-runtime/src/runtime/wasm-main-runner.service.ts

packages/nextclaw-app-runtime/src/permissions/permissions.types.ts
packages/nextclaw-app-runtime/src/permissions/document-access.service.ts
packages/nextclaw-app-runtime/src/permissions/allowed-domains.service.ts
packages/nextclaw-app-runtime/src/permissions/storage.service.ts
packages/nextclaw-app-runtime/src/permissions/capabilities.service.ts

packages/nextclaw-app-runtime/src/ui/ui-server.service.ts
packages/nextclaw-app-runtime/src/ui/ui-entry-resolver.service.ts

packages/nextclaw-app-runtime/src/bridge/host-bridge.types.ts
packages/nextclaw-app-runtime/src/bridge/host-bridge.server.ts

packages/nextclaw-app-runtime/src/sidecar/wasmtime-sidecar-client.service.ts
packages/nextclaw-app-runtime/src/sidecar/wasmtime-sidecar.types.ts

apps/examples/hello-notes/manifest.json
apps/examples/hello-notes/main/app.wasm
apps/examples/hello-notes/ui/index.html
```

## 最终建议

当前阶段不需要继续讨论产品集成层。

先把这套结构定住即可：

1. `packages/nextclaw-app-runtime`
2. `apps/examples/<app-name>`
3. 应用目录固定为 `manifest.json + main/ + ui/ + assets/`
4. 包内部按 `commands / manifest / host / runtime / permissions / ui / bridge / sidecar / logs` 这套角色拆分

这已经足够支撑下一步进入代码实现。
