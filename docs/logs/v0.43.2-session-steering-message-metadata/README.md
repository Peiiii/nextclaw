# v0.43.2 Session Steering Message Metadata

## 迭代完成说明

- 修复 AI 运行中通过 Command/Ctrl + Enter 直接插话，与先排队再插话在展示和状态链路上的差异。
- 根因一：NCP React 以前用 `runId !== null` 判断新 run，错误地把复用当前 runId 的 `steered` handle 接纳成正式 transcript 消息；现改为按 `delivery` 判定，steering 继续由 pending projection 展示。
- 根因二：direct steering 以前直接创建 next-step request，而 queued-row steering 走 queued -> steering mutation；现统一为先进入标准 pending owner，再复用同一个 promotion，并删除平行创建入口。
- 根因三：普通用户消息启动 run 时会附加 `run_trigger` 与 `run_spec`，steering claim 却把原始 message 直接写入 transcript，导致完成后的插话消息无法生成“更多操作”。现由 canonical promotion 固化本条输入的 trigger 与当前活动 run spec，claim、刷新和历史恢复继续使用同一份消息元数据。
- 根因通过 `Cmd/Ctrl+Enter -> prefer-steer -> SessionRun pending owner -> runtime claim -> MessageSent -> Chat message action projection` 的完整链路对照确认；修复落在 handle lifecycle 与 pending owner，而不是给 UI 添加特殊按钮或本地补丁。

## 测试/验证/验收方式

- `@nextclaw/kernel` tsc 通过。
- `@nextclaw/ncp-react` tsc 通过。
- `@nextclaw/ui` tsc 通过。
- Kernel 定向测试 19 项通过，覆盖统一 promotion、capability fallback、trigger/run spec 固化、claim 与恢复。
- UI 定向测试 51 项通过，覆盖 accepted handle、pending projection、controller、queue snapshot 与运行来源详情投影。
- Agent Chat UI pending -> durable DOM 稳定性测试 4 项通过。
- 定向 ESLint、`git diff --check` 与中英文文档镜像检查通过。
- `chat-message-list.container.test.tsx` 的全文件运行被仓库既有 `useAppPresenter` 测试装配缺口阻塞；本次改用无 Provider 依赖的运行来源详情 projection 测试证明同一 UI 合同，未修改该无关装配 WIP。

## 发布/部署方式

- 本次只形成源码提交，不执行 push、NPM 发布、runtime 发布或 desktop 发布。
- 后续统一发布流程消费 `.changeset/unified-steering-inputs.md` 后进入安装版本。

## 用户/产品视角的验收步骤

1. 在支持插话的 Native 会话中让 AI 开始回复。
2. 输入一条消息并按 Command/Ctrl + Enter，确认它以 pending 用户气泡出现，不提前显示为已完成普通消息。
3. 再普通发送一条排队消息并点击“插话”，确认它与快捷键插话使用相同的气泡和状态交接。
4. 等待 AI 消费插话并完成回复，确认插话消息保留在原位置，并出现“更多操作”。
5. 打开“更多操作”，确认能看到发起方、来源消息、目标 run、当前运行模型和原始 metadata。
6. 刷新或重新进入会话，确认同一插话消息仍有“更多操作”，且不会重复显示。

## 可维护性总结汇总

- 删除 direct next-step 创建路径，使 direct steering 与 queued-row steering 共享一个 queued -> steering mutation；状态 owner 更单一。
- 元数据在 Kernel promotion 时固化，runtime 与 UI 都只消费标准 message，不新增 adapter、store 或恢复补丁。
- diff-only maintainability 检查 0 error；唯一 warning 是 `agent-run-request.manager.ts` 接近既有文件预算，本次该文件净增 0。
- 未新增无调用者抽象、目录层级或跨包内部导入；新增 trigger resolver 复用普通 run 的既有解析逻辑。

## NPM 包发布记录

- 需要后续统一发布：`@nextclaw/kernel`、`@nextclaw/ncp-react`、`@nextclaw/ui`。
- 当前状态：源码与 changeset 已准备，尚未执行 NPM 发布，统一标记为 `待统一发布`。
