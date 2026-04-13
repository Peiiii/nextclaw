# Maintainability Hotspot Freeze

## 目标

把仓库内已经确认的 maintainability 红区从“大家知道它危险”升级为“有固定清单、有明确边界、有默认留痕要求”的治理机制。

本文件对应仓库治理方案中的 `Phase 2: Hotspot Freeze`，与以下文件配套：

- 红区数据源：[`scripts/governance/maintainability-hotspots.mjs`](../../scripts/governance/maintainability-hotspots.mjs)
- 默认守卫：[`post-edit-maintainability-guard`](../../.agents/skills/post-edit-maintainability-guard/SKILL.md)
- 上层方案：[`2026-03-19-repo-maintainability-governance-plan.md`](../plans/2026-03-19-repo-maintainability-governance-plan.md)

## 默认规则

1. 红区文件清单以 [`scripts/governance/maintainability-hotspots.mjs`](../../scripts/governance/maintainability-hotspots.mjs) 为准。
2. 触达红区文件时，不允许继续把 unrelated logic 塞进原文件。
3. 触达红区文件时，必须在本次 `docs/logs/v<semver>-<slug>/README.md` 增加 `## 红区触达与减债记录`。
4. `红区触达与减债记录` 下必须为每个被触达的红区文件写一个独立块，标题格式固定为 `### <repo-path>`。
5. 每个红区块必须至少包含三行：
   - `- 本次是否减债：是/否`
   - `- 说明：...`
   - `- 下一步拆分缝：...`
6. 默认通过 `post-edit-maintainability-guard` 在收尾阶段校验这条规则；缺失日志或格式不完整视为阻塞项。

## 当前首批红区

- `packages/nextclaw-core/src/agent/loop.ts`
- `packages/nextclaw/src/cli/commands/diagnostics.ts`
- `packages/nextclaw-server/src/ui/router/chat.controller.ts`
- `packages/nextclaw-server/src/ui/config.ts`
- `packages/extensions/nextclaw-channel-runtime/src/channels/discord.ts`
- `packages/extensions/nextclaw-channel-runtime/src/channels/telegram.ts`
- `packages/extensions/nextclaw-channel-runtime/src/channels/mochat.ts`
- `packages/nextclaw-ui/src/components/config/ProviderForm.tsx`

以上文件的链路归属、允许新增职责、禁止新增职责、下一步拆分缝，以数据源文件中的定义为准。

## 日志模板

```md
## 红区触达与减债记录

### packages/nextclaw/src/cli/commands/diagnostics.ts
- 本次是否减债：否
- 说明：本次只修复诊断字段映射错误，未继续向文件内增加新的编排阶段。
- 下一步拆分缝：拆出 diagnostics collector 与 user-facing renderer。
```

## 日常使用

- 查看当前红区清单：`node scripts/governance/maintainability-hotspots.mjs`
- 只看指定红区：`node scripts/governance/maintainability-hotspots.mjs --paths packages/nextclaw/src/cli/commands/diagnostics.ts`
- 代码任务收尾：`node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`

## 何时更新红区清单

- 某文件持续成为 maintainability report 热点
- 某文件明显已经无法一句话说清职责
- 某文件位于主链路，且继续增长会显著提高后续改动风险
- 某文件已拆分稳定，不再需要红区冻结时

更新红区清单时，必须同步：

- 更新 [`scripts/governance/maintainability-hotspots.mjs`](../../scripts/governance/maintainability-hotspots.mjs)
- 更新本文件中的首批红区列表
- 在对应迭代 README 中记录为什么新增、移除或调整红区
