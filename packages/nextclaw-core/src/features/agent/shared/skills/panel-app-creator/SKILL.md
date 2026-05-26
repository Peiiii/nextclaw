---
name: panel-app-creator
description: Create or update NextClaw single-file HTML Panel Apps shown in the right-side Panel Apps view. Use for lightweight dashboards, tools, forms, boards, visualizations, calculators, and disposable UI experiments.
description_zh: 创建或修改 NextClaw 右侧面板里的单文件 HTML Panel App。适用于轻量 dashboard、工具、表单、看板、可视化、计算器和可随时丢弃的临时 UI。
---

# NextClaw Panel App Creator

当用户想做一个轻量 UI、小工具、dashboard、todo board、表单、计算器、数据可视化或一次性 HTML 应用时，优先使用这个 skill。

## 输出位置

- Panel App 必须写入 NextClaw workspace 的 `panels/` 目录。
- 默认 workspace 是 `~/.nextclaw/workspace`；如果当前任务能读取 NextClaw 配置，则以 `agents.defaults.workspace` 为准。
- 文件名必须使用 kebab-case，并以 `.panel.html` 结尾，例如 `todo-board.panel.html`。

## 文件形态

- 每个 Panel App 只允许一个 HTML 文件。
- CSS 和 JavaScript 默认内联在同一个 HTML 文件里。
- 不创建 manifest、不创建多文件资源目录、不要求服务器部署。
- 不假设存在未声明的 bridge、SDK 或宿主注入对象；需要 AI 动作时，可以先做按钮和占位交互，再说明后续需要接入正式 API。

## 实现建议

1. 明确用户要解决的实际工作流，不把临时工具做成复杂产品。
2. 生成完整可打开的 HTML：`<!doctype html>`、`<meta charset="utf-8">`、响应式布局、可访问的按钮和输入。
3. 本地状态优先用 `localStorage`；需要导入导出时，用文本框、复制、下载 JSON 等浏览器原生能力。
4. 视觉保持克制、清晰、信息密度适中，避免营销页式 hero 和装饰性堆叠。
5. 完成后告诉用户在 NextClaw 左下角设置菜单打开“面板应用”，再选择对应应用。
