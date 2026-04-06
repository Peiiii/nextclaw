# 迭代完成说明

- 修复 Agent 管理页与运行时对“缺失 `workspace` 的额外 Agent”解析错误的问题：此前这类 Agent 会错误继承 `~/.nextclaw/workspace`，导致 UI 把所有 Agent 的主目录都展示成主 Agent 根目录。
- 将额外 Agent 的隐式 home 解析统一收口到 `packages/nextclaw-core/src/config/agent-profiles.ts`：
  - 新默认路径改为 `<agents.defaults.workspace>/agents/<agentId>`
  - 若检测到历史旧目录 `<workspace>-<agentId>` 仍存在，则继续兼容旧目录，避免打断存量数据
- `GatewayAgentRuntimePool` 改为复用 core 的 effective profile 解析，不再自己再算一套默认 workspace，避免“展示修好了、运行时仍跑错目录”。
- 新增 core / server / runtime 三层测试，覆盖：
  - 缺失 `workspace` 时推导为 `workspace/agents/<id>`
  - 仅存在旧目录时继续回落到 legacy home
  - `/api/agents` 返回正确 home
  - 运行时 engine factory 收到正确 agent workspace

# 测试 / 验证 / 验收方式

- 定向测试：
  - `pnpm -C packages/nextclaw-core test -- src/config/agent-profiles.test.ts`
  - `pnpm -C packages/nextclaw-server test -- src/ui/router.agents.test.ts`
  - `pnpm -C packages/nextclaw test -- src/cli/commands/agent/agent-runtime-pool.command.test.ts`
  - 结果：通过
- 类型检查：
  - `pnpm -C packages/nextclaw-core tsc`
  - `pnpm -C packages/nextclaw-server tsc`
  - `pnpm -C packages/nextclaw tsc`
  - 结果：通过
- 可维护性守卫：
  - `pnpm lint:maintainability:guard`
  - 结果：通过

# 发布 / 部署方式

- 不适用。本次为本地代码修复，不涉及远程部署、线上 migration 或发布闭环。

# 用户 / 产品视角的验收步骤

1. 启动或重启当前 NextClaw UI / service 实例。
2. 打开 Agent 管理页。
3. 确认 `main` 仍展示 `~/.nextclaw/workspace`。
4. 确认 `laowizard`、`zhangbasheng` 等额外 Agent 展示为 `~/.nextclaw/workspace/agents/<agentId>`，而不是统一展示成 `~/.nextclaw/workspace`。
5. 任选一个额外 Agent 发起会话，确认它的运行上下文、头像 home 资源与 memory 读写都继续命中对应 agent home。
6. 若本机仍保留旧式 `<workspace>-<agentId>` 目录，确认该 Agent 仍可继续工作，不会被强行切到新目录。

# 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。本次没有只在 UI 层做展示补丁，而是把隐式 Agent home 的推导规则收口到 core，并让运行时复用同一真相源。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。没有新增第二份配置字段、迁移脚本或临时 UI 映射层，只替换掉错误默认值，并删除 runtime pool 自己维护的一套重复解析逻辑。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：文件数未增长；总代码量有小幅净增长，主要用于补 legacy 兼容和回归测试，但同时减少了 runtime 层的重复推导，增长属于最小必要。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：更清晰。core 负责 Agent home 语义，runtime 负责消费 effective profile，server/UI 仅展示结果，避免再次分叉。
- 目录结构与文件组织是否满足当前项目治理要求：基本满足。本次未新增新目录，只在既有 core / server / cli 测试链路补充回归用例；`packages/nextclaw-core/src/config/agent-profiles.ts` 仍接近文件预算，后续若继续扩展 Agent profile 规则，应考虑拆出 path-resolution 子模块。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：已执行独立复核。
  - 可维护性复核结论：通过
  - 本次顺手减债：是
  - no maintainability findings
  - 可维护性总结：这次修复把“隐式 Agent home”从分散的 UI 现象收敛回单一核心规则，没有引入新的隐藏 fallback 矩阵。保留债务主要是 `agent-profiles.ts` 文件已接近预算，后续若还有更多 Agent 路径/迁移语义，应优先拆小而不是继续往同文件累加。
