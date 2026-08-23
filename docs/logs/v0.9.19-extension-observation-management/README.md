# Extension 管理与会话持续关注

## 迭代完成说明

- 根因：事件已经沿 Observation 投递链路进入会话并持久化，但前端未识别事件扩展片段，导致消息没有可渲染内容而被时间线过滤；同时消息扩展标识错误地带有产品/协议品牌。
- 确认方式：沿 `ObservationDeliveryService → agentRun.send → session messages → UI message adapter → ChatMessageList` 逐段核对，确认服务端已有 `service` 消息，缺口在前端扩展适配和展示。
- 修复：增加全局 Extension 管理页、会话持续关注管理页和时间线外部事件卡片；事件保持 `service` 消息语义，payload 默认折叠；新事件使用通用 `observation.event` 标识，旧标识仅兼容读取。

## 测试/验证/验收方式

- NCP、Kernel、UI TypeScript 检查通过。
- 事件适配、事件卡片渲染、Kernel 模型输入事件测试通过。
- UI lint 通过，仅保留既有消息列表测试文件行数 warning。
- UI 生产构建通过；`docs:i18n:check` 和 `git diff --check` 通过。
- 维护性检查 0 个 error；warnings 为既有大文件/目录预算以及本次触达容器接近预算提示。
- 旧消息列表大套件仍有既有 `AppPresenterProvider` 测试基线问题，未将无关修复混入本迭代。

## 发布/部署方式

- 本次只执行本地提交，不 push、不创建 PR、不发布、不部署、不重启宿主。
- 发布时需要同步消费本 changeset；运行中的宿主通过正常刷新或后续版本启动获得新 UI。

## 用户/产品视角的验收步骤

1. 打开设置，确认可以进入 Extensions 管理并看到 Extension 的运行状态与能力摘要。
2. 打开一个建立了持续关注关系的会话，在工作区查看“持续关注”，确认状态和事件可以分开管理。
3. 触发一个匹配的事件，确认事件出现在会话时间线中，而不是只在后台隐式触发。
4. 确认事件卡片显示事件类型、来源 Extension、发生时间和事件 ID，展开后可以查看 payload。
5. 确认事件卡片不会显示为用户发言，且后续助手回复仍按原会话顺序出现。

## 可维护性总结汇总

- 将事件扩展标识提升为公共消息合同常量，前端和 Kernel 共享同一新语义；会话事件卡片、事件数据校验和 payload 截断各有明确 owner。
- 保留旧标识仅用于迁移读取，新增发送链路只有 `observation.event`，没有新增品牌适配层或平行状态 owner。
- 全局 Extension 管理复用现有 Extension runtime owner；会话持续关注复用 ObservationManager，不复制安装、生命周期或关系语义。
- 自动检查无 error；文件组织 preflight 通过。既有大文件预算 warning 已记录，未为本次功能扩大无关范围。

## NPM 包发布记录

不涉及 NPM 包发布；本次 changeset 标记 `@nextclaw/ui`、`@nextclaw/server` 为 minor，`@nextclaw/kernel`、`@nextclaw/ncp` 为 patch，待统一发布。
