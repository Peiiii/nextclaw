# NextClaw Companion Architecture Design

日期：2026-05-06

## 这份文档解决什么问题

这份文档定义 NextClaw Companion 的长期架构。

这里的 Companion 不是一个独立宠物系统，也不是 `apps/desktop` 的附属窗口。它是把现有 Agent 头像桌面常驻化的轻量入口：

```text
Companion = Agent Avatar 的桌面常驻形态
```

它不要求 server 为它新增专属 API，也不要求 server 新增 `presence` 之类的新公共状态层。Companion 应作为一个上层客户端，复用现有 session / agent / realtime 能力，并通过统一 Client SDK 访问本地或远程 NextClaw 服务。

## 产品对齐

Companion 服务 NextClaw 的统一入口和自感知连续性，但它不应成为一个孤立功能点。

它的价值是：

- 用户不用打开完整工作台，也能看到当前 Agent 是否在工作
- 运行中的 session 可以通过 Agent 头像常驻在桌面上
- 点击头像可以回到对应 session 或主工作台
- NPM、Desktop、apt、Homebrew 等安装形态共享同一个 Companion 能力
- 未来远程实例也可以通过同一 Client SDK 被 Companion 展示

Companion 只做小视窗、小入口、小状态表达。会话、Agent、任务、工具执行、实时流和服务端状态事实仍然属于现有 server API 与运行时 owner。

## 冻结结论

长期架构固定为四块：

```text
packages/nextclaw
  - companion CLI 命令
  - companion 进程启动 / 停止 / 状态管理
  - companion autostart 管理入口
  - 不承载 UI，不承载 runtime 业务状态

packages/nextclaw-client
  - NextClaw Client SDK
  - 封装 base URL、auth、session、agent、realtime、错误处理
  - 支持 local server、remote gateway、未来其他连接形态
  - 不依赖 React、Electron、Desktop 或 Companion

packages/nextclaw-server
  - 继续提供原子化 session / agent / runtime / config 等现有能力
  - 不为 Companion 新增专属 API
  - 不新增 presence API
  - 不知道调用方是 Desktop、Companion 还是其他客户端

apps/companion
  - 独立 Electron companion app
  - 透明小窗、托盘、位置记忆、通知、快捷唤起
  - 通过 Client SDK 读取 session / agent / realtime
  - 渲染当前运行中或最近活跃 session 的 Agent avatar
```

一句话边界：

**Server 管原子领域事实，Client SDK 管统一访问，Companion 管桌面头像呈现，CLI 管生命周期。**

## 为什么不新增 server API

Companion 需要的不是新的后端能力，而是现有能力的一种更小的客户端呈现。

第一版不新增：

```text
/api/companion/status
/api/companion/actions
/api/runtime/presence
/api/runtime/actions
/api/runtime/events
```

Companion 应优先复用：

- session 列表
- session 详情
- session 运行状态
- session realtime / stream / websocket
- agent metadata
- agent avatar
- 本地 UI 打开地址或 session URL

如果现有 API 缺少必要字段，也不新增 Companion 专属 API，而是回到对应语义 owner 补齐：

- session 是否运行中，归 session contract
- session 当前 agent summary，归 session view 或 agent contract
- agent avatar，归 agent metadata contract
- realtime 更新，归现有 session realtime 能力

## 为什么需要 Client SDK

Companion 和 Desktop 都是上层客户端。它们不应该各自手写 fetch、URL 拼接、stream 订阅、token/header、错误处理和 reconnect。

因此需要一个通用 Client SDK：

```text
packages/nextclaw-client
```

它服务所有客户端：

- `apps/companion`
- `apps/desktop`
- Web UI
- 未来远程连接客户端
- 未来移动端或 tray / menu bar 宿主

Companion 不直接耦合 server 内部结构，也不自己实现一套 parallel data client。它通过 Client SDK 使用 NextClaw 已有 API。

详细设计见 [NextClaw Client SDK Design](./2026-05-06-nextclaw-client-sdk-design.md)。

## Agent Avatar Companion

Companion 不引入独立宠物资产体系。

它复用 Agent 身份：

```text
Agent name
Agent avatar
Agent/session status
Agent/session action target
```

桌面浮窗展示的是当前选中或当前运行 session 对应 Agent 的头像。状态变化只影响头像的表现层：

```text
running session       -> avatar active ring / subtle motion
needs attention       -> avatar badge / pulse
recent active session -> normal avatar
no session            -> default NextClaw or selected Agent avatar
server offline        -> dimmed avatar / reconnect hint
```

多 Agent 场景第一阶段只展示一个目标：

1. 正在运行的 session 对应 Agent
2. 需要关注的 session 对应 Agent
3. 最近活跃 session 对应 Agent
4. 用户选择的默认 Agent
5. NextClaw 默认头像

不做多个桌面角色，不做宠物市场，不做独立人格系统。

## 数据接入

Companion 的数据接入和 Desktop/Web UI 应保持同级。

数据策略：

1. 启动时通过 Client SDK 获取 session / agent snapshot
2. 如果现有 session realtime / stream / websocket 可用，订阅同一条实时能力
3. 如果现有客户端数据层本来需要 refresh，Companion 使用同样策略
4. stream 断开时按 SDK 的 reconnect / refresh 规则恢复

这里的重点是：

- 不新增 Companion 专属 server API
- 不新增 polling-only 状态系统
- 不重复实现 Desktop 已有数据接入逻辑
- 不让 Companion 自己推导 server 内部状态

