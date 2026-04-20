# v0.16.73-frontend-restart-auto-recovery

## 迭代完成说明

- 同批次补充验收修正：
  - 聊天页在 `stalled` 阶段不再主动展示“等待运行时恢复超时，请稍后重试或查看日志。”横幅。
  - 这条文案继续保留给运行时控制等明确需要诊断的场景，但不再作为聊天主路径里的默认干扰提示。
  - 根因已进一步确认：`RuntimeLifecycleManager.getDisplayMessage()` 与 `resolveChatRuntimeMessage()` 把内部恢复超时态直接映射成聊天可见文案，导致系统内部恢复噪音被前端主入口放大展示。
  - 本次修复命中根因而不是只改表象：直接删掉聊天链路里对 `stalled -> timeout banner` 的派生映射，同时保留 `stalled` 状态本身，因此发送 gate、连接状态、运行时控制诊断能力都不受影响。
- 本次没有继续在旧的 `runtime-recovery` 上补条件，而是把 NextClaw UI 的运行时启动、可用、短暂断开恢复、恢复超时、启动失败统一收敛成一个生命周期 owner：`packages/nextclaw-ui/src/runtime-lifecycle/runtime-lifecycle.manager.ts`。
- 新增统一 feature root：`packages/nextclaw-ui/src/runtime-lifecycle/`。
  - `runtime-lifecycle.manager.ts`：唯一业务 owner，统一解释 lifecycle 语义
  - `runtime-lifecycle.store.ts` / `runtime-lifecycle.types.ts`：生命周期快照与状态模型
  - `hooks/use-runtime-bootstrap-status.ts`：只负责 bootstrap query 与 polling
  - `hooks/use-runtime-lifecycle-status.ts`：只负责给 UI 提供派生状态
- 生命周期产品态统一为：
  - `cold-starting`
  - `ready`
  - `recovering`
  - `stalled`
  - `startup-failed`
- 关键行为变化：
  - 冷启动期间即使遇到传输层短暂失败，也保持 `cold-starting`，不再误报“正在等待 NextClaw 恢复”
  - 冷启动期间聊天输入框保持可编辑，只禁止发送动作；回车发送和发送按钮统一走同一条 gate，不再出现“提示说可输入，但输入框实际被锁死”的分裂行为
  - 只有页面曾进入过 `ready` 之后，后续断开才允许进入 `recovering`
  - 恢复超时后进入 `stalled`
  - 聊天页、输入栏、侧边栏统一消费 lifecycle 派生状态，不再各自拼接 bootstrap + recovery + connection status
  - 全局“正在等待 NextClaw 恢复”横幅本次已移除，不再闪烁；恢复提示只留在更贴近聊天上下文的位置
  - 启动阶段如果会话 hydrate 撞上后端占位错误 `ncp agent unavailable during startup`，前端会在 lifecycle 回到 `ready` 后主动重试并抑制该占位错误，不再出现“初始化提示消失后，输入区突然冒出启动错误”的跳变
- 目录与命名治理同步完成：
  - 删除旧的 `packages/nextclaw-ui/src/runtime-recovery/`
  - 删除旧的 `chat-runtime-bootstrap-state.ts`
  - `ChatSidebar.tsx` 收敛到 `packages/nextclaw-ui/src/components/chat/containers/chat-sidebar.tsx`
  - sidebar 标签编辑逻辑下沉到 `packages/nextclaw-ui/src/components/chat/hooks/use-chat-sidebar-session-label-editor.ts`
  - `raw-client.ts` 收敛为 `raw-client.utils.ts`
  - `app-client.ts` / `local.transport.ts` 收敛为 `app-client.service.ts` / `local-transport.service.ts`
- 根因已明确：
  - 根因不是“少一个 retry”或“少一个 loading”，而是前端长期并行维护了两套互不协调的运行时语义：
    - `bootstrap-status` 负责表达聊天能力是否 ready
    - `runtime-recovery` 负责表达传输层是否刚断开
  - 这两套语义没有统一 owner，导致冷启动还没 ready 时就会被传输层事件误解释成“恢复中”。
  - 根因确认方式：
    - 代码路径对比：`use-runtime-bootstrap-status`、`use-realtime-query-bridge`、`raw-client`、`local.transport`、`ncp-app-client-fetch`、`ncp-chat-page` 各自解释自己的局部状态
    - 现象对比：首次进入页面时仍处于初始化，但 UI 已显示恢复提示并且全局卡片闪烁
    - 修复命中点：把产品态解释权统一收回 `RuntimeLifecycleManager`，底层仅上报事实，UI 只消费派生状态
