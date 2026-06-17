# v0.20.82 Agent Avatar Brand Treatment

## 迭代完成说明

本次优化主 Agent 默认头像的视觉风格：

- 当 `agentId` 为 `main` 且没有配置自定义头像图片时，默认头像使用主题主色 `bg-primary` 作为墨绿色背景。
- 主 Agent 的 Bot 图标使用 `text-primary-foreground`，和主题色形成清晰对比。
- 自定义 `avatarUrl` 优先级不变，用户配置的图片头像不会被覆盖。
- 其它 specialist agent 继续使用原有 palette 字母头像，不扩大影响范围。

根因：主 Agent fallback 图标此前复用 hash palette 的浅色背景，和当前 NextClaw 品牌体系不够一致。

确认方式：通过 `AgentAvatar` 单测锁定主 Agent fallback 样式，并用本地页面 DOM 验证 `Main` avatar 的计算背景色为 `rgb(93, 107, 82)`。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/ui test -- src/shared/components/common/__tests__/agent-avatar.test.tsx`
- `pnpm --filter @nextclaw/ui tsc`
- `pnpm --filter @nextclaw/ui lint`
- `pnpm lint:new-code:governance -- --files packages/nextclaw-ui/src/shared/components/common/agent-avatar.tsx packages/nextclaw-ui/src/shared/components/common/__tests__/agent-avatar.test.tsx`
- `git diff --check -- packages/nextclaw-ui/src/shared/components/common/agent-avatar.tsx packages/nextclaw-ui/src/shared/components/common/__tests__/agent-avatar.test.tsx`
- Playwright headless DOM 验证 `http://127.0.0.1:5174/chat` 中 `Main` avatar 使用 `bg-primary text-primary-foreground`，保留 Bot SVG，且不显示字母 fallback。

## 发布/部署方式

不涉及单独部署；需要随下一次 NPM 批次发布 `@nextclaw/ui` patch。

## 用户/产品视角的验收步骤

1. 打开 chat 新会话欢迎页或 Agent 选择器。
2. 确认主 Agent 默认图标为墨绿色背景和浅色 Bot 图标。
3. 确认配置了自定义头像 URL 的 Agent 仍显示图片。
4. 确认其它 Agent 仍显示原来的字母 fallback 头像。

## 可维护性总结汇总

本次是小型用户可见样式优化，改动收敛在共享展示 owner `AgentAvatar`：

- 没有修改欢迎页装饰图标或业务逻辑。
- 没有新增组件、wrapper 或平行头像实现。
- 将主 Agent 判断提取为局部 `isMainAgent`，避免重复计算。
- 顺手将触达测试文件里的跨目录相对 import 改为 `@/` alias，符合当前 module contract。

代码增减报告：

- 总代码增减：新增 8 行，删除 3 行，净增 +5 行。
- 非测试代码增减：新增 5 行，删除 2 行，净增 +3 行。

这是用户可见 UI 优化，非功能 `<= 0` 门槛不适用；改动范围保持在单一展示 owner 内。

## NPM 包发布记录

需要发布 `@nextclaw/ui` patch，因为本次改变用户可见的 Agent 默认头像样式。已添加 `.changeset/agent-avatar-brand-treatment.md`，状态为待统一发布。
