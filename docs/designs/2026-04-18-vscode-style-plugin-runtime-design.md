# 2026-04-18 VS Code Style Plugin Runtime Design

## 这份文档回答什么

这份文档回答一个非常核心的问题：

- NextClaw 的插件机制，到底应该更像“声明式清单”，还是更像“真正的运行时程序”
- 为什么当前 `channels.*` 变更会错误地牵连 `reload plugin registry`
- 如果以 VS Code 的 extension model 为母版，NextClaw 应该怎样设计一套更强、更灵活、边界更清晰的插件运行时

这份文档的目标不是修补当前 `reloadPlugins` 判定，而是重新定义插件机制的长期方向。

---

## 第一性原理结论

结论先写在最前面：

1. NextClaw 的插件不应该以“声明式注册表快照”为主，而应该以“运行时激活与动态注册”为主。
2. `channel config` 变更不应该触发 `plugin registry reload`。
3. 插件应该像 VS Code extension 一样，在 `activate(context)` 后通过运行时 API 注册能力，并通过 `Disposable` / `subscriptions` 统一释放。
4. 但 NextClaw 不应机械照搬 VS Code 的所有表层接口；应尽量保持 VS Code 的机制与风格，只在 NextClaw 存在真实结构差异时做最小偏离。

一句话总结：

**默认照抄 VS Code 的 extension runtime model；只有在 `channel` 与 `ncp agent runtime` 这类 VS Code 不存在、且仓库里已经真实存在的一等对象上，才做最小必要扩展。**

---

## 设计约束

### 1. 产品约束

这套机制必须服务 NextClaw 的长期方向：

- 插件应增强 NextClaw 作为统一入口的能力，而不是制造新的分裂入口
- 配置修改后，能力应尽可能热生效，而不是依赖粗暴的全量重载
- 渠道、工具、NCP agent runtime 的关系必须可解释、可治理、可回收

### 2. 兼容约束

- 默认保留现有 plugin manifest / marketplace / UI schema / capability metadata 的最小契约
- 避免一次性推翻整个插件生态
- 新 runtime model 应允许旧插件分阶段迁移

### 3. 机制约束

- 不新增明显背离 VS Code 语言习惯的主 API 命名
- 不把“配置变化监听”发明成独立的自创主 API
- 不把“工具注册/卸载”硬塞进 `ChannelManager` 之类本不该负责 agent/tool 生命周期的 owner

---

## 参考母版：VS Code 到底是什么模型

VS Code 的 extension model，本质上不是“纯声明式插件”。

它的核心结构是：

1. `package.json` 只承担薄契约
   - 身份、版本、入口、激活事件、UI 贡献、配置 schema 等
2. `activate(context)` 承担主要运行时逻辑
   - 真正的命令、能力注册、监听器注册都发生在运行时
3. 所有注册行为返回 `Disposable`
   - 并统一进入 `context.subscriptions`
4. 配置变化通过 `workspace.onDidChangeConfiguration` + `event.affectsConfiguration(...)` 驱动，而不是 reload 整个 extension registry

参考资料：

