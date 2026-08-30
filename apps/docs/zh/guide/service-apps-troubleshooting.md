# Service Apps 故障排查

先看应用状态和准确的错误代码。应用正在做后台工作时，不要反复启用或重复调用；保存下来的 Job 和 Resident 记录可以告诉你之前的请求是否仍在执行，还是需要恢复。

## 应用无法启用

| 看到的状态 | 怎么处理 |
| --- | --- |
| `needs-configuration` | 检查必需密钥、模型或 Agent 槽位，以及文件夹授权；补齐后再验证。 |
| `needs-capability` | 检查依赖。只有一个兼容 Provider 时可以自动绑定；有多个时请明确选择。 |
| `SECRET_BINDING_MISSING` | 绑定提示的必需密钥槽位，再运行 `nextclaw app secrets verify <app-id> --json`。 |
| `SECRET_RESOLUTION_FAILED` | 不暴露密钥值的前提下检查密钥来源，然后重新验证槽位。 |

常用命令：

```bash
nextclaw app info <app-id> --json
nextclaw app secrets inspect <app-id> --json
nextclaw app ai-capabilities inspect <app-id> --json
nextclaw app dependencies inspect <app-id> --json
```

## 操作失败

| 代码 | 含义 | 下一步 |
| --- | --- | --- |
| `WASI_CAPABILITY_DENIED` | Component 请求了未被授权的访问 | 检查文件夹、域名、存储或声明能力 |
| `WASI_INPUT_SCHEMA_MISMATCH` | 操作输入不符合声明格式 | 修正输入，不要原样重试 |
| `WASI_GUEST_EXPORT_MISSING` | 应用声明了 Component 没有暴露的操作 | 更新或重新安装匹配版本的应用 |
| `WASI_ABI_VERSION_MISMATCH` | Component 和宿主合同不兼容 | 更新应用或 NextClaw 到兼容版本 |
| `WASI_COMPONENT_TRAP` | Component 意外停止 | 查看脱敏观察记录，并把错误代码交给应用作者 |
| `WASI_COMPONENT_FAILED` | 发生了其他 Component 运行错误 | 查看观察记录；修复其中的原因后再重试 |

优先查看保存的观察记录，不要把敏感输入复制到支持信息里：

```bash
nextclaw app verification --app <app-id> --json
```

## 长时间 Job 或 Resident 事件卡住

```bash
nextclaw app jobs list <app-id> --json
nextclaw app jobs watch <app-id> <job-id> --json
nextclaw app resident-inbox list <app-id> --dead-letters --json
```

只有不再需要这项工作时才请求取消。Job 必须等运行时确认后才会变成已取消。修复原因后可以重放死信 Resident 事件；事件至少投递一次，因此应用应当能安全处理重复投递。

## 仍然无法解决

收集 App id、App 版本、操作或 Job id、错误代码和脱敏验证记录。不要在报告中附上密钥值、Token 或私有文档内容。
