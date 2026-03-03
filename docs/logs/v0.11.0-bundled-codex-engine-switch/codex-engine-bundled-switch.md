# Codex 引擎内置集成与切换

## 迭代完成说明（改了什么）

- 保持 `@nextclaw/nextclaw-engine-codex-sdk` 为独立插件包（TypeScript + `src` + 独立构建）。
- 在 OpenClaw 兼容层加入 bundled runtime plugin 注入，`codex-sdk` 可像内置插件一样自动加载，无需手工 `plugins.load.paths`。
- 保持核心解耦：Codex SDK 逻辑仅在独立插件包内实现，`core/openclaw-compat` 不包含 Codex 专有业务实现。
- 完成运行时引擎切换闭环：
  - 配置层：支持 `agents.defaults.engine` / `agents.list[].engine`。
  - UI Runtime 页面：新增“默认引擎”和“Agent 引擎覆盖”输入项。
  - UI Runtime API：支持更新 `agents.defaults.engine`（以及 `engineConfig`）。
  - 热重载策略：补齐 `buildReloadPlan` 规则，`agents.defaults.engine`、`agents.list`、`bindings`、`session` 等变化会触发 `reload-agent`，无需重启即可切换引擎。

## 测试 / 验证 / 验收方式

执行基础验证：

```bash
PATH=/opt/homebrew/bin:$PATH pnpm build
PATH=/opt/homebrew/bin:$PATH pnpm lint
PATH=/opt/homebrew/bin:$PATH pnpm tsc
```

验证点：

- build 全量通过。
- lint 通过（仅仓库既有 max-lines warnings，无新增 errors）。
- tsc 全量通过。

端到端冒烟（隔离目录，不写入仓库）：

1. 使用隔离 `NEXTCLAW_HOME`，复制用户现有 `~/.nextclaw/config.json`，并将 workspace 指向临时目录。
2. 验证 bundled 插件可见：
   - `nextclaw plugins info nextclaw-engine-codex-sdk`
   - `nextclaw plugins list --json`
   - 验证 `origin=bundled`、`engines=["codex-sdk"]`。
3. 验证 Codex 引擎能力：
   - 调用 `/api/chat/turn` 让 agent 创建 `a.txt/b.txt/c.txt`，检查文件真实存在。
   - 调用 `/api/chat/turn/stream`，验证 SSE 事件包含 `ready/delta/final/done`。
   - 查询 `/api/sessions/:key/history`，验证存在 `engine.codex.*` 事件。
4. 验证引擎切换：
   - `PUT /api/config/runtime` 设置 `agents.defaults.engine=codex-sdk`，新会话出现 `engine.codex.*`。
   - 再设置 `agents.defaults.engine=native`，新会话不再出现 `engine.codex.*`。
   - 再切回 `codex-sdk`，确认切换可逆。

## 发布 / 部署方式

- 本次不涉及数据库或后端 migration。
- 常规发布路径：按项目 NPM 发布流程执行 changeset/version/publish。
- 若仅本地验证，不需要发布。

## 用户 / 产品视角验收步骤

1. 打开 Runtime 配置页，确认可看到“默认引擎”和每个 Agent 的“引擎覆盖”输入。
2. 默认引擎填写 `codex-sdk` 并保存。
3. 在 Chat 页面发起新对话，确认可正常回复并执行 Agent 能力（如创建文件/执行工具）。
4. 将默认引擎改为 `native` 并保存，发起新对话，确认链路仍可用。
5. 再切回 `codex-sdk`，确认无需重启即可生效。