- 设计文档：
  - [runtime lifecycle coordinator design](../../plans/2026-04-19-runtime-lifecycle-coordinator-design.md)

## 测试/验证/验收方式

- 已执行：
  - `pnpm -C packages/nextclaw-ui test -- src/runtime-lifecycle/runtime-lifecycle.manager.test.ts src/runtime-lifecycle/use-runtime-lifecycle-status.test.ts`
  - `pnpm -C packages/nextclaw-ui exec eslint src/runtime-lifecycle/runtime-lifecycle.manager.ts src/runtime-lifecycle/hooks/use-runtime-lifecycle-status.ts src/runtime-lifecycle/runtime-lifecycle.manager.test.ts src/runtime-lifecycle/use-runtime-lifecycle-status.test.ts`
  - `pnpm -C packages/nextclaw-ui tsc`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/runtime-lifecycle/runtime-lifecycle.manager.ts packages/nextclaw-ui/src/runtime-lifecycle/hooks/use-runtime-lifecycle-status.ts packages/nextclaw-ui/src/runtime-lifecycle/use-runtime-lifecycle-status.test.ts packages/nextclaw-ui/src/runtime-lifecycle/runtime-lifecycle.manager.test.ts`
  - `pnpm lint:new-code:governance`
  - `pnpm check:governance-backlog-ratchet`
  - `pnpm -C packages/nextclaw-ui tsc`
  - `pnpm -C packages/nextclaw-ui exec vitest run src/runtime-lifecycle/runtime-lifecycle.manager.test.ts src/runtime-lifecycle/use-runtime-lifecycle-status.test.ts src/runtime-lifecycle/use-runtime-bootstrap-status.test.ts src/components/chat/containers/chat-sidebar.test.tsx src/api/raw-client.test.ts src/transport/app-client.test.ts src/components/chat/ncp/ncp-app-client-fetch.test.ts`
  - `pnpm -C packages/nextclaw-ui exec vitest run src/components/chat/chat-input/ncp-chat-input-availability.utils.test.ts src/components/chat/ncp/session-conversation/use-ncp-session-conversation.test.tsx src/components/chat/ncp/tests/ncp-chat-input.manager.test.ts`
  - `pnpm -C packages/nextclaw-ui exec eslint src/app.tsx src/api/raw-client.utils.ts src/api/raw-client.test.ts src/components/chat/chat-page-shell.tsx src/components/chat/containers/chat-sidebar.tsx src/components/chat/containers/chat-sidebar.test.tsx src/components/chat/containers/chat-input-bar.container.tsx src/components/chat/hooks/use-chat-sidebar-session-label-editor.ts src/components/chat/ncp/ncp-app-client-fetch.ts src/components/chat/ncp/ncp-chat-page.tsx src/hooks/use-realtime-query-bridge.ts src/runtime-lifecycle/runtime-lifecycle.manager.ts src/runtime-lifecycle/runtime-lifecycle.manager.test.ts src/runtime-lifecycle/runtime-lifecycle.store.ts src/runtime-lifecycle/runtime-lifecycle.types.ts src/runtime-lifecycle/hooks/use-runtime-bootstrap-status.ts src/runtime-lifecycle/use-runtime-bootstrap-status.test.ts src/runtime-lifecycle/hooks/use-runtime-lifecycle-status.ts src/runtime-lifecycle/use-runtime-lifecycle-status.test.ts src/stores/ui.store.ts src/transport/app-client.service.ts src/transport/app-client.test.ts src/transport/index.ts src/transport/local-transport.service.ts`
  - `pnpm -C packages/nextclaw-ui exec eslint packages/nextclaw-ui/src/components/chat/containers/chat-input-bar.container.tsx packages/nextclaw-ui/src/components/chat/chat-input/ncp-chat-input-availability.utils.ts packages/nextclaw-ui/src/components/chat/chat-input/ncp-chat-input-availability.utils.test.ts packages/nextclaw-ui/src/components/chat/ncp/ncp-chat-input.manager.ts packages/nextclaw-ui/src/components/chat/ncp/ncp-chat-page.tsx packages/nextclaw-ui/src/components/chat/ncp/session-conversation/use-ncp-session-conversation.ts packages/nextclaw-ui/src/components/chat/ncp/session-conversation/use-ncp-session-conversation.test.tsx packages/nextclaw-ui/src/components/chat/ncp/tests/ncp-chat-input.manager.test.ts`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-ui/src/app.tsx packages/nextclaw-ui/src/api/raw-client.utils.ts packages/nextclaw-ui/src/api/raw-client.test.ts packages/nextclaw-ui/src/components/chat/chat-page-shell.tsx packages/nextclaw-ui/src/components/chat/containers/chat-sidebar.tsx packages/nextclaw-ui/src/components/chat/containers/chat-sidebar.test.tsx packages/nextclaw-ui/src/components/chat/containers/chat-input-bar.container.tsx packages/nextclaw-ui/src/components/chat/hooks/use-chat-sidebar-session-label-editor.ts packages/nextclaw-ui/src/components/chat/ncp/ncp-app-client-fetch.ts packages/nextclaw-ui/src/components/chat/ncp/ncp-chat-page.tsx packages/nextclaw-ui/src/hooks/use-realtime-query-bridge.ts packages/nextclaw-ui/src/runtime-lifecycle/runtime-lifecycle.manager.ts packages/nextclaw-ui/src/runtime-lifecycle/runtime-lifecycle.manager.test.ts packages/nextclaw-ui/src/runtime-lifecycle/runtime-lifecycle.store.ts packages/nextclaw-ui/src/runtime-lifecycle/runtime-lifecycle.types.ts packages/nextclaw-ui/src/runtime-lifecycle/hooks/use-runtime-bootstrap-status.ts packages/nextclaw-ui/src/runtime-lifecycle/use-runtime-bootstrap-status.test.ts packages/nextclaw-ui/src/runtime-lifecycle/hooks/use-runtime-lifecycle-status.ts packages/nextclaw-ui/src/runtime-lifecycle/use-runtime-lifecycle-status.test.ts packages/nextclaw-ui/src/stores/ui.store.ts packages/nextclaw-ui/src/transport/app-client.service.ts packages/nextclaw-ui/src/transport/app-client.test.ts packages/nextclaw-ui/src/transport/index.ts packages/nextclaw-ui/src/transport/local-transport.service.ts`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/components/chat/containers/chat-input-bar.container.tsx packages/nextclaw-ui/src/components/chat/chat-input/ncp-chat-input-availability.utils.ts packages/nextclaw-ui/src/components/chat/ncp/ncp-chat-input.manager.ts packages/nextclaw-ui/src/components/chat/ncp/ncp-chat-page.tsx packages/nextclaw-ui/src/components/chat/ncp/session-conversation/use-ncp-session-conversation.ts`
  - `pnpm lint:new-code:governance`
  - `pnpm check:governance-backlog-ratchet`
- 结果：
  - 本轮定向 vitest 通过，`14` 个测试通过
  - 本轮定向 ESLint 通过，无 error / warning
  - 本轮 `tsc` 通过
  - 本轮 `--non-feature --paths ...` maintainability guard 通过；代码增减 `+16 / -6 / 净增 +10`，非测试代码增减 `+1 / -4 / 净增 -3`
  - 本轮 `lint:new-code:governance` 通过，仅提示 `runtime-lifecycle/` 仍位于历史 legacy root，未新增治理违规
  - 本轮 `check:governance-backlog-ratchet` 通过
  - `tsc` 通过
  - 定向 vitest 通过，`37` 个测试通过
  - 启动期输入/发送合同与 ready 后自动重试的定向 vitest 通过，新增 `10` 个测试通过
  - 定向 ESLint 无 error，仅保留 `packages/nextclaw-ui/src/components/chat/ncp/ncp-chat-input.manager.ts` 中已有的 `prefer-destructuring` warning
  - `lint:new-code:governance` 通过
  - `check:governance-backlog-ratchet` 通过
  - 本次追加的 `--non-feature --paths ...` maintainability guard 通过，无新增阻塞项
  - maintainability guard 无阻塞项，仅保留历史目录预算警告与 `chat-sidebar.tsx` 逼近预算线的提醒
- 未执行：
  - `pnpm -C packages/nextclaw-ui build`
  - 原因：本次定向修复和结构治理已由 `tsc + vitest + eslint + governance` 覆盖主要风险，未额外跑整包构建

## 发布/部署方式

- 合入后按现有前端发布链路重新构建 `@nextclaw/ui` 即可。
- 若桌面端或其它宿主消费 UI 产物，需要在下一次统一前端发布批次中带上新的 UI 构建结果。
- 本次不涉及额外后端协议迁移，不需要单独变更服务端部署步骤。

## 用户/产品视角的验收步骤

1. 启动 NextClaw，并在服务仍处于冷启动时直接进入聊天页。
2. 确认页面显示的是初始化中的聊天态，而不是“正在等待 NextClaw 恢复”。
3. 确认冷启动提示期间输入框可以直接输入文本，但回车不会发送、发送按钮不可点击。
4. 等待初始化完成后，确认发送能力自动恢复，不会先消掉提示、再在输入区冒出 `ncp agent unavailable during startup`。
5. 在 UI 已经正常可用后，触发一次本地服务重启或模拟短暂断线。
6. 确认聊天区进入恢复态，输入区暂时禁发；不要出现全局恢复卡片闪烁。
7. 等待服务恢复完成，确认页面自动恢复可用，无需手动刷新。
8. 若故意让恢复时间超过阈值，确认聊天页不会再冒出“等待运行时恢复超时，请稍后重试或查看日志。”这类干扰横幅。
9. 如需诊断，再进入运行时控制或日志路径查看恢复失败信息；聊天主路径保持干净，不把内部恢复噪音直接抛给用户。

## 可维护性总结汇总

- 是否已尽最大努力优化可维护性：是。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。本次优先删除了旧的 `runtime-recovery`、旧 bootstrap 派生层、旧全局横幅路径，而不是在原结构上继续叠加判断。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：目录平铺度在聊天根目录上有所改善，`components/chat` 直接文件数从 `37` 降到 `35`。总代码量净增，属于把原来分散在多处的隐式语义显式收敛成一套生命周期 feature 的必要新增。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：更清晰。生命周期解释权统一收回 `RuntimeLifecycleManager`；request / websocket / bootstrap 只上报事实；UI 只读派生状态；sidebar 标签编辑逻辑单独下沉到 hook。
- 目录结构与文件组织是否满足当前项目治理要求：本次触达范围内已按治理要求收口到合适子树与命名规范；启动期输入/发送共享规则放入现有 `components/chat/chat-input/` 角色目录，而没有继续把 `components/chat/ncp/` 顶层铺平；仍存在 `src/api`、`src/hooks` 的历史目录预算警告，但本次未继续恶化。
- 基于一次独立于实现阶段的 `post-edit-maintainability-review` 主观复核结论：
  - 同批次本轮补充验收修正：
    - 可维护性复核结论：通过
    - 本次顺手减债：是
    - 长期目标对齐 / 可维护性推进：
      - 这轮不是再加一层“超时提示例外”，而是把聊天页对内部恢复状态的过度暴露直接删掉，顺着“主入口更安静、系统内部噪音更少、状态 owner 更单一”的方向继续收敛。
      - 下一步观察点仍是 `runtime-lifecycle/` 目录后续是否需要正式迁回治理白名单结构；本轮没有扩大这笔历史债务。
    - 代码增减报告：
      - 新增：16 行
      - 删除：6 行
      - 净增：10 行
    - 非测试代码增减报告：
      - 新增：1 行
      - 删除：4 行
      - 净增：-3 行
    - no maintainability findings
    - 可维护性总结：
      - 这次修正把一条干扰性的超时提示从聊天主链路里移除，同时保留状态机与诊断入口，没有引入新的 fallback、旁路判断或双路径。
      - 作为非功能修正，排除测试后的非测试代码保持净减，符合“删减优先、简化优先”的要求。
  - 可维护性复核结论：通过
  - 本次顺手减债：是
  - 长期目标对齐 / 可维护性推进：
    - 这次不是再加一套“恢复补丁”，而是把启动、断线、恢复统一为一个可解释的生命周期 owner，顺着“边界更清晰、语义更统一、隐藏分支更少”的长期方向推进了一步。
    - 下一步仍值得继续推进的是把 `components/chat/containers/chat-sidebar.tsx` 再拆一缝，避免它继续逼近预算线。
  - 代码增减报告：
    - 新增：2514 行
    - 删除：58 行
    - 净增：2456 行
  - 非测试代码增减报告：
    - 新增：1484 行
    - 删除：52 行
    - 净增：1432 行
  - no maintainability findings
  - 可维护性总结：
    - 这次增长主要来自把原本分散、互相冲突的语义正式收敛成 `runtime-lifecycle` feature root，以及把相关命名/目录治理一起做完。
    - 代码量虽然增长，但不是无边界扩散；旧 recovery 路径、旧 bootstrap 派生、旧闪烁横幅已经被删除。
    - 目前最需要继续观察的是 `chat-sidebar.tsx` 的体积和 `src/api` 的历史平铺目录债务。

## NPM 包发布记录

- 本次是否需要发包：需要。
- 需要发布哪些包：
  - `@nextclaw/ui`
- 每个包当前是否已经发布：
  - `@nextclaw/ui`：未发布，待统一发布
- 未发布原因：
  - 本次完成的是源码实现与验证，尚未进入下一次统一前端发布批次
- 阻塞或触发条件：
  - 下一次前端统一 release / 发包批次时，需要把本次 UI 生命周期治理一并带上
