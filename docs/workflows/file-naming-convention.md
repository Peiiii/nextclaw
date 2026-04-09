# File Naming Convention

目标：统一仓库内文件命名风格，降低认知成本，提升可维护性。  
参考：Angular / NestJS 的“语义后缀”模式。

## 1. 总原则

- 统一使用 `kebab-case`（小写 + 连字符）。
- 文件名必须体现职责（通过后缀标识模块角色）。
- 禁止使用：`camelCase`、`PascalCase`、`snake_case` 作为文件名。
- 同一文件只承载一个主要角色；不要在一个文件里混合多种角色。

## 2. 命名结构

推荐结构：

```txt
<domain>.<role>.ts
<domain>-<subdomain>.<role>.ts
```

示例：

- `chat.controller.ts`
- `chat-stream.manager.ts`
- `chat-input.store.ts`
- `provider-auth.service.ts`
- `marketplace-plugin.controller.ts`

## 3. 角色后缀约定（全仓库默认收口）

允许后缀（同级，无优先级）：

- `.service.ts`: 服务/编排能力（有状态或跨模块协调逻辑）。
- `.utils.ts`: 纯工具函数（无状态、可复用、输入输出稳定）。
- `.types.ts`: 类型定义聚合（仅类型，不放运行时逻辑）。
- `.test.ts`: 测试文件。

- `.manager.ts`、`.store.ts`、`.repository.ts`、`.config.ts`
- `.controller.ts`、`.provider.ts`

React hook 文件例外：

- 如果文件主职责是导出可复用 React hook，必须放在 `hooks/` 目录下。
- 命名必须使用 `use-<domain>.ts` 或 `use-<domain>.tsx`。
- 这类文件不使用 `.service.ts`、`.utils.ts` 等角色后缀。


## 4. 测试文件命名

- 单元测试：`<domain>.<role>.test.ts`
- 集成测试：`<domain>.<role>.int.test.ts`
- 端到端测试：`<domain>.<role>.e2e.test.ts`

示例：

- `cron.service.test.ts`
- `provider-auth.service.test.ts`

## 5. 目录与导出约定

- 优先 feature-first 目录组织（按业务域分目录）。
- React hook 目录统一使用 `hooks/`，避免与 `services/`、`utils/` 混放。
- `index.ts` 仅做导出聚合（barrel），不放业务逻辑。
- 避免模糊文件名：`utils.ts`、`helpers.ts`、`common.ts`（除非在明确子域目录下且职责单一）。

## 6. 反例

- `ChatController.ts`（非 kebab-case）
- `chatController.ts`（非 kebab-case）
- `chat_controller.ts`（snake_case）
- `controller.ts`（无业务域前缀，语义过弱）
- `chat.service.manager.ts`（多角色混合）
- `ui-bridge-api.client.ts`（若文件实际职责是服务编排而不是客户端职责，则命名与职责不匹配）
- `cron-job.view.ts`（若文件实际职责是纯工具而非视图职责，则命名与职责不匹配）
- `marketplace-installed-cache.ts`（如果实现只有纯映射 / view updater，而没有缓存协调）

## 7. 渐进迁移策略

- 新增文件：必须立即遵循本规范。
- 存量文件：按“改动即治理”原则，在触达文件时顺带迁移命名。
- 大规模改名：按模块分批进行，避免一次性跨仓库重命名导致冲突。

## 8. 机器守卫与审计入口

- `pnpm lint:new-code:governance` 现在会自动运行 `file-name-kebab-case` diff gate。
- 对新增或重命名的源码/脚本/测试文件：
  - 若文件名不是 kebab-case，会直接阻断。
  - 输出会同时给出建议目标名，便于直接改名。
- 对历史遗留且本次被触达的非 kebab-case 文件：
  - 默认只给 warning，不直接阻断主任务。
  - AI 仍必须评估是否可在同链路里安全重命名，并在保留债务时说明原因与下一步迁移位点。
- 如需盘点全仓历史命名债务，统一使用：

```bash
pnpm report:file-naming
```

- 该报告会输出“旧路径 -> 建议 kebab-case 路径”的清单，作为后续 AI 分批迁移、按目录偿还历史命名债务的统一入口。
