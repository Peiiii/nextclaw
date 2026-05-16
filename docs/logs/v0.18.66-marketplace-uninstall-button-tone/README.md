# v0.18.66 Marketplace Uninstall Button Tone

## 迭代完成说明

- 将 marketplace / skill 卡片里的卸载按钮默认态从红色降级为中性灰色。
- 保留 hover 态的温和红色提示，让危险语义只在用户靠近操作时出现。
- 未改变卸载确认流程与管理动作逻辑。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw-ui exec eslint src/features/marketplace/components/marketplace-list-card.tsx`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/features/marketplace/components/marketplace-list-card.tsx`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `git diff --check`

## 发布/部署方式

- 未发布。
- 本次是本地 UI 视觉调整，后续随前端或统一发布批次发布即可。

## 用户/产品视角的验收步骤

1. 打开 marketplace / skill 列表。
2. 找到已安装且可卸载的 skill 卡片。
3. 确认卸载按钮默认态为中性灰色，不再常驻红色。
4. 悬停按钮时确认出现温和红色提示。
5. 点击卸载后确认仍进入原有确认流程。

## 可维护性总结汇总

- 本次是非功能视觉调整，非测试代码净增为 `0`。
- 只替换现有按钮 class，未新增文件、分支、状态或平行组件。
- 可维护性 guard 结果：无 findings。
- 目录与文件组织满足当前 governance。

## NPM 包发布记录

- 不涉及 NPM 包发布。
