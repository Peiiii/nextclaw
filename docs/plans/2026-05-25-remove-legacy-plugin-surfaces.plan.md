# 彻底删除旧 Plugin 表面实施计划

**目标：** 在渠道和运行时 extension 迁移完成后，继续删除主仓库里剩余的旧 `plugin` 运行链路、配置域、marketplace 展示与管理入口，不保留旧路径兼容。

**核心判断：** 本轮不是把 `plugin` 改名成 `extension` 后继续展示，也不是做旧配置迁移层；而是删除已经没有当前产品 owner 的旧 OpenClaw plugin 表面。NextClaw 仍然保留长期生态扩展方向，但当前没有成熟的一等 extension marketplace 安装/管理合同，因此不保留 plugin marketplace 的占位 UI/API。

**执行原则：**

- `deletion-first`：能删就删，不用 alias、proxy、兼容读写或 fallback 保旧路径。
- `single-domain-owner`：extension 加载只走 extension runtime；渠道配置只走 `channels.*`；marketplace 当前只保留 skill / MCP。
- `no-compatibility-by-default`：`plugins.*` 配置、`/marketplace/plugins/*` API、旧 plugin 安装/启停/卸载入口都不做迁移兼容。
- `active-code-only`：历史 logs、旧计划和外部生态资料可以保留历史叙述；源码、测试、脚本、活跃文档和当前 UI 不能继续暴露旧路径。

---

## 当前已知并行改动

实施前必须先执行：

```bash
git status --short
```

当前工作区存在另一会话的并行改动，尤其涉及：

- `packages/nextclaw-service/src/shared/services/gateway/nextclaw-gateway-runtime.service.ts`
- `packages/nextclaw-kernel/src/features/*`
- `packages/nextclaw-shared/src/configs/ingress-keys.config.ts`
- `docs/designs/2026-05-25-agent-run-ingress-single-chain-design.md`

本计划实施时不得 revert、覆盖或格式化这些无关改动；触达同文件前必须先读当前内容并按现状合并。

---

## 成功标准

完成后，active code / scripts / package manifest / generated resource docs 中应满足：

1. 不存在 `config.plugins.*` 作为当前配置合同。
2. 不存在 `/api/marketplace/plugins/*` 路由。
3. UI 不再有 plugin marketplace tab / route / copy / installed cache 逻辑。
4. `MarketplaceInstaller` 不再声明 `installPlugin`、`enablePlugin`、`disablePlugin`、`uninstallPlugin`。
5. bootstrap / reload / gateway 测试不再使用 `pluginHydration`、`reloadPlugins`、`loadedPluginCount` 等旧命名。
6. extension manifest discovery 不再读取 `plugins.load.paths`。
7. active code 中旧关键词扫描只允许命中历史文档或非旧链路语义，例如 Lexical editor plugin、provider catalog plugin。

建议最终扫描：

```bash
rg -n "config\\.plugins|plugins\\.load|plugins\\.entries|plugins\\.installs|reloadPlugins|pluginHydration|loadedPluginCount|totalPluginCount|marketplace/plugins|PluginMarketplace|MarketplacePlugin|installPlugin|enablePlugin|disablePlugin|uninstallPlugin|openclaw\\.plugin\\.json|packageJson\\.openclaw|nextclaw plugins" packages scripts apps docker package.json pnpm-lock.yaml docs/USAGE.md packages/nextclaw/resources/USAGE.md --glob '!**/CHANGELOG.md' --glob '!**/dist/**' --glob '!**/ui-dist/**' --glob '!**/node_modules/**'
```

扫描结果必须逐条分类：确定已清、历史说明、非旧链路同名概念、或需要继续删除。

---

## 任务 1：删除 `plugins.*` 配置合同

**目标：** 从 core config schema 和 UI config metadata 中删除旧 plugin 配置域，不保留 `plugins` 到 `extensions` 的兼容迁移。

**重点文件：**

- `packages/nextclaw-core/src/features/config/configs/schema.ts`
- `packages/nextclaw-core/src/features/config/configs/schema.labels.ts`
- `packages/nextclaw-core/src/features/config/configs/schema.help.ts`
- `packages/nextclaw-core/src/features/config/configs/schema.hints.ts`
- `packages/nextclaw-core/src/features/config/configs/reload.ts`
- `packages/nextclaw-core/src/features/config/configs/reload.config.test.ts`
- `packages/nextclaw-core/src/features/config/configs/schema.plugin-channels.test.ts`

