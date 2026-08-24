# 会话委派边界与运行触发证据

## 迭代完成说明

- 修复子会话递归创建子会话。故障会话 `ncp-mt7gnqr7-ieo2rlr2` 的持久化记录形成 22 个会话、最大深度 21 的单链；逐层事件证明每个 child 都继续获得并调用 `sessions_spawn`，不是某个模型独有的行为。
- 根因是 `SessionToolProvider` 没有按持久化的 `parent_session_id` 过滤会话创建能力，`SessionManager.createSession` 也没有在写入前执行层级不变量。现在 child 不再获得 `sessions_spawn`，底层 session owner 同时拒绝 child 创建任何新 session、伪装 standalone、伪装挂到 root、缺失 parent 和 metadata 注入绕过。
- 为所有模型运行新增统一 `run_trigger` 证据，记录 actor、来源入口、触发时间、来源/目标 run、会话、消息、请求、工具调用、触发模型、渠道/定时任务/观察上下文；输入消息与最终回复都沿同一 NCP 元数据合同保存，可继续关联后续状态。
- 消息“更多操作”对非 AI 消息也提供触发详情；AI 回复保留既有运行元数据并追加触发详情。“触发模型”与“本次运行模型”分开展示，后者来自该消息的 `run_spec.model` 或 `ai_execution.model`。
- 后台完成通知改为只接受 `actor=human` 的直接用户触发。Agent 委派、定时任务、观察和系统运行静默；旧数据在缺少 trigger 时仅对 child 保守抑制，顶层会话保持原有兼容行为。
- 以上根因均通过故障 journal、session lineage、工具目录、运行事件和通知消费链的端到端证据确认；修复落在 capability projection、session 持久化 owner、NCP 元数据 owner 和通知 consumer，而不是依赖 prompt 或模型自觉。

## 测试/验证/验收方式

- 六个受影响包 TypeScript 检查通过：`@nextclaw/ncp`、`@nextclaw/ncp-toolkit`、`@nextclaw/shared`、`@nextclaw/core`、`@nextclaw/kernel`、`@nextclaw/ui`。
- NCP toolkit 全量测试：12 个文件、52 项全部通过，覆盖完成、失败、中止结算时的触发证据投影及跨 run 不泄漏。
- Kernel 定向测试：9 个文件、32 项全部通过，覆盖一层委派、深层拒绝、canonical lineage、触发证据贯穿、恢复 fallback、工具调用关联、cron 分类与非有限数过滤。
- UI 定向测试：3 个文件、14 项全部通过，覆盖人类/Agent/自动化通知策略、非 AI 消息触发详情、AI 运行元数据合并、触发模型与本次运行模型展示。
- 改动 TypeScript/TSX ESLint 为 0 error、0 warning；`git diff --check` 通过。
- diff-only maintainability guard 最终为 0 error、6 warning；一次越过 600 行预算的 NCP manager 已返工收敛回 598 行。剩余 warning 是接近预算或已有目录例外。
- Kernel 全量回归为 97/98 个文件、433/434 项通过；唯一失败来自本机已安装 extension discovery 多发现 `linear-comment` 与 `nextclaw-demo-filewatch`，未进入本次改动链路。
- UI 全量回归为 1149/1171 项通过；22 项既有失败位于 settings、channels、project dialog、workspace provider 等未触达测试链路。当前改动的定向测试全部通过。
- `pnpm lint:new-code:governance` 的命名、文件角色和模块结构阶段通过，随后 package-public-imports 脚本把变更 TSX 当作未启用 JSX 的 TS 解析并以 `TSError: '>' expected` 退出；这是治理工具自身的 TSX parser 缺口，本批未改动治理脚本。

## 发布/部署方式

- 本迭代只提交源码、测试、用户文档、设计、changeset 和迭代记录。
- 未执行 push、NPM/runtime/desktop 发布、部署或 NextClaw 宿主重启。
- 用户当前运行实例没有被停止；应用改动需在后续正常构建/发布后生效。

## 用户/产品视角的验收步骤

1. 从顶层会话创建 child，确认 child 能正常工作，但其工具目录不再包含 `sessions_spawn`；直接绕过工具尝试创建孙会话也应明确失败且不留下空 session。
2. 分别由用户、Agent 委派、定时任务和观察任务触发运行；打开输入消息或回复的“更多操作”，确认能看到发起者、来源、本次运行模型以及适用的来源模型、会话、消息、请求和工具调用证据。
3. 离开目标会话等待运行完成：用户直接发起的后台回复仍弹出右上角通知；Agent 委派、定时任务、观察和系统运行不弹通知。
4. 查看历史无 `run_trigger` 的顶层消息，确认原有后台通知兼容行为不变；历史 child 的完成事件保守静默。

## 可维护性总结汇总

- `run_trigger` 由 NCP 公共 schema 单一拥有，kernel 只负责分类与采集，tool/session request 只传递快照，UI 只消费；没有为 cron、Agent 或 channel 建立平行协议。
- child 身份继续只使用 durable `parent_session_id`；正常路径在工具投影层隐藏能力，绕过路径在 `SessionManager` 硬拒绝，不用 prompt 充当权限系统。
- Review 首轮发现 NCP 会话状态 manager 越过预算，已把三处重复结算收敛到现有 metadata manager；人工复核还修正了两条位置错误、原本未真正断言 trigger 传递的测试。
- 最终 guard 0 error。接近预算的 manager/container 未新增无收益 wrapper；UI 展示逻辑已放入独立 trigger-details utility。目录新增均通过 planned-path preflight，未混入 desktop automation 草稿。

## 红区触达与减债记录

### packages/ncp-packages/nextclaw-ncp-toolkit/src/agent/agent-conversation-state.manager.ts

- 本次是否减债：是。
- 说明：首版越过 600 行预算，返工后将重复元数据结算归并到现有 `AgentRunExecutionMetadataManager`，主 manager 最终 598 行。
- 下一步拆分缝：若继续增长，优先沿消息 settlement 与 run lifecycle 拆分，不在主 manager 追加新的元数据特判。

### packages/nextclaw-ui/src/features/chat/features/message/components/chat-message-list.container.tsx

- 本次是否减债：部分。
- 说明：container 只保留 view-model 连接与缓存键，触发详情构造、运行模型读取和 More Actions 合并均进入独立 utility；当前 487 行，未越过 500 行预算。
- 下一步拆分缝：后续新增消息详情类型时提取 adapter/cache owner，不继续在 React container 内累加投影规则。

## NPM 包发布记录

- 需要后续统一发布；本任务未发布任何包。
- `@nextclaw/ncp@0.9.0-beta.0`：新增公共 trigger schema，待统一发布（minor changeset）。
- `@nextclaw/ncp-toolkit@0.6.22-beta.0`、`@nextclaw/shared@0.4.27-beta.0`、`@nextclaw/core@0.17.7-beta.0`、`@nextclaw/kernel@0.10.0-beta.0`、`@nextclaw/ui@0.20.0-beta.0`：实现与消费同一合同，待统一发布（patch changeset）。
