# CLI Command-First Debt Cleanup Plan

## 目标

把 `packages/nextclaw/src/cli` 从“历史平铺根目录”逐步收敛到已经确定的 command-first 目标结构，并且在尽量少的批次里完成。

目标结构：

```text
src/
├── app/
├── commands/
└── shared/
```

其中：

- `commands/` 等价于 `features/`
- `app/` 负责 CLI 启动、bootstrap、命令注册、运行时装配
- `shared/` 负责跨多个 command 的稳定共享层

## 当前已知债务

当前 CLI 根层仍存在以下非目标结构债务：

- 根级目录：`experiments/`、`gateway/`、`runtime-state/`、`skills/`、`update/`
- 根级文件：`index.ts`、`runtime.ts`、`workspace.ts`、`types.ts`、`utils.ts`、`config-*.ts`、`restart-*.ts`、`runtime-*.ts`、`startup-trace.ts`、`service-command-registration.service.ts`、`register-agents-commands.ts`
- 业务边界债务：现有代码存在大量 `commands/<command>/...` deep import

当前治理已经启用：

- `cli-command-first` 协议已接入模块结构检查器
- CLI 使用严格 `contract-only`
- 历史根债务一旦触达，直接报错，不再只给 warning

## 执行原则

- 尽量少批次完成，优先尝试 2 个阶段
- 能复用已有目录语义的就复用，不发明新目录
- 根层优先：越靠近 `src/cli` 根层、越靠近 command 根层的债务越优先处理
- 先改拓扑骨架，再改叶子文件；不要退回“哪里报错就补哪里”的被动推进
- 优先清理根层最明显、耦合最小的债务
- 每一阶段结束都必须有可验证的结构收敛结果

## 执行顺序调整

后续所有批次都按以下优先级推进：

1. `src/cli` 根层一级目录与一级文件
2. `commands/<command>` 根层一级目录与一级文件
3. `features/`、`shared/`、`providers/`、`controllers/`、`services/`、`types/` 这些一级角色层
4. 更深层的实现文件、测试文件与叶子 import

这意味着：

- 若某个深层报错是由上层骨架错误引起，默认先修上层骨架
- 若同一批里既有根层债务也有叶子债务，默认先清根层债务
- 只有在上层结构已经确定后，才进入深层路径和局部测试修正

## 阶段划分

### 阶段 1：根层骨架收窄

优先处理根层入口与低耦合债务：

- 创建 `app/`
- 把 CLI 启动 / runtime / bootstrap / 注册相关文件迁入 `app/`
- 把 `update/` 并回 `commands/update/`
- 把 `skills/` 并回 `commands/skills/`
- 更新对应 import，优先消掉根层直接依赖 `update/`、`skills/` 的路径

完成标准：

- `update/` 与 `skills/` 不再留在 CLI 根层
- `app/` 开始承接 CLI 入口与装配职责
- 治理检查对本阶段改动通过

### 阶段 2：边界清债与 support 归位

继续处理高耦合债务：

- 清理 `gateway/`
- 清理 `runtime-state/`
- 收敛 `commands/*-support/` 与 `commands/shared/` 的边界
- 尽量消除 `commands/<command>/...` deep import，统一走 command root 入口
- 评估 `experiments/` 的最终归属，能删则删，不能删则归位

完成标准：

- CLI 根层只剩 `app/`、`commands/`、`shared/` 与协议配置文件
- 主要 command 边界形成唯一导入入口
- 历史根层债务显著下降

## 验证方式

每一阶段至少执行：

- `node --test scripts/governance/module-structure/lint-new-code-module-structure.test.mjs`
- `pnpm lint:new-code:governance -- <touched-files...>`
- 必要时用真实历史文件触发 `module-structure` 检查器，确认旧债务触达即报错

## 当前执行决定

立即从阶段 1 开始。

阶段 1 的优先顺序：

1. `app/` 骨架建立与入口文件迁移
2. `update/ -> commands/update/`
3. `skills/ -> commands/skills/`

这样做的原因是：

- 根层入口文件本身已经违反目标骨架，必须先收进 `app/`
- `update/` 和 `skills/` 迁移依赖 `runtime.ts`、`index.ts` 等入口路径，先做 `app/` 能避免重复改 import
- 入口收敛后，再迁 `update/` 和 `skills/` 的路径面会更干净
