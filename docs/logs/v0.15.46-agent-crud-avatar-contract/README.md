# v0.15.46 Agent CRUD Avatar Contract

## 迭代完成说明

- 将 Agent 自管理说明从“只讲创建”收敛为统一的 Agent CRUD 契约，明确 AI 管理 Agent 时应优先使用 `nextclaw agents list|new|update|remove --json`，而不是直接改 `config.json` / `agents.list`。
- 同步收紧仓库文档与打包运行时文档，避免 repo 里的说明与运行时注入给 AI 的说明不一致。
- 收敛了 Agent 头像规范：AI 创建 Agent 时应优先显式传入头像，且默认避免文字型头像；文档中不再推荐 DiceBear `initials`，改为非文字型的稳定示例。
- 在核心系统提示与 `nextclaw-self-manage` skill 中补齐同一条高优先级约束，并补了对应测试，确保提示系统本身也更清晰明确。

## 测试/验证/验收方式

- `PATH=/opt/homebrew/bin:/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C packages/nextclaw-core test src/agent/tests/context.test.ts`
- `PATH=/opt/homebrew/bin:/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C packages/nextclaw-core tsc`
- `diff -u /tmp/nextclaw-agent-crud-docs.txt /tmp/nextclaw-agent-crud-packaged.txt`
  - 通过，确认 `docs/USAGE.md` 与 `packages/nextclaw/resources/USAGE.md` 的 Agent CRUD 区块完全一致。
- `PATH=/opt/homebrew/bin:/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm lint:maintainability:guard`
  - 通过；存在两个历史/边界 warning：
  - `packages/nextclaw-core/src/agent/context.ts` 正好达到文件预算上限。
  - `packages/nextclaw-ui/src/components/chat` 目录仍为已有豁免的超预算目录，本次未继续恶化。

## 发布/部署方式

- 不适用。本次仅完成自管理文档、运行时提示与测试收敛，没有执行发布。

## 用户/产品视角的验收步骤

1. 打开仓库文档中的 Agent 自管理说明，确认同一处已经统一描述 Agent 的 `list/new/update/remove` 推荐路径，而不是只描述创建。
2. 确认文档明确写出：正常 Agent CRUD 不应直接操作 `config.json` / `agents.list`，`Routing & Runtime` 也不是 Agent 身份管理入口。
3. 确认文档明确写出：AI 创建 Agent 时应优先提供显式头像，并默认避免文字型头像；DiceBear `initials` 不再作为默认示例。
4. 运行 `nextclaw-core` 的上下文测试，确认系统提示中也已经包含同样的 Agent CRUD 与头像约束。

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。本次不是再补一条分散规则，而是把文档、打包副本、skill 和系统提示收敛成一套统一契约。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。核心动作是把原本“创建规则 + 零散补充”收敛为统一 CRUD 约束，并删除了文档里与新规范冲突的 `initials` 默认推荐。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：基本做到。未新增任何源代码目录；本次自身 diff 统计为新增 45 行、删除 29 行、净增 16 行，其中非测试代码新增 43 行、删除 29 行、净增 14 行。净增来自把原本缺失的统一约束补到运行时提示链路中，属于最小必要增长。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：更清晰。没有新增新的 helper / service / wrapper，而是直接强化现有 source-of-truth 文档与提示入口。
- 目录结构与文件组织是否满足当前项目治理要求：本次未新增目录平铺问题；`packages/nextclaw-ui/src/components/chat` 的历史目录 warning 仍在，但本次未触碰该目录。`packages/nextclaw-core/src/agent/context.ts` 达到预算边缘，后续若继续扩展自管理提示，应优先拆分该文件中的自管理提示构建职责。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：是。
  - 可维护性复核结论：通过
  - 本次顺手减债：是
  - 代码增减报告：
    - 新增：45 行
    - 删除：29 行
    - 净增：+16 行
  - 非测试代码增减报告：
    - 新增：43 行
    - 删除：29 行
    - 净增：+14 行
  - no maintainability findings
  - 可维护性总结：这次增长主要用于把“Agent CRUD 统一入口”和“非文字头像默认规范”真正注入到 AI 会读到的主链路里，而不是只停留在仓库讨论层。虽然出现了小幅净增，但没有新增模块、没有新增抽象层，也同步删掉了旧的冲突建议，因此整体是一次收敛而不是补丁式膨胀。
