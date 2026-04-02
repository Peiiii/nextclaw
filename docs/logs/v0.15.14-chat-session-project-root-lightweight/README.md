# v0.15.14-chat-session-project-root-lightweight

## 迭代完成说明

- 为聊天会话补齐轻量版“项目目录绑定”能力，继续坚持 `project = local directory`，不引入独立 `Project` 实体。
- 新增会话元数据字段 `session.metadata.project_root`，并让 `native / codex / claude` runtime 统一消费它作为会话级工作目录。
- 后端 `PATCH /api/ncp/sessions/:id` 支持写入/清除 `projectRoot`，并对路径执行绝对目录校验与规范化。
- 新增服务端驱动的通用路径浏览能力：
  - `GET /api/server-paths/browse`
  - 前端通用 `ServerPathPickerDialog`
  - 会话项目目录改为浏览“运行 NextClaw 服务的那台机器上的目录”，兼容远程部署语义。
- 继续收敛目录选择器交互：
  - 弹框主体改为固定尺寸，目录切换时不再因条目数量变化导致整体抖动
  - 滚动被限制在目录列表内部，header / path input / footer 保持稳定
  - 新增“当前目录内搜索”，先做纯前端过滤，不引入新的后端协议与状态复杂度
- 前端会话 header 从单一删除按钮升级为“更多操作”菜单，支持：
  - 设置项目目录
  - 清除项目目录
  - 删除会话
- 会话 header 新增 project badge，sidebar 搜索也支持匹配项目名/项目路径。
- 草稿会话支持先绑定项目目录再进入正式会话；`UiSessionService.updateSession` 采用轻量 upsert 以承接这一路径。
- 修复清除项目目录的持久化缺陷：
  - 真实 API 更新链路改为走 `replaceSession`，不再把旧 session metadata 保留回显式 patch 结果里
  - 路由 patch 时会同时清理历史兼容键 `projectRoot`，避免“提示清除成功但刷新后还在”
- 调整 runtime 项目语义暴露：
  - prompt 里始终显式写出 `Current project directory`
  - 若存在宿主 workspace，则同时显式写出 `NextClaw host workspace directory`
  - 两者都被视为真实且同时存在的上下文：
    - `Current project directory` 表示当前正在工作的项目目录
    - `NextClaw host workspace directory` 表示宿主 runtime 的 memory / workspace-local skills / bootstrap 所在目录
  - 宿主 workspace 的 bootstrap 文件与 workspace-local skills 在项目目录切换后不会丢失
- 收敛前端会话语义：线程态统一使用 `sessionKey` 表示当前线程，避免在同层重复引入 `activeSessionKey` 语义。
- 修正 React hook 治理：会话相关 hook 统一落在 `packages/nextclaw-ui/src/components/chat/hooks/`，并使用 `use-*.ts` 命名。
- 本次配套设计文档：
  - [chat-session-project-root-design](../../plans/2026-04-01-chat-session-project-root-design.md)
  - [chat-session-project-root-retrospective](../../internal/2026-04-02-chat-session-project-root-retrospective.md)

## 测试 / 验证 / 验收方式

- UI 定向测试：

```bash
PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C packages/nextclaw-ui test -- --run src/components/chat/chat-session-display.test.ts src/components/chat/ncp/ncp-session-adapter.test.ts src/components/chat/ChatConversationPanel.test.tsx
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui test -- --run src/components/path-picker/server-path-picker-dialog.test.tsx
```

- Nextclaw session/runtime 定向测试：

```bash
PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C packages/nextclaw test -- --run src/cli/commands/ncp/nextclaw-ncp-context-builder.test.ts src/cli/commands/ncp/ui-session-service.test.ts
```

- NCP backend 真实更新链路定向测试：

```bash
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit test -- --run src/agent/in-memory-agent-backend.test.ts
```

- OpenClaw compat runtime 定向测试：

```bash
PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C packages/nextclaw-openclaw-compat test -- --run src/plugins/runtime.test.ts
```

- Server 路由定向测试：

```bash
PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C packages/nextclaw-server test -- --run src/ui/router.ncp-agent.test.ts src/ui/router/server-path.controller.test.ts
```

- 受影响包类型检查：

