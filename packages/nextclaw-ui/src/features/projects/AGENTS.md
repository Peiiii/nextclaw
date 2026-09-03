# Projects UI boundary

- 本目录拥有 Projects 页面、presenter 和查询状态；工作项与产物来自 Project Work API，Skills 与工作约定来自独立的有界材料 API，组件不得读取项目配置、扫描文件或从会话正文重建项目事实。
- Overview、列表和看板消费同一份工作项查询状态；所有工作项入口统一打开右侧详情抽屉，不得在页面内追加平铺详情。
- `project.work.changed` 只用于失效查询；UI 不重放事件历史，也不以轮询或目录扫描代替业务存储。
- 组件负责连接与展示，跨组件状态归 hook/presenter；用户文案必须走 Projects i18n 资源。
