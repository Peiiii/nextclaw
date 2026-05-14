# v0.18.56 Chat Empty State And Alias Governance

## 迭代完成说明

- 根因一：聊天主面板把“无消息”当成一个可见空态，导致草稿发送失败、真实空会话或准备阶段可能展示“暂无消息，发送一条开始对话。”，和用户对统一入口的预期不一致。
- 根因二：`@nextclaw/agent-chat-ui` 的 `development` export 指向源码，但包内使用了泛用 `@/` alias；当 `@nextclaw/ui` 通过 Vite 直接消费源码时，宿主不会解析这个包私有 alias，于是出现 `Failed to resolve import "@/components/chat/hooks/use-active-item-scroll"`。
- 根因三：`module-structure` 的 `app-l1` protocol 默认带 `@/`，且旧合并逻辑不允许 package contract 用包级唯一 alias 覆盖默认值，导致可复用包规范与治理脚本冲突。
- 修复方式：
  - 聊天无消息时只展示欢迎页或保持空白，不再展示 `chatNoMessages` 文案；同时删除未使用的 `chatNoSessionHint`。
  - 将 `@nextclaw/agent-chat-ui` 的泛用 `@/` alias 收敛为较短的包级唯一 alias `@agent-chat-ui/`。
  - 允许 `module-structure.config.json` 显式覆盖 protocol 默认 alias，并为 `nextclaw-agent-chat-ui` 声明 `importAliasPrefixes: ["@agent-chat-ui/"]`。
  - 补充治理脚本测试，锁定“package contract 可以替换 protocol 默认 alias”。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/ui tsc`：通过。
- `pnpm --filter @nextclaw/agent-chat-ui tsc`：通过。
- `pnpm --filter @nextclaw/agent-chat-ui test -- chat-input-bar.test.tsx`：通过，20 个用例通过。
- `node --test scripts/governance/module-structure/lint-new-code-module-structure.test.mjs`：通过，56 个用例通过。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- Targeted ESLint：通过；`module-structure.config.json` 因 ESLint 配置不覆盖 JSON 文件出现 ignored warning，不影响源码与脚本检查结果。
- `pnpm --filter @nextclaw/ui test -- chat-conversation-panel.test.tsx`：仍被既有 PWA 测试环境问题阻塞，失败为 `storage.getItem is not a function`，发生在 `pwa-install-banner.utils.ts` 初始化阶段；alias 错误已不再出现。

## 发布/部署方式

- 本次不涉及数据库 migration、远程 deploy 或 NPM 发布。
- 变更会随下一次正常前端 / package 构建发布带出。

## 用户/产品视角的验收步骤

1. 打开聊天页。
2. 新草稿态应展示欢迎页。
3. 无消息但不应展示欢迎页的场景，主内容区保持空白。
4. 页面不再出现“暂无消息，发送一条开始对话。”。
5. 启动 `@nextclaw/ui` 开发页时，不再出现 `@nextclaw/agent-chat-ui` 内部 `@/components/...` import 解析失败 overlay。

## 可维护性总结汇总

- 可维护性复核结论：通过。
- 本次顺手减债：是。
- 代码增减报告：新增 61 行，删除 22 行，净增 +39 行。
- 非测试代码增减报告：新增 17 行，删除 17 行，净增 0 行。
- 正向减债动作：删除与简化。
- 质量与可维护性提升证明：删除了误导性聊天空态文案，并把可复用包的泛用 alias 改为短包级唯一 alias；治理脚本从“协议默认 alias 不可覆盖”改为“package contract 可显式覆盖”，与复用型 package 规范一致。
- 已知债务：`chat-input-bar` 目录仍处于既有目录预算 warning，`chat-input-bar.test.tsx` 与 module-structure 测试文件接近预算；本次未新增直接文件，未扩大目录平铺度。

## NPM 包发布记录

不涉及 NPM 包发布。
