# 2026-03-27 Plugin Uninstall Fast Path Terminal Design

## 这份文档回答什么

这份文档回答一个很具体的问题：

- 为什么现在 NextClaw 的插件卸载慢
- 为什么它没有做到接近 VSCode 的体验
- 如果接受架构级调整，终局应该怎么设计

目标不是做一次局部优化，而是把“插件卸载”收敛成一个清晰、可预测、可扩展、可跨平台的快路径。

## 第一性原理结论

如果从第一性原理看，用户要的不是“磁盘目录立刻被彻底删干净”。

用户真正要的是：

1. 插件立刻从产品表面消失
2. 插件立刻不再参与运行时能力
3. 插件立刻不会在下次启动时重新生效
4. 整个动作不要求全系统重建

所以“卸载”应该被拆成两个阶段：

1. `logical uninstall`
   - 立刻把插件从 live runtime 和持久化状态中摘掉
2. `physical garbage collection`
   - 后台清理插件文件与历史副本

只要这两个阶段被混在同一个同步请求里，卸载就不可能足够快。

## 当前为什么慢

当前实现的主要瓶颈不是某一行 `fs.rm`，而是整条链路的结构。

### 1. 卸载前先做了一次全量插件加载

`uninstallPluginMutation()` 不是直接根据 install record 卸载，而是先调用 `buildPluginStatusReport()`。

而 `buildPluginStatusReport()` 内部会走 `loadOpenClawPlugins()`，也就是：

- 扫描插件来源
- 读取 manifest
- 加载模块
- 执行注册

这意味着“我只是想卸载一个插件”，但系统先把所有插件又完整看了一遍。

### 2. Marketplace 卸载实际是两次变更、两次 reload

当前 service 层卸载流程是：

1. `disablePluginMutation(id)`
2. `applyLiveConfigReload()`
3. `uninstallPluginMutation(id, { force: true })`
4. `applyLiveConfigReload()`

这不是一次卸载，而是：

- 先禁用一次
- 再卸载一次

每一步都触发一轮 live reload。

### 3. 每次 reload 都是“全量重建插件世界”

当前 `reloadServicePlugins()` 的做法本质上是：

1. 重新 `loadPluginRegistry()`
2. 重新生成 extension registry
3. 重新计算 channel bindings
4. 必要时停掉旧 plugin gateways
5. 再启动新 plugin gateways

也就是说，单个插件变更没有走“增量 apply / 增量 dispose”，而是走“全量重建 snapshot”。

这天然不是 VSCode 模型。

### 4. 卸载还可能同步删除多个目录副本

当前 `resolveUninstallDirectoryTargets()` 可能同时删除：

- 受控全局扩展目录
- install record 记录目录
- `workspace/.nextclaw/extensions/<pluginId>`

这说明当前插件安装路径不是单一 canonical source，而是历史兼容后的多副本清理模型。

多副本越多，卸载越慢，也越不稳定。

### 5. Channel 插件可能触发过大的重启面

当前 reload 逻辑会根据 binding diff 决定是否重启 plugin channel gateways，必要时还会连带 channel manager。

这意味着：

- 一个插件的 channel 变化
- 可能导致更大范围的运行时波动

这依然不是“按插件隔离、按插件卸载”的模型。

## 根因不是实现慢，而是模型错了

真正的根因是：

1. 没有“受管插件索引”
2. 没有“每插件 activation scope”
3. 没有“每插件 live instance manager”
4. 没有“卸载即摘除，删盘异步”的明确分层
5. 没有把“managed marketplace plugin”和“dev load path plugin”彻底分开

所以系统只能用：

- 改 config
- 扫全局
- 重建 registry
- 希望状态最终收敛

这是一种可工作但不可能快的结构。

## 终局目标

终局目标应该明确成下面四个指标：

1. 普通 runtime / tool / provider / engine 插件卸载 API 返回时间 `P95 < 150ms`
2. channel 插件卸载 API 返回时间 `P95 < 400ms`
3. 单插件卸载时 `0` 次全量插件重建
4. 单插件卸载时请求主链路 `0` 次同步递归删盘