- [Extension Anatomy](https://code.visualstudio.com/api/get-started/extension-anatomy)
- [Activation Events](https://code.visualstudio.com/api/references/activation-events)
- [VS Code API](https://code.visualstudio.com/api/references/vscode-api)
- [Extension Host](https://code.visualstudio.com/api/advanced-topics/extension-host)

这几条里，NextClaw 最应该抄的是“机制”，不是“字面字段”。

---

## 当前问题不是慢，而是模型错位

### 1. 当前插件机制更像静态快照

现在的核心链路是：

1. `loadPluginRegistry()`
2. 生成 `PluginRegistry`
3. 转成 `ExtensionRegistry`
4. NCP tool registry 从 `ExtensionRegistry` 读取扩展工具
5. config 变化时，必要时重新 `loadPluginRegistry()`

这意味着：

- 插件能力是否存在，很多时候由“加载当下的那份配置”决定
- 一旦配置变化，要么接受快照过期，要么全量 reload

这不是运行时模型，而是“重新拍快照”模型。

### 2. `channels.*` 触发 `reloadPlugins` 是错位补丁

当前 `buildReloadPlan()` 把所有 `channels.*` 都视为：

- `restartChannels = true`
- `reloadPlugins = true`
- `reloadAgent = true`

这背后的注释理由是：

- 渠道配置变化会影响插件产出的工具目录
- 要保持 prompt-visible tool availability 同步

这个理由只在“工具是否存在是 load-time 决策”时才成立。

换句话说，`channels.* -> reloadPlugins` 不是正确架构，而是对当前静态快照模型的补丁式兜底。

### 3. 真正的边界混乱点

当前最根本的问题不是某一处 if 写错了，而是三层责任被混在一起：

1. 插件身份与元数据
2. 插件声明的能力类型
3. 插件运行时根据当前配置、当前会话、当前渠道状态决定“此刻要不要暴露这些能力”

VS Code 的答案是：

- 1 和 2 可以有薄声明
- 3 必须是运行时逻辑

NextClaw 现在把 3 过早提前到了“加载插件时”，所以才会被迫频繁 reload。

---

## 设计原则

### 原则 1：默认照抄 VS Code

凡是 VS Code 已有成熟模型的地方，NextClaw 默认照抄：

- `activate(context)` / `deactivate()`
- `ExtensionContext` 风格上下文对象
- `Disposable`
- `subscriptions`
- `workspace.getConfiguration()`
- `workspace.onDidChangeConfiguration()`
- `event.affectsConfiguration()`
- 运行时注册与释放

### 原则 2：只有在 NextClaw 有真实结构差异时才扩展

NextClaw 与 VS Code 的关键差异不在“插件哲学”，而在运行对象上：

- NextClaw 有 `channel`
- NextClaw 有 `ncp agent runtime`
- NextClaw 有长生命周期网关、轮询器、webhook listener、reply dispatcher

因此我们只扩展“仓库里已经存在的一等注册对象”，不扩展“生命周期模型”本身，也不为了完整性提前发明新的注册类型。

### 原则 3：manifest 只保留薄契约

manifest 可以保留：

- `id`
- `version`
- `entry`
- `displayName`
- `description`
- `config schema`
- `ui hints`
- `permissions`
- marketplace / packaging 所需元信息

manifest 不应成为主要业务逻辑载体。

### 原则 4：插件是运行时程序，不是配置翻译器

插件在 `activate()` 之后，应拿到宿主提供的 runtime API，自主决定：

- 什么时候注册工具
- 什么时候卸载工具
- 什么时候启动渠道 runtime
- 什么时候停止渠道 runtime
- 什么时候根据配置变化做 reconcile

### 原则 5：channel 生命周期与 plugin reload 解耦

渠道配置变化默认只影响：

- channel registration 对应的运行实例
- tool availability
- message hint availability
- NCP runtime 可见性与可用性

不应默认影响：

- 插件模块本身是否重新加载
- 插件 registry 是否重建

---

## 目标模型

## 一. 薄声明层：Plugin Manifest

保留一层极薄 manifest，作用仅限于：

- 标识插件是谁
- 告诉宿主入口在哪里
- 提供配置和 UI 元信息
- 为 marketplace / 诊断 / 兼容性提供基础资料

建议形态：

```json
{
  "id": "nextclaw-channel-feishu",
  "version": "0.1.0",
  "main": "./dist/index.js",
  "displayName": "NextClaw Feishu",
  "description": "Feishu channel and tool integration for NextClaw",
  "contributes": {
    "configuration": {
      "title": "Feishu",
      "properties": {
        "nextclaw.channels.feishu": {}
      }
    }
  }
}
```

说明：

- 保留 `contributes.configuration` 这种风格是为了与 VS Code 对齐
- 但主要业务逻辑不依赖 `contributes`
- `contributes` 是产品和宿主理解插件的元信息，不是能力注册主体

## 二. 激活层：`activate(context)`

插件真正的主入口应改成：

```ts
export function activate(context: NextclawExtensionContext): Disposable | void;
export function deactivate?(): void | Promise<void>;
```

设计约束：

- 插件模块只加载一次
- 宿主只在必要时激活
- 激活后所有注册行为都通过 `context` 完成
- 返回值或 `context.subscriptions` 负责统一清理

## 三. 上下文层：`NextclawExtensionContext`

默认形态尽量贴近 VS Code：

```ts
type NextclawExtensionContext = {
  subscriptions: Disposable[];
  extensionUri: string;
  extensionPath: string;
  workspaceState: MementoLike;
  globalState: MementoLike;
  logger: ExtensionLogger;
  workspace: {
    getConfiguration(section?: string, scope?: unknown): WorkspaceConfigurationLike;
    onDidChangeConfiguration(
      listener: (event: ConfigurationChangeEventLike) => void
    ): Disposable;
  };
  runtime: NextclawRuntimeHost;
};
```

这里最关键的是：

- 配置读取和监听必须走 `workspace.*`
- 注册能力必须走 `runtime.*`
- 资源回收必须走 `subscriptions`

不新增插件侧 `watchConfig()` 这种脱离 VS Code 语感的主 API。

## 四. 运行时宿主层：`NextclawRuntimeHost`

这是 NextClaw 相比 VS Code 必须新增的部分，但它仍然遵守 VS Code 的 register/dispose 习惯。

```ts
type NextclawRuntimeHost = {
  registerTool(definition: ToolDefinition | ToolFactory): Disposable;
  registerChannel(registration: ChannelRegistration): Disposable;
  registerLlmProvider(provider: LlmProviderRegistration): Disposable;
  registerNcpAgentRuntime(registration: NcpAgentRuntimeRegistration): Disposable;
};
```

说明：

- `registerProvider` 是现有 compat 层的历史命名，但语义太宽，新设计不应继续沿用
- 这里明确改成 `registerLlmProvider`
- `LlmProvider` 已经足够限定语义：它表达的是 LLM provider 注册项，而不是任意 provider，更不是 NCP runtime provider
- 每个 `registerXxx()` 都必须返回 `Disposable`
- 不新增 `registerSessionRuntime`
- 不新增 `registerMessageHintsProvider`
- 不新增 `registerStatusProvider`
- 不把 `createScope()` 做成插件主 API；`subscriptions` 已是母版，若插件内部需要分层回收，可自行使用 `DisposableStore` 一类基础设施

## 五. 反过度设计收敛

这次设计必须明确删掉几类“看起来完整、其实没有现状支撑”的接口：

1. 不引入 `registerSessionRuntime`
   - 当前仓库里没有独立的 `session runtime` 注册体系
   - 现有真实对象是 `registerNcpAgentRuntime` 与 `UiNcpRuntimeRegistry`
   - UI 的 `session type` 是 NCP runtime provider 的展示/选择结果，不是另一套独立 runtime owner
2. 不引入 `registerMessageHintsProvider`
   - `message hints` 更像现有 live capability 的动态派生结果
   - 它应该依赖当前工具、渠道、配置去求值，而不是先被注册成新的一级对象
3. 不引入 `registerStatusProvider`
   - 当前仓库里没有对应的一等注册表与稳定 owner
   - 若未来真需要，也应先从真实对象反推，再决定是否升格为注册项
4. 不引入 `createScope()`
   - VS Code 已有 `subscriptions`
   - 我们仓库已有 `DisposableStore`
   - 这已经足够表达插件内部的局部回收，不需要再发明新的宿主级 API
5. 不再使用 `registerProvider` 这个名字
   - 当前仓库里的 `OpenClawProviderPlugin` 实际更接近 LLM provider catalog entry
   - 它包含的是 `id / label / docsPath / envVars / models / auth` 这类目录与配置元数据
   - 因此新设计里应明确命名成 `registerLlmProvider`，而不是继续保留一个“什么 provider 都可能是 provider”的宽泛名字

---

## 能力注册应该怎么变化

## 一. 工具不再依赖 load-time 决定存在与否

当前 Feishu 的问题是：

- 没有账号时，加载阶段直接跳过工具注册
- 有账号时，加载阶段才注册工具

这样会导致：

- 配置变化后，除非 reload plugin registry，否则工具目录过期

目标模型应改成：

- Feishu 插件总是注册 `feishu_doc` / `feishu_chat` / `feishu_wiki` 等 tool factory
- tool factory 在运行时根据当前 config 决定是否返回真实工具
- tool adapter 的 `isAvailable()` 动态反映当前状态

这样好处是：

- 插件模块不需要 reload
- 工具是否可见/可用随配置实时收敛
- `channel config` 变化只触发 runtime reconcile

## 二. Channel runtime 由插件在运行时控制

渠道 runtime 的目标模型应是：

- 插件在 `activate()` 时创建 channel controller
- controller 监听相关配置
- 当 `channels.feishu.enabled` 或账号集合变化时：
  - 启动/重建/停止对应的 channel 实例
- 当仅有 token、baseUrl、allowFrom 等 runtime 参数变化时：
  - 只重建对应的 channel 实例

这部分不需要 reload 插件模块。

## 三. Message hints 继续动态求值

这一点本来就更接近正确模型：

- `messageToolHints` 本质上是运行时上下文相关能力
- 应继续在每次需要时根据当前 config 动态求值

因此它不构成 `reload plugin registry` 的理由。

## 四. NCP agent runtime 也走同一模型

插件若暴露：

- 自定义 NCP agent runtime
- 同一 runtime kind 下的不同 entry / backend 变体

也都应遵守同一个机制：

- `activate()` 时注册 factory
- 配置变化时插件内部自行 reconcile
- 下线时 `dispose()`

---

## 目标交互模式

建议插件写法如下：

```ts
export function activate(context: NextclawExtensionContext): void {
  const rootStore = new DisposableStore();
  context.subscriptions.push(rootStore);

  let channelStore = new DisposableStore();
  let toolStore = new DisposableStore();
  rootStore.add(channelStore);
  rootStore.add(toolStore);

  const replaceStore = (current: DisposableStore) => {
    current.dispose();
    const next = new DisposableStore();
    rootStore.add(next);
    return next;
  };

  const reconcile = () => {
    const config = context.workspace.getConfiguration("nextclaw.channels.feishu");

    channelStore = replaceStore(channelStore);
    toolStore = replaceStore(toolStore);

    if (config.get("enabled") === true) {
      channelStore.add(
        context.runtime.registerChannel(createFeishuChannelRegistration(config)),
      );
    }

    toolStore.add(
      context.runtime.registerTool(createFeishuDocToolFactory(context)),
    );
    toolStore.add(
      context.runtime.registerTool(createFeishuChatToolFactory(context)),
    );
  };

  reconcile();

  rootStore.add(
    context.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("nextclaw.channels.feishu")) {
        reconcile();
      }
    }),
  );
}
```

关键点：

- 插件自己决定何时 reconcile
- 宿主只负责提供 register/dispose 能力
- 不再由外部 `reloadPlugins()` 代替插件做运行时决定

---

## 为什么不把工具注册硬塞进 `channel.start/stop`

表面上看，“start 时注册工具，stop 时卸载工具”很诱人，但它会引入新的边界污染。

原因如下：

1. `ChannelManager` 的 owner 边界是渠道发送/接收与连接生命周期，不是 agent/tool 生命周期
2. 工具能力不一定与 channel connection 一一对应
   - 某些工具即使渠道 runtime 暂时未连通，仍然可以展示但不可用
   - 某些工具和 account availability、permission、session context 有关，而不只与 channel socket 是否运行有关
3. 工具暴露与 NCP runtime 选择都属于插件 runtime 的横向能力，不应反向塞进 channel 类中统一调度

所以正确方式不是：

- `channel.start()` 直接管理所有插件能力

而是：

- 插件 runtime 自己管理若干可回收对象
- `channel` 的启停可以被 `reconcile()` 控制
- `tool` 的启停也由同一个插件 runtime 控制

换句话说，控制权确实应回到插件手里，但 owner 不应退化成 `ChannelManager`。

---

## 宿主需要新增什么

## 一. `LiveCapabilityStore`

需要引入一个真正的 live capability store，取代“registry snapshot 是唯一真相”的旧模型。

建议结构：

```ts
type LiveCapabilityStore = {
  tools: Map<string, LiveToolRegistration>;
  channels: Map<string, LiveChannelRegistration>;
  llmProviders: Map<string, LiveLlmProviderRegistration>;
  ncpAgentRuntimes: Map<string, LiveNcpAgentRuntimeRegistration>;
};
```

核心语义：

- 当前系统正在暴露什么能力，由 live store 决定
- plugin reload 不再是能力变化的主要手段
- `dispose()` 即能力摘除

## 二. 动态冲突治理

既然注册改成运行时，就必须加强冲突治理：

- tool name 冲突
- channel id 冲突
- LLM provider id 冲突
- ncp agent runtime kind 冲突
- 重复注册与重复 dispose

这部分应由宿主统一保护，插件不自行解决。

## 三. 可观测性

宿主需要能回答：

- 当前哪些插件已激活
- 当前哪些能力由谁注册
- 某个工具为什么不可用
- 某个 channel 为什么当前未运行

这对 UI、诊断、日志、support 都很重要。

---

## 配置机制如何对齐 VS Code

插件配置相关 API 应直接对齐 VS Code：

- `workspace.getConfiguration(section)`
- `workspace.onDidChangeConfiguration(listener)`
- `event.affectsConfiguration(section)`

不额外发明插件侧主 API 名字。

NextClaw 的配置路径建议统一采用类似：

- `nextclaw.channels.feishu`
- `nextclaw.channels.weixin`
- `nextclaw.plugins.<pluginId>`
- `nextclaw.ncp.runtimes.<runtimeId>`

这样可以直接复用 VS Code 风格的“section-based change detection”。

---

## 插件加载与插件重载的重新定义

## 一. 什么情况下才允许 plugin reload

新的原则应非常严格：

只有以下场景才允许重新加载插件模块：

1. 插件安装
2. 插件卸载
3. 插件启用/禁用
4. 插件源码或打包产物变化
5. 插件 manifest 结构性变化

除此之外，普通配置变化一律不应该 reload 插件模块。

## 二. `channels.*` 的处理原则

`channels.*` 变化默认只做两件事：

1. 通知插件 runtime 配置变化
2. 由插件内部 reconcile 对应的注册项与运行实例

默认不做：

1. plugin registry reload
2. plugin module reload
3. extension registry rebuild

## 三. 旧 `reloadPlugins` 的退场方向

现有 `reloadPlugins` 机制不应立刻粗暴删除，但应收缩为：

- 插件模块级别变更处理器
- 只服务插件安装/卸载/启停/源码变化

不再服务普通 channel config 变更。

---

## 迁移策略

### Phase 1：引入新 runtime host，但先兼容旧 registry

目标：

- 先让宿主具备 `activate(context)`、`Disposable`、`subscriptions`、`runtime.registerXxx()` 能力
- 插件侧只暴露最小必要的 `registerTool/registerChannel/registerLlmProvider/registerNcpAgentRuntime`
- 同时保留旧 `PluginRegistry -> ExtensionRegistry` 通路

结果：

- 新插件可按 runtime 模型开发
- 旧插件仍可继续运行

### Phase 2：把高价值 channel plugin 迁到 runtime-controlled model

优先迁移：

1. `feishu`
2. `weixin`

因为它们最直接涉及：

- channel lifecycle
- config-sensitive capability exposure
- 当前 `channels.* -> reloadPlugins` 的主要误判来源

迁移目标：

- 不再依赖 load-time 决定工具是否存在
- 改为 runtime availability / `Disposable` 控制

### Phase 3：收缩 `channels.* -> reloadPlugins`

当 `feishu` / `weixin` 等关键插件迁完后：

- 从 reload planner 中删除 `channels.* -> reloadPlugins`
- 保留 `channels.* -> restartChannels`
- 必要时保留 `channels.* -> reloadAgent`

### Phase 4：让旧 registry 退居兼容层

最终目标：

- `PluginRegistry` 主要承担 discovery / metadata / compatibility
- `LiveCapabilityStore` 才是运行中的真实能力图

---

## 为什么这是比当前模型更好的长期方向

### 1. 更符合 VS Code

这条路不是“自创一套插件新宗教”，而是更接近已经验证过的大模型：

- 薄声明
- 运行时激活
- 动态注册
- `Disposable`
- `subscriptions`
- 配置变化事件驱动

### 2. 更符合 NextClaw 的真实对象模型

NextClaw 不是编辑器，但它同样需要：

- 插件身份层
- 插件运行时层
- 能力动态增删层
- 生命周期与回收层

把这些收敛清楚，比继续靠 reload 快照更符合我们的产品复杂度。

### 3. 更少 surprise

用户修改一个渠道配置时，预期应该是：

- 这个渠道相关能力变化
- 不是全插件世界重建

### 4. 更易维护

未来如果继续沿当前模型前进，只会不断新增：

- “这类 config 需要 reloadPlugins”
- “那类 config 还要 reloadAgent”
- “某些 plugin gateway 要特殊重启”

这会把复杂度继续堆在 planner 和例外判定上。

改成 runtime-controlled model 后，复杂度回到插件 owner 自己负责的 `reconcile()` 中，更可预测。

---

## 非目标

这份设计当前不要求一次性解决以下问题：

1. marketplace install/uninstall 快路径的完整重构
2. 插件隔离进程 / 沙箱权限模型
3. 插件崩溃自动恢复策略
4. 跨线程/跨进程 extension host 拆分
5. 旧 plugin manifest 字段的立即统一淘汰

这些都重要，但属于后续批次。

---

## 最终建议

最终建议非常明确：

1. 默认照抄 VS Code 的 extension runtime model
2. 不再为配置变化发明脱离 VS Code 风格的插件侧主 API
3. 插件主要逻辑从“load-time registry snapshot”迁到“runtime activate + register/dispose”
4. `channel config` 变化不再触发 `plugin registry reload`
5. 插件自己控制其能力生命周期，但控制入口应通过现有 register/dispose + `subscriptions` 完成，而不是把 agent/tool 生命周期硬塞进 `channel.start/stop`

这条路既保留了你要求的“插件必须足够灵活、不能主要靠声明”，也避免了把系统带到新的边界混乱里。

---

## 建议的下一份文档

如果接受这份方向，下一份应该直接进入实现级设计：

- `NextclawExtensionContext` 精确定义
- `NextclawRuntimeHost` 精确定义
- `LiveCapabilityStore` 数据结构
- `Feishu` 迁移示例
- `channels.* -> reloadPlugins` 删除条件

这份文档建议写入：

- `docs/plans/2026-04-18-vscode-style-plugin-runtime-migration-plan.md`

作为后续实施计划。
