# 会话列表实时运行态覆盖设计

## 背景与复现证据

左侧会话列表只在分页摘要的 `status` 为 `running` 时展示旋转图标。同一个已在侧栏可见的项目会话执行长任务时，未打补丁的 5174 前端在开始后 1.2 秒和约 9 秒两次采样都没有侧栏 `运行中` 图标；第二次采样时正文仍有停止按钮及位于内容区的 `执行中` 图标。修复版 5175 前端在同一会话的 60 秒任务开始后 1.2 秒、约 9 秒和约 24 秒三次采样均保留侧栏 `运行中` 图标，完成后图标和停止按钮一同消失。

事件链路为：

1. `SessionRun` 进入 busy，发布 `session.run-status=running`。
2. UI 尝试修改已加载的摘要；新会话尚未进入分页缓存时，本次修改没有目标。
3. 用户消息和后续 journal 事件发布 `session.summary.upsert`。该持久化摘要不拥有 runtime busy 状态，通常携带 `status=idle`。
4. 分页缓存插入或替换这份摘要，侧栏因此投影为空闲；后续 running activity preview 也无法把已经丢失的实时状态恢复出来。

被破坏的不变量是：从 runtime 发布 `running` 到同一 runtime 发布 `idle` 之间，摘要新增或刷新不得清除该会话的侧栏运行态。

## 范围判定

这是 UI 实时缓存内的局部状态合同缺口。Kernel 的 `SessionRun` 仍是运行态事实源，HTTP 列表也会正确叠加 runtime 状态；协议、持久化结构和展示交互不需要改变。

不进入 Kernel、transport 或通用状态框架重构。用户文档不更新，因为本次只恢复已有运行指示器行为；作为用户可见 bugfix 添加 changeset。

## 方案

在现有 `chat-session-list.store.ts` 内增加非持久化的 `runningSessionKeys`，记录由 `session.run-status` 事件确认仍在运行的 session key。它是瞬时覆盖层，不是新的产品状态源；侧栏和子会话列表都从同一 store 订阅：

- 收到 `running`：先写入覆盖层，再修改已存在的普通和分页摘要。
- 收到摘要 upsert：摘要照常更新；列表 consumer 以 `runningSessionKeys` 优先于摘要的 snapshot status，因此支持“状态先到、摘要后到”和“运行中摘要刷新”。
- 收到 `idle`：移除覆盖，再把所有列表缓存改为空闲。
- 收到摘要删除：同时移除覆盖，避免 session key 泄漏。
- 实时连接恢复且期间发生过断线：清空覆盖层，并同时重新拉取普通列表与分页列表，以服务端当前 runtime 状态重新建立事实。

覆盖层复用已有会话列表 store，并由应用事件 consumer 统一驱动；store 的持久化 `partialize` 明确排除该字段，页面刷新只从 HTTP runtime status 重建。React Query 继续负责摘要 snapshot，不新增 manager、store、协议字段或持久化 fallback。

## 候选与取舍

- 仅让组件读取当前会话的 `isRunning`：无法覆盖后台会话和新会话，形成第二个局部 owner，放弃。
- 摘要更新时无条件保留 `running`：可以修复当前竞态，但断线漏掉 `idle` 时会长期残留，放弃。
- 在已有会话列表 store 中增加瞬时覆盖层并在重连时以服务端重建：覆盖完整生命周期，且不会受未订阅 React Query cache 的 `gcTime` 回收，采用。

命中的架构原则是 `single-complete-owner`、`information-expert` 与 `simple-structure-first`：Kernel 继续拥有真实 runtime busy 状态，UI session-list store 只拥有已接收事件的瞬时投影，query cache 只拥有服务端摘要 snapshot。

## 生命周期矩阵

| 场景 | 预期 |
| --- | --- |
| 已有会话开始运行 | `running` 事件后立即显示转圈，摘要刷新不清除 |
| 新会话开始运行 | 即使事件早于摘要，摘要首次出现时仍显示转圈 |
| 队列继续下一轮 | busy 未变为 idle，转圈持续 |
| 正常完成、失败或取消 | `idle` 事件清除覆盖和转圈 |
| 会话删除 | 删除摘要并清除覆盖 |
| 断线期间结束运行 | 重连后清空覆盖并重拉分页列表，按服务端状态停止转圈 |
| 刷新或首次进入 | HTTP 列表的 runtime status 直接决定初始转圈 |

## 验收与交付

- 回归测试复现“running 事件后旧 activity preview 的 idle 摘要到达”，修复后仍为 running。
- 回归测试复现“新 session 的 running 事件先于摘要”，修复后首次摘要为 running，随后 idle 清除。
- 重连测试证明普通和分页 session query 都会重新同步，覆盖层被清空。
- 运行 `nextclaw-ui` 定向测试、匹配范围 TypeScript 编译与 diff-only maintainability review。
- 在开发实例启动真实长任务，观察正文运行期间侧栏持续存在旋转图标，任务完成后消失。

`design-document: required`；`plan: not-required`，可在单批内完成。
