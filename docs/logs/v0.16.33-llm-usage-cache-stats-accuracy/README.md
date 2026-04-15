# v0.16.33 LLM Usage Cache Stats Accuracy

## 迭代完成说明

- 修正 `nextclaw usage --stats` 的缓存统计口径，新增以下拆分：
  - `Usage records`
  - `Empty usage records`
  - `Prompt-bearing records`
  - `Cache token rate`
- 将记录级命中率的分母从“所有历史记录”收敛为“真正携带 prompt token 的记录”，避免空 telemetry 直接拉低缓存命中率。
- 在 recorder 层阻止 `usage: {}` 这类空 usage 响应写入最新快照和 history，避免继续污染后续统计。
- 补充回归测试：
  - 空 usage 不再落盘
  - stats 输出会把空 usage 和 prompt-bearing records 分开显示
- 将 `scripts/smoke/prompt-cache-smoke.mjs` 扩展为同时支持：
  - `provider-direct`
  - `ncp-chat`
- `ncp-chat` 模式会通过真实 `native + model` 会话重复发消息，并直接从 `~/.nextclaw/logs/llm-usage.jsonl` 回读对应 usage 记录，验证产品链路里的实际缓存 telemetry。
- 针对 `minimax/MiniMax-M2.7` 补了真实 MiniMax 冒烟结论：若每轮都新开 session，结果可能出现 `INCONCLUSIVE`；若按真实会话方式复用同一 session 连续请求，则能稳定观察到高缓存命中。

## 测试 / 验证 / 验收方式

- 单元测试：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw exec vitest run src/cli/commands/shared/llm-usage-observer.test.ts src/cli/commands/shared/llm-usage.commands.test.ts`
- 类型检查：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw exec tsc -p tsconfig.json --noEmit`
- 可维护性守卫：
  - `PATH=/opt/homebrew/bin:$PATH node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw/src/cli/runtime-state/llm-usage-record.ts packages/nextclaw/src/cli/commands/shared/llm-usage-recorder.ts packages/nextclaw/src/cli/commands/shared/llm-usage-observer.ts packages/nextclaw/src/cli/commands/shared/llm-usage-query.service.ts packages/nextclaw/src/cli/commands/shared/llm-usage.commands.ts packages/nextclaw/src/cli/commands/shared/llm-usage-observer.test.ts packages/nextclaw/src/cli/commands/shared/llm-usage.commands.test.ts`
- 本机真实数据只读复核：
  - 通过 `LlmUsageQueryService().getStats()` 读取 `~/.nextclaw/logs/llm-usage.jsonl`
  - 观察到：
    - `totalRecords = 837`
    - `usageRecordCount = 777`
    - `emptyUsageRecordCount = 60`
    - `promptTokenRecordCount = 766`
    - `tokenCacheRate = 42.9%`
    - `cacheHitRate = 47.0%`
- 真实服务链路冒烟：
  - 单次可用性：
    - `PATH=/opt/homebrew/bin:$PATH pnpm smoke:ncp-chat -- --session-type native --model minimax/MiniMax-M2.7 --prompt "Reply exactly MINIMAX-SMOKE-OK" --json`
    - 结果：`PASS`，`assistantText = "MINIMAX-SMOKE-OK"`，耗时约 `2554ms`
  - 真实缓存命中验证（2026-04-16，北京时间，使用运行中的本机服务 `http://127.0.0.1:18792`）：
    - `PATH=/opt/homebrew/bin:$PATH pnpm smoke:prompt-cache -- --transport ncp-chat --session-type native --model minimax/MiniMax-M2.7 --runs 3 --json`
    - 结果：`PASS`
    - `laterRuns.cacheHitRuns = 2/2`
    - `laterRuns.cachedTokens = 42102`
    - `laterRuns.promptTokens = 63937`
    - `laterRuns.cacheRate = 65.8%`
  - 复测确认：
    - `PATH=/opt/homebrew/bin:$PATH pnpm smoke:prompt-cache -- --transport ncp-chat --session-type native --model minimax/MiniMax-M2.7 --runs 4 --json`
    - 结果：`PASS`
    - `laterRuns.cacheHitRuns = 3/3`
    - `laterRuns.cachedTokens = 71217`
    - `laterRuns.promptTokens = 103929`
    - `laterRuns.cacheRate = 68.5%`
  - 对照观察：
    - 同一脚本在“每轮新开 session”的早期实现下，曾得到 `INCONCLUSIVE`，且 `cached_tokens = 0`
    - 改为复用同一 session 后，MiniMax 立即稳定返回 `prompt_tokens_details_cached_tokens`
    - 说明 MiniMax 在当前产品链路里并非“缓存能力差”，而是“会话形态会显著影响缓存 telemetry 是否出现”

