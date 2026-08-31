# Service Apps：权限与数据

安装一个应用，并不代表它自动获得你的电脑、账号或其他应用的访问权限。Portable Runtime 使用“由宿主转交”的方式：应用先声明需要什么，NextClaw 再检查声明和你的配置，最后只把被允许的资源交给运行中的 Component。

## 文件

Portable Component 有一套很小的私有文件空间：

| Guest 路径 | 访问方式 | 用途 |
| --- | --- | --- |
| `/app` | 只读 | 应用打包的资源；存在时才会挂载 |
| `/data` | 可读写 | 应用受管的私有数据 |
| `/cache` | 可读写 | 应用受管的缓存 |
| `/tmp` | 可读写 | 临时文件 |
| `/documents/<scope>` | 由你授权的方式决定 | 应用在 `documentAccess` 中声明的文件夹 |

文件权限会声明一个 scope 和允许的最高模式。安装应用时不会自动授权。需要使用文件功能时，可在“应用”页面的“文件与文件夹”区域选择运行主机上的目录，并决定只读或读写；也可以随时替换目录或撤销访问。读写授权会直接修改所选目录里的原始文件，不会先复制到 NextClaw。

命令行使用同一套授权记录：

```bash
nextclaw app permissions inspect <app-id>
nextclaw app permissions document grant <app-id> --scope <scope-id> --path <directory> --mode read|read-write
nextclaw app permissions document revoke <app-id> --scope <scope-id>
```

NextClaw 会把目录规范化并确认它真实存在。应用只能看到 `/documents/<scope>`，看不到宿主路径；只读授权不能写入。替换或撤销会停止旧的运行实例，新调用不会继续持有原目录。授权记录在 NextClaw 重启后仍会保留；目录被移动或磁盘离线时会显示为不可用，需要替换或撤销。

没有目录授权时，应用仍可使用自己的 `/data`、`/cache` 和 `/tmp`。这些目录位于 NextClaw 管理的应用实例中，和你的 Documents、桌面或项目目录不是一回事。

## 网络与密钥

应用要先声明需要访问的网站域名。网络访问只会发往这些域名，重定向后的目标也会检查。运行时策略会拒绝私有网络目标。

密钥是命名槽位，不是明文输入框。通过已安装应用查看和配置：

```bash
nextclaw app secrets inspect <app-id> --json
nextclaw app secrets bind <app-id> --slot <slot> --source env|file|exec --id <secret-id> --json
nextclaw app secrets verify <app-id> --json
```

`verify` 只会告诉你槽位能否使用，不会返回值。必需密钥缺失或无法读取时，应用不能启用。更换或移除绑定后，Component 会带着新的能力快照重新启动；密钥本身不会保存在应用数据、命令参数、Panel 输出或验证记录中。

## 模型、Agent、Provider 与外部服务

应用可以声明非敏感的模型或 Agent 槽位。只绑定你希望该应用使用的、已经配置好的模型或 Agent：

```bash
nextclaw app ai-capabilities inspect <app-id> --json
nextclaw app ai-capabilities bind <app-id> --kind model|agent --slot <slot> --target <id> --json
nextclaw app ai-capabilities verify <app-id> --json
```

应用也可以需要 Provider 或外部资源。这是保留的例外，不是推荐安装方式：自包含应用更容易安装、更新和移除。缺少依赖时，NextClaw 会明确显示并保持应用未启用；它不会把清单中的连接字符串或凭据当作已经完成设置。

```bash
nextclaw app dependencies inspect <app-id> --json
nextclaw app dependencies setup <app-id> --json
nextclaw app dependencies verify <app-id> --json
```

只有恰好存在一个兼容 Provider 时，`setup` 才会自动绑定。有多个候选时，请用 `dependencies bind` 明确选择，或使用 Provider 自己的设置操作。得到授权后，Agent 可以使用同一套管理入口；不要要求非技术用户去学习某个 Provider 专有的配置流程。

## 应用生命周期中的数据

应用数据按应用实例隔离。更新和回滚会保留受管实例，除非应用自己的迁移另有说明。卸载默认保留受管数据，因此重新安装同一个应用时可以恢复。只有同时指定 `--purge-data` 并精确确认 App id 才会永久删除。

用 `nextclaw app data list --json` 查看活动和保留的数据。只有确认要永久删除时，才执行 `nextclaw app data delete <data-id> --confirm <app-id> --json`。

## Agent 权限是另一层

把一个 Service Action 授权给 Agent，并不代表它拿到了该应用的所有权限。Agent 只获得这个操作声明的接口；文件夹、密钥、模型、Provider 和外部资源仍由各自的授权和绑定控制。

相关页面：[使用 Service Apps](/zh/guide/service-apps-usage) · [Service Apps 故障排查](/zh/guide/service-apps-troubleshooting)
