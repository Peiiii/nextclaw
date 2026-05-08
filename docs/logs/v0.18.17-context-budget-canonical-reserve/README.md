# v0.18.17 Context Budget Canonical Reserve

## 迭代完成说明

本次修复上下文圆环显示约 40%-50% 时触发压缩的问题。

根因是压缩触发与 UI 圆环使用了两套预算口径：压缩触发基于 raw legacy messages estimate，raw estimate 会把 `ncp_parts`、`ncp_message_id`、timestamp 等 session/UI envelope 字段也算进上下文；圆环显示则基于经过工具历史清理和裁剪后的 pruned estimate。因此在 200K context 下，raw 到达旧 160K 阈值时，UI 可能只显示约 40%-50%。

修复方式：

- 新增 canonical context budget owner，先剥离非模型字段，只保留模型输入字段后再估算。
- 压缩触发与圆环显示统一使用 canonical estimate。
- 删除固定 `0.8` 压缩阈值，改为 `contextTokens - reservedContextTokens`。
- 新增 `agents.defaults.reservedContextTokens` 与 per-agent override。显式配置写多少就是多少；未配置时使用 `min(10000, floor(contextTokens * 0.2))`，避免 20K context window 被硬默认 reserve 吃空。
- 实际 NCP model input pruning 使用同一 reserve，并取消额外 4K soft reserve。
- 删除未引用且与 `context.ts` 字节级重复的 `context.service.ts`。
- 在 `nextclaw-ncp-context-builder.ts` 内合并单用途 tool filter helper，避免本次非功能修复继续撑大已超预算文件。

确认方式：

- 本地真实 session 扫描确认低圆环触发现象来自 raw/pruned 差值。
- 新增测试覆盖 envelope 虚高不得触发压缩。
- 新增测试覆盖显式 reserve 精确决定触发点，以及未配置 reserve 时的 `min(10000, floor(contextTokens * 0.2))` 默认数学语义。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw test -- context-compaction-preflight.service.test.ts nextclaw-ncp-context-builder.test.ts`
  - 结果：通过，2 个测试文件，21 个测试。
- `pnpm -C packages/nextclaw-core test -- schema.plugin-channels.test.ts agent-profiles.test.ts provider-runtime-resolution.test.ts schema.remote.test.ts context.test.ts`
  - 结果：通过，5 个测试文件，28 个测试。
- `pnpm -C packages/nextclaw-core tsc`
  - 结果：通过。
- `pnpm -C packages/nextclaw tsc`
  - 结果：通过。
- `pnpm -C packages/nextclaw exec eslint ...`
  - 结果：通过。
- `pnpm -C packages/nextclaw-core exec eslint ...`
  - 结果：0 error，1 个既有 cognitive-complexity warning。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`
  - 结果：通过，0 error，5 warnings；总代码 `+326 / -449 / net -123`，非测试代码 `+200 / -444 / net -244`。
- `pnpm check:governance-backlog-ratchet`
  - 结果：通过。
- `pnpm lint:new-code:governance -- packages/nextclaw/src/cli/commands/ncp/context packages/nextclaw/src/cli/commands/ncp/nextclaw-ncp-context-builder.ts packages/nextclaw-core/src/features/agent/services`
  - 结果：通过。
- 本地真实 session 静态回放：
  - `ncp-mo03kzh6-mhgjuwgu`：canonical used 2315 / trigger 180000，`shouldCompact=false`。
  - `agent:joker:weixin:direct:o9cq804svxfycctiqzdddqrbemc0@im.wechat`：canonical used 7352 / trigger 180000，`shouldCompact=false`。
  - `ncp-mngsdv3n-hryihkpq`：canonical used 10276 / trigger 180000，`shouldCompact=false`。
  - `ncp-mne1i2qj-awu75cu8`：canonical used 454 / trigger 180000，`shouldCompact=false`。
- `pnpm lint:new-code:governance`
  - 结果：未通过；阻塞来自当前已触达的 legacy config 文件命名规则，以及工作区里一个非本次任务的 `nextclaw-openclaw-compat` 改动。已运行并通过本次 context budget 相关路径的 scoped governance；未在本次扩大到治理规则或大规模文件重命名。

## 发布/部署方式

未发布、未部署。

该修复涉及 `@nextclaw/core` 与 `nextclaw` 包源码，后续需要随统一 NPM release 发布。

## 用户/产品视角的验收步骤

1. 配置 200K context 与 `reservedContextTokens: 20000`。
2. 构造包含历史 tool 调用、tool result、NCP envelope 字段的长会话。
3. 当 canonical used context 约为 86K 时，圆环显示约 43%，不得触发 NextClaw compaction。
4. 当 canonical used context 接近 180K 时，才触发 compaction。
5. 压缩触发时，圆环显示与触发判断使用同一个 token 数。
6. 对 20K context window 不配置 `reservedContextTokens` 时，默认 reserve 为 4K，触发点为 16K；显式写 `reservedContextTokens: 20000` 时应作为配置错误处理。

## 可维护性总结汇总

本次使用 `post-edit-maintainability-guard` 与人工可维护性复核。

可维护性动作：

- 职责收敛：新增 canonical budget owner，避免 preflight 内 raw/pruned 双口径并行。
- 删除：移除未引用且重复的 `context.service.ts`。
- 简化：删除固定 `0.8` magic threshold，用 `contextTokens - reservedContextTokens` 表达配置契约。
- 简化：`nextclaw-ncp-context-builder.ts` 合并单用途 `filterTools` helper，本次触达后该超预算文件净减 4 行。

非测试代码净变更为负数，原因是删除了重复生产文件；不是靠压缩语句或隐藏复杂度达成。

保留债务：

- `configs/` 目录下既有文件命名与当前 file-role governance 不一致。
- `nextclaw-ncp-context-builder.ts` 仍超过文件预算，但本次触达后净减 4 行。
- `packages/nextclaw/src/cli/commands/ncp` 目录仍在目录预算边界。

## NPM 包发布记录

未执行 NPM 发布。

涉及包：

- `@nextclaw/core`
- `nextclaw`

状态：待后续统一发布。
