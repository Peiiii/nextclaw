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

### 隐私与匿名统计

NextClaw 默认发送匿名使用统计，用于估算当日、当前自然周和当前自然月的活跃安装及成功活跃。每个周期使用互不关联的随机单次回执，不发送账号、登录令牌或长期安装标识，也不包含消息、回复、工具数据、文件、URL、IP、User-Agent 或诊断日志。

你可以在 **设置 → 隐私与统计** 中随时关闭。关闭后，NextClaw 会停止发送并清除本地待发送回执。服务端已有数据只有匿名汇总，无法按安装反查或删除。统计结果是活跃安装估算，不等于精确人数；WAU 和 MAU 分别采用自然周和自然月，而不是滚动 7/30 日窗口。

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