```bash
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui build
PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C packages/nextclaw-ui exec tsc -p tsconfig.json --noEmit
PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk exec tsc -p tsconfig.json --noEmit
PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk exec tsc -p tsconfig.json --noEmit
PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C packages/nextclaw-openclaw-compat exec tsc -p tsconfig.json --noEmit
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit exec tsc -p tsconfig.json --noEmit
```

- maintainability / 新代码治理：

```bash
PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm lint:maintainability:guard
```

观察点：
- 会话可写入合法的 `project_root`，非法路径会被明确拒绝。
- 草稿会话可先 patch `projectRoot` / `sessionType`，再被提升为正式会话。
- header 在草稿态显示 `New Task`，在正式会话态显示真实标题与 project badge。
- Codex / Claude / native runtime 都通过会话级目录解析得到一致工作目录。
- 即使项目目录下没有 `AGENTS.md` / `SOUL.md`，runtime prompt 里也会明确暴露当前项目目录。
- `project_root` 清除后，header、刷新后的列表、以及 runtime 上下文都不再残留旧目录。
- 对真实运行中的 `/api/ncp/sessions/:id` 发 `PUT { "projectRoot": null }` 后，返回 payload 里不再包含 `project_root`。
- 路径选择器浏览的是服务端机器目录，而不是浏览器当前机器目录。
- 路径选择器弹框在切换目录时高度保持稳定，滚动只发生在目录列表内部。
- 在搜索框输入关键字后，只过滤当前目录内的条目；清空关键字后恢复完整列表。
- maintainability guard 无新增阻塞错误；仅保留仓库历史目录预算类 warning。

## 红区触达与减债记录

### packages/nextclaw-core/src/agent/loop.ts

- 本次是否减债：否
- 说明：这次触达仅用于跟随 `agent` 目录内的文件归位更新 import path，没有继续把“会话项目目录”逻辑塞进这个热点编排文件里。项目目录能力的新增与修复被收敛在 session metadata、runtime context、runtime plugin 边界内，避免继续扩大 `loop.ts` 的职责面。
- 下一步拆分缝：优先拆出 `session lookup / hydration`、`tool loop orchestration`、`response finalization` 三段，避免后续需求再次被迫落到同一个热点文件里。

## 发布 / 部署方式

- 本次未执行独立发布；改动属于工作区内功能实现与结构治理，不涉及远程 migration。
- 后续若随版本一并发布，沿用既有 workspace 发布闭环即可：

```bash
PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm lint:maintainability:guard
PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C packages/nextclaw-ui test -- --run src/components/chat/chat-session-display.test.ts src/components/chat/ncp/ncp-session-adapter.test.ts src/components/chat/ChatConversationPanel.test.tsx
PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C packages/nextclaw test -- --run src/cli/commands/ncp/nextclaw-ncp-context-builder.test.ts src/cli/commands/ncp/ui-session-service.test.ts
PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C packages/nextclaw-openclaw-compat test -- --run src/plugins/runtime.test.ts
PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C packages/nextclaw-server test -- --run src/ui/router.ncp-agent.test.ts src/ui/router/server-path.controller.test.ts
```

## 用户 / 产品视角的验收步骤

1. 打开任意聊天会话，进入顶部 header 右侧的“更多操作”菜单。
2. 选择“设置项目目录”，在弹窗里输入路径，或通过目录浏览器选择一个真实存在的服务端目录。
3. 验收点：
   - header 出现项目 badge
   - 目录浏览弹窗不会因文件数变化而整体抖动
   - 可在弹窗内直接搜索当前目录下的子目录名/路径片段
   - 会话再次打开后项目目录仍然保留
   - sidebar 搜索项目名时能命中该会话
   - 问 `Codex`“当前项目目录是什么”时，回答应优先围绕绑定目录，而不是把 `NextClaw workspace` 当成当前项目
4. 在该会话里继续发消息给 `native / codex / claude` 任一 runtime。
5. 验收点：
   - runtime 后续操作围绕该目录工作
   - 清除项目目录后，header 立即消失 project badge
   - 刷新页面后也不会回显旧目录
   - runtime 会同时保留两层清晰语义：
     - 当前项目目录：当前工作的 repo / directory
     - NextClaw host workspace：memory、workspace-local skills、bootstrap 所在目录
6. 新建一个草稿会话，不先发送消息，直接在“更多操作”里设置项目目录。
7. 验收点：
   - 设置成功后不会报错
   - 后续发送第一条消息时，该会话仍携带已设置的项目目录与会话类型
