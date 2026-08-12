# v0.32.1 工作台上下文连续性

## 迭代完成说明

本批闭合两条会话工作台上下文链路。

第一条让 Doc Browser 中可寻址的文档、Apps、Panel App 和网页 Tab 可以通过统一右键/更多菜单添加到聊天。引用进入 Composer 原子 Token、NCP 消息 metadata、历史消息回显和 Kernel Context Provider，同一资源发送后仍可识别并重新打开；不可寻址页面不生成伪引用。

第二条修复项目文件树刷新只更新根目录、展开与滚动状态依赖组件未卸载、以及“全部折叠”不稳定的问题。项目树现在只持久化按项目隔离的相对展开路径和滚动位置，不缓存目录事实；手动刷新覆盖根目录和全部 active 展开查询。新增的实时同步使用显式 watch action、浅层按需文件监听和既有 App Event WebSocket，只监听根目录与当前可见展开目录，并在面板卸载或租约到期后释放资源。

## 测试与验收

- `@nextclaw/shared`、`@nextclaw/kernel`、`@nextclaw/agent-chat-ui`、`@nextclaw/client-sdk`、`@nextclaw/server` 与 `@nextclaw/ui` 的受影响 TypeScript 检查通过。
- UI 资源引用定向测试覆盖菜单资格、Composer 协议、复制剪切粘贴、消息回显、历史点击和 Kernel 上下文注入。
- 项目文件树 24 项 UI 定向测试通过，覆盖根与展开目录刷新、全部折叠、跨重挂载展开/滚动恢复和实时 query 失效。
- 服务端 watcher 生命周期测试通过，覆盖浅层 watcher 复用、80ms 事件合并、订阅更新与释放。
- 触达文件 targeted ESLint、`git diff --check` 通过；diff-only 可维护性闸门 0 error。目录浏览器越界告警已通过抽取独立项目树视图组件消除，其余为既有预算例外或接近预算提醒。

## 性能与降级边界

- 不递归扫描整个项目，不监听未展开的深层目录，不使用后台轮询。
- 单订阅最多监听 64 个目录，全局最多 256 个浅层 watcher；同目录事件 80ms 合并。
- 前端每 2 分钟续租，服务端 5 分钟回收失联订阅；正常卸载会立即取消。
- 自动监听不可用时不会伪装成已同步，手动刷新继续作为明确兜底。

## 发布记录

- 用户可见变化已写入 changeset，涉及 `@nextclaw/shared`、`@nextclaw/agent-chat-ui`、`@nextclaw/kernel`、`@nextclaw/client-sdk`、`@nextclaw/server` 与 `@nextclaw/ui` 的 patch。
- 本批只提交源码与发布说明，未执行 NPM publish、runtime update channel、Desktop 发布或宿主重启。
