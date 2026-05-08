# 2026-05-07 Native JS Plugin Lifecycle Design

## 这份文档回答什么

这份文档沉淀一套更简单的插件运行时方向：

- NextClaw 运行时只加载插件编译后的 JavaScript，不在插件加载阶段处理 TypeScript。
- 插件模块统一用原生 `import()` 加载，不再用 `jiti` 做运行时转译和无缓存加载。
- 插件代码可以被加载，但能力是否生效由明确生命周期控制。
- `enabled / disabled` 不再等价于“是否 import 模块”，而是等价于“是否运行插件激活函数”。

这份文档起初是方案底稿；当前已补充到可对照实现与验证结果的设计记录。

## 当前落地状态

已落地的第一批实现聚焦运行时启动主链路：

- progressive external plugin loader 已改为原生 `import()` 加载 `.js` / `.mjs` / `.cjs`。
- 运行时 `.ts` 插件入口会被拒绝，并给出 `plugin runtime only supports built JavaScript entries` 诊断。
- 插件定义支持 `enable(api)` / `disable(api)`；旧 `register(api)` / `activate(api)` 在迁移期作为 `enable(api)` 兼容别名。
- disabled 外部插件仍会 import 模块以暴露加载错误和 metadata，但不会运行 `enable`，也不会注册 tool / channel / provider / NCP runtime。
- progressive path 会真正 `await enable(api)`，避免异步插件半初始化就被标记为 loaded。
- progressive path 维护进程内 lifecycle scope：reload 重新 enable 前、enabled -> disabled、插件从 load paths 移除时都会调用旧实例 `disable(api)`。
- 运行中 reload 继续通过现有 gateway plugin reload 重建 registry snapshot，并由 `PluginRuntimeRegistrationController` 的 `DisposableStore` 按 extension registry 变化摘除 NCP runtime provider。

已记录的关键复测结果：

- 原始基线：`plugin.loader.total=2377ms`，Claude 外部 runtime 插件模块加载约 `1866ms`，deferred startup 约 `18.2s`。
- 隔离 HOME、无外部 runtime 插件：`plugin.loader.total=630ms`，`hydrate_capabilities=3778ms`，deferred startup 约 `3.9s`。
- 显式加载 Codex / Claude built JS 插件：Codex module load 约 `37ms`，Claude module load 约 `49ms`，`plugin.loader.total=1324ms`，`hydrate_capabilities=4472ms`，deferred startup 约 `5.2s`。
- 补齐 lifecycle 后隔离 `pnpm dev start`：`service.ui_shell_grace_window=3004ms`，Feishu bundled load `733ms`，`plugin.loader.total=795ms`，`hydrate_capabilities=3904ms`，deferred startup end 约 `4011ms`。

因此当前异常点可以更精确地归因：慢的不是“JS 模块 import”这个动作，而是旧 runtime loader 通过 no-cache `jiti` 冷加载插件入口和依赖树。

## 背景

`pnpm dev start` 慢启动排查暴露出一个核心问题：插件加载链路把太多事情混进了“加载模块”这个动作里。

当前链路里，插件加载大致经过：

1. 发现插件候选项。
2. 读取 manifest。
3. 判断插件启用状态。
4. 对启用插件用 `jiti` 加载入口。
5. 执行插件 `register(api)`。
6. 由注册结果重建 channel / tool / runtime 等能力视图。

其中两个问题最明显：

- `jiti` 被配置为 `requireCache: false` 和 `cache: false`，每次 hydration 都接近冷加载。
- 部分插件入口顶层 import 过重，加载模块本身就会拉起大依赖树。

用户提出的方向是：不要把事情搞复杂。运行时统一加载插件 JS 代码，插件是否生效交给生命周期函数控制。

## 第一性原理结论

插件运行时应该区分三件事：

1. `load`
   加载插件模块，得到插件定义对象。
2. `enable`
   让插件能力进入系统，例如注册 channel、tool、provider、NCP runtime。
3. `disable`
   让插件能力从系统摘除，例如注销注册项、停止监听、释放计时器和连接。

因此：

- 插件可以被加载，但不一定被启用。
- 禁用插件不应运行激活逻辑。
- 已启用插件被禁用时，必须运行释放逻辑。
- 插件顶层代码必须轻量、可预测、无业务副作用。

一句话：

