# Chat 新会话类型偏好设计

## 背景

Chat 左上角当前有两个相邻入口：左侧按钮用于新增会话，右侧下拉用于选择会话类型。实际行为是右侧下拉选择后会立即创建对应类型会话，但用户更容易把它理解成“设置新会话类型”。这导致动作语义和控件心智不一致。

这次设计目标是把“创建动作”和“创建配置”拆开：

- 左侧按钮只负责新增会话。
- 右侧控件只负责切换后续新增会话的类型。
- 切换结果应作为用户偏好持久保存。

## 现状依据

- Kernel 已有通用 `PreferenceManager`，支持 JSON 值的 `getPreference`、`setPreference`、`deletePreference`。
- Server 已暴露 `/api/preferences/:key` 的 get/put/delete 路由。
- UI 已有 `fetchPreference`、`updatePreference`、`deletePreference` API helper。
- Chat 模型收藏已使用 `chat.modelFavorites` 作为 kernel-backed preference。
- Sidebar 当前 `ChatSidebarDesktopToolbar` 中左侧按钮按 `defaultSessionType` 创建，右侧 `ChatSidebarCreateMenu` 选择后直接 `onCreateSession(sessionType)`。
- Session type option 已包含 `label`、`icon`、`ready`、`reasonMessage`、`modelSelectionMode` 等可展示数据，且已有 `ChatSessionTypeOptionItem` 可复用。

## 核心判断

右侧控件的稳定语义应是“新会话类型偏好”，不是“新增某类型会话”。

原因：

- 新增会话是一个动作，应该只有一个主入口。
- 类型选择是一个配置，应该可重复使用、可记忆、可恢复。
- 会话类型属于 chat session creation context，不属于 input bar，也不属于当前 session metadata。
- Runtime 图标应从 session type listing 派生，不应写 Codex 特例。

## 用户体验

桌面 sidebar 顶部保持左右相邻结构，两个控件都使用无边框 soft surface，让入口有清晰边界但不显得厚重：

- 左侧：`+ 新增会话`
- 右侧：当前新会话类型切换器

交互规则：

1. 用户点击右侧切换器，打开会话类型菜单。
2. 菜单展示所有可选 session type，包括默认类型和非默认类型。
3. 用户选择某个类型后，只更新偏好，不立即创建会话。
4. 右侧切换器立即切换为新选中类型的 runtime 图标；类型名称只在下拉菜单中展示。
5. 用户点击左侧 `新增会话` 时，按当前偏好创建该类型会话。
6. 用户刷新或重启后，右侧切换器恢复上次选择。

移动端可以继续保持一个 compact 新增入口，但菜单语义也应统一：如果 mobile 只有一个 `+` 入口，点击后可以先展示类型选择，再创建；如果后续移动端也拆成“新增 + 类型偏好”，则必须和桌面共享同一个 preference key。

## Preference 合同

新增 preference key：

```text
chat.newSession.sessionType
```

值：

```ts
type ChatNewSessionTypePreference = string;
```

存储规则：

- 只存 session type 稳定 ID，例如 `native`、`codex`。
- 不存展示文案、图标、runtime 名称或整个 option 对象。
- 写入前使用 `normalizeSessionType`。
- 读取后必须用当前 `sessionTypeOptions` 校验可用性。
- 如果值为空、格式无效、类型不存在或当前不可用，回退到 `sessionTypesData.defaultType ?? DEFAULT_SESSION_TYPE`。

Preference key 维护规则：

- 前端所有 preference key 必须通过统一 registry 引用，禁止在 feature hook、component、manager 中直接手写字符串。
- 推荐新增 `packages/nextclaw-ui/src/shared/lib/api/preferences/preference-keys.config.ts`，用 `as const` 对象维护 key，而不是散落多个局部常量。
- `chat.modelFavorites` 也应迁入同一个 registry，避免已有 key 和新 key 分属两套管理方式。
- Kernel `PreferenceManager` 继续保持 key-agnostic，不需要知道每个业务 key。
- 如果未来某个 preference key 需要被 kernel/server 业务逻辑理解，再把该 key 升级到跨包共享 contract；在此之前先由 UI API preference 模块统一管理。

建议形状：

```ts
export const PREFERENCE_KEYS = {
  chat: {
    modelFavorites: "chat.modelFavorites",
    newSessionType: "chat.newSession.sessionType",
  },
} as const;
```

是否覆盖历史 session：

- 不覆盖。
- 该 preference 只影响未来“新增会话”。
- 已创建会话的 `sessionType` 仍由 session record / metadata 承载。

## Owner 与数据流

推荐 owner：

