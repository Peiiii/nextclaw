# v0.44.13 子 Agent 执行合同修复

## 迭代完成说明

- 根因：2026-04-03 引入空会话创建后，2026-04-10 的统一会话请求改造把 `notify` 误用成了“是否启动”的开关；2026-05-12 又让 `final_reply` 路径同步等待，最终把运行、等待和通知三种独立语义耦合在一起。
- 确认方式：沿 `sessions_spawn` 从工具 schema、请求分发、父子会话运行、完成回执到 journal/message projection 做端到端追踪，并用 Git 历史定位 `44e811693`、`48d5a1b77`、`5416d3cfa` 和 `27dea5431` 四个关键演变点。
- 根因修复：明确 `start`、`wait`、`notify` 三个正交控制面；默认 `start=true`、`wait=none`、`notify=final_reply`，仅创建空会话必须显式传 `start=false`。完成通知通过隐藏系统输入回到父会话，异步工具终态由统一事件 coordinator 写入 journal、实时事件流和 message projection。
- 用户文档、中英文多 Agent 指南、Native 上下文提示和 UI 工具卡已同步更新。

## 测试/验证/验收方式

- Kernel 定向测试：6 个文件、45 个测试通过。
- UI 相关工具卡测试：2 个测试通过。
- `@nextclaw/core`、`@nextclaw/kernel`、`@nextclaw/ui` TypeScript 编译检查通过。
- 所有变更 TypeScript 文件 ESLint 通过，`git diff --check` 通过。
- Core、Kernel、NextClaw 最终构建通过。
- 使用隔离的本地 NextClaw 实例和真实 `codex-sub/gpt-5.6-luna` 模型验证：父 Agent 在子任务结束前先返回，子任务完成后父会话收到通知继续，原工具结果更新为 `completed`；冷重启后仍可从 API 复读相同终态。
- 使用真实模型验证 `start=false`：只创建空子会话，子会话保持 `idle`、消息数为 0、没有运行事件。

## 发布/部署方式

- 本批仅按用户授权提交到隔离分支，不 push、不发布、不部署。
- 用户可见修复已添加 patch changeset，等待后续统一发布流程消费。

## 用户/产品视角的验收步骤

1. 让父 Agent 调用 `sessions_spawn` 创建一个需要数秒才能完成的子任务。
2. 确认父 Agent 在子任务完成前可以继续并结束当前回复。
3. 确认子任务完成后父会话收到内部完成通知并继续处理。
4. 刷新或重启 NextClaw，确认原 `sessions_spawn` 工具卡仍显示 `completed`。
5. 显式传 `start=false`，确认只生成空子会话且不会自动执行任务。

## 可维护性总结汇总

- 将事件发布、journal 落盘和投影同步收敛到 `SessionEventCoordinatorService`，避免继续扩张 `SessionManager`；`session.manager.ts` 从基线 606 行降至 600 行，journal store 从 400 行降至 399 行。
- 运行 diff-only maintainability guard，结果为 0 error、5 warning；warning 均为既有或临近预算提示，没有新增超限错误。
- 运行、等待、通知分别拥有单一字段和单一语义；删除了 session request 对已结束 runtime 回调的依赖，没有新增兼容双路径。
- 新文件通过 planned-path preflight，目录与角色检查通过。

## 红区触达与减债记录

### packages/nextclaw-kernel/src/managers/session.manager.ts

- 本次是否减债：是。
- 说明：把 session event 协调职责移到独立 service，文件由 606 行降至 600 行。
- 下一步拆分缝：继续把会话生命周期编排从 API 门面中按 owner 下沉。

### packages/nextclaw-kernel/src/stores/ncp-agent-session-journal.store.ts

- 本次是否减债：是。
- 说明：投影同步细节归属 message projection store，journal store 只保留单行委托，文件由 400 行降至 399 行。
- 下一步拆分缝：将 journal 写入队列和 summary/index 协调进一步分离。

## NPM 包发布记录

不涉及 NPM 包发布；本次仅添加 changeset，待后续统一发布。
