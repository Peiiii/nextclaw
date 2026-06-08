# v0.20.48-nextclaw-ui-i18n-json-catalog

## 迭代完成说明

- 将 `packages/nextclaw-ui` 主 UI 的 i18n 文案从 TypeScript `{ zh, en }` label 表迁移为 per-locale JSON catalog。
- 新增 `packages/nextclaw-ui/src/shared/lib/i18n/locales/zh-CN/*.json` 与 `en-US/*.json`，按现有领域文件拆为 14 组文案资产。
- 保持现有 `t(key)`、`formatDateTime`、`formatDateShort`、`formatNumber`、语言状态 API 不变，避免同步重命名大量调用点。
- 删除旧 TS 文案表文件，让 `shared/lib/i18n/index.ts` 只负责 catalog assembly、格式化 helper 和稳定翻译入口。
- 新增 `scripts/smoke/i18n/nextclaw-ui-i18n-check.mjs`，校验双语 JSON 文件集合、key 集合和 `{placeholder}` 一致性。

遗留债务：本次只完成 JSON 资产化，没有把历史 flat key 改成 namespaced key。flat key 不是本次引入，后续应按 JSON 文件域渐进迁移到语义命名空间。

## 测试/验证/验收方式

- `node scripts/smoke/i18n/nextclaw-ui-i18n-check.mjs`：通过，14 组 locale 文件对齐。
- `node --check scripts/smoke/i18n/nextclaw-ui-i18n-check.mjs`：通过。
- `pnpm -C packages/nextclaw-ui tsc`：通过。
- `pnpm -C packages/nextclaw-ui lint`：通过，仍有 32 个既有 warning，无本次新增 error。
- `pnpm -C packages/nextclaw-ui build`：通过，Vite 仍提示既有大 chunk warning。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature`：通过。
- `pnpm clean:generated`：通过，生成产物保持 clean。

## 发布/部署方式

不涉及数据库 migration、远程 deploy 或 runtime update。若需要让用户使用，需要随下一次 NextClaw UI / NPM 发布批次交付。

## 用户/产品视角的验收步骤

1. 打开 NextClaw UI。
2. 在语言设置或侧栏语言入口切换中文 / English。
3. 验收标准：原有页面文案仍能正常显示，不出现 i18n key 泄露；语言切换后的文案与本次迁移前一致。
4. 后续新增或修改主 UI 文案时，只改对应 `locales/<locale>/*.json`，并运行 i18n check。

## 可维护性总结汇总

本次遵循先收敛事实源再迁移调用点的策略：`index.ts` 不再承载超大文案表，旧 TS 文案 owner 文件删除，文案资产进入 per-locale JSON。代码增减口径：TS/JS/MJS 代码新增 171 行、删除 1821 行、净减 1650 行；JSON 文案资产新增 2522 行；全量文本新增 2709 行、删除 1824 行、净增 885 行。

`post-edit-maintainability-review` 结论：通过。正向减债动作是删除旧 TS 文案表、收敛 i18n runtime owner 职责，并用脚本校验替代人工记忆。全量文本净增长来自 per-locale JSON 资产化，是本次需求的必要成本，不代表运行逻辑复杂度增加。

## NPM 包发布记录

不涉及 NPM 包发布。
