# UI 静态资源缓存设计

## 背景

NextClaw 当前为所有 UI 静态文件返回 `Cache-Control: no-store`。即使文件位于 `assets/` 且名称包含构建内容哈希，浏览器在同一版本内刷新时仍会重复下载完整 JS/CSS。

## 设计

- 已存在且文件名带构建哈希的 `/assets/*` 资源返回 `public, max-age=31536000, immutable`。
- `index.html`、SPA fallback、无哈希静态文件和 `/api/ui-inject.js` 继续返回 `no-store`。
- 缺失的旧 JS chunk 继续返回自动刷新模块，并保持 `no-store`，避免缓存恢复响应。
- 缓存策略由 NextClaw UI server 统一负责，不依赖 Nginx 或具体部署环境。

内容变化会产生新的哈希文件名；HTML 保持不可缓存，因此升级后浏览器会取得新 HTML 并加载新资源。旧页面请求已移除 chunk 时，现有恢复链路仍会触发页面刷新。

## 非目标

- 不缓存 API、会话数据或用户数据。
- 不改变 UI 构建产物命名和 Service Worker 策略。
- 不为无哈希文件启用长期缓存。

## 验证

- 哈希 JS/CSS 返回一年期 `immutable`。
- 无哈希资源和 SPA 页面仍为 `no-store`。
- 缺失旧 chunk 的刷新模块仍为 `no-store`。
- `@nextclaw/server` 定向测试和 TypeScript 检查通过。