**删除内容：**

- `PluginEntrySourceSchema`
- `PluginEntrySchema`
- `PluginsLoadSchema`
- `PluginInstallRecordSchema`
- `PluginsConfigSchema`
- `ConfigSchema.plugins`
- `plugins.*` labels/help/hints
- `reloadPlugins` reload plan 字段与 rule

**同步调整：**

- 将 `schema.plugin-channels.test.ts` 改名为 `schema.channel-config.test.ts` 或 `schema.extension-channels.test.ts`。
- 测试描述从 `plugin channel compatibility` 改为 channel / extension channel 配置语义。
- 若有测试仍断言 `plugins.entries.*` 会触发 reload，应删除或改成当前真实入口。

**验收：**

```bash
pnpm -C packages/nextclaw-core tsc
pnpm -C packages/nextclaw-core test -- src/features/config/configs/reload.config.test.ts src/features/config/configs/schema.extension-channels.test.ts --run
```

---

## 任务 2：收敛 extension manifest 加载路径

**目标：** extension manifest discovery 不再读 `plugins.load.paths`。若需要用户配置扩展加载路径，后续单独设计 `extensions.load.paths`；本轮不新增替代配置合同。

**重点文件：**

- `packages/nextclaw-kernel/src/features/extension-runtime/services/extension-manifest-discovery.service.ts`
- `packages/nextclaw-kernel/src/services/extension-runtime.service.test.ts`

**删除内容：**

- `...(params.config.plugins.load?.paths ?? [])`
- 测试名中的 `existing configured load paths`。
- 所有依赖 `plugins.load.paths` 的断言。

**保留内容：**

- `${NEXTCLAW_HOME}/extensions`
- `<workspace>/.nextclaw/extensions`
- dev first-party extension dir
- bundled first-party extension package discovery

**验收：**

```bash
pnpm -C packages/nextclaw-kernel tsc
pnpm -C packages/nextclaw-kernel test -- src/services/extension-runtime.service.test.ts --run
```

---

## 任务 3：删除 plugin marketplace API 与服务空壳

**目标：** 删除当前没有真实 installer owner 的 plugin marketplace API，不保留只会返回 `NOT_AVAILABLE` 的 install/manage 空壳。

**重点文件：**

- `packages/nextclaw-server/src/features/marketplace/routes/marketplace.route.ts`
- `packages/nextclaw-server/src/features/marketplace/controllers/plugin-marketplace.controller.ts`
- `packages/nextclaw-server/src/features/marketplace/types/marketplace.types.ts`
- `packages/nextclaw-server/src/features/marketplace/utils/marketplace-installed.utils.ts`
- `packages/nextclaw-server/src/features/marketplace/utils/marketplace-spec.utils.ts`
- `packages/nextclaw-server/src/features/marketplace/utils/marketplace-catalog.utils.ts`
- `packages/nextclaw-server/src/features/marketplace/index.ts`
- `packages/nextclaw-server/src/app/router.ts`
- `packages/nextclaw-server/src/app/router.marketplace-content.test.ts`
- `packages/nextclaw-server/src/app/router.marketplace-manage.test.ts`

**删除内容：**

- `/api/marketplace/plugins/installed`
- `/api/marketplace/plugins/items`
- `/api/marketplace/plugins/items/:slug`
- `/api/marketplace/plugins/items/:slug/content`
- `/api/marketplace/plugins/install`
- `/api/marketplace/plugins/manage`
- `/api/marketplace/plugins/recommendations`
- `PluginMarketplaceController`
- `MarketplacePlugin*` 类型
- `MarketplaceInstaller` 中 plugin install/manage 方法
- plugin installed record 收集逻辑
- plugin marketplace router/content/manage 测试

**保留内容：**

- Skill marketplace API。
- MCP marketplace API。
- `MarketplaceItemType` 若只剩 `skill | mcp`，同步收窄。

**验收：**

```bash
pnpm -C packages/nextclaw-server tsc
pnpm -C packages/nextclaw-server test -- src/app/router.marketplace-content.test.ts src/app/router.marketplace-manage.test.ts --run
```

如果上述两个测试文件删除，应改跑剩余 marketplace skill / MCP 测试。

---

## 任务 4：删除 UI plugin marketplace 表面

**目标：** UI 不再展示插件市场，不再请求 `/marketplace/plugins`，不再维护 plugin installed cache。

