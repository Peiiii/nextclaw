# 使用 Service Apps

Service Apps 按“应用”安装和管理，日常通常从应用的 Panel 使用；**Service Apps** 页面用来查看 Panel 背后真正运行的服务。

## 安装并启用

可以从 Marketplace 或 `.napp` 文件安装应用。启用前先查看它的状态。

```bash
nextclaw app install ./my-app.napp --json
nextclaw app info <app-id> --json
nextclaw app enable <app-id> --json
```

如果状态显示 `needs-configuration` 或 `needs-capability`，说明应用声明了必须完成的设置。请先完成设置；不要把连接信息或 Token 塞进操作输入里绕过它。

## 从 Panel 使用应用

1. 从应用列表打开应用。
2. 第一次执行受保护操作前，阅读它请求的访问权限。
3. 在 Panel 中完成应用要做的事情。
4. 需要查看操作、错误或后台任务时，再回到 **Service Apps** 页面。

Panel 只能调用自己声明的操作。遇到操作授权时，只确认你认识的操作和风险级别。

## 让 Agent 使用一个操作

在 **Service Apps** 中展开服务，找到目标操作，然后把它授权给需要使用它的 Agent。该 Agent 会把同一个已声明操作当作工具发现。撤销授权后，Agent 就不会再看到它。

适合的任务例如：“同步这个仓库的 Issue，再总结未关闭的 Bug”。不要因为 Agent 请求就直接授权危险操作；先看清楚操作名称和风险。

## 从命令行调用同一个操作

命令行会通过与 Panel 相同的宿主，调用一个已启用的已安装应用：

```bash
nextclaw app invoke <app-id> <action-name> --input '{"key":"value"}' --json
```

结果里会带有操作和验证记录标识。要查看这次调用的脱敏运行事实：

```bash
nextclaw app verification --app <app-id> --json
```

## 跟进长时间工作

当一个操作启动了持久化 Job，可以通过 Job id 查看保留的进度和输出。请求取消不代表已经取消；只有运行时确认终态后，Job 才会结束。

```bash
nextclaw app jobs list <app-id> --json
nextclaw app jobs inspect <app-id> <job-id> --json
nextclaw app jobs watch <app-id> <job-id> --json
nextclaw app jobs cancel <app-id> <job-id> --json
```

Resident 应用的死信事件也可以通过同一个宿主查看和重放：

```bash
nextclaw app resident-inbox list <app-id> --dead-letters --json
nextclaw app resident-inbox replay <app-id> <event-id> --json
```

## 更新、回滚或移除

```bash
nextclaw app update <app-id> --version <version> --json
nextclaw app rollback <app-id> --version <installed-version> --json
nextclaw app uninstall <app-id> --json
```

卸载默认保留应用的受管数据。只有显式传入 `--purge-data` 并精确确认 App id 才会永久删除。密钥绑定不会作为应用数据被保留。

接着阅读：[权限与数据](/zh/guide/service-app-permissions-data) · [Service Apps 故障排查](/zh/guide/service-apps-troubleshooting)
