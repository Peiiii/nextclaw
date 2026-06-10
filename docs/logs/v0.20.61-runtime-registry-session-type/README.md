# v0.20.61 Runtime Registry Session Type

## 迭代完成说明

本次收敛 runtime registry / manager 的职责边界，并修复 chat 左上角新建会话入口看不到 runtime 会话类型的问题。

架构根因有两层：

- Kernel 侧 `AgentRuntimeManager` 与 `AgentRuntimeRegistry` 都在表达 runtime entry / provider / listing 相关事实，形成重复 owner。实际生效链路是 `AgentRunRequestManager -> AgentRuntimeManager -> runtime provider`，因此保留 manager 作为运行时生命周期 owner，把 registry service 收敛为纯 utils。
- UI 侧左上角创建入口属于 sidebar / 会话创建表面，但之前读取的是 `ChatInputStore.sessionTypeOptions`。这个 store 没有由 query 链路稳定同步，所以本地开发态 API 已返回 `native/hermes/claude/codex/opencode` 时，sidebar 仍可能看不到非默认类型。
- Codex runtime 需要同时支持“运行时默认模型”和“NextClaw 指定模型”。根因是 server config 的 `narp-stdio` entry 归一化会丢掉 `modelSelectionMode/model/recommendedModel/supportedModels`，且 runtime entries 只在 kernel contribution 启动时 apply，`/api/config/runtime` 更新后 session type listing 不会同步刷新。

修复方式：

- 删除 `AgentRuntimeRegistry` class，把 runtime entry resolution 和 session type describe 逻辑放入 `runtime-registry/utils`。
- `AgentRuntimeManager` 继续作为 kernel live owner，直接调用纯 utils，避免重复 listing owner。
- Service CLI runtime 列表复用同一套 utils，删除为了 registry class 构造的 unused runtime。
- `ChatSidebar` 直接从 `NcpChatQueryStore.sessionTypesQuery` 派生 `defaultSessionType` 和 `sessionTypeOptions`，不再依赖输入框或 input store。
- 会话列表 runtime context 由 sidebar 将同一份 session type options 传给 session entry，避免 session entry 隐式读取 input store。
- `narp-stdio` runtime entry 配置保存时保留模型选择字段，Codex 可通过配置声明 `modelSelectionMode: "optional"`。
- `AgentRunRuntimeContribution` 接入 config reload hook，runtime entry 更新后重新 apply 到 `AgentRuntimeManager`，让 session type listing 和实际 run 继续共享同一 live owner。
- 将 runtime entry config 归一化移到 config utils，避免继续向超长 `server-config.store.ts` 塞无状态解析逻辑。
- 将“写代码前先判断最佳 owner / 最佳落点，不能因为当前组件方便就塞进去”沉淀到 `AGENTS.md` 和 `nextclaw-clean-implementation`。

## 测试/验证/验收方式

- `curl http://127.0.0.1:18792/api/ncp/session-types`：本地源码 dev API 返回 `native/hermes/claude/codex/opencode`，Codex ready。
- `PUT http://127.0.0.1:18792/api/config/runtime`：给 Codex runtime entry 写入 `modelSelectionMode: "optional"` 后，`/api/config` 返回配置已保存，`/api/ncp/session-types` 返回 Codex `modelSelectionMode: "optional"`。
- Chrome DevTools 打开 `http://127.0.0.1:5174/chat`：左上角出现“会话类型”按钮，菜单包含 Claude Code、Codex、Hermes、OpenCode。
- Chrome DevTools 在 `http://127.0.0.1:5174/chat/draft` 选择 Codex 后，模型选择器默认显示“运行时默认”，展开后同时显示“运行时默认”和普通模型列表。
- `pnpm -C packages/nextclaw-ui exec vitest run src/features/chat/components/layout/__tests__/chat-sidebar.test.tsx src/features/chat/components/layout/__tests__/chat-sidebar-read-state.test.tsx`
- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw-ui lint`
- `pnpm -C packages/nextclaw-kernel exec vitest run src/features/runtime-registry/utils/agent-runtime-registry.utils.test.ts`
- `pnpm -C packages/nextclaw-kernel exec vitest run src/features/runtime-registry/utils/agent-runtime-registry.utils.test.ts src/features/narp-runtime/services/builtin-narp-runtime-provider.service.test.ts --reporter=verbose`
- `pnpm -C packages/nextclaw-kernel tsc`
- `pnpm -C packages/nextclaw-kernel lint`
- `pnpm -C packages/nextclaw-server exec vitest run src/features/config/stores/server-config.store.runtime.test.ts --reporter=verbose`
- `pnpm -C packages/nextclaw-server tsc`
- `pnpm -C packages/nextclaw-server lint`
- `pnpm -C packages/nextclaw-service tsc`
- `pnpm -C packages/nextclaw-service lint`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths <本次相关路径>`

说明：

- UI lint 通过但保留 33 个既有 warning，均不在本次触达的 sidebar / session entry 文件中。
- Service lint 通过但保留 8 个既有 warning。
- 浏览器 console 仍有既有 `/api/runtime/update` 404 资源请求，不影响本次 session type 菜单验收。

## 发布/部署方式

本次未执行部署或发布。

## 用户/产品视角的验收步骤

1. 启动本地源码开发态，使用 UI 端口 `5174` 和 API 端口 `18792`。
2. 打开 `http://127.0.0.1:5174/chat`。
3. 查看左上角“新任务”旁边应显示“会话类型”按钮。
4. 点击“会话类型”，菜单应显示 Claude Code、Codex、Hermes、OpenCode 等非默认 runtime 类型。
5. 点击 Codex，应创建 / 切换到 Codex draft，并在主界面显示 Codex 标识。

## 可维护性总结汇总

本次遵守删除和 owner 收敛优先：删除重复的 `AgentRuntimeRegistry` class，保留 `AgentRuntimeManager` 作为 kernel live owner；UI 会话类型来源回到 query / sidebar owner，移除对输入组件状态的隐式依赖。后续补充中将 runtime entry config 归一化移出超长 `server-config.store.ts`，该热点文件本次净减 50 行；`post-edit-maintainability-review` 已使用。唯一相关 warning 是 sidebar 测试文件仍接近预算，但本次已从 897 行降到 835 行，下一步拆分缝是把 fixtures/builders 从行为测试中拆出。

## 红区触达与减债记录

### packages/nextclaw-server/src/features/config/stores/server-config.store.ts

- 本次是否减债：是
- 说明：该文件仍超出预算，但本次没有继续塞入 runtime entry 归一化细节，而是把无状态解析迁移到 `features/config/utils/runtime-entry-config.utils.ts`；同时复用 `default-provider-config.utils.ts` 承接内置 provider 默认对象创建。该热点文件本次净减 50 行，`updateProvider` 的 max-statements 指标没有继续恶化。
- 下一步拆分缝：继续按 config 子域拆分 store，优先把 provider update / provider view、runtime entries、channel projection 三块从单一 store 文件中拆出，让 `server-config.store.ts` 回到持久化协调 owner。

## NPM 包发布记录

本次未执行 NPM 发布。涉及 `@nextclaw/kernel`、`@nextclaw/service`、`@nextclaw/ui` 的源码变化；是否需要 changeset / 发布记录留到提交或统一发布前按 release workflow 再判断。
