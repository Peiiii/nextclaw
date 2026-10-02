# 会话置顶持久化与分页设计

创建日期：2026-10-02。来源：用户反馈“会话列表的置顶过一段时间就没了”，要求调查最佳实践并优化。风险 L3，flow=bugfix，plan=not-required，单批交付。初始范围不含提交、发布或升级；用户随后明确要求“先把上面的合入主干”，追加授权本修复的提交、主干集成和推送，不包含新提议的定时任务视图。

## 事实与目标

置顶由 `ChatSessionListManager` 写入 Zustand localStorage，后端不知道置顶。侧栏和标题切换器先请求最近 100 条，再按本地置顶集合分组；会话跨出加载窗口后不可见。localStorage 没有 TTL，不能据此断言用户现场是缓存过期；本次用分页边界失败测试复现确定的失效机制。

长期搭档应保留用户对重要会话的选择。用户在会话菜单置顶后，立即看到置顶分组；刷新、换浏览器、服务重新加载、继续产生新会话后仍能找到它；取消后恢复普通时间排序。网络失败恢复原状态并显示错误，重复点击不并发写同一会话。

## 唯一主链路

- kernel 会话设置 owner 接收 `pinned: boolean`，持久化 `metadata.pinned`（false 也保留，区分显式取消与旧数据未配置），沿已有摘要事件更新客户端。API、CLI 和 `sessions_update` 复用同一入口。
- SQLite 会话目录在分页前按 `pinned === true` 优先、活动时间降序及 session ID 排序。只修改分页列表；历史工具的普通时间顺序保持原合同。当前侧栏已消费分页接口，不新增无消费者的查询协议。
- 前端置顶集合由服务器摘要投影，操作期间允许非持久化的乐观覆盖；完成后更新查询缓存并刷新分页，失败撤销覆盖并提示。侧栏、手机和标题切换器消费同一列表投影。
- 浏览器原 `pinnedSessionKeys` 只作为迁移队列，逐条提交 `pinned: true, pinnedIfUnset: true`；设置 owner 在串行写入内判定：后端已有布尔状态优先，未配置才写 true。避免 GET/PUT 窗口覆盖取消状态。成功或确定 404 后移除；网络失败保留并提示，刷新可重试。迁移与该客户端用户操作串行，完成后旧前端真相退出，不把服务器投影写回旧缓存。
- 同一会话设置读改写在设置 owner 串行，避免并发已读时间、重命名与置顶互相覆盖；现有 journal 写入队列继续承担落盘顺序。

浏览器存储继续拥有分组方式、项目置顶和折叠等视图偏好。本次问题指向会话置顶，不改变项目的存储合同。保留现有菜单与分组外观，不新增必须使用的筛选控件；置顶是后端可判断的会话属性。

方案比较：仅加强 localStorage 无法修复后端分页；单独建收藏数据库会复制会话生命周期；复用 kernel 会话 metadata 与目录排序，改动和迁移成本最低且删除会话自动删除置顶事实。无需新增 manager/service。

## 验收合同（active contract=session-pin-20261002，scope-revision=1）

parent-goal：会话置顶可靠保存，跨刷新和分页保持可见，取消与失败反馈一致。

| ID | Required | 标准 | Status | 当前证据 |
| --- | --- | --- | --- | --- |
| PIN-01 | true | 置顶/取消经 kernel 与 HTTP 保存；新 storage 实例恢复相同值，非法类型拒绝 | passed | `session-pinning.manager.test.ts`、`router-ncp-session-list-route.test.ts`：真实文件存储冷恢复、非法类型及并发设置 |
| PIN-02 | true | 较旧置顶跨至少两页仍在第一页；取消后回普通位置；搜索和分页总数保持正确 | passed | 上述 kernel/HTTP 用例覆盖三页、取消和搜索；源码页面 103 条会话中最早会话置顶，清搜索并刷新、终止原进程并重启后仍在首屏；HTTP 第 1 页首条 pinned=true、total=103 |
| PIN-03 | true | 前端使用服务端置顶，成功刷新列表；失败回退提示，重复点击不产生并发写 | passed | `chat-session-list.manager.test.ts`、列表 hook、侧栏及标题切换器回归；真实页面完成两次置顶/取消，再置顶刷新 |
| PIN-04 | true | 本地旧置顶迁移包含未加载会话；服务端 false 不被旧缓存覆盖；失败保留且不创建已删除会话 | passed | manager 回归覆盖未加载目标、失败保留及 404 清理；kernel/HTTP 回归证明条件写入尊重 false 和缺失目标不创建 |
| PIN-05 | true | CLI、AI 工具、SDK 复用设置 owner，使用说明与资源同步，类型与定向静态检查通过 | passed | kernel/server/service/client-sdk/UI/CLI 的 tsc；AI 工具、CLI controller、CLI 文档覆盖测试；usage 同步、ESLint、diff governance 和维护性检查通过 |

AI 验收：真实文件存储与组装 HTTP 边界证明保存/冷恢复/分页；UI manager 和组件回归证明状态与反馈，源码页面证明菜单动作、刷新和两次置顶取消。纯审美无变化，无额外偏好确认门。用户交接给出源码入口及安装版未升级的事实。

契约 Review：删除泛化性能、主题截图和全运行时构建要求，因为没有对应变更；未排除任何会改变本次置顶结果的保存、恢复、迁移和失败场景。

## 验证与交接

2026-10-02：定向回归 kernel 44、server 9、UI 42 + cache 16、service 3 全通过；CLI 命令全集同步测试 2 通过。隔离 HOME 的源码 CLI 实际执行 pin/unpin，两次输出对应 true/false。维护性检查无阻塞，既有文件预算告警未扩展职责；新增置顶测试独立成文件，HTTP 和 SDK 复用 kernel 设置类型，避免复制字段合同。实现 Review 发现迁移请求缺少 pinned 时可能创建空目标，已补齐禁止创建条件及 HTTP 回归，无未关闭 findings。

原有 `chat-sidebar.test.tsx` 全文件存在 10 个会话类型/项目菜单失败，使用 HEAD 原组件同样复现；该文件已退出本次 diff。新增置顶组件回归落在较小的 `chat-sidebar-read-state.test.tsx` 并通过，不把既有失败计为本次验收成功。

验证时源码预览：`http://127.0.0.1:19883/chat`，API 19882，独立 `NEXTCLAW_HOME=/tmp/nextclaw-session-pin-preview`，103 条人工验证会话，无真实用户配置；截图留在原工作区 `.local/session-pin-preview/pinned-after-reload.jpg`。页面中最早的“置顶验证：较旧会话”位于“已置顶”分组。现有安装未升级；本轮不发布 NPM/Runtime。提交与主干集成记录见 [迭代记录](../logs/2026-10-02-session-pin-persistence/README.md)。

复盘决定：本次确定根因和迁移边界已沉淀到本设计与 owner 的回归测试；没有足够重复证据形成跨项目通用规则，不增加 skill 或常驻规则。用户现场的存储清理原因没有证据，仍保留不确定性。
