export type I18nLanguage = 'zh' | 'en';

const I18N_STORAGE_KEY = 'nextclaw.ui.language';

export const LANGUAGE_OPTIONS: Array<{ value: I18nLanguage; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' }
];

const LANGUAGE_TO_LOCALE: Record<I18nLanguage, string> = {
  en: 'en-US',
  zh: 'zh-CN'
};

let activeLanguage: I18nLanguage = 'en';
let initialized = false;
const listeners = new Set<(lang: I18nLanguage) => void>();

function isLanguage(value: unknown): value is I18nLanguage {
  return value === 'en' || value === 'zh';
}

function detectBrowserLanguage(): I18nLanguage {
  if (typeof navigator === 'undefined') {
    return 'en';
  }
  const preferred = navigator.language?.toLowerCase() ?? 'en';
  return preferred.startsWith('zh') ? 'zh' : 'en';
}

export function resolveInitialLanguage(): I18nLanguage {
  if (typeof window === 'undefined') {
    return 'en';
  }

  try {
    const saved = window.localStorage.getItem(I18N_STORAGE_KEY);
    if (isLanguage(saved)) {
      return saved;
    }
  } catch {
    // ignore storage failures
  }

  return detectBrowserLanguage();
}

export function initializeI18n(): I18nLanguage {
  if (!initialized) {
    activeLanguage = resolveInitialLanguage();
    initialized = true;
  }
  return activeLanguage;
}

export function getLanguage(): I18nLanguage {
  return initialized ? activeLanguage : initializeI18n();
}

export function setLanguage(lang: I18nLanguage): void {
  initializeI18n();
  if (activeLanguage === lang) {
    return;
  }

  activeLanguage = lang;

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(I18N_STORAGE_KEY, lang);
    } catch {
      // ignore storage failures
    }
  }

  listeners.forEach((listener) => listener(lang));
}