**重点文件：**

- `packages/nextclaw-ui/src/app/configs/app-navigation.config.ts`
- `packages/nextclaw-ui/src/app/index.tsx`
- `packages/nextclaw-ui/src/shared/lib/ui-document-title/index.ts`
- `packages/nextclaw-ui/src/shared/lib/i18n/marketplace.ts`
- `packages/nextclaw-ui/src/shared/lib/api/types.ts`
- `packages/nextclaw-ui/src/shared/lib/api/utils/marketplace.utils.ts`
- `packages/nextclaw-ui/src/features/marketplace/hooks/use-marketplace.ts`
- `packages/nextclaw-ui/src/features/marketplace/components/marketplace-page.tsx`
- `packages/nextclaw-ui/src/features/marketplace/components/marketplace-page.test.tsx`
- `packages/nextclaw-ui/src/features/marketplace/utils/marketplace-installed-cache.utils.ts`
- `packages/nextclaw-ui/src/features/marketplace/utils/marketplace-installed-cache.utils.test.ts`

**删除内容：**

- `/marketplace/plugins` route。
- plugin marketplace tab/copy/search/no-result 文案。
- `fetchMarketplacePluginContent`。
- plugin install/manage mutation 分支。
- plugin installed cache 测试和工具中只服务 plugin 的逻辑。

**保留或调整：**

- 如果 `marketplace-page.tsx` 目前同时承载 skill/plugin，可将页面收窄为 skill 页面；避免为了删除 plugin 复制出一套新页面。
- MCP marketplace 页面保持独立。

**验收：**

```bash
pnpm -C packages/nextclaw-ui tsc
pnpm -C packages/nextclaw-ui test -- src/features/marketplace/components/marketplace-page.test.tsx src/features/marketplace/components/mcp/mcp-marketplace-page.test.tsx --run
```

---

## 任务 5：重命名 bootstrap / reload 的旧 plugin 语义

**目标：** 运行状态和热重载命名反映真实 extension/capability 语义，不再把 extension 加载叫 plugin hydration。

**重点文件：**

- `packages/nextclaw-server/src/shared/types/server-api.types.ts`
- `packages/nextclaw-service/src/shared/services/gateway/service-bootstrap-status.service.ts`
- `packages/nextclaw-service/src/shared/services/gateway/managers/gateway-extension.manager.ts`
- `packages/nextclaw-service/src/shared/services/gateway/utils/gateway-runtime-lifecycle.utils.ts`
- `packages/nextclaw-service/src/shared/services/gateway/nextclaw-gateway-runtime.service.ts`
- `packages/nextclaw-service/src/shared/services/gateway/tests/service-bootstrap-status.service.test.ts`
- `packages/nextclaw-service/src/shared/services/gateway/tests/nextclaw-app.service.test.ts`
- `packages/nextclaw-ui/src/shared/lib/api/types.ts`
- `packages/nextclaw-ui/src/features/system-status/**`
- `packages/nextclaw-ui/src/features/chat/**` 中依赖 bootstrap status 的测试

**建议命名：**

- `pluginHydration` -> `extensionLoading` 或 `capabilityLoading`
- `loadedPluginCount` -> `loadedExtensionCount`
- `totalPluginCount` -> `totalExtensionCount`
- `markPluginHydrationRunning` -> `markExtensionLoadingRunning`
- `markPluginHydrationProgress` -> `markExtensionLoadingProgress`
- `markPluginHydrationReady` -> `markExtensionLoadingReady`
- `markPluginHydrationError` -> `markExtensionLoadingError`
- `reloadPlugins` -> `reloadExtensions`

**测试必须修复：**

当前 `packages/nextclaw-service/src/shared/services/gateway/tests/nextclaw-app.service.test.ts` 已确认失败，因为测试仍 mock `gateway.plugins.*`，实现已使用 `gateway.extensions.load`。本任务必须把它改成 extension 测试。

**验收：**

```bash
pnpm -C packages/nextclaw-service test -- src/shared/services/gateway/tests/nextclaw-app.service.test.ts src/shared/services/gateway/tests/service-bootstrap-status.service.test.ts --run
pnpm -C packages/nextclaw-service tsc
pnpm -C packages/nextclaw-ui tsc
```

---

## 任务 6：删除脚本和治理里的 OpenClaw package metadata 残留

