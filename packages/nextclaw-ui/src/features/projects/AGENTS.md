# Projects UI boundary

- 本目录拥有 Projects 页面、presenter、查询状态和用户回复编排；事实来源只能是 `client.projects` 的公共快照，组件不得自行扫描文件或解析 Marker。
- 页面默认只读；确认/拒绝只复用现有 agent-run 消息入口，并携带可追踪、可幂等的响应元数据，不创建第二套 response bridge。
- Overview、列表、看板、甘特图和详情必须消费同一份 snapshot，不为视图复制业务状态或推断缺失阶段、日期与进度。
- 组件负责连接与展示，跨组件状态归 hook/presenter；用户文案必须走 Projects i18n 资源。