export function subscribeLanguageChange(listener: (lang: I18nLanguage) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLocale(lang: I18nLanguage = getLanguage()): string {
  return LANGUAGE_TO_LOCALE[lang];
}

export function formatDateTime(value?: string | Date, lang: I18nLanguage = getLanguage()): string {
  if (!value) {
    return '-';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === 'string' ? value : '-';
  }

  return date.toLocaleString(getLocale(lang));
}

export function formatDateShort(value?: string | Date, lang: I18nLanguage = getLanguage()): string {
  if (!value) {
    return '-';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === 'string' ? value : '-';
  }

  return new Intl.DateTimeFormat(getLocale(lang), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

export function formatNumber(value: number, lang: I18nLanguage = getLanguage()): string {
  return new Intl.NumberFormat(getLocale(lang)).format(value);
}

export const LABELS: Record<string, { zh: string; en: string }> = {
  // Navigation
  chat: { zh: '对话', en: 'Chat' },
  model: { zh: '模型', en: 'Model' },
  providers: { zh: '提供商', en: 'Providers' },
  channels: { zh: '渠道', en: 'Channels' },
  cron: { zh: '定时任务', en: 'Cron Jobs' },
  secrets: { zh: '密钥管理', en: 'Secrets' },
  runtime: { zh: '路由与运行时', en: 'Routing & Runtime' },
  marketplace: { zh: '市场', en: 'Marketplace' },

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
  confirm: { zh: '确认', en: 'Confirm' },
  unchanged: { zh: '未修改', en: 'Unchanged' },
  saving: { zh: '保存中...', en: 'Saving...' },
  remove: { zh: '移除', en: 'Remove' },
  all: { zh: '全部', en: 'All' },
  prev: { zh: '上一页', en: 'Prev' },
  next: { zh: '下一页', en: 'Next' },
  noneOption: { zh: '无', en: 'None' },
  language: { zh: '语言', en: 'Language' },
  theme: { zh: '主题', en: 'Theme' },
  themeWarm: { zh: '暖色', en: 'Warm' },
  themeCool: { zh: '冷色', en: 'Cool' },
  isRequired: { zh: '必填', en: 'is required' },
  duplicate: { zh: '重复', en: 'duplicate' },
  notFound: { zh: '未找到', en: 'not found' },

  // Model
  modelPageTitle: { zh: '模型配置', en: 'Model Configuration' },
  modelPageDescription: { zh: '配置默认 AI 模型和运行参数限制', en: 'Configure default AI model and runtime limits' },
  defaultModel: { zh: '默认模型', en: 'Default Model' },
  workspace: { zh: '工作空间', en: 'Workspace' },
  generationParameters: { zh: '生成参数', en: 'Generation Parameters' },
  modelName: { zh: '模型', en: 'Model' },
  maxTokens: { zh: '最大 Token 数', en: 'Max Tokens' },
  maxToolIterations: { zh: '最大工具迭代次数', en: 'Max Tool Iterations' },
  saveChanges: { zh: '保存变更', en: 'Save Changes' },

  // Provider
  providersPageTitle: { zh: 'AI 提供商', en: 'AI Providers' },
  providersLoading: { zh: '加载中...', en: 'Loading...' },
  providersTabConfigured: { zh: '已配置', en: 'Configured' },
  providersTabAll: { zh: '全部提供商', en: 'All Providers' },
  providersDefaultDescription: { zh: '为你的 Agent 配置 AI 服务', en: 'Configure AI services for your agents' },
  providersEmptyTitle: { zh: '尚未配置提供商', en: 'No providers configured' },
  providersEmptyDescription: { zh: '添加一个 AI 提供商后即可开始使用。', en: 'Add an AI provider to start using the platform.' },
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
  providerFormDescription: { zh: '配置 AI 提供商的 API 密钥与参数', en: 'Configure API keys and parameters for AI provider' },
  enterApiKey: { zh: '请输入 API 密钥', en: 'Enter API Key' },
  leaveBlankToKeepUnchanged: { zh: '留空则保持不变', en: 'Leave blank to keep unchanged' },

  // Channel
  channelsPageTitle: { zh: '消息渠道', en: 'Message Channels' },
  channelsLoading: { zh: '加载渠道中...', en: 'Loading channels...' },
  channelsTabEnabled: { zh: '已启用', en: 'Enabled' },
  channelsTabAll: { zh: '全部渠道', en: 'All Channels' },
  channelsEmptyTitle: { zh: '暂无启用渠道', en: 'No channels enabled' },
  channelsEmptyDescription: { zh: '启用一个消息渠道以开始接收消息。', en: 'Enable a messaging channel to start receiving messages.' },
  channelDescriptionDefault: { zh: '配置该通信渠道', en: 'Configure this communication channel' },
  channelDescTelegram: { zh: '连接 Telegram 机器人以进行即时消息收发', en: 'Connect with Telegram bots for instant messaging' },
  channelDescSlack: { zh: '接入 Slack 工作区进行团队协作消息处理', en: 'Integrate with Slack workspaces for team collaboration' },
  channelDescEmail: { zh: '通过邮件协议收发消息', en: 'Send and receive messages via email protocols' },
  channelDescWebhook: { zh: '接收 HTTP Webhook 以支持自定义集成', en: 'Receive HTTP webhooks for custom integrations' },
  channelDescDiscord: { zh: '将 Discord 机器人连接到你的社区服务器', en: 'Connect Discord bots to your community servers' },
  channelDescFeishu: { zh: '企业消息与协作平台接入', en: 'Enterprise messaging and collaboration platform' },
  configureMessageChannelParameters: { zh: '配置消息渠道参数', en: 'Configure message channel parameters' },
  channelsGuideTitle: { zh: '查看指南', en: 'View Guide' },
  allowFrom: { zh: '允许来源', en: 'Allow From' },
  token: { zh: 'Token', en: 'Token' },
  botToken: { zh: 'Bot Token', en: 'Bot Token' },
  appToken: { zh: 'App Token', en: 'App Token' },
  appId: { zh: 'App ID', en: 'App ID' },
  corpId: { zh: '企业 ID', en: 'Corp ID' },
  agentId: { zh: '应用 Agent ID', en: 'Agent ID' },
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
  callbackPort: { zh: '回调端口', en: 'Callback Port' },
  callbackPath: { zh: '回调路径', en: 'Callback Path' },
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
  accountId: { zh: '账号 ID', en: 'Account ID' },
  dmPolicy: { zh: '私聊策略', en: 'DM Policy' },
  groupAllowFrom: { zh: '群组允许来源', en: 'Group Allow From' },
  requireMention: { zh: '需要 @ 提及', en: 'Require Mention' },
  mentionPatterns: { zh: '提及匹配规则', en: 'Mention Patterns' },
  groupRulesJson: { zh: '群组规则（JSON）', en: 'Group Rules (JSON)' },
  allowBotMessages: { zh: '允许机器人消息', en: 'Allow Bot Messages' },
  attachmentMaxSizeMb: { zh: '附件最大体积（MB）', en: 'Attachment Max Size (MB)' },
  streamingMode: { zh: '流式模式', en: 'Streaming Mode' },
  draftChunkingJson: { zh: '草稿分块（JSON）', en: 'Draft Chunking (JSON)' },
  textChunkLimit: { zh: '文本分块上限', en: 'Text Chunk Limit' },
  invalidJson: { zh: 'JSON 格式无效', en: 'Invalid JSON' },

  // Runtime
  runtimePageTitle: { zh: '路由与运行时', en: 'Routing & Runtime' },
  runtimePageDescription: { zh: '对齐 OpenClaw 的多 Agent 路由：绑定规则、Agent 池、私聊范围。', en: 'Align multi-agent routing with OpenClaw: bindings, agent pool, and DM scope.' },
  runtimeLoading: { zh: '加载运行时配置中...', en: 'Loading runtime settings...' },
  dmScope: { zh: '私聊范围', en: 'DM Scope' },
  dmScopeHelp: { zh: '控制私聊会话如何隔离。', en: 'Control how direct-message sessions are isolated.' },
  defaultContextTokens: { zh: '默认上下文 Token', en: 'Default Context Tokens' },
  defaultContextTokensHelp: { zh: '当 Agent 未设置单独值时使用该上下文预算。', en: 'Input context budget for agents when no per-agent override is set.' },
  maxPingPongTurns: { zh: '最大乒乓轮次', en: 'Max Ping-Pong Turns' },
  maxPingPongTurnsHelp: { zh: '设为 0 可阻止 Agent 间自动 ping-pong。', en: 'Set to 0 to block automatic agent-to-agent ping-pong loops.' },
  agentList: { zh: 'Agent 列表', en: 'Agent List' },
  agentListHelp: { zh: '在同一个网关进程中运行多个固定角色 Agent。', en: 'Run multiple fixed-role agents in one gateway process.' },
  bindings: { zh: '绑定规则', en: 'Bindings' },
  bindingsHelp: { zh: '根据渠道 + 账号 + 对端将入站消息路由到目标 Agent。', en: 'Route inbound message by channel + account + peer to target agent.' },
  agentIdRequiredError: { zh: 'agents.list[{index}].id 必填', en: 'agents.list[{index}].id is required' },
  duplicateAgentId: { zh: '重复的 agent id', en: 'Duplicate agent id' },
  bindingAgentIdRequired: { zh: 'bindings[{index}].agentId 必填', en: 'bindings[{index}].agentId is required' },
  bindingAgentIdNotFound: { zh: 'bindings[{index}].agentId 未在 agents.list/main 中找到', en: "bindings[{index}].agentId not found in agents.list/main" },
  bindingChannelRequired: { zh: 'bindings[{index}].match.channel 必填', en: 'bindings[{index}].match.channel is required' },
  bindingPeerIdRequired: { zh: '设置 peer.kind 时，bindings[{index}].match.peer.id 必填', en: 'bindings[{index}].match.peer.id is required when peer.kind is set' },
  agentIdPlaceholder: { zh: 'Agent ID（例如 engineer）', en: 'Agent ID (e.g. engineer)' },
  workspaceOverridePlaceholder: { zh: '工作空间覆盖（可选）', en: 'Workspace override (optional)' },
  modelOverridePlaceholder: { zh: '模型覆盖（可选）', en: 'Model override (optional)' },
  maxTokensPlaceholder: { zh: '最大 tokens', en: 'Max tokens' },
  contextTokensPlaceholder: { zh: '上下文 tokens', en: 'Context tokens' },
  maxToolsPlaceholder: { zh: '最大工具次数', en: 'Max tools' },
  defaultAgent: { zh: '默认 Agent', en: 'Default agent' },
  addAgent: { zh: '添加 Agent', en: 'Add Agent' },
  targetAgentIdPlaceholder: { zh: '目标 Agent ID', en: 'Target agent ID' },
  channelPlaceholder: { zh: '渠道（例如 discord）', en: 'Channel (e.g. discord)' },
  accountIdOptionalPlaceholder: { zh: '账号 ID（可选）', en: 'Account ID (optional)' },
  peerKindOptional: { zh: '对端类型（可选）', en: 'Peer kind (optional)' },
  peerIdPlaceholder: { zh: '对端 ID（需先设置对端类型）', en: 'Peer ID (requires peer kind)' },
  addBinding: { zh: '添加绑定', en: 'Add Binding' },
  saveRuntimeSettings: { zh: '保存运行时设置', en: 'Save Runtime Settings' },

  // Secrets
  secretsPageTitle: { zh: '密钥管理', en: 'Secrets Management' },
  secretsPageDescription: {
    zh: '集中管理 secrets.providers、secrets.defaults 与 secrets.refs。',
    en: 'Manage secrets.providers, secrets.defaults, and secrets.refs in one place.'
  },
  secretsEnabledHelp: {
    zh: '关闭后不会解析 `{{secret:*}}` 引用。',
    en: 'When disabled, `{{secret:*}}` refs are not resolved.'
  },
  defaultEnvProvider: { zh: '默认 Env 提供器', en: 'Default Env Provider' },
  defaultFileProvider: { zh: '默认 File 提供器', en: 'Default File Provider' },
  defaultExecProvider: { zh: '默认 Exec 提供器', en: 'Default Exec Provider' },
  secretProvidersTitle: { zh: 'Secret Providers', en: 'Secret Providers' },
  secretProvidersDescription: {
    zh: '定义可复用的 secrets provider（env/file/exec）。',
    en: 'Define reusable secret providers (env/file/exec).'
  },
  providerAlias: { zh: '提供器别名', en: 'Provider Alias' },
  removeProvider: { zh: '移除提供器', en: 'Remove Provider' },
  envPrefix: { zh: '环境变量前缀', en: 'Environment Prefix' },
  secretFilePath: { zh: 'Secrets 文件路径', en: 'Secrets File Path' },
  secretExecCommand: { zh: '执行命令', en: 'Exec Command' },
  secretExecArgs: { zh: '命令参数（每行一个）', en: 'Exec Args (one per line)' },
  secretExecCwd: { zh: '执行目录（可选）', en: 'Exec Working Directory (optional)' },
  secretExecTimeoutMs: { zh: '超时（毫秒）', en: 'Timeout (ms)' },
  addSecretProvider: { zh: '添加 Provider', en: 'Add Provider' },
  secretRefsTitle: { zh: 'Secret Refs', en: 'Secret Refs' },
  secretRefsDescription: {
    zh: '把配置路径映射到 secret 引用（source/provider/id）。',
    en: 'Map config paths to secret refs (source/provider/id).'
  },
  secretConfigPath: { zh: '配置路径', en: 'Config Path' },
  secretId: { zh: 'Secret ID', en: 'Secret ID' },
  secretProviderAlias: { zh: 'Provider 别名', en: 'Provider Alias' },
  addSecretRef: { zh: '添加 Ref', en: 'Add Ref' },

  // Sessions
  sessionsPageTitle: { zh: '会话管理', en: 'Sessions' },
  sessionsPageDescription: {
    zh: '管理会话：筛选、按渠道分组、查看历史、改标签/偏好模型、清空和删除。',
    en: 'Manage sessions: filter, group by channel, inspect history, edit metadata, clear, and delete.'
  },
  sessionsFiltersTitle: { zh: '筛选', en: 'Filters' },
  sessionsFiltersDescription: { zh: '按关键词、活跃窗口和分组方式筛选会话。', en: 'Filter sessions by query, activity window, and grouping mode.' },
  sessionsSearchPlaceholder: { zh: '搜索 key 或标签', en: 'Search session key or label' },
  sessionsActiveMinutesPlaceholder: { zh: '活跃分钟（0=不限）', en: 'Active minutes (0 = no limit)' },
  sessionsLimitPlaceholder: { zh: '展示上限', en: 'Limit' },
  sessionsGroupModeLabel: { zh: '分组方式', en: 'Grouping' },
  sessionsGroupModeAll: { zh: '不分组 / 全部', en: 'All (No grouping)' },
  sessionsGroupModeByChannel: { zh: '按渠道分组', en: 'Group by channel' },
  sessionsListTitle: { zh: '会话列表', en: 'Session list' },
  sessionsTotalLabel: { zh: '总数', en: 'Total' },
  sessionsCurrentLabel: { zh: '当前展示', en: 'Showing' },
  sessionsLoading: { zh: '加载会话中...', en: 'Loading sessions...' },
  sessionsEmpty: { zh: '暂无会话。', en: 'No sessions yet.' },
  sessionsKeyLabel: { zh: '键', en: 'Key' },
  sessionsChannelLabel: { zh: '渠道', en: 'Channel' },
  sessionsMessagesLabel: { zh: '消息数', en: 'Messages' },
  sessionsUpdatedLabel: { zh: '更新时间', en: 'Updated' },
  sessionsLastRoleLabel: { zh: '最后角色', en: 'Last Role' },
  sessionsLabelPlaceholder: { zh: '会话标签（可选）', en: 'Session label (optional)' },
  sessionsModelPlaceholder: { zh: '偏好模型（可选）', en: 'Preferred model (optional)' },
  sessionsShowHistory: { zh: '查看历史', en: 'View history' },
  sessionsHideHistory: { zh: '隐藏历史', en: 'Hide history' },
  sessionsSaveMeta: { zh: '保存元信息', en: 'Save metadata' },
  sessionsClearHistory: { zh: '清空历史', en: 'Clear history' },
  sessionsDeleteConfirm: { zh: '确认删除会话', en: 'Delete session' },
  sessionsHistoryTitle: { zh: '历史', en: 'History' },
  sessionsHistoryDescription: { zh: '最近 200 条消息（展示窗口）。', en: 'Latest 200 messages (display window).' },
  sessionsHistoryLoading: { zh: '加载历史中...', en: 'Loading history...' },
  sessionsApplyingChanges: { zh: '正在应用会话变更...', en: 'Applying session changes...' },
  sessionsUnknownChannel: { zh: '未知渠道', en: 'Unknown channel' },
  sessionsAllChannels: { zh: '全部渠道', en: 'All Channels' },
  sessionsMetadata: { zh: '元信息', en: 'Metadata' },
  sessionsNoSelectionTitle: { zh: '未选择会话', en: 'No Session Selected' },
  sessionsNoSelectionDescription: {
    zh: '从左侧列表选择一个会话以查看聊天历史并配置其元信息。',
    en: 'Select a session from the list on the left to view its chat history and configure its metadata.'
  },

  // Chat
  chatPageTitle: { zh: 'Agent 对话', en: 'Agent Chat' },
  chatPageDescription: {
    zh: '在 UI 内直接与 Agent 交互，支持多会话与多 Agent 切换。',
    en: 'Chat with your agent directly in UI with multi-session and multi-agent switching.'
  },
  chatRefresh: { zh: '刷新', en: 'Refresh' },
  chatNewSession: { zh: '新会话', en: 'New Session' },
  chatSearchSessionPlaceholder: { zh: '搜索会话 key / 标签', en: 'Search session key / label' },
  chatAgentLabel: { zh: '目标 Agent', en: 'Target Agent' },
  chatSelectAgent: { zh: '选择 Agent', en: 'Select Agent' },
  chatSessionLabel: { zh: '当前会话', en: 'Current Session' },
  chatNoSession: { zh: '未选择会话', en: 'No session selected' },
  chatNoSessionHint: { zh: '创建一个会话并发送第一条消息。', en: 'Create a session and send your first message.' },
  chatHistoryLoading: { zh: '加载会话历史中...', en: 'Loading session history...' },
  chatNoMessages: { zh: '暂无消息，发送一条开始对话。', en: 'No messages yet. Send one to start.' },
  chatTyping: { zh: 'Agent 正在思考...', en: 'Agent is thinking...' },
  chatInputPlaceholder: { zh: '输入消息，Enter 发送，Shift + Enter 换行', en: 'Type a message, Enter to send, Shift + Enter for newline' },
  chatInputHint: { zh: '支持多轮上下文，默认走当前会话。', en: 'Multi-turn context is preserved in the current session.' },
  chatSend: { zh: '发送', en: 'Send' },
  chatSending: { zh: '发送中...', en: 'Sending...' },
  chatDeleteSession: { zh: '删除会话', en: 'Delete Session' },
  chatDeleteSessionConfirm: { zh: '确认删除当前会话？', en: 'Delete the current session?' },
  chatSendFailed: { zh: '发送消息失败', en: 'Failed to send message' },
  chatRoleUser: { zh: '你', en: 'You' },
  chatRoleAssistant: { zh: '助手', en: 'Assistant' },
  chatRoleTool: { zh: '工具', en: 'Tool' },
  chatRoleSystem: { zh: '系统', en: 'System' },
  chatRoleMessage: { zh: '消息', en: 'Message' },
  chatToolCall: { zh: '工具调用', en: 'Tool Call' },
  chatToolResult: { zh: '工具结果', en: 'Tool Result' },
  chatToolOutput: { zh: '查看输出', en: 'View Output' },
  chatToolNoOutput: { zh: '无输出（执行完成）', en: 'No output (completed)' },
  chatReasoning: { zh: '查看推理内容', en: 'Show reasoning' },

  // Cron
  cronPageTitle: { zh: '定时任务', en: 'Cron Jobs' },
  cronPageDescription: { zh: '查看与删除定时任务，关注执行时间与状态。', en: 'View and delete cron jobs, track schedule and status.' },
  cronSearchPlaceholder: { zh: '搜索名称 / 消息 / ID', en: 'Search name / message / ID' },
  cronStatusLabel: { zh: '状态', en: 'Status' },
  cronStatusAll: { zh: '全部', en: 'All' },
  cronStatusEnabled: { zh: '仅启用', en: 'Enabled' },
  cronStatusDisabled: { zh: '仅禁用', en: 'Disabled' },
  cronTotalLabel: { zh: '总数', en: 'Total' },
  cronLoading: { zh: '加载定时任务中...', en: 'Loading cron jobs...' },
  cronEmpty: { zh: '暂无定时任务。', en: 'No cron jobs yet.' },
  cronScheduleLabel: { zh: '计划', en: 'Schedule' },
  cronDeliverTo: { zh: '投递到', en: 'Deliver to' },
  cronNextRun: { zh: '下次执行', en: 'Next run' },
  cronLastRun: { zh: '上次执行', en: 'Last run' },
  cronLastStatus: { zh: '上次状态', en: 'Last status' },
  cronDeleteConfirm: { zh: '确认删除定时任务', en: 'Delete cron job' },
  cronOneShot: { zh: '一次性', en: 'One-shot' },
  cronEnable: { zh: '启用', en: 'Enable' },
  cronDisable: { zh: '禁用', en: 'Disable' },
  cronRunNow: { zh: '立即执行', en: 'Run now' },
  cronEnableConfirm: { zh: '确认启用定时任务', en: 'Enable cron job' },
  cronDisableConfirm: { zh: '确认禁用定时任务', en: 'Disable cron job' },
  cronRunConfirm: { zh: '确认立即执行定时任务', en: 'Run cron job now' },
  cronRunForceConfirm: { zh: '任务已禁用，仍要立即执行', en: 'Cron job disabled. Force run now' },

  // Marketplace
  marketplacePluginsPageTitle: { zh: '插件市场', en: 'Plugin Marketplace' },
  marketplacePluginsPageDescription: { zh: '安装、启用与管理插件。', en: 'Install, enable, and manage plugins.' },
  marketplaceSkillsPageTitle: { zh: '技能市场', en: 'Skill Marketplace' },
  marketplaceSkillsPageDescription: { zh: '安装与管理技能。', en: 'Install and manage skills.' },
  marketplaceTabMarketplacePlugins: { zh: '插件市场', en: 'Plugin Market' },
  marketplaceTabMarketplaceSkills: { zh: '技能市场', en: 'Skill Market' },
  marketplaceTabInstalledPlugins: { zh: '已安装插件', en: 'Installed Plugins' },
  marketplaceTabInstalledSkills: { zh: '已安装技能', en: 'Installed Skills' },
  marketplaceSearchPlaceholderPlugins: { zh: '搜索插件...', en: 'Search plugins...' },
  marketplaceSearchPlaceholderSkills: { zh: '搜索技能...', en: 'Search skills...' },
  marketplaceFilterPlugins: { zh: '插件', en: 'Plugins' },
  marketplaceFilterSkills: { zh: '技能', en: 'Skills' },
  marketplaceSortRelevance: { zh: '相关性', en: 'Relevance' },
  marketplaceSortUpdated: { zh: '最近更新', en: 'Recently Updated' },
  marketplaceUnknownItem: { zh: '未知项目', en: 'Unknown Item' },
  marketplaceInstalledLocalSummary: { zh: '已在本地安装，市场暂无详情。', en: 'Installed locally. Details are currently unavailable from marketplace.' },
  marketplaceTypePlugin: { zh: '插件', en: 'Plugin' },
  marketplaceTypeSkill: { zh: '技能', en: 'Skill' },
  marketplaceTypeExtension: { zh: '扩展', en: 'Extension' },
  marketplaceInstall: { zh: '安装', en: 'Install' },
  marketplaceInstalling: { zh: '安装中...', en: 'Installing...' },
  marketplaceEnable: { zh: '启用', en: 'Enable' },
  marketplaceDisable: { zh: '禁用', en: 'Disable' },
  marketplaceEnabling: { zh: '启用中...', en: 'Enabling...' },
  marketplaceDisabling: { zh: '禁用中...', en: 'Disabling...' },
  marketplaceUninstall: { zh: '卸载', en: 'Uninstall' },
  marketplaceRemoving: { zh: '卸载中...', en: 'Removing...' },
  marketplaceSectionPlugins: { zh: '插件列表', en: 'Plugin Catalog' },
  marketplaceSectionSkills: { zh: '技能列表', en: 'Skill Catalog' },
  marketplaceSectionInstalledPlugins: { zh: '已安装插件', en: 'Installed Plugins' },
  marketplaceSectionInstalledSkills: { zh: '已安装技能', en: 'Installed Skills' },
  marketplaceErrorLoadingPluginsData: { zh: '加载插件市场数据失败', en: 'Failed to load plugin marketplace data' },
  marketplaceErrorLoadingSkillsData: { zh: '加载技能市场数据失败', en: 'Failed to load skill marketplace data' },
  marketplaceErrorLoadingInstalledPlugins: { zh: '加载已安装插件失败', en: 'Failed to load installed plugins' },
  marketplaceErrorLoadingInstalledSkills: { zh: '加载已安装技能失败', en: 'Failed to load installed skills' },
  marketplaceNoPlugins: { zh: '未找到插件。', en: 'No plugins found.' },
  marketplaceNoSkills: { zh: '未找到技能。', en: 'No skills found.' },
  marketplaceNoInstalledPlugins: { zh: '未找到已安装插件。', en: 'No installed plugins found.' },
  marketplaceNoInstalledSkills: { zh: '未找到已安装技能。', en: 'No installed skills found.' },
  marketplaceUninstallTitle: { zh: '确认卸载', en: 'Uninstall' },
  marketplaceUninstallDescription: {
    zh: '该操作会移除扩展，后续可在市场中重新安装。',
    en: 'This will remove the extension. You can install it again from the marketplace.'
  },
  marketplaceInstallSuccessPlugin: { zh: '插件安装成功', en: 'Plugin installed successfully' },
  marketplaceInstallSuccessSkill: { zh: '技能安装成功', en: 'Skill installed successfully' },
  marketplaceEnableSuccess: { zh: '启用成功', en: 'Enabled successfully' },
  marketplaceDisableSuccess: { zh: '禁用成功', en: 'Disabled successfully' },
  marketplaceUninstallSuccess: { zh: '卸载成功', en: 'Uninstalled successfully' },
  marketplaceInstallFailed: { zh: '安装失败', en: 'Install failed' },
  marketplaceOperationFailed: { zh: '操作失败', en: 'Operation failed' },
  marketplaceInstalledPluginsCountSuffix: { zh: '个已安装插件', en: 'installed plugins' },
  marketplaceInstalledSkillsCountSuffix: { zh: '个已安装技能', en: 'installed skills' },

  // Status
  connected: { zh: '已连接', en: 'Connected' },
  disconnected: { zh: '未连接', en: 'Disconnected' },
  connecting: { zh: '连接中...', en: 'Connecting...' },
  feishuConnecting: { zh: '验证 / 连接中...', en: 'Verifying / connecting...' },
  statusReady: { zh: '就绪', en: 'Ready' },
  statusSetup: { zh: '待配置', en: 'Setup' },
  statusActive: { zh: '活跃', en: 'Active' },
  statusInactive: { zh: '未启用', en: 'Inactive' },

  // Action labels
  actionConfigure: { zh: '配置', en: 'Configure' },
  actionAddProvider: { zh: '添加提供商', en: 'Add Provider' },
  actionEnable: { zh: '启用', en: 'Enable' },

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
  headerValue: { zh: 'Header 值', en: 'Header Value' },

  // Doc Browser
  docBrowserTitle: { zh: '帮助文档', en: 'Help Docs' },
  docBrowserSearchPlaceholder: { zh: '搜索，也可以输入文档地址直接打开', en: 'Search, or enter a doc URL to open' },
  docBrowserUrlPlaceholder: { zh: '输入文档路径，如 /guide/channels', en: 'Enter a doc path, e.g. /guide/channels' },
  docBrowserOpenExternal: { zh: '文档中心打开', en: 'Open in Docs' },
  docBrowserFloatMode: { zh: '悬浮窗口', en: 'Float Window' },
  docBrowserDockMode: { zh: '固定到侧栏', en: 'Dock to Sidebar' },
  docBrowserClose: { zh: '关闭', en: 'Close' },
  docBrowserHelp: { zh: '帮助文档', en: 'Help Docs' },
};

export function t(key: string, lang: I18nLanguage = getLanguage()): string {
  return LABELS[key]?.[lang] || LABELS[key]?.en || key;
}