**目标：** 治理脚本不再把 `packageJson.openclaw.extensions` 当作入口。

**重点文件：**

- `scripts/governance/topology/topology-governance-shared.mjs`
- 相关 governance 测试，如存在。

**删除内容：**

- `pushValue(workspace.packageJson.openclaw?.extensions);`

**验收：**

```bash
pnpm lint:new-code:governance
```

---

## 任务 7：清理活跃文档和生成资源

**目标：** 面向当前用户和内置自管理指南的文档不再出现旧 plugin 配置/marketplace 入口。

**重点文件：**

- `docs/USAGE.md`
- `packages/nextclaw/resources/USAGE.md`
- `docs/feature-universe.md`
- `apps/docs/en/guide/commands.md`
- `apps/docs/zh/guide/commands.md`
- `packages/nextclaw-core/src/features/agent/shared/skills/hermes-runtime/SKILL.md`

**删除或改写：**

- `plugins.entries.*.config`
- `plugins.load.paths`
- plugin marketplace 管理描述
- `nextclaw plugins *`

**同步命令：**

```bash
node packages/nextclaw/scripts/sync-usage-resource.mjs
```

**注意：**

历史 `docs/logs/**` 和旧设计计划可保留历史记录，不强制全仓库抹除旧词。

---

## 任务 8：最终残留扫描与验证

**必须验证：**

```bash
pnpm -C packages/nextclaw-core tsc
pnpm -C packages/nextclaw-kernel tsc
pnpm -C packages/nextclaw-server tsc
pnpm -C packages/nextclaw-service tsc
pnpm -C packages/nextclaw-ui tsc
pnpm -C packages/nextclaw tsc
pnpm lint:new-code:governance
pnpm check:governance-backlog-ratchet
node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature
git diff --check
```

**定向测试至少覆盖：**

```bash
pnpm -C packages/nextclaw-kernel test -- src/services/extension-runtime.service.test.ts --run
pnpm -C packages/nextclaw-service test -- src/shared/services/gateway/tests/nextclaw-app.service.test.ts src/shared/services/gateway/tests/service-bootstrap-status.service.test.ts --run
pnpm -C packages/nextclaw-server test -- <剩余 marketplace skill/mcp route tests> --run
pnpm -C packages/nextclaw-ui test -- <剩余 marketplace skill/mcp tests> --run
```

**最终残留扫描：**

```bash
rg -n "config\\.plugins|plugins\\.load|plugins\\.entries|plugins\\.installs|reloadPlugins|pluginHydration|loadedPluginCount|totalPluginCount|marketplace/plugins|PluginMarketplace|MarketplacePlugin|installPlugin|enablePlugin|disablePlugin|uninstallPlugin|openclaw\\.plugin\\.json|packageJson\\.openclaw|nextclaw plugins" packages scripts apps docker package.json pnpm-lock.yaml docs/USAGE.md packages/nextclaw/resources/USAGE.md --glob '!**/CHANGELOG.md' --glob '!**/dist/**' --glob '!**/ui-dist/**' --glob '!**/node_modules/**'
```

---

## 风险与取舍

### 1. 这是 breaking cleanup

删除 `plugins.*` 配置合同会让旧配置不再生效。这是本计划的明确目标，不做兼容迁移。

### 2. marketplace plugin 删除后，extension 暂无安装 UI

这是有意为之：没有成熟的 extension install/manage 合同前，不保留旧 plugin marketplace 占位。后续如果要做，应单独设计 extension marketplace。

### 3. 并行改动风险

当前已有其他会话改动运行链路文件。实施时必须逐文件检查当前 diff，避免覆盖并行变更。

### 4. 命名中的普通 plugin 不等于旧链路

以下不应在本轮强删：

- Lexical / editor plugin 概念。
- Provider catalog plugin，如果它仍是 provider registry 的本地扩展概念。
- 历史文档、竞品/生态资料中描述 OpenClaw 的内容。

---

## 推荐落地顺序

1. 先删 server/UI plugin marketplace，减少外部 API 和 UI 表面。
2. 再删 `config.plugins.*` schema 与 extension discovery 对 `plugins.load.paths` 的读取。
3. 再重命名 bootstrap/reload 的 plugin 语义。
4. 最后清理文档、治理脚本和残留扫描。

这样做的原因是：先删除用户可见和 API 表面，再处理底层配置合同，最后改状态命名，能最大化暴露真实编译断点，避免只做局部换名。
