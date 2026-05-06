# 配置手册

配置手册解释 NextClaw 的配置面。它不是新手第一步；如果你还没跑通，先看 [快速开始](/zh/guide/getting-started)。

## 配置分成几类

### 模型提供方

决定 NextClaw 调用哪个模型服务。包括 provider、API base、认证方式、默认模型。

相关指南：

- [配置模型提供方](/zh/guide/model-selection)
- [先选接入方式](/zh/guide/tutorials/provider-options)

### 渠道

决定用户从哪里进入 NextClaw，例如本地 UI、聊天平台或其他入口。

相关指南：

- [接入聊天入口](/zh/guide/channels)

### 密钥

保存 API Key、token 和其他敏感信息。密钥应该集中管理，避免直接散落在普通文档和聊天记录里。

相关手册：

- [密钥管理](/zh/guide/secrets)

### 自动化

决定哪些任务可以按计划触发，以及是否需要绑定会话上下文。

相关指南：

- [运行自动化](/zh/guide/cron)

## 配置修改后如何确认

```bash
nextclaw status
nextclaw doctor
```

如果配置未生效，先看 [故障排查](/zh/guide/troubleshooting)。

## 什么时候用命令改配置

普通用户优先使用 UI。  
当你需要脚本化、远程维护或精确修改配置路径时，再使用 `nextclaw config`。

完整命令见 [命令索引](/zh/guide/commands)。
