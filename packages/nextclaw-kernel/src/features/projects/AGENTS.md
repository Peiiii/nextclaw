# Projects kernel boundary

- 本目录拥有 Projects 的产品语义、配置/Marker 解析、事实合并和只读观测合同；不要把这些逻辑下沉到 server、service 或 UI。
- Projects 可以读取已注册项目、会话投影、文件和 Skills，但不得依赖 HTTP、前端状态或宿主进程能力。
- 同一事实只保留一条解析与合并主链路。新增抽象层前必须证明它隔离了真实变化点；不要以 wrapper、adapter、manager 的名义复制合同。
- 观测失败必须显式进入 source status、diagnostics 与 data quality；不得用推测值、静默 fallback 或隐式写入伪装完整数据。
- V1 默认只读。任何持久化、创建/编辑工作项或主动订阅都属于新的设计决策，不能借局部改动顺带加入。