补充说明：

- `pnpm lint:new-code:governance` 当前失败，原因是工作区内已有与本次无关的 touched 文件 `packages/nextclaw-ui/src/components/chat/ChatSidebar.tsx` / `ChatSidebar.test.tsx` 不满足 kebab-case。
- `pnpm check:governance-backlog-ratchet` 当前失败，原因是仓库现状中的 doc file-name violation 数量高于 baseline；非本次改动引入。

## 发布 / 部署方式

- 无额外部署步骤。
- 按既有 `nextclaw` CLI 发布流程发版即可；本次改动仅影响本地 usage snapshot/history 的记录与展示口径，不涉及配置迁移。

## 用户 / 产品视角的验收步骤

1. 继续正常使用会触发 LLM 请求的 CLI 或 UI/NCP 会话。
2. 执行 `nextclaw usage --stats`。
3. 确认输出不再只给出一个混杂口径的 cache hit 数字，而是同时展示：
   - `Usage records`
   - `Empty usage records`
   - `Prompt-bearing records`
   - `Cache hit records`
   - `Cache token rate`
4. 若某些 provider 返回空 usage，确认后续这类请求不再覆盖最近一次有效 snapshot，也不再继续污染 history 分母。
5. 若要验证 MiniMax 的真实缓存能力，执行：
   - `pnpm smoke:prompt-cache -- --transport ncp-chat --session-type native --model minimax/MiniMax-M2.7 --runs 4 --json`
6. 确认结果中：
   - `status = PASS`
   - `laterRuns.cacheHitRuns > 0`
   - `laterRuns.cacheRate` 维持在预期高位（本次实测约 `65% - 69%`）
   - 具体 usage 记录可在 `~/.nextclaw/logs/llm-usage.jsonl` 中看到 `prompt_tokens_details_cached_tokens`

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。本次没有新增新的缓存层或补丁式分支，而是直接在现有 record / recorder / query / commands 边界内修正口径，并删除“空 telemetry 也照样落盘”的隐性噪音路径。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：没有完全做到净减少，但已把增长压到当前验证目标下的最小必要范围。为避免把 `prompt-cache-smoke` 再做成新的大文件债务，本次把新增 smoke 能力拆成薄入口加分职责 runner；`git diff --numstat` 与新增文件行数合并统计后，本迭代总计新增 `1006` 行、删除 `5` 行、净增 `1001` 行；排除测试后新增 `930` 行、删除 `4` 行、净增 `926` 行。增长主要来自真实 smoke 脚本和本次迭代留痕文档，而不是继续向业务主链路叠加补丁。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。统计修正仍沿用既有 `record factory -> recorder -> query service -> commands` 分层；新增的 smoke 能力也没有另起一套测试框架，而是在现有 `prompt-cache-smoke` 内最小化扩到 `provider-direct / ncp-chat` 两种模式，把“发请求”和“判读 usage 日志”的职责收敛在同一个 owner 脚本里。
- 目录结构与文件组织是否满足当前项目治理要求：本次触达目录满足当前治理要求；未新增目录。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：已基于独立复核填写。结论为 `通过`，`no maintainability findings`。当前仅剩 `scripts/smoke` 目录平铺预算警告，已在目录 README 记录原因与后续治理方向。

长期目标对齐 / 可维护性推进：

- 这次顺着“让系统更可感知、更可信、更少噪音”的长期方向推进了一小步：把本来会误导产品判断的空 usage 记录排除掉，让缓存统计更接近真实运行状态。
- 剩余观察点是 provider 层对 prompt cache telemetry 的支持并不一致，且同一 provider 也可能受会话形态影响；MiniMax 本次实测显示“复用 session 的真实产品链路”可以稳定打出约 `65% - 69%` 的 cache rate，但“每轮新开 session”未必会暴露同样的 telemetry。这说明后续若要继续提升“真实缓存命中率”，应优先从 prompt 稳定性、会话复用策略与 provider telemetry 语义入手，而不是继续在 CLI 展示层补丁。
