// i18n labels - Chinese primary, English fallback
export const LABELS: Record<string, { zh: string; en: string }> = {
  // Navigation
  model: { zh: '模型', en: 'Model' },
  providers: { zh: '提供商', en: 'Providers' },
  channels: { zh: '渠道', en: 'Channels' },

  // Common
  enabled: { zh: '启用', en: 'Enabled' },
  disabled: { zh: '禁用', en: 'Disabled' },
  save: { zh: '保存', en: 'Save' },
  cancel: { zh: '取消', en: 'Cancel' },
  delete: { zh: '删除', en: 'Delete' },
  add: { zh: '添加', en: 'Add' },
  edit: { zh: '编辑', en: 'Edit' },
  loading: { zh: '加载中...', en: 'Loading...' },
  success: { zh: '成功', en: 'Success' },
  error: { zh: '错误', en: 'Error' },

  // Model
  modelName: { zh: '模型', en: 'Model' },
  workspace: { zh: '工作空间', en: 'Workspace' },
  maxTokens: { zh: '最大 Token 数', en: 'Max Tokens' },
  maxToolIterations: { zh: '最大工具迭代次数', en: 'Max Tool Iterations' },

  // Provider
  apiKey: { zh: 'API 密钥', en: 'API Key' },
  apiBase: { zh: 'API Base', en: 'API Base' },
  extraHeaders: { zh: '额外请求头', en: 'Extra Headers' },
  wireApi: { zh: '请求接口', en: 'Wire API' },
  wireApiAuto: { zh: '自动（优先 Chat，必要时 Responses）', en: 'Auto (Chat with fallback)' },
  wireApiChat: { zh: 'Chat Completions', en: 'Chat Completions' },
  wireApiResponses: { zh: 'Responses', en: 'Responses' },
  apiKeySet: { zh: '已设置', en: 'Set' },
  apiKeyNotSet: { zh: '未设置', en: 'Not Set' },
  showKey: { zh: '显示密钥', en: 'Show Key' },
  hideKey: { zh: '隐藏密钥', en: 'Hide Key' },

  // Channel
  allowFrom: { zh: '允许来源', en: 'Allow From' },
  token: { zh: 'Token', en: 'Token' },
  botToken: { zh: 'Bot Token', en: 'Bot Token' },
  appToken: { zh: 'App Token', en: 'App Token' },
  appId: { zh: 'App ID', en: 'App ID' },
  appSecret: { zh: 'App Secret', en: 'App Secret' },
  markdownSupport: { zh: 'Markdown 支持', en: 'Markdown Support' },
  clientId: { zh: 'Client ID', en: 'Client ID' },
  clientSecret: { zh: 'Client Secret', en: 'Client Secret' },
  encryptKey: { zh: '加密密钥', en: 'Encrypt Key' },
  verificationToken: { zh: '验证令牌', en: 'Verification Token' },
  bridgeUrl: { zh: '桥接 URL', en: 'Bridge URL' },
  gatewayUrl: { zh: '网关 URL', en: 'Gateway URL' },
  proxy: { zh: '代理', en: 'Proxy' },
  intents: { zh: 'Intents', en: 'Intents' },
  mode: { zh: '模式', en: 'Mode' },
  webhookPath: { zh: 'Webhook 路径', en: 'Webhook Path' },
  groupPolicy: { zh: '群组策略', en: 'Group Policy' },
  consentGranted: { zh: '同意条款', en: 'Consent Granted' },
  imapHost: { zh: 'IMAP 服务器', en: 'IMAP Host' },
  imapPort: { zh: 'IMAP 端口', en: 'IMAP Port' },
  imapUsername: { zh: 'IMAP 用户名', en: 'IMAP Username' },
  imapPassword: { zh: 'IMAP 密码', en: 'IMAP Password' },
  imapMailbox: { zh: 'IMAP 邮箱', en: 'IMAP Mailbox' },
  imapUseSsl: { zh: 'IMAP 使用 SSL', en: 'IMAP Use SSL' },
  smtpHost: { zh: 'SMTP 服务器', en: 'SMTP Host' },
  smtpPort: { zh: 'SMTP 端口', en: 'SMTP Port' },
  smtpUsername: { zh: 'SMTP 用户名', en: 'SMTP Username' },
  smtpPassword: { zh: 'SMTP 密码', en: 'SMTP Password' },
  smtpUseTls: { zh: 'SMTP 使用 TLS', en: 'SMTP Use TLS' },
  smtpUseSsl: { zh: 'SMTP 使用 SSL', en: 'SMTP Use SSL' },
  fromAddress: { zh: '发件地址', en: 'From Address' },
  autoReplyEnabled: { zh: '自动回复已启用', en: 'Auto Reply Enabled' },
  pollIntervalSeconds: { zh: '轮询间隔(秒)', en: 'Poll Interval (s)' },
  markSeen: { zh: '标记为已读', en: 'Mark Seen' },
  maxBodyChars: { zh: '最大正文字符数', en: 'Max Body Chars' },
  subjectPrefix: { zh: '主题前缀', en: 'Subject Prefix' },
  baseUrl: { zh: 'Base URL', en: 'Base URL' },
  socketUrl: { zh: 'Socket URL', en: 'Socket URL' },
  socketPath: { zh: 'Socket 路径', en: 'Socket Path' },
  socketDisableMsgpack: { zh: '禁用 Msgpack', en: 'Disable Msgpack' },
  socketReconnectDelayMs: { zh: '重连延迟(ms)', en: 'Reconnect Delay (ms)' },
  socketMaxReconnectDelayMs: { zh: '最大重连延迟(ms)', en: 'Max Reconnect Delay (ms)' },
  socketConnectTimeoutMs: { zh: '连接超时(ms)', en: 'Connect Timeout (ms)' },
  refreshIntervalMs: { zh: '刷新间隔(ms)', en: 'Refresh Interval (ms)' },
  watchTimeoutMs: { zh: '监视超时(ms)', en: 'Watch Timeout (ms)' },
  watchLimit: { zh: '监视限制', en: 'Watch Limit' },
  retryDelayMs: { zh: '重试延迟(ms)', en: 'Retry Delay (ms)' },
  maxRetryAttempts: { zh: '最大重试次数', en: 'Max Retry Attempts' },
  clawToken: { zh: 'Claw Token', en: 'Claw Token' },
  agentUserId: { zh: '代理用户ID', en: 'Agent User ID' },
  sessions: { zh: '会话', en: 'Sessions' },
  panels: { zh: '面板', en: 'Panels' },
  mentionRequireInGroups: { zh: '群组中需要@', en: 'Require Mention in Groups' },
  groups: { zh: '群组', en: 'Groups' },
  replyDelayMode: { zh: '回复延迟模式', en: 'Reply Delay Mode' },
  replyDelayMs: { zh: '回复延迟(ms)', en: 'Reply Delay (ms)' },
  secret: { zh: '密钥', en: 'Secret' },

  // UI
  saveVerifyConnect: { zh: '保存并验证 / 连接', en: 'Save & Verify / Connect' },

  // Status
  connected: { zh: '已连接', en: 'Connected' },
  disconnected: { zh: '未连接', en: 'Disconnected' },
  connecting: { zh: '连接中...', en: 'Connecting...' },
  feishuConnecting: { zh: '验证 / 连接中...', en: 'Verifying / connecting...' },

  // Messages
  configSaved: { zh: '配置已保存', en: 'Configuration saved' },
  configSavedApplied: { zh: '配置已保存并已应用', en: 'Configuration saved and applied' },
  configSaveFailed: { zh: '保存配置失败', en: 'Failed to save configuration' },
  configReloaded: { zh: '配置已重载', en: 'Configuration reloaded' },
  configReloadFailed: { zh: '重载配置失败', en: 'Failed to reload configuration' },
  feishuVerifySuccess: {
    zh: '验证成功，请到飞书开放平台完成事件订阅与发布后再开始使用。',
    en: 'Verified. Please finish Feishu event subscription and app publishing before using.'
  },
  feishuVerifyFailed: { zh: '验证失败', en: 'Verification failed' },
  enterTag: { zh: '输入后按回车...', en: 'Type and press Enter...' },
  headerName: { zh: 'Header 名称', en: 'Header Name' },
  headerValue: { zh: 'Header 值', en: 'Header Value' }
};

export function t(key: string, lang: 'zh' | 'en' = 'en'): string {
  return LABELS[key]?.[lang] || LABELS[key]?.en || key;
}