**NextClaw runtime 只原生 import 插件 JS；插件能力是否生效由 `enable / disable` 生命周期决定。**

## 目标

### 产品目标

- 降低 dev 启动时间和插件 reload 抖动。
- 让插件启用、禁用、热切换更接近 VS Code extension 的体验。
- 保持模型简单，不引入独立 Plugin Host、复杂沙箱或运行时 TS 转译。

### 技术目标

- 移除插件运行时对 `jiti` 的依赖。
- 插件入口统一为 `.js` / `.mjs` / `.cjs`。
- 插件模块加载用 Node 原生 `import()`。
- 插件状态由生命周期函数管理。
- 插件能力注册必须可按 plugin id 统一注销。

### 非目标

- 不在本方案里支持运行时直接加载 `.ts` 插件入口。
- 不在本方案里引入独立插件进程隔离。
- 不在本方案里重做 marketplace 安装协议。
- 不要求第一阶段一次性完成所有插件的按需工具加载。

## 建议插件合同

插件入口导出一个默认对象。

```ts
export default {
  id: "feishu",
  name: "Feishu",
  version: "0.1.0",

  async enable(api) {
    api.registerChannel(...);
    api.registerTool(...);
  },

  async disable(api) {
    await api.unregisterByPlugin("feishu");
  },
};
```

### 字段约束

- `id` 必须稳定。
- `name` / `version` 用于 UI、诊断和日志。
- `enable(api)` 负责注册能力。
- `disable(api)` 负责释放能力。
- 如果插件没有 `disable(api)`，宿主必须至少能通过 plugin id 回收所有注册项。

### 顶层约束

插件模块顶层只允许：

- 声明常量。
- 导出插件定义。
- 引用轻量类型无关工具。
- 准备不产生外部副作用的纯函数。

插件模块顶层不应：

- 发起网络请求。
- 打开数据库。
- 启动 channel 连接。
- 创建 watcher。
- 启动 timer。
- 注册全局事件。
- 读取大文件或扫描目录。
- import 明显重型 SDK，除非这是插件轻入口暂时无法避免的迁移状态。

重型依赖应尽量放进 `enable()` 或具体能力首次使用路径。

## 运行时行为

### 启动加载

启动时，宿主可以加载所有发现到的插件 JS：

```ts
const module = await import(pluginEntryUrl);
const plugin = module.default;
pluginManager.addLoaded(plugin);
```

加载完成后：

- 如果插件配置为 enabled，调用 `enable(api)`。
- 如果插件配置为 disabled，只保留 loaded metadata，不调用 `enable(api)`。

### 运行中安装

当用户在 UI 中安装插件，例如 Codex runtime plugin 或 Claude Code runtime plugin：

1. Marketplace / installer 下载插件包，并确保插件入口是已构建的 JS。
2. 持久化插件安装记录和 enabled 状态。
3. Plugin Runtime Manager 原生 `import()` 新插件入口。
4. 将插件加入 loaded plugin 集合。
5. 如果安装结果要求立即启用，调用 `enable(api)`。
6. 宿主发布 capability 更新事件，UI 立即刷新可用 session type、runtime、tool 或 channel。

这条路径不应要求主进程重启，也不应触发全量插件世界重建。

### 运行中启用

当插件从 disabled 变为 enabled：

1. 确认插件模块已 loaded。
2. 如果未 loaded，先 `import()`。
3. 调用 `enable(api)`。
4. 标记插件 runtime state 为 active。
5. 发布 capability 更新事件。

### 运行中禁用

当插件从 enabled 变为 disabled：

1. 调用插件 `disable(api)`。
2. 宿主兜底清理该 plugin id 下的注册项。
3. 停止相关 channel / watcher / timer / disposable。
4. 标记插件 runtime state 为 loaded but inactive。
5. 发布 capability 更新事件。

### 热更新

开发态插件热更新可以走两种简单路径：

1. 重启主 dev 进程。
2. 使用版本化 URL 重新 import，例如按文件 mtime 拼接 query。

```ts
await import(`${pathToFileURL(entryFile).href}?v=${mtimeMs}`);
```

第一阶段可以先接受重启；后续如果需要真热更新，再引入版本化 import。

## 为什么原生 import 更适合这里

当前 `jiti` 的主要价值是运行时兼容 TS / CJS / ESM / alias。但如果运行时只认 JS，`jiti` 的价值就大幅下降。

