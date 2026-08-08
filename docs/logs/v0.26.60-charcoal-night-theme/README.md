# 炭夜主题

## 迭代完成说明

- 新增“炭夜 / Charcoal”深色主题，使用抬高黑位的中性炭灰表面、柔和近白文字和克制的清蓝交互色。
- 保留原有“暗夜”主题及用户已保存偏好；新主题复用现有主题选择、持久化和暗色兼容链路。
- 首屏初始化与 PWA 外壳同步识别新主题，刷新页面时不会先闪成浅色背景。
- 新主题 token 独立放在 `packages/nextclaw-ui/src/app/styles/charcoal-theme.css`，避免继续扩大已超预算的 `design-system.css`。
- 首轮真实会话验收遗漏了滚动区上方的用户消息，导致共享聊天皮肤的 `bg-primary` 把炭夜用户气泡和头像渲染成亮蓝色。代码检索、用户截图与浏览器计算样式共同确认根因后，修复落在炭夜主题 owner：复用消息语义类并给头像补充稳定语义类，把内容表面改回炭灰，不改变按钮与选中态的清蓝强调。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ui test -- src/shared/lib/theme/index.test.ts src/features/pwa/managers/__tests__/pwa-shell-theme.manager.test.ts src/features/settings/pages/__tests__/appearance-settings-page.test.tsx`：通过，3 个测试文件共 18 项。
- `pnpm -C packages/nextclaw-ui lint`：通过，无错误；工作区其他在途 UI 改动产生 2 条既有函数长度 warning。
- `pnpm -C packages/nextclaw-ui build`：通过。
- `pnpm -C packages/nextclaw-agent-chat-ui test -- src/components/chat/ui/chat-message-list/chat-message-list.test.tsx`：通过，1 个测试文件共 19 项。
- `pnpm -C packages/nextclaw-agent-chat-ui lint`、`pnpm -C packages/nextclaw-agent-chat-ui tsc`、`pnpm -C packages/nextclaw-ui tsc`：通过。
- 本次触达 TypeScript/TSX 文件的定向 ESLint、`git diff --check` 和中英文 JSON 解析：通过。
- `pnpm check:generated-clean`、maintainability guard、`pnpm check:governance-backlog-ratchet`：通过。Guard 为 0 error、2 warning；消息组件目录已有预算豁免，测试文件 856 行接近 900 行预算，本次只增加 2 行稳定样式钩子断言，后续拆分缝为测试 fixture / builder 与行为用例分离。
- `pnpm lint:new-code:governance`：仅被本迭代未触达的 `packages/nextclaw-kernel/src/managers/__tests__/agent-run-request.manager.test.ts` 参数解构规则阻塞；其余治理检查通过。
- `pnpm release:summary -- --json`：通过，识别 `@nextclaw/ui` 与 `@nextclaw/agent-chat-ui` patch changeset，无图片与发布摘要错误。
- 浏览器真实验收：在 `http://127.0.0.1:5174/appearance` 逐一切换全部 10 套主题并截图检查；在 `/chat` 和真实历史会话检查炭夜主题的 shell、导航、内容、卡片、文字、输入与控件表面。纠偏后同一历史会话中的用户气泡和头像均为 `rgb(43, 43, 43)`，文字为 `rgb(224, 224, 224)`，发送按钮继续保持清蓝色。

## 发布/部署方式

- 本轮未发布、未部署，也未重启现有 NextClaw 实例；直接使用已经运行且指向当前源码的 Vite 开发实例完成热更新验收。
- 已新增 `.changeset/charcoal-night-theme.md`，进入后续统一发布批次。

## 用户/产品视角的验收步骤

1. 打开“设置 → 外观”，在主题列表中选择“炭夜”。
2. 确认页面背景为中性炭灰，侧栏、卡片和输入区之间保留舒适的明度层次，主要操作使用清蓝强调。
3. 返回聊天首页并打开一段历史会话，确认用户消息与头像使用中性炭灰而不是亮蓝色，正文、输入框、滚动区和右侧快捷栏没有固定浅色泄漏。
4. 刷新页面，确认“炭夜”偏好仍保留，浏览器/PWA 外壳背景不会先闪成白色。
5. 切回“暗夜”和其他浅色主题，确认原有配色没有变化。

## 可维护性总结汇总

- 主题状态继续由现有 `UiThemeOwner` 统一拥有，业务组件只消费主题选项和 token，没有新增页面级条件分支、helper、factory 或平行状态链路。
- 新主题样式留在既有 `app/styles` 作用域，并通过唯一全局样式入口导入；没有把视觉规则散落到聊天、设置或 SideDock 组件。
- 应用源码与测试合计 `+125/-5`，净增 120 行；其中非测试生产代码 `+100/-2`，净增 98 行，测试 `+25/-3`，净增 22 行。主要净增来自 85 行独立主题 token，未继续扩大已超预算的全局设计系统文件。
- 本次属于新增用户可见能力，非功能改动的非测试净增门槛不适用；新增代码表达一套完整主题合同，而不是补丁式兼容分支。
- maintainability guard 为 0 error、2 条已披露 warning；主观复核未发现新增 owner 漂移、跨层依赖、重复主题链路或可继续无争议删除的生产代码。没有新增文件或目录膨胀，头像语义类复用现有组件和主题链路。
- 复盘结论：规则已经要求真实整页主题验收，缺口出在首轮截图没有主动把用户消息滚入视口；本次把“用户气泡与头像”补进同迭代验收步骤和稳定语义类测试，不新增重复常驻规则或治理脚本。

## NPM 包发布记录

- `@nextclaw/ui`：需要 patch，新增用户可选择的炭夜主题；当前待统一发布。
- `@nextclaw/agent-chat-ui`：需要 patch，向宿主主题暴露稳定的用户头像语义样式钩子；当前待统一发布。
