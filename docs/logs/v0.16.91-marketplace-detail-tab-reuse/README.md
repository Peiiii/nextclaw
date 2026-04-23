# 迭代完成说明

- 修复了 skills marketplace / plugins marketplace / MCP marketplace 中，详情页缺少按条目身份去重的问题：同一个条目重复点击会复用同一个内嵌浏览器 tab，不同条目会按各自 `dedupeKey` 并存。
- 同批次继续修复了 skills marketplace 中，点击 skill 后右侧详情要等明显一段时间才出现的问题：现在先立即打开 loading 详情，再异步填充真实内容。
- 重复标签页问题根因已确认：marketplace 详情打开逻辑在 [packages/nextclaw-ui/src/features/marketplace/components/marketplace-page.tsx](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/features/marketplace/components/marketplace-page.tsx) 与 [packages/nextclaw-ui/src/features/marketplace/components/mcp/mcp-marketplace-page.tsx](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/features/marketplace/components/mcp/mcp-marketplace-page.tsx) 中，每次打开详情都显式传入 `newTab: true`，因此即使只是重复查看当前详情，也会强制新建 content 标签。
- 详情打开慢的问题根因已确认：skills marketplace 在点击后先 `await fetchMarketplaceSkillContent(...)`，只有等远端内容拉完才调用 `docBrowser.open(...)`，于是用户体感上是“右侧面板迟迟不出现”，而不是“面板先出现、内容后补齐”。
- 同批次后续确认了第一次去重修复不完整：只移除 `newTab: true` 会让所有 marketplace 详情都退化成“复用当前 content tab”，导致不同 skill 的详情互相覆盖，违背用户对“不同 skill 可并存、同 skill 才去重”的预期。
- 根因确认方式：
  - 直接检查 marketplace 详情点击链路代码，对比 doc browser 现有 `open()` 逻辑，确认第一层重复页问题来自调用侧强制 `newTab: true`。
  - 直接检查 skills 详情打开路径，确认 `docBrowser.open(...)` 位于远端 content fetch 之后，因此右侧详情显示被网络等待串行阻塞。
  - 继续检查 [packages/nextclaw-ui/src/shared/components/doc-browser/doc-browser-context.tsx](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/shared/components/doc-browser/doc-browser-context.tsx) 的 `open()` 逻辑，确认它原本只按 `kind` 决定是否复用 active tab，缺少可由调用方提供的稳定详情身份 key。
- 本次修复为何命中根因而非表象：
  - 对重复页与不同 skill 互相覆盖问题，新增通用 `dedupeKey` 协议并由 marketplace 传入 `marketplace:<type>:<slug>` / `marketplace:mcp:<slug>` 等稳定 key；doc browser 只在 key 相同时更新已有 tab，key 不同时新建并保留并存。
  - 对打开慢问题，没有去改 iframe 或渲染层，而是把 skills detail 改成“先立即打开 loading 详情，再异步替换为真实内容”；竞态保护也从“全局最后一个 skill”修正为“同一个 dedupeKey 的最后一次请求”，避免不同 skill 之间互相吞掉回填。
  - 对慢响应回填时的焦点问题，新增 `activate: false` 更新选项，保证异步内容只更新自己的 tab，不会在用户已经切到另一个 skill 时抢回焦点。

# 测试/验证/验收方式

- 运行：`pnpm test -- src/features/marketplace/components/marketplace-page.test.tsx src/features/marketplace/components/marketplace-page-detail.test.tsx src/shared/components/doc-browser/doc-browser-context.test.tsx src/shared/components/doc-browser/doc-browser.test.tsx`
- 结果：通过，`4` 个测试文件、`12` 个测试用例全部通过。
- 其中新增的定向验证覆盖：
  - 点击 skill 后会先立即打开 loading 详情，而不是等内容请求完成后才显示右侧面板。
  - 当用户连续点击两个不同 skill 时，两个详情响应都能按各自 `dedupeKey` 回填，不会互相覆盖或互相吞掉。
  - 当用户重复点击同一个 skill 时，同 key 的旧响应会被抑制，只允许最后一次请求回写。
  - doc browser 底层验证不同 `dedupeKey` 会打开不同 content tab，相同 `dedupeKey` 会更新已有 content tab，且后台更新不会抢走当前 active tab。
- 运行：`pnpm lint:maintainability:guard`
- 结果：通过，无错误；保留历史体量 warning，主要来自 `MarketplacePage`、`DocBrowserProvider` 与 `DocBrowser` 文件接近预算或历史函数体量偏大。本次没有引入治理错误，`lint:new-code:governance` 与 `check:governance-backlog-ratchet` 均通过。
- 运行：`pnpm --filter @nextclaw/ui tsc`
- 结果：通过。

# 发布/部署方式

- 该改动属于前端行为修复，无额外配置、数据迁移或脚本步骤。
- 随正常 UI 构建/发布流程进入下一个前端版本即可。

# 用户/产品视角的验收步骤

1. 打开 marketplace 页面，进入 `skills`、`plugins` 或 `MCP` 任一列表。
2. 点击某个条目，确认右侧内嵌浏览器会立刻出现详情区域；对于 skill，先显示 loading 详情，再补齐真实内容。
3. 在详情已打开的情况下，连续多次点击同一个条目。
4. 确认不会继续累积多个重复 content 标签，而是复用同一个详情标签更新内容。
5. 在 skills 列表中连续快速点击两个不同 skill。
6. 确认两个 skill 拥有不同详情标签，可以在内嵌浏览器里并存切换；其中任一 skill 的慢响应只回填自己的标签。
7. 再切换到 plugins / MCP marketplace 验证同一条目复用、不同条目并存。

# 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。本次没有为 marketplace 单独做隐藏全局状态，而是在 doc browser 已有 tab owner 上补最小 `dedupeKey` 字段与更新规则；marketplace 侧只负责传入稳定身份 key 与立即打开 loading 详情。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：本次为新增用户可见能力修正，引入了少量非测试代码和定向测试；`pnpm lint:maintainability:guard` 已通过，但仍保留文件体量 warning，后续继续触达时应优先拆分 `MarketplacePage` 与 `DocBrowserProvider` 的长函数。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。去重语义属于 doc browser tab owner，因此放在 `DocBrowserProvider.open()`；具体 key 的构造属于 marketplace 调用 owner，因此留在 marketplace 页面。竞态保护限制为同一 `dedupeKey` 的请求序号，没有扩散成全局“最后点击条目”。
- 目录结构与文件组织是否满足当前项目治理要求：本次触达范围满足；未新增目录，也未放大目录平铺问题。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：本次已结合守卫结果做独立复核，结论为通过。当前主要债务是 `MarketplacePage` / `DocBrowserProvider` / `DocBrowser` 历史体量偏大；后续若继续触达，应优先把详情打开流程与 tab 状态迁移进一步拆到更窄的 owner。

# NPM 包发布记录

- 不涉及 NPM 包发布。