原生 `import()` 的优势：

- Node 原生语义，行为更可预测。
- 默认有模块缓存。
- 不需要运行时转译。
- 不需要自定义 alias 解析。
- 和插件发布产物一致。
- 启动性能更稳定。

这也会倒逼插件开发流程更清晰：

- 开发期：插件自己 watch / build。
- 运行期：NextClaw 只加载 `dist/*.js`。

## 当前异常点解释

正常情况下，import 一个轻量 JS 模块确实应该很快。

本次慢启动异常不是因为 `import` 这个概念天然慢，而是当前链路叠加了以下成本：

1. 外部插件使用 `jiti`，且关闭缓存。
2. loader 每次 hydration 会重新冷加载启用插件。
3. 部分插件入口顶层 import 太胖。
4. dev 启动同时运行多个 `tsdown --watch`，造成 CPU / IO 竞争。
5. 后台 NCP capability warmup 还出现 SQLite `database is locked`，进一步放大抖动。

因此，解决方向不是给当前冷加载加更多补丁，而是把运行时模型收敛成：

- 原生 JS import。
- 顶层轻入口。
- 生命周期控制能力启停。
- 注册项可按 plugin id 回收。

## 需要调整的关键 owner

### 1. Plugin Loader

当前 owner：

- `packages/nextclaw-openclaw-compat/src/plugins/loader.ts`
- `packages/nextclaw-openclaw-compat/src/plugins/progressive-plugin-loader/*`

目标：

- 删除运行时 `jiti` 加载路径。
- 入口必须解析为 JS 文件。
- 用 `pathToFileURL(entryFile).href` 后原生 `import()`。
- loaded plugin 与 active plugin 分开建模。

### 2. Plugin Runtime Manager

需要引入或收敛一个 runtime owner，负责：

- `loadedPlugins`
- `activePlugins`
- `enablePlugin(pluginId)`
- `disablePlugin(pluginId)`
- `reloadPlugin(pluginId)`
- plugin id 到 disposables 的映射。

这个 owner 不应散落在 ChannelManager、ConfigReloader 或 UI controller 中。

### 3. Registry API

当前注册更像一次性构建快照。

目标是让注册 API 返回可释放对象，或者至少由宿主记录 plugin id 归属：

```ts
const disposable = api.registerTool(...);
context.subscriptions.push(disposable);
```

如果暂时不引入 `Disposable` 形态，也必须支持：

```ts
api.unregisterByPlugin(pluginId);
```

### 4. 插件入口瘦身

重点插件：

- Feishu 插件：当前入口顶层 import 全套工具模块。
- Claude runtime plugin：当前入口顶层 import runtime SDK。
- Weixin / Codex runtime plugin：需要确认是否存在类似顶层重依赖。

目标：

- 顶层只导出 descriptor 和生命周期函数。
- 重依赖推迟到 `enable()` 或首次使用。

## 迁移路线

### Phase 1：原生 JS import

目标：先验证性能收益，不改变外部插件合同太多。

- 插件运行时只接受 JS 入口。
- loader 从 `jiti` 改为原生 `import()`。
- 保留现有 `register(api)` 语义。
- 禁止 runtime 直接加载 TS 入口。

验收：

- `NEXTCLAW_STARTUP_TRACE=1 pnpm dev start` 中 plugin loader 总耗时显著下降。
- 不再出现 `jiti` 冷加载导致的秒级抖动。

### Phase 2：引入 enable / disable 生命周期

目标：让 enabled / disabled 从加载策略变成运行时状态。

- 插件定义支持 `enable(api)` / `disable(api)`。
- 兼容旧 `register(api)`，视为 `enable(api)`。
- 宿主维护 active state。
- 禁用插件时调用 `disable()` 并兜底清理注册项。

验收：

- 插件禁用不需要重建整个 plugin registry。
- 插件启用不需要重启主进程。

### Phase 3：插件轻入口治理

目标：让“全量 import JS”本身保持便宜。

- Feishu 插件入口瘦身。
- Runtime plugin 延迟加载重 SDK。
- 注册 tool descriptor 与 tool handler 加载分离。

验收：

- 全量 import 所有内置插件 JS 不应超过数百毫秒级别。
- disabled 插件不产生 channel / watcher / timer / network 副作用。

