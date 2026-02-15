# 2026-02-15 OpenClaw 核心机制对齐（Gateway/Sessions/Subagents）

## 背景 / 问题

- 需要与 openclaw 在核心机制上严格对齐（会话工具、gateway 配置控制、subagents 控制面）
- 现有工具接口/字段命名与 openclaw 不一致，难以复用 prompt/习惯

## 决策

- 工具名保持不变，参数/动作/返回结构对齐 openclaw
- Gateway 仅实现本地可用的 config.get/schema/apply/patch 与 restart；不新增 UI 能力
- 兼容 nextclaw 现有最小实现，缺失字段返回空/默认

## 变更内容

- 会话工具对齐：sessions_list/history/send 参数与输出字段命名靠拢 openclaw（含 kinds/activeMinutes/messageLimit 等）
- Subagents 工具对齐：action/target/message/recentMinutes，支持 last/index/label 解析
- Gateway 工具对齐：动作改为 config.get/schema/apply/patch + restart + update.run
- Gateway 控制器新增：本地 config.get/schema/apply/patch，支持 baseHash 校验与重启调度
- Memory 工具对齐：memory_search/memory_get 参数与返回结构靠拢 openclaw
- update.run：新增本地更新策略（repo git pull 或 npm 全局更新）+ 重启调度
- 系统提示补齐：加入 CLI 快速参考与自更新规则，匹配 openclaw 结构

## 验证（怎么确认符合预期）

```bash
# build / lint / tsc
pnpm build
pnpm lint
pnpm tsc

# smoke-check（非仓库目录）
cd /tmp
PATH="/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH" \
  /Users/peiwang/Projects/nextbot/packages/nextclaw-core/node_modules/.bin/tsx -e \
  "import { SessionsListTool } from '/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/agent/tools/sessions.ts';\nimport { SessionManager } from '/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/session/manager.ts';\nconst manager = new SessionManager('/tmp/nextclaw-smoke');\nconst session = manager.getOrCreate('cli:direct');\nmanager.save(session);\nconst tool = new SessionsListTool(manager);\ntool.execute({ limit: 1 }).then((out) => {\n  const ok = out.includes('sessions');\n  console.log(ok ? 'smoke-ok' : 'smoke-fail');\n});"
```

验收点：

- build/lint/tsc 全部通过
- 冒烟输出包含 `smoke-ok`

## 发布 / 部署

- 如需发布 npm，请按 `docs/workflows/npm-release-process.md`

## 影响范围 / 风险

- Breaking change：gateway/sessions/subagents 工具参数更贴近 openclaw（建议同步更新提示词）
- 回滚方式：回退本次提交