- Kernel：继续使用现有 `PreferenceManager`，不新增专用 manager。
- Server：继续使用现有 preferences route，不新增 chat-specific route。
- UI API：继续使用现有 preference helper，并在 `preferences` API 模块内维护统一 preference key registry。
- Chat feature：新增 chat session type preference hook 或 manager，放在 `features/chat/features/session-type` 下。
- Sidebar：消费已解析好的当前新会话类型，不直接知道 preference 存储细节。

推荐数据流：

```text
PreferenceManager
  -> /api/preferences/chat.newSession.sessionType
  -> UI preference helper
  -> chat session-type preference hook/manager
  -> ChatSidebarToolbar
  -> ChatSessionListManager.createSession(selectedNewSessionType)
```

不推荐：

- 在各个 hook 或组件里直接写 `'chat.xxx'` key 字符串。
- 放进 `chat-input-bar.container.tsx`。
- 放进当前 session metadata。
- 让 sidebar 组件直接拼 API 请求和 fallback 逻辑。
- 为 Codex 写硬编码分支。
- 同时维护 localStorage 和 kernel preference 两套记忆。

## UI 组件边界

建议把当前 `ChatSidebarCreateMenu` 改名或收敛为更中性的 session type menu，例如：

- `ChatSessionTypeMenu`
- 或保留组件但改 props 语义，避免 `CreateMenu` 暗示选择即创建。

右侧切换器展示：

- 当前 session type icon。
- 常态关闭时不展示 session type label，避免顶部主操作区变挤。
- 常态关闭时使用接近白色的不透明浅底色，不加边框和强阴影，避免 runtime 图标和按钮背景冲突。
- 左侧创建按钮和右侧类型切换器的颜色通过 toolbar 内部样式变种控制；当前可选语义变种为 `neutralSurface`、`brandSoft`、`brandTextSurface`、`brandSolid`，分别对应中性浅色表面、柔和品牌色表面、中性表面承载品牌文字和实心品牌主色。
- 右侧类型切换器在当前 runtime/session type 图标旁展示一个小下拉箭头，明确提示这里可以打开类型菜单。
- 两个顶部操作都需要有更明显的 hover 反馈，但不通过额外边框制造新的视觉噪音。
- 必须有 tooltip / aria-label 表达该控件是会话类型切换器；具体类型名称在菜单项里展示。

菜单项展示：

- runtime/session type icon。
- label。
- ready/setup 状态。
- 当前选中项 check 状态。
- 不 ready 的类型仍可展示，但选择时应有明确 disabled 或 setup required 表达；具体是否允许选择不 ready 类型应和当前创建逻辑保持一致。

## 兼容与迁移

首次进入时没有 preference：

- 使用 runtime listing 的 `defaultType`。

历史用户已有 draft 或当前会话：

- 不从当前会话反推覆盖 preference。
- 只有用户显式切换右侧控件时才写 preference。

session type listing 变化：

- preference 指向的类型消失时，UI 回退默认类型。
- 不需要立即删除旧 preference；下一次用户选择时覆盖即可。

## 验收标准

功能验收：

1. 切换右侧类型不会创建新会话。
2. 切换后右侧按钮图标和左侧创建行为都使用该类型。
3. 刷新页面后仍恢复上次选择。
4. 当前类型图标来自 session type option，而不是硬编码 runtime。
5. 不可用类型有清晰状态，不出现静默失败。
6. 当前会话的类型不会因为切换“新会话类型”而变化。

测试建议：

- preference key registry 测试或类型约束：chat preference 只能从 registry 引用，至少迁移 `chat.modelFavorites` 和 `chat.newSession.sessionType` 两个 key。
- `ChatSidebarToolbar` 组件测试：选择类型只触发 preference update，不触发 `onCreateSession`。
- `ChatSidebarToolbar` 组件测试：点击新增按钮使用当前 resolved preference。
- session-type preference hook 测试：无 preference、有效 preference、无效 preference、option 缺失时的 fallback。
- preference API 或 existing helper 不需要为该 key 增加专用后端测试；复用现有通用 preference route 测试即可。

## 非目标

- 不在本入口里解决模型选择、思考强度选择或 project 选择。
- 不新增 runtime-specific 逻辑。
- 不重做 sidebar 布局。
- 不改变已有 session record 的 session type 存储合同。
- 不为一个 preference key 新增专用 kernel manager。

## 后续实现顺序

1. 在 `features/chat/features/session-type` 增加新会话类型 preference owner。
2. 在 UI preference API 模块增加统一 key registry，并迁移现有 `chat.modelFavorites`。
3. 将 sidebar toolbar 的右侧控件从“选择并创建”改成“选择并记忆”。
4. 将左侧新增按钮改为使用 resolved new-session session type。
5. 更新 i18n 文案和 aria/tooltip。
6. 补组件测试、hook 测试和 key registry 覆盖。
