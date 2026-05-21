# NextClaw UI 前端交接文档（Phase 1）

目标：让前端团队/模型直接据此实现“系统配置界面”。

## 1. 项目目标（第一阶段）

- 只做“系统配置”页面：模型配置 + provider 配置 + 渠道配置
- 不做聊天 UI、日志 UI、插件管理
- 后端已提供 UI API（Hono，网关复用）

## 2. 页面结构建议

- 顶部：应用名 + 运行状态（本地）
- 左侧：配置分类
  - 模型
  - Providers
  - Channels
  - UI（可选）
- 右侧：表单内容

## 3. 后端 API 对接

详见：`docs/designs/2026-02-12-ui-gateway-api.md`

重点接口：

- `GET /api/config`：获取当前配置（含脱敏）
- `GET /api/config/meta`：获取 providers/channels 列表
- `PUT /api/config/model`
- `PUT /api/config/providers/:provider`
- `PUT /api/config/channels/:channel`
- `PUT /api/config/ui`（可选）

## 4. 表单交互规范

### 4.1 模型配置

字段：
- `agents.defaults.model`

提交：
- `PUT /api/config/model`

### 4.2 Provider 配置

字段：
- `apiKey`（敏感）
- `apiBase`（可选）
- `extraHeaders`（键值对）

交互规则：
- 如果 `apiKeySet = true`，输入框显示为空，但提示“已设置”（或显示 `apiKeyMasked`）
- 若用户希望清空，提交 `apiKey: ""`
- 若未修改 apiKey，不提交 apiKey 字段

### 4.3 Channel 配置

字段动态渲染：
- 先调用 `GET /api/config/meta` 获取 channel 列表
- 对常用通道做基础字段
  - `enabled`（开关）
  - `token` / `appId` / `appSecret` / `allowFrom` 等

通道字段建议从 `GET /api/config` 中读取并原样编辑

### 4.4 UI 配置（可选）

字段：
- `host` / `port` / `open`

### 4.5 Channel 字段清单（建议 UI 呈现）

说明：字段来源 `packages/nextclaw/src/config/schema.ts`。

- WhatsApp: `enabled`, `bridgeUrl`, `allowFrom`
- Telegram: `enabled`, `token`, `allowFrom`, `proxy`
- Discord: `enabled`, `token`, `allowFrom`, `gatewayUrl`, `intents`
- Feishu: `enabled`, `appId`, `appSecret`, `encryptKey`, `verificationToken`, `allowFrom`
- DingTalk: `enabled`, `clientId`, `clientSecret`, `allowFrom`
- Slack: `enabled`, `mode`, `webhookPath`, `botToken`, `appToken`, `groupPolicy`, `groupAllowFrom`, `dm.enabled`, `dm.policy`, `dm.allowFrom`
- Email: `enabled`, `consentGranted`, `imapHost`, `imapPort`, `imapUsername`, `imapPassword`, `imapMailbox`, `imapUseSsl`, `smtpHost`, `smtpPort`, `smtpUsername`, `smtpPassword`, `smtpUseTls`, `smtpUseSsl`, `fromAddress`, `autoReplyEnabled`, `pollIntervalSeconds`, `markSeen`, `maxBodyChars`, `subjectPrefix`, `allowFrom`
- QQ: `enabled`, `appId`, `secret`, `allowFrom`

### 4.6 表单校验与提交规则

- 数字字段需做基础校验（如端口、intents、各类 *Ms 参数、pollIntervalSeconds）。
- `allowFrom` 建议用“标签输入”或逗号分隔转数组。
- `extraHeaders` 建议用 Key/Value 编辑器。
- 保存时只提交用户修改过的字段（避免覆盖未展示的字段）。
- 字符串清空：传空字符串；nullable 字段清空：传 `null`。

### 4.7 Provider 表单呈现建议

- Provider 列表来自 `GET /api/config/meta`。
- `apiBase` 若为空，可提示默认值（来自 `defaultApiBase`）。
- 如果 `apiKeySet` 为 true：
  - 输入框留空但展示 “已设置” 或 `apiKeyMasked`
  - 未修改时不要提交 `apiKey`

### 4.8 失败处理与用户提示

- `NOT_FOUND`：提示“未知 Provider/Channel”
- `INVALID_BODY`：高亮对应字段
- `WRITE_FAILED`：提示“配置写入失败”
- `RELOAD_FAILED`：提示“重载失败，可重试”

## 5. 数据格式示例

### GET /api/config（示例）

```json
{
  "ok": true,
  "data": {
    "agents": { "defaults": { "model": "minimax/MiniMax-M2.5" } },
    "providers": {
      "minimax": {
        "apiKeySet": true,
        "apiKeyMasked": "sk-****abcd",
        "apiBase": "https://api.minimaxi.com/v1",
        "extraHeaders": null
      }
    },
    "channels": {
      "discord": { "enabled": false, "token": "" }
    }
  }
}
```

### PUT /api/config/providers/minimax（示例）

```json
{ "apiKey": "sk-xxx", "apiBase": "https://api.minimaxi.com/v1" }
```

## 6. 前端状态管理建议

- 页面初始化：先拉 `GET /api/config` + `GET /api/config/meta`
- 表单提交后：
  - 本地更新状态
  - 或重新拉取配置
- WebSocket 可选订阅（Phase 1 可忽略）

## 7. UI 设计原则（建议）

- 信息密度高，专业工具风格
- 支持中英文标签（中文优先）
- 对敏感字段（apiKey）做隐藏/确认提示

## 8. 非目标提醒

- 不做聊天功能
- 不做多用户
- 不做远程访问

## 9. 本地开发说明

- 后端 UI 默认端口：`55667`
- 前端 dev server 可用 `http://localhost:5173`
- CORS 已允许本地访问
