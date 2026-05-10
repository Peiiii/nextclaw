# Service Public API Convergence

## 目标

`packages/nextclaw` 只依赖 `@nextclaw-service` 的少量高层 public contract，不再感知 service 包内部对象、内部目录和运行时组装过程。

`packages/nextclaw-service` 自己拥有 service graph、命令执行逻辑、状态 store、restart、plugin registry、NCP runtime、telemetry 等内部细节。

## 预期结构

- `packages/nextclaw/src/cli/app` 保留 CLI shell：
  - `commander` 命令声明
  - 参数解析
  - 调用 `NextclawServiceRuntime`
- `packages/nextclaw-service/src/service-runtime.service.ts` 成为 service runtime owner：
  - 创建并持有各 command service
  - 组装 restart / workspace / runtime / telemetry / plugin / channel 能力
  - 对外提供高层方法
- `packages/nextclaw-service/src/cli/commands` 承载原 CLI command 的执行逻辑。
- `packages/nextclaw-service/src/index.ts` 只导出 public contract：
  - `NextclawServiceRuntime`
  - `NextclawServiceRuntimeOptions`
  - `registerLearningLoopCommands`
  - `registerSkillsCommands`
  - CLI shell 需要的公开 option/result 类型

## 禁止形态

- `packages/nextclaw` 直接导入 `@nextclaw-service/*` 子路径。
- `packages/nextclaw` new service 内部类，例如 `RuntimeCommandService`、`WorkspaceManager`、`RestartCoordinator`。
- `@nextclaw-service` 根入口继续导出 stores、shared utils、内部 command classes、launcher classes。
- 新增 `@nextclaw-service/runtime`、`@nextclaw-service/commands` 作为跨包 public 子入口。
- 使用 `#service/*` 或其他新别名逃逸现有规则。

## 验收标准

```bash
rg "@nextclaw-service/" packages/nextclaw/src packages/nextclaw/tests
```

预期无结果。

```bash
rg "RuntimeCommandService|WorkspaceManager|RestartCoordinator|PluginCommands|ChannelCommands|ServiceCommands|managedServiceStateStore|llmUsageRecorder" packages/nextclaw/src
```

预期无结果。

```bash
rg "export .*\\\"\\./(shared|commands|launcher)/" packages/nextclaw-service/src/index.ts
```

预期无结果。根入口只允许导出 facade、command registration function 和 public types。

必须通过：

```bash
pnpm -C packages/nextclaw-service tsc
pnpm -C packages/nextclaw tsc
pnpm -C packages/nextclaw-service lint
pnpm -C packages/nextclaw lint
pnpm lint:new-code:package-public-imports
pnpm lint:new-code:governance
pnpm check:governance-backlog-ratchet
```

基础命令冒烟：

```bash
pnpm --filter nextclaw exec nextclaw --version
pnpm --filter nextclaw exec nextclaw status --json
```
