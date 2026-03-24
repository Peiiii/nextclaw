# v0.14.157-codex-plugin-local-deps-loader-fix

## 迭代完成说明

- 修复 external plugin loader 对 `@nextclaw/*` 的 alias 策略：外部插件若在自己的安装目录中已经携带可运行的 `@nextclaw/*` 依赖，NextClaw 现在优先使用插件本地依赖，而不是强行替换成宿主版本。
- 这次修复直接覆盖了本地旧版 `@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk` 的典型故障：旧插件仍调用 `skillsLoader.loadSkillsForContext(...)`，此前会因宿主 `@nextclaw/core` 不再提供该接口而报错；修复后插件可以回到自身依赖树中运行。
- 将 alias 解析逻辑拆分到独立文件 `plugin-loader-aliases.ts`，并新增回归测试，覆盖两种场景：
  - 插件本地依赖可运行时，应优先使用本地依赖。
  - 插件本地依赖不可运行时，仍应回退到宿主 alias。

## 测试/验证/验收方式

- 定向测试：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-openclaw-compat test -- --run src/plugins/loader.ncp-agent-runtime.test.ts`
- 类型检查：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-openclaw-compat tsc`
- 静态检查：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-openclaw-compat lint`
  - 结果：通过；仅存在仓库历史 warning，无新增 error。
- 可维护性检查：
  - `PATH=/opt/homebrew/bin:$PATH node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-openclaw-compat/src/plugins/loader.ts packages/nextclaw-openclaw-compat/src/plugins/plugin-loader-aliases.ts packages/nextclaw-openclaw-compat/src/plugins/loader.ncp-agent-runtime.test.ts`
  - 结果：无阻塞项；仅保留 `loader.ts` 的历史超长函数警告，本次文件行数从 `514` 降到 `444`。
- 真实 AI 冒烟：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw dev:build serve --ui-port 18832`
  - `curl http://127.0.0.1:18832/api/ncp/session-types`
  - `PATH=/opt/homebrew/bin:$PATH pnpm smoke:ncp-chat -- --session-type codex --model openai/gpt-5.4 --port 18832 --timeout-ms 180000 --prompt 'Reply exactly OK'`
  - `PATH=/opt/homebrew/bin:$PATH pnpm smoke:ncp-chat -- --session-type codex --model openai/gpt-5.3-codex --port 18832 --timeout-ms 180000 --prompt 'Reply exactly OK'`
- 冒烟验收结果：
  - `session-types` 返回包含 `codex`
  - 两次 `smoke:ncp-chat` 都返回 `Result: PASS`
  - 真实 assistant 文本为 `OK`

## 发布/部署方式

- 合并后按项目既有 NPM 发版流程发布包含本次修复的 `nextclaw` / `@nextclaw/openclaw-compat`：
  - [NPM Package Release Process](../../../workflows/npm-release-process.md)
- 本地验证或临时止血可直接使用源码服务：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw dev:build serve`
- 若用户运行的是已安装的本地 NextClaw 实例，需要升级到包含本次修复的版本后再重启服务；无需删除已有 `~/.nextclaw/extensions/nextclaw-ncp-runtime-plugin-codex-sdk` 目录。

## 用户/产品视角的验收步骤

1. 保留现有本地 `codex` 插件安装记录，不手动删除旧插件目录。
2. 启动包含本次修复的 NextClaw 服务。
3. 访问 `GET /api/ncp/session-types`，确认返回里有 `codex` 且状态为可用。
4. 发起一个 `codex` 会话，选择 `openai/gpt-5.4` 或 `openai/gpt-5.3-codex`。
5. 发送一条最小消息，例如 `Reply exactly OK`。
6. 确认服务返回真实 assistant 内容，而不是 `skillsLoader.loadSkillsForContext is not a function`。
