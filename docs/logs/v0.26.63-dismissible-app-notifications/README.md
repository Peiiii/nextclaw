# 全局通知独立关闭操作

## 迭代完成说明

- 根因：通用通知展示层把整张卡片实现为单一 `Link`，底层 `AppNotificationManager` 虽然已经提供 `dismiss` 生命周期能力，界面却没有把它暴露成独立操作，导致用户只能打开目标内容或等待通知自动消失。
- 确认方式：沿 `ChatCompletionNotificationManager -> AppNotificationManager -> AppNotificationToast` 主链路核对，确认通知 manager 已将 `onDismiss` 交给组件，缺口仅存在于组件交互结构；原组件测试也只覆盖了点击链接后关闭，没有覆盖“只关闭、不跳转”。
- 根因修复：通知卡片改为容器内的正文链接与关闭按钮两个同级控件。右上角关闭按钮始终可见，点击只 dismiss 当前通知；正文点击继续 dismiss 并进入目标会话。无目标路由的信息通知同样可以关闭。
- 关闭按钮复用共享 `IconActionButton`，使用中英文 i18n 文案、32px 点击面、明确的 hover/focus 状态与 tooltip；没有嵌套交互元素，也没有新增通知 store、队列或第二条生命周期链路。
- 同步修订原通知设计文档，并刷新官网与版本更新说明共用的中英文真实产品截图；截图场景会在正文链接和关闭按钮都可见后才落盘。

## 测试/验证/验收方式

- UI 定向测试：通知组件、通用 manager、后台完成事件 manager、应用运行时连接与聊天页连接共 5 个测试文件、13 项通过。
- 关键行为测试覆盖：关闭按钮与正文链接是独立控件；Tab 可分别聚焦；点击关闭时路由保持不变；点击正文才跳转；无路由通知仍可关闭。
- TypeScript：`pnpm --filter @nextclaw/ui tsc` 通过。
- ESLint：通知组件、manager、相关测试与截图场景配置定向检查通过，0 error。
- 生产构建：`pnpm --filter @nextclaw/ui build` 通过；仅有既有 Browserslist 数据过期与大 chunk 警告。
- 真实浏览器视觉验收：通过当前源码 Vite 实例与 Playwright 重生成 `background-session-notification-en/zh` 两个场景；脚本真实等待可导航正文和关闭按钮后截图。人工检查确认关闭按钮未遮挡标题或摘要、卡片仍为实体背景、Side Dock 避让正常。
- 视觉资产合同：中英文源图均为 3024×1656；`images/screenshots/` 与 `apps/landing/public/` 对应镜像 SHA-256 一致。
- 截图脚本首次运行被旧欢迎语锚点阻断；已更新为当前产品中英文欢迎语后重跑通过，没有回退到 mock 概念图。
- 官网构建：`pnpm --filter @nextclaw/landing build` 通过；通知截图镜像可以被当前 landing 构建正常打包。
- 发布素材合同：`pnpm release:summary -- --json` 通过，`dismissible-app-notifications` 的中英文图片均被发现，`errors` 为空。
- 治理：`pnpm lint:new-code:governance` 与 `pnpm check:governance-backlog-ratchet` 通过；全仓仅报告一项已有说明的 context-provider 扁平目录 warning，与本次通知改动无关。

## 发布/部署方式

- 已添加 `@nextclaw/ui` patch changeset，并通过 `release-note-image` 指令绑定本次中英文通知截图，供后续统一版本更新说明自动发现。
- 本次功能、测试、设计、截图与发布记录随本迭代提交；未推送、未部署，也未重启用户正在运行的 NextClaw 实例。真实视觉验收使用脚本启动并自动退出的隔离 Vite 进程。

## 用户/产品视角的验收步骤

1. 在会话 A 启动任务，并在任务结束前切换到其它会话或页面。
2. 等待右上角出现后台任务完成通知，确认卡片右上角始终显示关闭按钮。
3. 点击关闭按钮，确认通知消失，当前页面和路由不变，对应会话内容不被打开。
4. 再触发一条通知并点击正文，确认通知消失且进入对应会话。
5. 使用 Tab 依次聚焦通知正文与关闭按钮，确认两者都有可见焦点状态且 Enter 可执行对应操作。

## 可维护性总结汇总

- 复用了既有 `AppNotificationManager` dismiss 生命周期和共享 `IconActionButton`，没有复制关闭按钮样式、增加局部 timer，或把通知队列搬进 React 组件。
- 组件只负责展示与两个用户动作，manager 继续负责 Sonner 生命周期，Chat manager 继续负责后台完成事件语义；owner 边界未发生漂移。
- 本次是新增用户操作能力，定向 maintainability guard 使用 feature 模式检查 5 个源码、脚本与测试文件：总代码 `+96/-23，净增 73`，非测试代码 `+66/-17，净增 49`，0 error、0 warning；生产净增长用于显式表达两个同级操作、无障碍文案和稳定截图验收，不存在兼容分支或平行实现。
- 主观复核删除了未使用的 `group` 状态和不必要的强制 hover tone，保留默认主题交互色；没有新增 effect、状态、helper 文件或目录层级。
- 文件、函数与目录预算均未触线，命名与角色保持现有 `notifications/components`、`notifications/managers` 和 product screenshot config 合同。

## NPM 包发布记录

- `@nextclaw/ui` 当前版本 `0.15.21`，需要随后续统一发布进入一个 patch 版本。
- 当前状态：未在本次任务中发布，标记为 `待统一发布`。
