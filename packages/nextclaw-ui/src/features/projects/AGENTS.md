# Projects UI boundary

- 本目录拥有 Projects 页面、presenter、查询状态和用户回复编排；项目观测事实来自 `client.projects` 公共快照，工作项来自 Project Work API，组件不得自行扫描文件或解析 Marker。
- 页面默认只读；确认/拒绝只复用现有 agent-run 消息入口，并携带可追踪、可幂等的响应元数据，不创建第二套 response bridge。
- Overview、列表和看板消费同一份工作项查询状态；所有工作项入口统一打开右侧详情抽屉，不得在页面内追加平铺详情。
- `project.work.changed` 只用于失效查询；UI 不重放事件历史，也不以轮询或目录扫描代替业务存储。
- 组件负责连接与展示，跨组件状态归 hook/presenter；用户文案必须走 Projects i18n 资源。
