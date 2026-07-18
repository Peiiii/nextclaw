# v0.25.30 AI 运行元数据与消息统计

## 迭代完成说明

- 每次 AI 运行现在都会生成版本化的 `ai_execution` 元数据，记录实际 runtime、模型、请求模型、完成结果与 token 用量；成功、失败和取消均有终态记录。
- native runtime 按真实模型调用累计 usage；外部 runtime 未提供标准 usage 时显式记录 `unavailable`，不把缺失数据伪装成零。
- 运行元数据通过既有 `run.metadata` 主链路进入会话状态，并在消息落盘前投影到对应 assistant 消息，旧消息无需迁移。
- assistant 消息底部展示模型及输入/输出 token；所有语言统一使用小写 `k`、`m`、`b`，例如 `143k 输入 / 307 输出`。
- 缓存输入、总 token、调用次数、用量状态和运行 ID 默认不占用消息页脚；含运行元数据的 assistant 消息可通过“更多操作 → 查看运行元数据”打开可访问弹窗查看完整事实。
- 详细 owner、合同、事件流、目录组织和非目标见 `docs/designs/2026-07-18-ai-run-message-metadata.design.md`。

## 测试/验证/验收方式

- native 真实聊天冒烟：隔离源码实例在 `18941` 端口运行，`smoke:ncp-chat` 返回 `ok: true`、精确回复 `AI_RUN_METADATA_OK`、终态 `run.finished`，事件流包含 `run.metadata`。
- 持久化验收：最终源码复跑后的 assistant 消息在刷新读取时仍含 `metadata.ai_execution`，记录实际模型 `minimax/MiniMax-M3`、输入 `18529`、输出 `31`、总计 `18560`、一次已报告模型调用及 `reported` 状态。
- 用户已在实际界面验收消息底部展示效果；随后在隔离源码实例中完成浏览器验收，确认消息级“更多操作”、元数据菜单、缓存行、遮罩和关闭行为正常，关闭后焦点回到原消息按钮。
- 六个受影响 package 的 TypeScript 检查全部通过；精确暂存快照中的 11 个定向测试文件、78 个用例全部通过。
- 六个 package lint 均为 0 error；11 条 warning 均来自本任务未触达或既有预算文件，本次暂存的 33 个 TypeScript 文件使用 `--max-warnings=0` 通过。
- 35 个源码 workspace package 的主工作区隔离构建通过；精确暂存快照另完成 23 个 UI 依赖 package 构建与六包 TypeScript 复验；`lint:new-code:governance`、governance backlog ratchet 与 generated-clean 均通过。

## 发布/部署方式

- 变更由 `.changeset/record-ai-run-message-metadata.md` 记录，后续随六个受影响 workspace package 的 patch 版本统一发布。
- 本次只提交源码、测试、设计、迭代记录和 changeset；未执行 NPM 发布、部署或现有 NextClaw 实例重启。
- 真实链路使用独立 home 与独立端口的源码实例验收，验收后已停止。

## 用户/产品视角的验收步骤

1. 在任意 native 会话发送一条消息并等待 AI 回复完成。
2. 确认 assistant 消息底部显示本次实际运行模型。
3. 确认输入和输出 token 使用 `k`、`m`、`b` 统一缩写，不随界面语言变成“万”等本地单位。
4. 点击该消息的“更多操作 → 查看运行元数据”，确认弹窗包含缓存输入 token、总 token、调用次数、用量状态、runtime 和运行 ID；较大 token 同时显示缩写与精确值。
5. 关闭弹窗，确认焦点回到原消息的“更多操作”按钮。
6. 刷新会话，确认模型与 token 统计仍存在，证明数据来自持久化消息而不是临时流状态。
7. 查看不含 `ai_execution` 的历史消息，确认不会显示伪造的模型或用量占位，也不会出现元数据操作入口。

## 可维护性总结汇总

- 可维护性 guard 结论：0 error / 7 warning；主观复核通过，没有阻塞提交的 maintainability finding。
- TypeScript 代码与测试新增 `1752` 行、删除 `97` 行、净增 `1655` 行；排除测试后生产代码新增 `1098` 行、删除 `94` 行、净增 `1004` 行。本次是新增用户能力，因此不适用非功能改动的生产代码净增 `<= 0` 门槛。
- 新增能力复用既有 `run.metadata`、会话 settlement、消息 metadata、journal 与 message footer，没有新增数据库表、并行事件通道、React effect 或独立持久化系统。
- native runtime 是 usage 事实 owner；conversation state 只负责终态投影；UI 只读取稳定消息元数据，避免同一事实多 owner。
- 外部 runtime 的兼容行为显式为 `unavailable`，旧消息则保持无展示，缺失事实不会被猜测或隐式补零。
- 正向减债动作：治理首次发现两个 600 行预算 error 后，把 conversation 的运行元数据状态抽成独立生命周期 manager，把 kernel 的事件识别与 fallback 构造收敛到既有 execution metadata utility，并把 native metadata 事件构造下沉到单次 run owner；最终所有预算 error 清零。
- 剩余 7 条 warning 均为近预算提示或已有目录例外：四个生产主干文件仍接近 600/500 行，两个测试文件接近测试预算，agent chat message-list 目录沿用已登记例外。它们没有新增平行 owner 或目录文件，后续继续沿 guard 给出的 orchestration、view-model mapping 与测试 fixture seam 拆分，不在本功能中扩大为跨域重构。

## NPM 包发布记录

- `@nextclaw/ncp`：需要 patch，新增稳定的 AI 运行元数据合同与读取函数，待统一发布。
- `@nextclaw/ncp-agent-runtime-next`：需要 patch，新增真实模型调用 usage 汇总与终态 metadata 事件，待统一发布。
- `@nextclaw/ncp-toolkit`：需要 patch，新增运行元数据到 assistant 消息的终态投影，待统一发布。
- `@nextclaw/kernel`：需要 patch，补齐 run spec 事实和外部 runtime 的可预测 metadata 兼容，待统一发布。
- `@nextclaw/agent-chat-ui`：需要 patch，新增 assistant 消息执行摘要、消息级更多操作与可访问元数据弹窗，待统一发布。
- `@nextclaw/ui`：需要 patch，新增消息执行摘要/详情读取、`k/m/b` 格式化、缓存详情和多语言文案，待统一发布。
- Changeset：`.changeset/record-ai-run-message-metadata.md`。
- 本次未执行 NPM 发布。