### Phase 4：可选热更新

目标：开发态体验更好，但不让 v1 复杂化。

- 插件 dist 变更时，按 mtime query 重新 import。
- reload 时先 disable 旧实例，再加载新实例并按配置 enable。

验收：

- dev 插件更新可不重启主进程生效。
- reload 失败时旧实例可保留或进入明确错误态。

## Runtime 插件适配说明

Codex / Claude Code 这类插件的能力本质是注册一种 NCP agent runtime 或 session type。它们非常适合生命周期模型，但必须遵守一个边界：

**安装或启用 runtime 插件，不等于立即启动 agent runtime 进程。**

推荐行为：

1. `load`
   - 原生 import 插件 JS。
   - 得到插件定义和轻量 metadata。
2. `enable`
   - 注册 runtime kind，例如 `codex` 或 `claude`。
   - 注册 session type descriptor。
   - 注册配置 UI metadata。
   - 不启动 Codex CLI、Claude SDK、Hermes bridge 或其它重型 runtime。
3. 用户创建或运行 session 时
   - 才创建具体 runtime 实例。
   - 才做 provider route、capability probe、子进程启动或 SDK 初始化。
4. `disable`
   - 立即隐藏新建入口。
   - 注销 runtime kind 和 session type。
   - 停止或标记不再接受新的 runtime 实例。
   - 对已经运行中的 session，默认不强杀，进入 `disabled-pending-sessions` 之类的等待态。

如果用户明确要求卸载并立即停止相关任务，宿主可以先停止该插件创建的活跃 session，再执行 `disable()` 和物理卸载。

这能覆盖 UI 运行中安装场景：

```ts
await pluginInstaller.install(spec);

const plugin = await pluginRuntimeManager.load(installedEntry);
await pluginRuntimeManager.enable(plugin.id);

uiEvents.publish({
  type: "capabilities.updated",
  payload: { pluginId: plugin.id },
});
```

禁用 / 卸载路径反向执行：

```ts
await pluginRuntimeManager.disable(pluginId);
await pluginInstaller.uninstall(pluginId);
```

这个规则对 channel 插件也有参考价值：启用 channel 插件可以注册 channel 类型，但是否立刻连接外部平台，应由 channel 配置和 channel manager 生命周期决定，而不是由模块 import 决定。

## 风险与防线

### 风险 1：顶层副作用泄漏

如果插件顶层做重活，那么“全量 import”仍然会慢，disabled 插件也会影响系统。

防线：

- 增加插件规范。
- 增加 dev warning。
- 对核心插件做入口瘦身。

### 风险 2：disable 清理不完整

如果注册项不能按 plugin id 回收，disable 会留下脏状态。

防线：

- 所有 register API 必须记录 owner plugin id。
- 宿主提供 `unregisterByPlugin(pluginId)` 兜底。
- 长生命周期对象必须进入 plugin scope。

### 风险 3：原生 import 缓存影响热更新

原生 import 默认缓存同一 URL。

防线：

- v1 接受重启。
- v2 使用 mtime query 做 reload。
- 不再依赖关闭全局缓存来实现热更新。

### 风险 4：JS-only 增加插件开发约束

插件开发者不能直接把 TS 源码交给运行时。

防线：

- 明确文档：TS 是开发期，JS 是运行期。
- dev watcher 负责输出 dist。
- 插件加载错误提示指向 build 命令。

## 待评审问题

1. `register(api)` 是否直接改名为 `enable(api)`，还是先兼容旧字段？
2. manifest 是否继续作为加载前 metadata source，还是完全相信 JS default export？
3. 内置 bundled 插件是否也统一走 JS entry，而不是 package import？
4. disable 失败时，插件状态应是 `error`、`disabled-with-errors`，还是继续 active？
5. tool handler 是否需要独立 lazy import 合同？
6. dev 热更新 v1 是否接受重启，还是必须首版支持 mtime query reload？

## 当前推荐

建议下一步先做最小验证：

1. 不改插件外部语义。
2. 不引入 Plugin Host。
3. 不处理 TS 插件入口。
4. 只把外部插件 runtime loader 改成原生 JS `import()`。
5. 跑一次启动 trace，对比 plugin loader 耗时。

如果收益明显，再推进 `enable / disable` 生命周期和插件轻入口治理。
