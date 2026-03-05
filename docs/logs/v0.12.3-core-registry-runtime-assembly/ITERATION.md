# Iteration v0.12.3 - core-registry-runtime-assembly

## 1) 迭代完成说明（改了什么）

### 目标
将 NextClaw 的 provider/channel 架构调整为：
- `@nextclaw/core` 仅保留机制层（registry、匹配与路由算法）。
- `@nextclaw/runtime` 负责内置 provider/channel 的装配与数据提供。
- 上层应用（CLI / UI Server）只依赖 runtime 提供的内置目录，不再从 core 感知具体 provider/channel。

### 设计方案（详细）
1. Core 机制化改造（Provider Registry）
- 将 `packages/nextclaw-core/src/providers/registry.ts` 从“静态内置 provider 常量”重构为可注入机制：
  - 新增 `ProviderRegistry` class（支持 `replacePlugins/addPlugin/list/find`）。
  - 增加全局 registry 挂载点：`setProviderRegistry`、`configureProviderCatalog`。
  - 对外保留无状态查询函数（`findProviderByName/findGateway/...`），但数据来源改为当前注入 registry。

2. Core 去除具体内置数据
- 删除 core 内置 provider 数据文件：
  - `packages/nextclaw-core/src/providers/plugins/builtin.ts`
  - `packages/nextclaw-core/src/providers/plugins/index.ts`
- 删除 core 内置 channel 列表文件：
  - `packages/nextclaw-core/src/channels/plugins/builtin.ts`
  - `packages/nextclaw-core/src/channels/plugins/index.ts`
- `packages/nextclaw-core/src/index.ts` 移除对 `channels/plugins` 的导出。

3. Core 配置层去耦
- `packages/nextclaw-core/src/config/schema.ts`：
  - `providers` schema 改为通用 `z.record(ProviderConfigSchema)`，不再内建 provider shape。
  - provider 路由逻辑改为运行时读取 `listProviderSpecs()`，不依赖编译期内置 provider 常量。
- `packages/nextclaw-core/src/config/loader.ts`：
  - 保持“开箱即用”体验，若 `providers.nextclaw` 不存在则自动创建并生成 `nc_free_` key。

4. 新增 Runtime 装配层
- 新包：`packages/nextclaw-runtime`，提供：
  - 内置 provider 插件数据（从 core 迁移而来，当前先放一个 builtin plugin，后续可继续拆分）。
  - 内置 channel id 列表。
  - 装配入口：`installBuiltinProviderRegistry()`，模块加载时自动执行，向 core 注入 builtin provider registry。
- 对外导出：
  - `listBuiltinProviders` / `findBuiltinProviderByName` / `builtinProviderIds`
  - `BUILTIN_CHANNEL_PLUGIN_IDS`

5. 上层应用改造（装配责任上移）
- `@nextclaw/server`：
  - `src/ui/config.ts` 和 `src/ui/provider-auth.ts` 改为从 `@nextclaw/runtime` 获取 builtin provider 信息。
- `nextclaw` CLI：
  - `src/cli/commands/plugins.ts`、`channels.ts`、`diagnostics.ts` 改为从 `@nextclaw/runtime` 获取 reserved provider ids 与 builtin channel ids。

6. 工程链路更新
- root `package.json` 的 `build/lint/tsc` 脚本加入 `packages/nextclaw-runtime`。
- `packages/nextclaw` 与 `packages/nextclaw-server` 增加 `@nextclaw/runtime` 依赖。
- 对应 `tsconfig` 增加 `@nextclaw/runtime` path 映射。

### 兼容策略
- 目标是“行为不降级”：
  - 开箱即用的 nextclaw provider 仍会自动生成 key。
  - provider 路由与默认 apiBase 逻辑保留（改为 runtime 注入来源）。
- 架构上完成职责分层：core 无具体 provider/channel 数据，runtime 承担装配。

## 2) 测试/验证/验收方式

### 自动化验证（本迭代要求）
1. 全量工程验证：
- `pnpm build`
- `pnpm lint`
- `pnpm tsc`

2. 关键测试（最小回归）
- `pnpm -C packages/nextclaw-core test -- src/config/schema.provider-routing.test.ts`
- `pnpm -C packages/nextclaw-server test -- src/ui/router.provider-test.test.ts`

### 主要验收点
- core 中不再包含内置 provider/channel 数据定义文件。
- server/cli 能正常读取 runtime 的 builtin providers/channels。
- provider 路由、默认 apiBase、provider test 连接逻辑保持可用。

## 3) 发布/部署方式

### 代码发布（NPM 包）
1. 执行发布前校验：`pnpm build && pnpm lint && pnpm tsc`
2. 若需要发包，按项目 release 流程：changeset → version → publish。
3. 本次新增包 `@nextclaw/runtime`，发布时需纳入联动发布范围（依赖方 `nextclaw`、`@nextclaw/server`）。

### 部署
- 本次为架构层改造，不涉及 worker 或后端 migration。
- 若后续与在线服务联动发布，按 `release-must-be-closed-loop` 补齐线上冒烟。

## 4) 用户/产品视角的验收步骤

1. 安装并启动 NextClaw（不手动配置 provider）。
2. 打开配置页查看 Providers：
- 能看到 builtin providers（包含 NextClaw、DashScope、OpenRouter 等）。
- `nextclaw` provider 自动具备 `nc_free_` 前缀 key（首次生成并持久化）。
3. 在 CLI 执行：
- `nextclaw channels status`（builtin channel 列表正常展示）
- `nextclaw plugins list`（reserved provider ids 保护逻辑仍生效）
4. 在 UI 执行 provider connection test：
- 预期返回成功/失败结果结构正常，且不会出现 provider 未识别错误（对 builtin provider）。

