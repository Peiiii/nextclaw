# Projects kernel boundary

- 本目录拥有 Projects 的产品语义、只读观测合同和工作项持久化合同；不要把这些逻辑下沉到 server、service 或 UI。
- Projects 可以读取已注册项目、会话投影、文件和 Skills，但不得依赖 HTTP、前端状态或宿主进程能力。
- 同一事实只保留一条解析与合并主链路。新增抽象层前必须证明它隔离了真实变化点；不要以 wrapper、adapter、manager 的名义复制合同。
- 观测失败必须显式进入 source status、diagnostics 与 data quality；不得用推测值、静默 fallback 或隐式写入伪装完整数据。
- `ProjectWorkManager` 是工作项、状态、历史和 artifact 关联的唯一写入 owner；数据存放在 NextClaw data 目录，不得向项目目录写入 Marker、Skill 或配置。
- 工作项变更先事务提交，再发布 `project.work.changed` 通知；消费者按需查询当前投影，不通过扫描或重放历史事件重建状态。
