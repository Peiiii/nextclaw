# v0.15.14-chat-session-project-root-lightweight

## 迭代完成说明

- 为聊天会话补齐轻量版“项目目录绑定”能力，继续坚持 `project = local directory`，不引入独立 `Project` 实体。
- 新增会话元数据字段 `session.metadata.project_root`，并让 `native / codex / claude` runtime 统一消费它作为会话级工作目录。
- 后端 `PATCH /api/ncp/sessions/:id` 支持写入/清除 `projectRoot`，并对路径执行绝对目录校验与规范化。
- 新增服务端驱动的通用路径浏览能力：
  - `GET /api/server-paths/browse`
  - 前端通用 `ServerPathPickerDialog`
  - 会话项目目录改为浏览“运行 NextClaw 服务的那台机器上的目录”，兼容远程部署语义。
- 前端会话 header 从单一删除按钮升级为“更多操作”菜单，支持：
  - 设置项目目录
  - 清除项目目录
  - 删除会话
- 会话 header 新增 project badge，sidebar 搜索也支持匹配项目名/项目路径。
- 草稿会话支持先绑定项目目录再进入正式会话；`UiSessionService.updateSession` 采用轻量 upsert 以承接这一路径。
- 修复清除项目目录的持久化缺陷：
  - session store 不再把已移除的 `project_root` 从旧 metadata merge 回来
  - 路由 patch 时会同时清理历史兼容键 `projectRoot`，避免“提示清除成功但刷新后还在”
- 调整 runtime 项目语义暴露：
  - prompt 里始终显式写出 `Current project directory`
  - 若存在宿主 workspace，则额外以辅助信息形式提供 `NextClaw workspace directory`
  - `project_root` 成为“当前项目”主语，workspace 只作为宿主环境背景，不再喧宾夺主
- 收敛前端会话语义：线程态统一使用 `sessionKey` 表示当前线程，避免在同层重复引入 `activeSessionKey` 语义。
- 修正 React hook 治理：会话相关 hook 统一落在 `packages/nextclaw-ui/src/components/chat/hooks/`，并使用 `use-*.ts` 命名。
- 本次配套设计文档：
  - [chat-session-project-root-design](../../plans/2026-04-01-chat-session-project-root-design.md)

## 测试 / 验证 / 验收方式

- UI 定向测试：

```bash
PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C packages/nextclaw-ui test -- --run src/components/chat/chat-session-display.test.ts src/components/chat/ncp/ncp-session-adapter.test.ts src/components/chat/ChatConversationPanel.test.tsx
```

- Nextclaw session/runtime 定向测试：

```bash
PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C packages/nextclaw test -- --run src/cli/commands/ncp/nextclaw-ncp-context-builder.test.ts src/cli/commands/ncp/ui-session-service.test.ts
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
PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C packages/nextclaw-ui exec tsc -p tsconfig.json --noEmit
PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk exec tsc -p tsconfig.json --noEmit
PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk exec tsc -p tsconfig.json --noEmit
PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C packages/nextclaw-openclaw-compat exec tsc -p tsconfig.json --noEmit
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
- 路径选择器浏览的是服务端机器目录，而不是浏览器当前机器目录。
- maintainability guard 无新增阻塞错误；仅保留仓库历史目录预算类 warning。

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
   - 会话再次打开后项目目录仍然保留
   - sidebar 搜索项目名时能命中该会话
   - 问 `Codex`“当前项目目录是什么”时，回答应优先围绕绑定目录，而不是把 `NextClaw workspace` 当成当前项目
4. 在该会话里继续发消息给 `native / codex / claude` 任一 runtime。
5. 验收点：
   - runtime 后续操作围绕该目录工作
   - 清除项目目录后，header 立即消失 project badge
   - 刷新页面后也不会回显旧目录
   - runtime 恢复到默认 workspace 语义，但仍可把 workspace 作为辅助背景信息使用
6. 新建一个草稿会话，不先发送消息，直接在“更多操作”里设置项目目录。
7. 验收点：
   - 设置成功后不会报错
   - 后续发送第一条消息时，该会话仍携带已设置的项目目录与会话类型