只要终局不能满足这四条，就不算真正解决。

## 终局架构

### 一. 插件源分层

必须先把插件来源分成两类：

1. `managed plugins`
   - Marketplace 安装的正式受管插件
   - 由系统安装、系统启停、系统卸载
2. `dev plugins`
   - `plugins.load.paths` / link path / workspace source
   - 只服务开发态或高级手工接入

核心原则：

- 受管插件不再依赖目录扫描做发现
- `plugins.load.paths` 不参与 Marketplace 卸载快路径
- “卸载”只针对 managed plugins
- dev path 走 `unlink` 语义，不走 managed uninstall

这样才能把生产路径从 dev 兼容逻辑里解耦出来。

### 二. 引入受管插件索引 `plugin-index.json`

安装成功后，系统必须持久化一个受管插件索引，而不是以后每次靠扫描反推。

建议结构：

```json
{
  "plugins": {
    "<pluginId>": {
      "state": "active",
      "version": "0.1.0",
      "kind": "agent-runtime",
      "installSource": "npm",
      "installSpec": "@nextclaw/xxx",
      "generation": "20260327T120102Z-abcd",
      "installPath": ".../plugins-store/<pluginId>/<generation>",
      "manifestPath": ".../openclaw.plugin.json",
      "capabilities": {
        "channels": [],
        "providers": [],
        "engines": [],
        "ncpAgentRuntimes": ["codex"]
      }
    }
  }
}
```

这个索引是卸载的主依据。

卸载时不再需要：

- 重新扫目录
- 重新 load 全量插件
- 重新推断这个插件是谁

### 三. 引入 `PluginInstanceManager`

宿主需要维护真正的 live 插件实例，而不是只有一个重建出来的 registry snapshot。

建议结构：

```text
PluginInstanceManager
  - instances: Map<pluginId, PluginInstance>

PluginInstance
  - pluginId
  - generation
  - manifest summary
  - activationScope
  - registered capabilities
  - channel gateway handles
  - status
```

这里的关键不是“把 registry 做得更复杂”，而是：

- 每个插件有自己独立的 activation scope
- 每个插件注册的能力都知道 owner 是谁
- 卸载时只 dispose 当前插件，不重建别人

### 四. 所有能力都挂在 per-plugin activation scope 下

之前 NCP runtime 已经往 `Disposable` 方向走过一步，但终局必须继续扩到全部插件能力：

- tool
- provider
- engine
- ncp runtime
- channel
- route / background task / timer / watcher

规则必须是：

- 任何插件注册动作都返回 `Disposable`
- 所有 `Disposable` 都进入该插件的 activation scope
- 禁用 / 卸载时直接 dispose 整个 scope

这样“停一个插件”才是 `O(changed plugin)`。

### 五. canonical install store 改成 generation 模型

正式受管插件不应该直接散落在多个可能路径中。

建议统一为：

```text
<NEXTCLAW_HOME>/plugins-store/<pluginId>/<generation>/
<NEXTCLAW_HOME>/plugins-trash/<pluginId>/<generation>/
<NEXTCLAW_HOME>/plugin-index.json
```

优点：

1. 单一 canonical path
2. 安装/升级可用新 generation 原子切换
3. 卸载可直接从 active generation 移到 trash
4. 不需要同步清理多份镜像目录

历史兼容路径只在迁移期处理，不应永久留在主链路。

### 六. 卸载改成单次事务

终局卸载流程应该是：

1. 从 `plugin-index.json` 直接定位插件
2. 获取该插件操作锁
3. `PluginInstanceManager.deactivate(pluginId)`
4. live registries 立刻移除该插件提供的能力
5. 只停止该插件自己的 channel gateway handles
6. 单次持久化：
   - config entry 删除
   - install record 删除
   - allowlist / load path 清理
   - plugin index 标记为 `uninstalled`
7. 把 generation 目录原子 `rename` 到 `plugins-trash`
8. API 立即返回成功
9. 后台 GC 异步递归删除 trash 目录

这就是快路径。

### 七. 文件删除必须后台化

磁盘删除不应该再放在卸载请求的关键路径里。

