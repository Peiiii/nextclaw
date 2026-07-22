# v0.26.9 本地 AI 订阅代理

## 迭代完成说明

- 新增并发布 `@nextclaw/proxy-local-ai-subscriptions` Marketplace skill，把用户本机 Codex 或 Claude Code 订阅安全地接成 localhost-only OpenAI 兼容端点，并在用户确认后事务式添加 NextClaw provider。
- 首次交付的真实验收范围是 macOS、CLIProxyAPI `v7.2.90` 与 Codex OAuth；Claude、Linux、Windows 保留为明确未验收边界。
- 代理配置固定监听 `127.0.0.1`，关闭管理 API 和控制面板，密钥只通过 `0600` 文件传递；NextClaw provider 不接触订阅 OAuth token，也不自动修改默认模型。
- 真实 NCP 验收确认：OpenAI 端点使用 Responses wire 可以正常回复，但 NextClaw `native` 工具上下文经 Responses wire 会触发上游工具 schema 不兼容；provider 因此固定使用已验证通过的 Chat Completions wire，不做隐式 fallback。
- 后续真实使用把 provider 改名为 `codex-sub` 时，配置与 provider test 均成功，但 NCP smoke 在发请求前仍强制要求 `local-subscriptions/...`。根因是验收脚本把默认实例名误写成协议合同；修复后 smoke 只要求通用 `<provider-id>/<raw-model-id>` route，session id 保持无业务语义的通用标识，不再维护第二份 provider 名称事实。
- 发布后默认 Marketplace 安装两次复现了国内镜像 blob 的 2 秒边界超时，其中一次留下半套目录。根因由真实远端时延、读取源选择和逐文件写入顺序共同确认。修复让每个文件沿候选源回退、并发预取，并在同目录 staging 完成后原子替换；失败时保留原目录，因此同时解决超时和半安装误判，而不是只提高超时阈值。

## 测试/验证/验收方式

- bundled scripts：`node --check`、8 个 Node 定向测试、精确 ESLint 均通过。
- Provider ID 回归：修前用 `codex-sub/gpt-5.4-codex` 可稳定复现固定前缀拒绝；修后定向测试断言 NCP envelope 保留 `codex-sub`，session id 不再编码 provider 名称。
- `codex-sub` 真实链路：仓库源码 smoke 经 `native + codex-sub/gpt-5.4` 精确返回 `NEXTCLAW_NCP_PROXY_OK` 与 `run.finished`；Marketplace 更新后从临时目录安装远端包，再运行同一路径也精确通过。
- Skill quick validator、Marketplace validator、精确 ESLint、`lint:new-code:governance`、governance backlog ratchet 与 `git diff --check` 均通过。
- skill：Skill quick validator、Marketplace validator 均通过；远端条目返回 `published`，包含 7 个发布文件。
- Codex 真实链路：OAuth 成功；`/v1/models` 返回 10 个模型；`gpt-5.3-codex-spark` 经 `/v1/responses` 精确返回 `NEXTCLAW_PROXY_OK`。
- NextClaw 真实链路：隔离源码实例完成 provider connection test，并经 `native + local-subscriptions/gpt-5.3-codex-spark` 的 NCP SSE 精确返回 `NEXTCLAW_NCP_PROXY_OK` 与 `run.finished`。
- Marketplace 安装修复：9 个定向 Vitest 通过，覆盖读取源回退、blob 级回退、残留目录恢复，以及安装/更新下载失败时保留原目录；`@nextclaw/service` 的 `tsc` 和 build 通过。
- 发布后安装：无 `--api-base` 的默认安装成功，安装包共 7 个发布文件加 1 个本地状态文件；从已安装包再次调用真实 Codex Responses smoke 通过。
- 全包测试曾因命令参数传递错误意外运行 46 个文件：45 个文件、150 个测试通过；3 个既有 cron dev 集成测试因本机旧 Node 路径 `/opt/homebrew/Cellar/node/25.6.1/bin/node` 不存在而失败，与本次 Marketplace 定向测试无关。
- `lint:new-code:governance`、governance backlog ratchet、精确 ESLint 与 `git diff --check` 通过。`check:generated-clean` 检出了工作区原有的 `packages/nextclaw/ui-dist` 资产漂移；本次没有触达或清理这些并行改动。

