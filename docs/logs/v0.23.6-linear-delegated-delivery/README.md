# Linear 委派交付机制

## 迭代完成说明

- 新增 `delivering-delegated-linear-issues` skill，统一人工触发、批量处理与定时扫描 Linear 委派事项的领取和交付合同。
- 明确标签 owner：`Delegated to Agent` 与 `Delivery: Local Master` 由用户管理，Agent 永不自动增删。
- 引入持久且互斥的 Agent 状态标签：`Agent: Queued`、`Agent: Claimed`、`Agent: Blocked`、`Agent: Delivered`。状态迁移通过替换完成，不在处理后清空状态。
- 默认交付 ready PR；只有 `Delivery: Local Master` 明确选择本地路径时，才允许在 clean master、完整验证、fast-forward-only 和合并后 smoke 等硬门下合入本地 `master`。
- 保留串行队列、Run ID 领取竞争、隔离 worktree、Linear 评论回写和不自动标记 `Done` 等安全边界。

## 测试/验证/验收方式

- `quick_validate.py .agents/skills/delivering-delegated-linear-issues`：通过。
- `agents/openai.yaml` YAML 解析：通过。
- `git diff --check -- AGENTS.md`：通过。
- 静态状态矩阵检查覆盖：新委派/重试、领取、阻塞、PR 完成、本地 master 完成、dirty master、master 前进/冲突、合并后 smoke 失败与授权撤销。
- 本次只修改 AI 指令、skill 元信息和迭代记录，不涉及 TypeScript、运行链路或用户可运行功能，因此 build、lint、tsc 和产品冒烟不适用。

## 发布/部署方式

不涉及发布、部署、migration、远程 master 或生产操作。本次只提交到本地 `master`，不 push。

## 用户/产品视角的验收步骤

1. 在 Linear 保留用户标签 `Delegated to Agent`；需要本地合入时额外添加 `Delivery: Local Master`。
2. 首次领取后确认 Agent 状态变为 `Agent: Claimed`，且用户标签仍存在。
3. 成功交付后确认状态标签变为 `Agent: Delivered`；阻塞退回后确认变为 `Agent: Blocked`，而不是被清空。
4. 需要重试时把 Agent 状态改为 `Agent: Queued`，或直接要求 Agent 对指定 issue 重试。
5. 本地 `master` 不干净时确认 Agent 不 stash/reset/merge，而是保留分支证据并把 issue 标为 blocked。

## 可维护性总结汇总

- 机制收敛在单一 skill 中，没有创建平行工作流或窄治理脚本。
- `AGENTS.md` 只增加一条触发索引，具体状态机、异常恢复和交付硬门保持懒加载。
- 用户意图标签与 Agent 状态标签 owner 分离，避免把委派授权误当成运行锁；PR 与本地 master 共用领取、隔离开发、验证和回写主流程。
- 不涉及代码可维护性评估，`post-edit-maintainability-review` 不适用。

## NPM 包发布记录

不涉及 NPM 包发布。
