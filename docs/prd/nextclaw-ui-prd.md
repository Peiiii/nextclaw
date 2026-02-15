# NextClaw Web UI 产品 PRD（功能版，无界面设计）

版本：v1.0  
日期：2026-02-14  
范围：`packages/nextclaw-ui`

## 1. 背景与目标

### 背景
当前 Web UI 的角色是“配置管理中枢”：用于配置默认模型、AI Provider 连接参数、消息渠道参数。UI 不承担运行时聊天、历史记录、监控等能力。

### 目标
- 让用户在浏览器中完成 **模型 / Provider / 渠道** 的配置与启用
- 保存后给出明确反馈（成功/失败）
- 配置更新后能被动刷新（WebSocket 通知）

### 非目标
- 不做用户登录/鉴权/权限管理
- 不做聊天界面与消息历史
- 不做运行状态面板、告警与可视化监控

## 2. 用户与场景

- 开发者/运维：快速配置 API Key 与渠道参数
- 个人用户：本机部署后用 UI 配置并开启消息渠道

## 3. 功能模块

系统仅包含 3 个一级模块：
1. Models：默认模型与生成参数配置
2. Providers：AI Provider 连接配置
3. Channels：消息渠道配置与启用

## 4. 功能需求

### 4.1 Models（默认模型）
**目的**：设置默认模型名与基础生成参数

**功能**
- 读取当前配置并展示
- 支持编辑并保存

**字段**
- model（文本）
- workspace（文本，当前不持久化）
- maxTokens（数值，当前不持久化）
- temperature（数值，当前不持久化）

**保存行为**
- 调用 `PUT /api/config/model`
- **仅提交 `{ model }`**

**反馈**
- 成功：toast `Configuration saved`
- 失败：toast `Failed to save configuration: {error}`

### 4.2 Providers（AI 提供商）
**目的**：配置 API Key、API Base、额外 Header 等

**功能**
- 展示全部 Provider（来自 `/api/config/meta`）
- 展示已配置 Provider（`apiKeySet=true`）
- 点击进入编辑弹窗

**字段**
- apiKey（可选；输入为空不提交）
- apiBase（可选）
- extraHeaders（可选，键值对）

**保存行为**
- 调用 `PUT /api/config/providers/:provider`
- 仅提交有变更的字段

**反馈**
- 成功：toast `Configuration saved`
- 失败：toast `Failed to save configuration: {error}`

### 4.3 Channels（消息渠道）
**目的**：配置并启用消息渠道

**功能**
- 展示全部渠道（来自 `/api/config/meta`）
- 展示已启用渠道（`enabled=true`）
- 点击进入编辑弹窗
- 支持 Feishu 的“保存并验证/连接”动作

**保存行为**
- 调用 `PUT /api/config/channels/:channel`
- 成功：toast `Configuration saved and applied`
- 失败：toast `Failed to save configuration: {error}`

**Feishu 验证**
- 点击“Save & Verify / Connect”
  - 先保存并强制 `enabled=true`
  - 再调用 `POST /api/channels/feishu/probe`
- 成功：toast `Verified. Please finish Feishu event subscription and app publishing before using.`
- 失败：toast `Verification failed: {error}`

## 5. 渠道字段定义（前端硬编码）

### telegram
- enabled (boolean)
- token (password)
- allowFrom (tags)
- proxy (text)

### discord
- enabled (boolean)
- token (password)
- allowFrom (tags)
- gatewayUrl (text)
- intents (number)

### whatsapp
- enabled (boolean)
- bridgeUrl (text)
- allowFrom (tags)

### feishu
- enabled (boolean)
- appId (text)
- appSecret (password)
- encryptKey (password)
- verificationToken (password)
- allowFrom (tags)

### dingtalk
- enabled (boolean)
- clientId (text)
- clientSecret (password)
- allowFrom (tags)

### slack
- enabled (boolean)
- mode (text)
- webhookPath (text)
- botToken (password)
- appToken (password)

### email
- enabled (boolean)
- consentGranted (boolean)
- imapHost (text)
- imapPort (number)
- imapUsername (text)
- imapPassword (password)
- fromAddress (email)

### mochat
- enabled (boolean)
- baseUrl (text)
- clawToken (password)
- agentUserId (text)
- allowFrom (tags)

### qq
- enabled (boolean)
- appId (text)
- secret (password)
- markdownSupport (boolean)
- allowFrom (tags)

## 6. 数据与接口

### API Base
- 默认：`http://127.0.0.1:18791`
- 可通过 `VITE_API_BASE` 覆盖

### REST API
- `GET /api/config`
- `GET /api/config/meta`
- `PUT /api/config/model`
- `PUT /api/config/providers/:provider`
- `PUT /api/config/channels/:channel`
- `POST /api/channels/feishu/probe`

### WebSocket
- `ws://127.0.0.1:18791/ws`
- 事件：
  - `connection.open`
  - `config.updated`（触发刷新）
  - `error`（仅记录）

## 7. 交互反馈

- Toast：保存成功/失败；Feishu 验证成功/失败
- Loading：加载阶段需有可见提示
- 请求中按钮禁用

## 8. 约束与已知限制

- Model 页面的 workspace / maxTokens / temperature 不持久化
- 渠道字段定义为前端硬编码，不基于动态 schema
- WebSocket 连接状态未在 UI 中显式展示

## 9. 验收标准（功能级）

- 模型、Provider、渠道三模块均可读/写配置
- Provider/Channel 配置保存能触发正确接口
- Feishu 验证链路完整
- WebSocket 收到 `config.updated` 后能刷新配置