## 发布/部署方式

- Marketplace：已发布 `@nextclaw/proxy-local-ai-subscriptions`，公开安装命令为 `nextclaw skills install @nextclaw/proxy-local-ai-subscriptions`。
- Marketplace Provider ID 修复：已执行 `skills update`，远端条目为 `published`，安装包共 7 个发布文件；远端元数据和临时安装内容都明确 provider id 由用户选择并在 NCP 验收中复用。
- NPM：Marketplace 默认安装可靠性修复已加入 changeset，尚未执行 NPM 发布，随下一次统一发布交付。
- 无数据库 migration、后端部署、前端部署或桌面发布。

## 用户/产品视角的验收步骤

1. 从 Marketplace 安装 `@nextclaw/proxy-local-ai-subscriptions`。
2. 按 skill 引导安装 CLIProxyAPI、生成 localhost-only 配置，并由用户本人完成 Codex OAuth。
3. 以 bundled script 验证模型列表和固定 Responses marker。
4. 用户确认接入 NextClaw 后，只选择一次 provider id；Codex 推荐 `codex-sub`，Claude Code 推荐 `claude-sub`，也可使用其他 kebab-case 名称。确认 connection test 成功且未改默认模型。
5. 用同一个 `<provider-id>/<raw-model-id>` 执行 NCP smoke；只有收到精确 marker 和 `run.finished` 才验收通过。

## 可维护性总结汇总

- 使用单一 skill root，把 OAuth/OpenAI 协议继续交给 CLIProxyAPI owner，把 provider 持久化继续交给 NextClaw 现有 owner；没有在内核增加订阅代理特判。
- 三个工作流脚本共享一个纯边界工具模块，测试留在仓库级 `tests/skills`，Marketplace 包只包含用户运行所需的 7 个文件。
- Marketplace 安装修复收敛在既有 client/lifecycle owner：client 负责候选源与完整下载，lifecycle 负责 staging、替换和回滚；没有新增 service、manager 或平行安装入口。
- scoped maintainability guard 为 0 error、4 warning；代码增减为 `+1527/-49`、净增 `1478`，非测试代码为 `+986/-48`、净增 `938`。这是新增用户能力，增长主要来自可独立运行的安全编排脚本与真实链路测试。
- `marketplace-client.utils.ts` 与 `marketplace-skill-lifecycle.utils.ts` 已进入 400 行预算的 80% 观察区，但本次没有增加新的核心文件或平行 owner；下一次继续扩展 Marketplace 安装语义时，应把 skill-install 子域整体下沉到子目录，而不是继续向两个文件追加分支。
- `post-edit-maintainability-review` 结论为通过：没有阻塞性维护问题；职责归属、失败原子性与验证入口均更清晰，剩余增长已是当前安全合同下的实际最小范围。
- Provider ID 修复的 scoped non-feature guard 为 0 error、0 warning；总代码 `+9/-6`、净增 `3`，排除测试后的运行代码 `+3/-3`、净增 `0`。正向减债动作是简化：删除 smoke 对某个默认实例名的耦合，用传入的标准 route 作为唯一事实，没有新增 helper、分支或兼容入口。

## NPM 包发布记录

- `@nextclaw/service`：需要 patch，changeset 已添加，当前待统一发布。
- `nextclaw`：需要 patch 以交付其直接依赖的 Marketplace 安装修复，changeset 已添加，当前待统一发布。
- Marketplace skill 不通过 NPM 发布；`@nextclaw/proxy-local-ai-subscriptions` 已独立发布到 NextClaw Marketplace。