建议语义：

- 卸载成功 = 用户看不见 + 运行时不生效 + 下次启动不加载
- 后台 GC 成功 = 磁盘空间回收完成

如果 GC 暂时失败：

- 不回滚 logical uninstall
- 记录 tombstone / retry queue
- 下次启动或后台任务继续删

这才是用户体验优先的结构。

### 八. channel 插件改成定点停机，不再全局重启

channel 插件是最容易把卸载做慢的一类。

终局应把运行句柄下沉到插件实例级别：

```text
pluginId -> channelId -> accountId -> gateway handle
```

卸载时只做：

- stop 该插件持有的 handles
- 从 live channel registry 中移除该插件注册的 channel

而不是：

- 重算全部 bindings
- 停掉所有 plugin channel gateways
- 重新启动一批不相关网关

### 九. UI 只依赖 logical uninstall 结果

UI 不应该等待物理删盘完成才更新。

API 返回成功的条件应该改成：

- live registry 已移除
- config/index 已持久化
- 卸载任务已进入 GC 队列

这样页面可以立即：

- 从 installed list 移除
- 从 session types / tools / providers 中移除
- 展示 “Uninstalled” 成功提示

## 为什么这才接近 VSCode

VSCode 快，不是因为它“删文件特别快”。

而是因为它把用户关心的动作收敛成：

- 停止扩展参与运行
- 更新宿主状态
- 后续再处理落盘与清理

我们真正该学的是：

1. 每扩展独立 lifecycle
2. 每扩展独立 activation scope
3. 宿主 live registry 是增量可撤销的
4. 卸载成功不依赖全局重建

## 分阶段落地

### Phase 0: 立即止血

先做不改大架构但收益最高的动作：

1. Marketplace 卸载改成单次 config mutation + 单次 live reload
2. 移除 `disable -> reload -> uninstall -> reload` 双跳
3. `uninstallPluginMutation()` 不再调用 `buildPluginStatusReport()`
4. 若 install record 存在，直接按 install record 卸载
5. 目录删除改成 `rename to trash + background delete`

这一阶段的目标不是完美，而是先把体感时间砍掉一大半。

### Phase 1: 引入受管插件索引

1. 安装时写 `plugin-index.json`
2. 卸载/启用/禁用都先查 index，不再扫目录推断身份
3. managed plugin 与 dev load path plugin 做源分离
4. 统一 canonical install root

做到这一步后，卸载链路就能真正摆脱“全量发现”。

### Phase 2: 引入 `PluginInstanceManager`

1. 每插件 activation scope
2. 所有插件能力改为可撤销注册
3. 运行时能力 registry 支持 per-plugin remove
4. channel gateway handle 下沉到 per-plugin 实例

做到这一步后，禁用/卸载就可以不再依赖全量 registry rebuild。

### Phase 3: generation store + async GC 完整闭环

1. 安装升级走 generation
2. 卸载走 trash
3. GC 队列重试
4. 启动时回收残留 trash

做到这一步后，磁盘清理也会变成稳定、可恢复、可观测的后台流程。

## 明确不再接受的模式

终局里，下面这些模式都应该视为要被移除：

1. 为了卸载一个插件而 `loadOpenClawPlugins()` 全量加载所有插件
2. `disable` 和 `uninstall` 分两次对用户可见的同步操作
3. 卸载主链路里做同步递归删盘
4. 依赖多副本目录清理保证“不复活”
5. 通过全量重建 registry 才能完成单插件停用
6. 把 dev plugin source 的兼容逻辑混进正式 Marketplace 快路径

## 我的明确建议

如果目标真的是“像 VSCode 一样快”，那就不要继续在现有链路上做微调。

应该直接采用下面这个总方向：

1. 把卸载定义成 `logical uninstall + async GC`
2. 把 managed plugin 从“目录扫描发现”升级为“索引驱动管理”
3. 把 live runtime 从“全量重建 snapshot”升级为“per-plugin activation / dispose”
4. 把 canonical install root 收敛成 generation store

这不是锦上添花，而是唯一能稳定达到目标体验的结构。

