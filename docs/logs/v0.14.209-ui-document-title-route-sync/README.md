# v0.14.209 UI document title route sync

## 迭代完成说明

- 根因：`index.html` 中静态 `<title>NextClaw - 系统配置</title>` 在 SPA 路由切换时从未更新；调试日志在 `/chat` 下仍观察到 `documentTitle` 为「NextClaw - 系统配置」。
- 改动：将默认标题改为 `NextClaw`；在 `AppLayout` 中按 `pathname`（及语言）调用 `resolveUiDocumentTitle` 同步 `document.title`；路由与现有 i18n 页面标题键对齐。
- 同步更新打包产物目录下的 `index.html` 默认标题，避免未走 JS 的壳层仍长期显示旧文案。

## 测试/验证/验收方式

- 打开 UI，进入 `/chat`，检查浏览器标签或窗口标题为「NextClaw - 对话」（中文）或对应英文，且不含「系统配置」。
- 进入设置子路由（如 `/model`），标题应对应页面语义；返回 `/chat` 后标题应恢复为对话页。
- 调试验证已完成；已移除 `AppLayout` / `BrandHeader` 中的调试上报代码。

## 发布/部署方式

- 按常规前端构建链路发布；若依赖 `packages/nextclaw/ui-dist`，需随 `nextclaw-ui` 一并构建以刷新静态 HTML。

## 用户/产品视角的验收步骤

1. 从设置页返回聊天主页。
2. 确认标签栏/窗口标题不再固定为「NextClaw - 系统配置」，主页显示与「对话」一致的标题。
