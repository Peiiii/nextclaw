# 迭代完成说明

- 优化了 `nextclaw agents runtimes --json` 的加载路径，不再为了列出 agent runtime 而先加载整套 bundled channel plugins。
- 在 [`packages/nextclaw/src/cli/commands/agent/agent-runtime.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/agent/agent-runtime.ts) 增加 runtime-only 插件注册表加载逻辑，只保留 `kind = agent-runtime` 的外部插件，并显式跳过 bundled plugins。
- 在 [`packages/nextclaw-openclaw-compat/src/plugins/loader.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-openclaw-compat/src/plugins/loader.ts) 为通用 plugin loader 增加可选过滤能力：支持 `includeBundled: false` 与按 `kinds` 过滤 manifest。
- 在 [`packages/nextclaw-openclaw-compat/src/plugins/loader.ncp-agent-runtime.test.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-openclaw-compat/src/plugins/loader.ncp-agent-runtime.test.ts) 补充回归测试，锁住“跳过 bundled、只加载 agent-runtime manifest”的行为。
- 实测优化前 `nextclaw agents runtimes --json` 约 `7.67s`，优化后约 `1.50s`；startup trace 显示 plugin loader 从约 `6621ms` 降到约 `659ms`。

# 测试/验证/验收方式

- 运行 `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C packages/nextclaw test -- src/cli/commands/agent/agent-commands.test.ts`
  - 结果：通过，`1` 个测试文件、`4` 个测试通过。
- 运行 `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C packages/nextclaw-openclaw-compat test -- src/plugins/loader.ncp-agent-runtime.test.ts`
  - 结果：通过，`1` 个测试文件、`6` 个测试通过。
- 运行 `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C packages/nextclaw-openclaw-compat build`
  - 结果：通过。
- 运行 `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C packages/nextclaw build`
  - 结果：通过。
- 运行 `NEXTCLAW_STARTUP_TRACE=1 PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH node packages/nextclaw/dist/cli/index.js agents runtimes --json`
  - 结果：通过；整体约 `1.50s`，`plugin.loader.total duration_ms=659 plugin_count=2`。
- 运行 `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm lint:maintainability:guard`
  - 结果：未全绿，但当前失败项来自仓库内其它并行改动热点；本次涉及的 `loader.ts` 从 `475` 行降到 `470` 行，未新增新的维护性错误，仅保留历史超限告警。
- 运行 `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C packages/nextclaw tsc`
  - 不适用为本次放行依据：仓库存在与本改动无关的既有错误，报错位于 `packages/ncp-packages/nextclaw-ncp-agent-runtime/src/user-content.ts:147`。

# 发布/部署方式

- 先执行：
  - `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C packages/nextclaw-openclaw-compat build`
  - `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C packages/nextclaw build`
- 若按常规仓库发布流出包，继续走项目既有 release 流程即可；本次改动只涉及 CLI 运行时与 plugin loader，不涉及数据库 migration、远程部署或线上配置迁移。
- 若仅本地验证，可直接运行：
  - `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH node packages/nextclaw/dist/cli/index.js agents runtimes --json`

# 用户/产品视角的验收步骤

1. 在本地执行 `nextclaw agents runtimes --json`。
2. 确认输出仍包含 `native`、已安装的 runtime 插件（如 `claude`、`codex`），且 JSON 结构未变化。
3. 对比优化前后的主观响应时间，确认命令明显更快，不再有数秒级等待。
4. 若开启 `NEXTCLAW_STARTUP_TRACE=1`，确认日志中不再出现 bundled channel plugin 的逐个加载记录，而只剩真正相关的 runtime 插件加载。

# 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。
  - 这次没有去重写整套 plugin loader，而是优先选择最小必要切口，把“runtime 列表查询”收敛到 runtime-only 加载路径，避免为性能问题引入更大范围重构。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。
  - 关键收益来自删除无关加载，而不是再叠加缓存、特判或隐藏兜底；最终减少的是执行路径复杂度，而不是仅在慢路径外再包一层补丁。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：基本做到。
  - 代码增减报告：
    - 新增：133 行
    - 删除：17 行
    - 净增：+116 行
  - 非测试代码增减报告：
    - 新增：38 行
    - 删除：17 行
    - 净增：+21 行
  - 说明：本次总增量主要来自回归测试；非测试代码净增仅用于引入 runtime-only 加载入口，并同步删除了部分旧路径冗余。对于一个性能修复，这个净增已压到较小范围。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。
  - runtime-only 加载逻辑被限制在 [`agent-runtime.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/agent/agent-runtime.ts) 的专用 helper 中；通用 loader 只补了两个小选项，没有再新增一套平行 loader。
- 目录结构与文件组织是否满足当前项目治理要求：部分满足。
  - 本次未新增新的源码目录或额外业务模块；但 [`packages/nextclaw-openclaw-compat/src/plugins/loader.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-openclaw-compat/src/plugins/loader.ts) 仍是历史热点大文件。守卫显示该文件从 `475` 行降到 `470` 行，历史超限仍在，但本次没有继续恶化。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：已执行。
  - 可维护性复核结论：保留债务经说明接受
  - 本次顺手减债：是
  - no maintainability findings
  - 可维护性总结：这次改动让 `agents runtimes` 从“全量插件初始化”收敛成“只加载 runtime 插件”，属于直接删减执行复杂度的优化。保留债务主要是通用 loader 本身仍偏大，但这次已经把它压小了一点，并避免在 `plugins.ts` 这类热点文件继续堆逻辑；后续若 runtime-only 查询继续扩展，再考虑把 loader 的 manifest 过滤和外部模块加载拆成更小的单职责步骤。
