# Service Apps

Service Apps 让 NextClaw 应用不只是一个界面。它可以在 Panel 背后保存数据、访问已批准的网站、读取你明确授权的文件夹、持续处理后台工作，或者把某个操作交给指定的 Agent。

你仍然像使用普通应用一样从 Panel 开始。Service Apps 的作用是让结果可以保存下来，并且在合适的时候，让同一个操作也能被 Agent 或命令行调用。

## 它能帮你做什么

每个应用只会声明自己需要的能力。启用前，NextClaw 会展示权限和配置状态。

| 需求 | 应用可以做什么 | 仍由你控制的部分 |
| --- | --- | --- |
| 保存工作 | 保存应用自己的记录、设置、缓存或数据库 | 数据属于该应用实例，可随应用保留或删除 |
| 使用文件 | 只读取或修改你授权的文件夹 | 安装应用不等于它能浏览其他文件夹 |
| 连接服务 | 只访问应用声明的网站域名 | 不在声明列表内的网络请求会被拒绝 |
| 使用 Token | 为 GitHub 等服务使用一个命名的密钥槽位 | Token 不会出现在 Panel、操作结果或诊断记录里 |
| 后台运行 | 接收可恢复的 Resident 事件，或执行长时间 Job | 你可以查看进度、重放失败事件或请求取消 Job |
| 与 Agent 协作 | 让指定 Agent 发现并调用某个声明的操作 | Agent 按操作授权，随时可以撤销 |
| 组合应用 | 使用声明的 Provider 或明确配置的外部资源 | 依赖缺失或有多个候选时，应用不会悄悄猜测后启用 |

Portable Runtime 是面向 WebAssembly Component 的 Service Apps 运行方式。它适合把应用逻辑和数据处理一起打包，并在支持的平台上使用同一份应用包。确实需要平台程序或较重外部集成的应用，仍可以使用 native-process Service。

## 在哪里使用

打开 NextClaw 的 **Service Apps** 页面，可以看到已安装服务、它们提供的操作、运行状态和请求的访问权限。日常使用时，从应用自己的 Panel 开始。第一次调用受保护操作时可能需要确认；确认后，Panel 会通过 NextClaw 调用服务，而不是直接访问你的系统。

想先看一个完整的日常例子，可以阅读 [GitHub Issue Watcher](/zh/guide/service-apps-github-issue-watcher)。具体步骤见 [使用 Service Apps](/zh/guide/service-apps-usage)。

## 启用前请确认

1. 阅读应用说明和它请求的权限。
2. 如果它需要文件夹，只选择你愿意分享的文件夹；能只读就不要给写入权限。
3. 如果它需要密钥，在 NextClaw 中把请求的槽位绑定到已配置的密钥。不要把值粘贴到应用清单或 Panel 里。
4. 如果它需要模型、Agent、Provider 或外部资源，选择你希望它使用的对象。必要配置没完成时，NextClaw 会保持应用未启用。
5. 启用应用，然后从 Panel 或已经授权的操作开始使用。

应用请求文件、网络、密钥或外部依赖时，请先阅读 [权限与数据](/zh/guide/service-app-permissions-data)。

## 出问题时

应用可能因为没有授权、缺少配置、输入不正确，或服务停止而失败。NextClaw 会保留错误代码和简要原因，不会把所有问题都混成同一种失败。

先看 [Service Apps 故障排查](/zh/guide/service-apps-troubleshooting)。如果应用正在做长时间工作，请先查看已保存的 Job 进度，不要直接重复执行。

## 相关页面

- [使用 Service Apps](/zh/guide/service-apps-usage)
- [权限与数据](/zh/guide/service-app-permissions-data)
- [GitHub Issue Watcher](/zh/guide/service-apps-github-issue-watcher)
- [面向开发者的 Portable Runtime](/zh/developers/portable-runtime)