## 模块职责

### packages/nextclaw

`packages/nextclaw` 是 CLI 和本地生命周期管理入口。

它负责：

- `nextclaw companion start`
- `nextclaw companion stop`
- `nextclaw companion status`
- 后续 `nextclaw companion autostart enable / disable / status / doctor`
- 启动独立 `apps/companion` 产物
- 在需要时提示用户启动或修复 NextClaw service

它不负责：

- 渲染 Companion UI
- 维护 Companion 窗口位置
- 判断 session / agent 展示优先级
- 直接 import `apps/companion` 源码内部模块

### packages/nextclaw-client

`packages/nextclaw-client` 是所有上层客户端访问 NextClaw 服务的 SDK。

它负责：

- 创建 client
- 管理 base URL
- 管理 auth/header
- 封装 session / agent / realtime API
- 统一 stream、abort、timeout、reconnect 和错误形态
- 同时支持 local 和 remote endpoint

它不负责：

- 决定哪个 session 应该显示成 Companion
- 决定 Agent avatar 如何渲染
- 承载 React hook
- 承载 Electron 行为
- 吞掉 server contract 的真实错误

### packages/nextclaw-server

`packages/nextclaw-server` 继续提供原子领域能力。

它负责：

- session API
- agent API
- realtime / stream 能力
- config / auth / marketplace / remote 等现有能力
- 在原 owner 上补齐缺失字段

它不负责：

- 创建 Companion 专属 API
- 创建 presence API
- 判断调用方是不是 Companion
- 依赖 `apps/companion`
- 依赖 `apps/desktop`

### apps/companion

`apps/companion` 是独立 Electron Companion App。

它负责：

- 创建透明悬浮窗口
- 管理托盘菜单
- 管理窗口位置、尺寸和显示模式
- 通过 Client SDK 获取 session / agent / realtime 数据
- 选择要展示的 Agent avatar
- 点击后打开对应 session 或主 UI
- 在系统通知、快捷键、右键菜单中提供轻量操作

它不负责：

- 保存会话业务状态
- 执行 agent 任务
- 管理 runtime 生命周期
- 读取 server 内部文件或 import server 内部实现
- 作为第二个 Desktop App 承载完整控制台

## 文件组织建议

### packages/nextclaw

```text
src/cli/commands/companion/index.ts
src/cli/commands/companion/services/companion-process.service.ts
src/cli/commands/companion/services/companion-autostart.service.ts
src/cli/commands/companion/types/companion-command.types.ts
```

### packages/nextclaw-client

```text
src/client.ts
src/services/session-client.service.ts
src/services/agent-client.service.ts
src/services/realtime-client.service.ts
src/types/client-options.types.ts
src/types/session-client.types.ts
src/types/agent-client.types.ts
src/utils/url.utils.ts
```

### apps/companion

```text
src/main.ts
src/preload.ts
src/services/companion-window.service.ts
src/services/companion-tray.service.ts
src/services/companion-session-view.service.ts
src/services/companion-notification.service.ts
src/stores/companion-window-position.store.ts
src/types/companion.types.ts
src/renderer/
```

角色说明：

- window service 管 Electron 窗口
- tray service 管系统托盘
- session view service 从 SDK 数据中选择展示目标
- notification service 管系统通知
- store 管本地 UI 偏好和窗口位置
- renderer 管 Agent avatar 呈现

不使用 `support`、`helpers`、`common` 这类模糊目录。

## UI 与交互边界

第一阶段 Companion 交互保持克制：

- 左键点击：打开当前 session 或主 UI
- 右键菜单：打开 NextClaw、切换展示目标、隐藏、刷新、退出
- 拖拽：移动头像并记住位置
- 状态变化：通过头像 ring、badge、motion、opacity 表达
- 需要关注：轻量提示，不抢占屏幕

暂不纳入第一阶段：

- 完整聊天面板
- 独立 agent 会话系统
- 复杂人格系统
- 宠物资产系统
- 插件化皮肤市场
- 自己实现任务队列或自动化调度

## 错误处理

Companion 必须优先处理服务不可用场景：

- server 不可用时展示离线头像
- SDK 返回认证错误时提示重新连接或登录
- stream 断开时交给 SDK reconnect / refresh
- 点击打开 session 失败时给出可执行下一步
- Companion 崩溃不影响 NextClaw Runtime
- NextClaw Runtime 崩溃不导致 Companion 无限重启

## 验证策略

设计落地时需要分层验证：

### packages/nextclaw

- CLI 命令解析测试
- Companion 进程启动 / 停止 / 状态判断测试
- 自启动配置生成测试

### packages/nextclaw-client

- session client contract 测试
- agent client contract 测试
- realtime client reconnect / abort 测试
- local / remote base URL 解析测试

### apps/companion

- Electron main 进程最小 smoke
- 窗口创建 smoke
- tray 菜单 smoke
- server 不可用 smoke
- SDK mock 下 running session avatar 选择测试

只要触达 TypeScript 源码、类型声明或运行链路，收尾必须运行相关 `tsc`。用户可见行为改动必须做真实或贴近真实的冒烟。

## 最终原则

Server 提供原子领域事实，Client SDK 提供统一访问能力，Desktop/Companion 提供不同产品形态。

Companion 的本质不是新后端能力，也不是宠物系统，而是 Agent avatar 的桌面常驻呈现。
