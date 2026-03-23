import { CHANNEL_LABELS } from './i18n.channels';
import { CHANNEL_AUTH_LABELS } from './i18n.channel-auth';
import { MARKETPLACE_LABELS } from './i18n.marketplace';
import { REMOTE_LABELS } from './i18n.remote';
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
  searchChannels: { zh: '搜索渠道', en: 'Search Channels' },
  providers: { zh: '提供商', en: 'Providers' },
  channels: { zh: '渠道', en: 'Channels' },
  cron: { zh: '定时任务', en: 'Cron Jobs' },
  secrets: { zh: '密钥管理', en: 'Secrets' },
  runtime: { zh: '路由与运行时', en: 'Routing & Runtime' },
  remote: { zh: '远程访问', en: 'Remote Access' },
  marketplace: { zh: '市场', en: 'Marketplace' },
  advanced: { zh: '高级', en: 'Advanced' },
  settings: { zh: '设置', en: 'Settings' },
  security: { zh: '安全', en: 'Security' },
  backToMain: { zh: '返回主界面', en: 'Back to Main' },

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
  yes: { zh: '是', en: 'Yes' },
  no: { zh: '否', en: 'No' },
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
  modelPageDescription: { zh: '配置默认 AI 模型选择', en: 'Configure default AI model selection' },
  defaultModel: { zh: '默认模型', en: 'Default Model' },
  workspace: { zh: '工作空间', en: 'Workspace' },
  modelName: { zh: '模型', en: 'Model' },
  modelPickerNoOptions: { zh: '暂无可选模型', en: 'No model options available' },
  modelPickerUseCustom: { zh: '使用自定义模型：{value}', en: 'Use custom model: {value}' },
  modelInputCustomHint: {
    zh: '如果列表里没有目标模型，可直接输入自定义模型 ID。',
    en: 'If the model is not listed, type a custom model ID directly.'
  },
  modelIdentifierHelp: {
    zh: 'Agent 默认模型标识，使用带 provider 前缀的格式。例如：openai/gpt-5.1、anthropic/claude-opus-4-1、deepseek/deepseek-chat、minimax/MiniMax-M2.5、openrouter/openai/gpt-5.3-codex。',
    en: 'Default model identifier used by the agent. Use provider-prefixed format. Examples: openai/gpt-5.1 · anthropic/claude-opus-4-1 · deepseek/deepseek-chat · minimax/MiniMax-M2.5 · openrouter/openai/gpt-5.3-codex.'
  },
  maxToolIterations: { zh: '最大工具迭代次数', en: 'Max Tool Iterations' },
  saveChanges: { zh: '保存变更', en: 'Save Changes' },

  // Provider
  searchPageTitle: { zh: '搜索渠道', en: 'Search Channels' },
  searchPageDescription: { zh: '配置网页搜索提供商', en: 'Configure web search providers.' },
  searchActiveProvider: { zh: '当前搜索提供商', en: 'Active Search Provider' },
  searchDefaultMaxResults: { zh: '默认返回条数', en: 'Default Result Count' },
  searchProviderSummary: { zh: '结果摘要', en: 'Result Summary' },
  searchProviderFreshness: { zh: '时间范围', en: 'Freshness' },
  searchProviderBaseUrl: { zh: '接口地址', en: 'API Base URL' },
  searchProviderOpenDocs: { zh: '获取博查 API', en: 'Get Bocha API' },
  searchProviderActivate: { zh: '激活', en: 'Activate' },
  searchProviderActivated: { zh: '已激活', en: 'Activated' },
  searchProviderDeactivate: { zh: '取消激活', en: 'Deactivate' },
  searchProviderBochaDescription: { zh: '更适合中国大陆用户的 AI 搜索。', en: 'AI-ready search that works better for mainland China users.' },
  searchProviderBraveDescription: { zh: '保留 Brave 作为可选 provider。', en: 'Keep Brave as an optional provider.' },
  searchStatusConfigured: { zh: '已配置', en: 'Configured' },
  searchStatusNeedsSetup: { zh: '待配置', en: 'Needs Setup' },
  searchFreshnessNoLimit: { zh: '不限', en: 'No Limit' },
  searchFreshnessOneDay: { zh: '一天内', en: 'One Day' },
  searchFreshnessOneWeek: { zh: '一周内', en: 'One Week' },
  searchFreshnessOneMonth: { zh: '一个月内', en: 'One Month' },
  searchFreshnessOneYear: { zh: '一年内', en: 'One Year' },
  searchNoProviderSelected: { zh: '请选择左侧搜索 provider', en: 'Select a search provider from the left.' },
  providersPageTitle: { zh: 'AI 提供商', en: 'AI Providers' },
  providersPageDescription: { zh: '在一个页面内完成提供商切换、配置与保存。', en: 'Switch, configure, and save providers in one continuous workspace.' },
  providersLoading: { zh: '加载中...', en: 'Loading...' },
  providersTabConfigured: { zh: '已配置', en: 'Configured' },
  providersTabAll: { zh: '全部提供商', en: 'All Providers' },
  providersFilterPlaceholder: { zh: '搜索提供商', en: 'Search providers' },
  providersNoMatch: { zh: '没有匹配的提供商', en: 'No matching providers' },
  providerAddCustom: { zh: '新增自定义提供商', en: 'Add Custom Provider' },
  providerDelete: { zh: '删除该提供商', en: 'Delete Provider' },
  providerDeleteConfirm: { zh: '确认删除这个自定义提供商吗？删除后不可恢复。', en: 'Delete this custom provider? This action cannot be undone.' },
  providersSelectPlaceholder: { zh: '选择提供商', en: 'Select Provider' },
  providersSelectTitle: { zh: '选择左侧提供商开始配置', en: 'Select a provider from the left to configure' },
  providersSelectDescription: { zh: '你可以连续切换多个提供商并逐个保存配置。', en: 'Switch between providers continuously and save each configuration.' },
  providersDefaultDescription: { zh: '为你的 Agent 配置 AI 服务', en: 'Configure AI services for your agents' },
  providersEmptyTitle: { zh: '尚未配置提供商', en: 'No providers configured' },
  providersEmptyDescription: { zh: '添加一个 AI 提供商后即可开始使用。', en: 'Add an AI provider to start using the platform.' },
  apiKey: { zh: 'API 密钥', en: 'API Key' },
  apiBase: { zh: 'API Base URL', en: 'API Base URL' },
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
  providerDisplayName: { zh: '自定义名称', en: 'Custom Name' },
  providerDisplayNamePlaceholder: { zh: '例如：中转站 A', en: 'For example: Relay A' },
  providerDisplayNameHelp: {
    zh: '仅用于界面展示，便于区分多个自定义 Provider。',
    en: 'Display-only label to distinguish multiple custom providers.'
  },
  enterApiKey: { zh: '请输入 API 密钥', en: 'Enter API Key' },
  providerApiBaseHelp: { zh: '留空或恢复默认即可使用预置 API Base。', en: 'Leave empty or reset to use the default API base.' },
  providerApiBaseHelpMinimax: {
    zh: 'MiniMax 中国区请使用 https://api.minimaxi.com/v1；海外请使用 https://api.minimax.io/v1。',
    en: 'Use https://api.minimaxi.com/v1 for Mainland China accounts, and https://api.minimax.io/v1 for overseas accounts.'
  },
  providerOpenAICompatHint: {
    zh: '自定义提供商默认按 OpenAI 兼容 API 格式接入（Chat Completions / Responses）。',
    en: 'Custom providers use OpenAI-compatible API format by default (Chat Completions / Responses).'
  },
  providerExtraHeadersHelp: { zh: '用于自定义请求头（可选）。', en: 'Optional custom request headers.' },
  providerTestConnection: { zh: '测试连接', en: 'Test Connection' },
  providerTestingConnection: { zh: '测试中...', en: 'Testing...' },
  providerTestConnectionSuccess: { zh: '连接测试通过', en: 'Connection test passed' },
  providerTestConnectionFailed: { zh: '连接测试失败', en: 'Connection test failed' },
  providerModelsTitle: { zh: '可用模型列表', en: 'Available Models' },
  providerModelInputPlaceholder: {
    zh: '输入模型 ID（无需 provider 前缀，不在列表也可）',
    en: 'Enter model id (without provider prefix; custom values allowed)'
  },
  providerModelInputHint: {
    zh: '列表仅作参考，不在列表也可直接输入并添加。',
    en: 'The list is only a reference. You can type and add models that are not listed.'
  },
  providerAddModel: { zh: '添加模型', en: 'Add Model' },
  providerModelsEmpty: { zh: '当前没有模型，可直接输入并添加。', en: 'No models yet. Add one by typing model id.' },
  providerModelDefaultTag: { zh: '默认', en: 'Default' },
  providerModelCustomTag: { zh: '自定义', en: 'Custom' },
  providerModelsHelp: {
    zh: '系统会先填充预置模型；你可以在这里新增或删除。请填写当前提供商自己的模型 ID（不带当前 provider 前缀）；若输入带当前 provider 前缀会自动去除，但会保留后续路径（如 openai/gpt-5）。',
    en: 'Built-in models are prefilled and can be added or removed here. Enter provider-local model ids without the current provider prefix; if prefixed input is entered, only the current provider prefix is removed while the remaining path is preserved (for example, openai/gpt-5).'
  },
  providerModelsEmptyShort: { zh: '暂无可用模型', en: 'No models available' },
  providerAddFirstModel: { zh: '添加第一个模型', en: 'Add first model' },
  providerModelThinkingTitle: { zh: '思考档位能力', en: 'Thinking Capability' },
  providerModelThinkingHint: {
    zh: '为该模型声明可切换的思考档位，聊天会话将按这里的能力展示下拉。',
    en: 'Declare supported thinking levels for this model. Chat sessions will show the selector accordingly.'
  },
  providerModelThinkingDefault: { zh: '默认思考档位', en: 'Default Thinking Level' },
  providerModelThinkingDefaultNone: { zh: '无默认（回落 off）', en: 'No default (fallback off)' },
  providerModelThinkingNoSupported: { zh: '请先至少选择一个支持档位。', en: 'Select at least one supported level first.' },
  providerDisplayNameHelpShort: { zh: '便于区分多个自定义提供商', en: 'Helps distinguish multiple custom providers' },
  providerApiBaseHelpShort: { zh: '一般只需填写域名，系统自动补全路径', en: 'Usually just the domain; path auto-appended' },
  providerExtraHeadersHelpShort: { zh: '可选，用于自定义鉴权等场景', en: 'Optional, for custom auth etc.' },
  providerAdvancedSettings: { zh: '高级设置', en: 'Advanced Settings' },
  providerAuthSectionTitle: { zh: '提供商授权', en: 'Provider Authorization' },
  providerAuthStarting: { zh: '启动中...', en: 'Starting...' },
  providerAuthAuthorizing: { zh: '授权中...', en: 'Authorizing...' },
  providerAuthAuthorizeInBrowser: { zh: '浏览器授权', en: 'Authorize in Browser' },
  providerAuthWaitingBrowser: { zh: '等待浏览器完成授权...', en: 'Waiting for browser authorization...' },
  providerAuthCompleted: { zh: '授权已完成。', en: 'Authorization completed.' },
  providerAuthOpenPrompt: { zh: '请在浏览器完成授权，验证码：', en: 'Open browser and complete authorization (code: ' },
  providerAuthOpenPromptSuffix: { zh: '', en: ')' },
  providerAuthStartFailed: { zh: '启动授权失败', en: 'Failed to start authorization' },
  providerAuthMethodLabel: { zh: '授权区域', en: 'Authorization Region' },
  providerAuthMethodPlaceholder: { zh: '请选择授权方式', en: 'Select authorization method' },
  providerAuthImportFromCli: { zh: '从 Qwen CLI 导入', en: 'Import From Qwen CLI' },
  providerAuthImporting: { zh: '导入中...', en: 'Importing...' },
  providerAuthImportSuccess: { zh: '已从 CLI 导入凭证。', en: 'Imported provider credentials from CLI.' },
  providerAuthImportStatusPrefix: { zh: 'CLI 导入成功。', en: 'Imported credentials from CLI successfully.' },
  providerAuthImportFailed: { zh: '导入凭证失败', en: 'Failed to import credentials' },
  providerAuthSessionLabel: { zh: '会话', en: 'Session' },
  resetToDefault: { zh: '恢复默认', en: 'Reset to Default' },
  leaveBlankToKeepUnchanged: { zh: '留空则保持不变', en: 'Leave blank to keep unchanged' },

  // Channel
  ...CHANNEL_LABELS,
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

  // Auth
  authBrand: { zh: 'NextClaw UI', en: 'NextClaw UI' },
  authLoginTitle: { zh: '管理员登录', en: 'Admin Sign In' },
  authLoginDescription: {
    zh: '认证已开启。登录后才能查看这台机器的 NextClaw UI。',
    en: 'Authentication is enabled. Sign in to access this machine’s NextClaw UI.'
  },
  authUsername: { zh: '管理员用户名', en: 'Admin Username' },
  authUsernamePlaceholder: { zh: '输入管理员用户名', en: 'Enter admin username' },
  authPassword: { zh: '管理员密码', en: 'Admin Password' },
  authPasswordPlaceholder: { zh: '输入管理员密码', en: 'Enter admin password' },
  authConfirmPassword: { zh: '确认密码', en: 'Confirm Password' },
  authConfirmPasswordPlaceholder: { zh: '再次输入密码', en: 'Enter password again' },
  authLoginAction: { zh: '登录', en: 'Sign In' },
  authLoggingIn: { zh: '登录中...', en: 'Signing in...' },
  authLoggingOut: { zh: '退出中...', en: 'Signing out...' },
  authActionFailed: { zh: '认证操作失败', en: 'Authentication action failed' },
  authLoginSuccess: { zh: '登录成功', en: 'Signed in successfully' },
  authLogoutSuccess: { zh: '已退出登录', en: 'Signed out successfully' },
  authSetupSuccess: { zh: '认证已开启，当前标签页已自动登录，可直接继续使用', en: 'Authentication enabled. This tab is now signed in and ready to use.' },
  authPasswordUpdated: { zh: '管理员密码已更新', en: 'Admin password updated' },
  authEnabledSuccess: { zh: '认证已开启', en: 'Authentication enabled' },
  authDisabledSuccess: { zh: '认证已关闭', en: 'Authentication disabled' },
  authRetryStatus: { zh: '重试', en: 'Retry' },
  authStatusLoadFailed: { zh: '无法获取认证状态，请检查 UI 服务是否正常。', en: 'Failed to load authentication status. Check whether the UI server is healthy.' },

  // Runtime
  runtimePageTitle: { zh: '路由与运行时', en: 'Routing & Runtime' },
  runtimePageDescription: { zh: '对齐 OpenClaw 的多 Agent 路由：绑定规则、Agent 池、私聊范围。', en: 'Align multi-agent routing with OpenClaw: bindings, agent pool, and DM scope.' },
  runtimeLoading: { zh: '加载运行时配置中...', en: 'Loading runtime settings...' },
  authSecurityTitle: { zh: 'Security', en: 'Security' },
  authSecurityDescription: {
    zh: '保持本机控制台默认简单；只有在你需要远程暴露时，再给 UI 加一层登录门。',
    en: 'Keep the local console simple by default, and add a lightweight login gate only when you expose the UI remotely.'
  },
  authSetupTitle: { zh: '开启轻量认证', en: 'Enable Lightweight Authentication' },
  authSetupDescription: {
    zh: '首次开启时设置单个管理员账号。完成后当前标签页会自动登录。',
    en: 'Create the single admin account the first time you enable authentication. This tab will be signed in automatically.'
  },
  authSetupAction: { zh: '开启认证', en: 'Enable Authentication' },
  authSettingUp: { zh: '开启中...', en: 'Enabling...' },
  authPasswordMismatch: { zh: '两次输入的密码不一致', en: 'Passwords do not match' },
  authPasswordMinLengthHint: {
    zh: '密码至少 8 个字符。当前版本只支持单管理员账号。',
    en: 'Passwords must be at least 8 characters. This version supports a single admin account only.'
  },
  authStatusLabel: { zh: '当前状态', en: 'Current Status' },
  authStatusConfiguredUser: { zh: '管理员账号：{username}', en: 'Admin account: {username}' },
  authUsernameFixedHelp: {
    zh: '首版不提供修改用户名和多用户管理；如需重新定义账号，请后续扩展这套边界。',
    en: 'This first version does not support renaming the admin account or managing multiple users.'
  },
  authEnableLabel: { zh: '要求登录', en: 'Require Login' },
  authEnableOnHelp: {
    zh: '已开启后，除健康检查与认证接口外，其余 UI API 和 WebSocket 都需要登录。',
    en: 'When enabled, every UI API and WebSocket except health and auth endpoints requires login.'
  },
  authEnableOffHelp: {
    zh: '当前保持即开即用。重新打开后，这个标签页会自动拿到新的登录会话。',
    en: 'The UI is currently open for local-style use. Re-enabling will issue a fresh signed-in session to this tab.'
  },
  authPasswordSectionTitle: { zh: '修改管理员密码', en: 'Change Admin Password' },
  authPasswordSectionDescription: {
    zh: '更新密码后，旧会话会立即失效；当前标签页会自动续成新会话（仅在认证开启时）。',
    en: 'Updating the password invalidates old sessions immediately. This tab gets a fresh session automatically while auth is enabled.'
  },
  authPasswordAction: { zh: '更新密码', en: 'Update Password' },
  authPasswordUpdating: { zh: '更新中...', en: 'Updating...' },
  authLogoutAction: { zh: '退出当前标签页', en: 'Sign Out This Tab' },
  authSessionMemoryNotice: {
    zh: '当前版本的会话只保存在服务端内存里。NextClaw UI 进程重启后，需要重新登录。',
    en: 'Sessions are stored only in server memory for now. You will need to sign in again after the NextClaw UI process restarts.'
  },
  dmScope: { zh: '私聊范围', en: 'DM Scope' },
  dmScopeHelp: { zh: '控制私聊会话如何隔离。', en: 'Control how direct-message sessions are isolated.' },
  defaultContextTokens: { zh: '默认上下文 Token', en: 'Default Context Tokens' },
  defaultContextTokensHelp: { zh: '当 Agent 未设置单独值时使用该上下文预算。', en: 'Input context budget for agents when no per-agent override is set.' },
  defaultEngine: { zh: '默认引擎', en: 'Default Engine' },
  defaultEngineHelp: { zh: '默认使用的 Agent 引擎类型，例如 native 或 codex-sdk。', en: 'Default agent engine kind, for example native or codex-sdk.' },
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
  defaultEnginePlaceholder: { zh: '默认引擎（如 native 或 codex-sdk）', en: 'Default engine (e.g. native or codex-sdk)' },
  engineOverridePlaceholder: { zh: '引擎覆盖（可选）', en: 'Engine override (optional)' },
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
  sessionsRunStatusRunning: { zh: '运行中', en: 'Running' },
  sessionsRunStatusQueued: { zh: '排队中', en: 'Queued' },
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
  chatModelLabel: { zh: '对话模型', en: 'Chat Model' },
  chatSelectModel: { zh: '选择模型', en: 'Select model' },
  chatThinkingLevelOff: { zh: '思考关闭', en: 'Thinking Off' },
  chatThinkingLevelMinimal: { zh: '思考 Minimal', en: 'Thinking Minimal' },
  chatThinkingLevelLow: { zh: '思考 Low', en: 'Thinking Low' },
  chatThinkingLevelMedium: { zh: '思考 Medium', en: 'Thinking Medium' },
  chatThinkingLevelHigh: { zh: '思考 High', en: 'Thinking High' },
  chatThinkingLevelAdaptive: { zh: '思考 Adaptive', en: 'Thinking Adaptive' },
  chatThinkingLevelXhigh: { zh: '思考 XHigh', en: 'Thinking XHigh' },
  chatSessionTypeLabel: { zh: '会话类型', en: 'Session Type' },
  chatSessionTypeNative: { zh: '原生', en: 'Native' },
  chatSessionTypeCodex: { zh: 'Codex', en: 'Codex' },
  chatSessionTypeClaude: { zh: 'Claude Code', en: 'Claude Code' },
  chatSessionTypeUnavailableSuffix: {
    zh: '当前不可用，请启用对应插件或新建 Native 会话。',
    en: 'is unavailable now. Re-enable the plugin or create a native session.'
  },
  chatModelNoOptions: { zh: '暂无可用模型，请先配置提供商。', en: 'No available models. Configure a provider first.' },
  chatGoConfigureProvider: { zh: '去配置提供商', en: 'Go to Providers' },
  chatProviderSetupTitle: { zh: '开始前先配置提供商', en: 'Configure a Provider First' },
  chatProviderSetupDescription: {
    zh: '你还没有可用模型。先在提供商页面配置并保存至少一个 Provider 后，再回来开始对话。',
    en: 'No models are available yet. Configure and save at least one provider, then return to start chatting.'
  },
  chatSessionLabel: { zh: '当前会话', en: 'Current Session' },
  chatNoSession: { zh: '未选择会话', en: 'No session selected' },
  chatNoSessionHint: { zh: '创建一个会话并发送第一条消息。', en: 'Create a session and send your first message.' },
  chatHistoryLoading: { zh: '加载会话历史中...', en: 'Loading session history...' },
  chatNoMessages: { zh: '暂无消息，发送一条开始对话。', en: 'No messages yet. Send one to start.' },
  chatTyping: { zh: 'Agent 正在思考...', en: 'Agent is thinking...' },
  chatInputPlaceholder: { zh: '输入消息，输入 / 选择技能，Enter 发送，Shift + Enter 换行', en: 'Type a message, type / to select skills, Enter to send, Shift + Enter for newline' },
  chatInputHint: { zh: '支持多轮上下文，默认走当前会话。', en: 'Multi-turn context is preserved in the current session.' },
  chatSlashSectionCommands: { zh: '命令', en: 'Commands' },
  chatSlashSectionSkills: { zh: '技能', en: 'Skills' },
  chatSlashTypeCommand: { zh: '命令', en: 'Command' },
  chatSlashTypeSkill: { zh: '技能', en: 'Skill' },
  chatSlashSkillSpec: { zh: '标识', en: 'Spec' },
  chatSlashLoading: { zh: '加载命令与技能中…', en: 'Loading commands and skills…' },
  chatSlashNoResult: { zh: '无匹配项', en: 'No matches' },
  chatSlashHint: { zh: '输入 / 触发命令或技能选择', en: 'Type / to access commands and skills' },
  chatSlashCommandHint: { zh: '回车插入命令，继续输入参数后发送。', en: 'Press Enter to insert command, then add args and send.' },
  chatSlashSkillHint: { zh: '回车把该技能加入本轮请求。', en: 'Press Enter to add this skill for the next turn.' },
  chatSend: { zh: '发送', en: 'Send' },
  chatStop: { zh: '停止', en: 'Stop' },
  chatStopPreparing: { zh: '正在建立可停止会话，请稍候…', en: 'Preparing stoppable run…' },
  chatStopUnavailable: { zh: '当前后端引擎不支持手动停止。', en: 'Manual stop is not supported by the current backend engine.' },
  chatSending: { zh: '发送中...', en: 'Sending...' },
  chatQueueSend: { zh: '排队发送', en: 'Queue' },
  chatQueuedHintPrefix: { zh: '当前有', en: 'Queued' },
  chatQueuedHintSuffix: { zh: '条消息待发送。', en: 'pending messages.' },
  chatQueueMoveFirst: { zh: '置顶到下一条', en: 'Move to Next' },
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
  chatToolWorkflow: { zh: '工具工作流', en: 'Tool Workflow' },
  chatToolWorkflowDetails: { zh: '展开查看参数和结果', en: 'Expand to view params and results' },
  chatToolOutput: { zh: '查看输出', en: 'View Output' },
  chatToolNoOutput: { zh: '无输出（执行完成）', en: 'No output (completed)' },
  chatReasoning: { zh: '推理过程', en: 'Reasoning' },
  chatUnknownPart: { zh: '未知消息片段', en: 'Unknown message part' },
  chatCodeCopy: { zh: '复制代码', en: 'Copy' },
  chatCodeCopied: { zh: '已复制', en: 'Copied' },

  // Chat Sidebar (unified)
  chatSidebarNewTask: { zh: '新任务', en: 'New Task' },
  chatSidebarSearchPlaceholder: { zh: '搜索对话...', en: 'Search conversations...' },
  chatSidebarScheduledTasks: { zh: '定时任务', en: 'Scheduled Tasks' },
  chatSidebarSkills: { zh: '技能', en: 'Skills' },
  chatSidebarTaskRecords: { zh: '会话记录', en: 'Sessions' },
  chatSidebarToday: { zh: '今天', en: 'Today' },
  chatSidebarYesterday: { zh: '昨天', en: 'Yesterday' },
  chatSidebarPrevious7Days: { zh: '近 7 天', en: 'Previous 7 Days' },
  chatSidebarOlder: { zh: '更早', en: 'Older' },

  // Welcome page
  chatWelcomeTitle: { zh: '你好，有什么可以帮你的吗？', en: 'Hello, how can I help you?' },
  chatWelcomeSubtitle: { zh: '开始一个新任务或选择已有对话', en: 'Start a new task or select an existing conversation' },
  chatWelcomeCapability1Title: { zh: '智能对话', en: 'Smart Conversations' },
  chatWelcomeCapability1Desc: { zh: '多轮上下文对话，支持多种 AI 模型', en: 'Multi-turn context conversations with multiple AI models' },
  chatWelcomeCapability2Title: { zh: '技能扩展', en: 'Skill Extensions' },
  chatWelcomeCapability2Desc: { zh: '通过安装技能扩展 Agent 能力', en: 'Extend Agent capabilities by installing skills' },
  chatWelcomeCapability3Title: { zh: '定时任务', en: 'Scheduled Tasks' },
  chatWelcomeCapability3Desc: { zh: '设置定时执行的自动化任务', en: 'Set up scheduled automated tasks' },

  // Skills picker
  chatSkillsPickerTitle: { zh: '技能', en: 'Skills' },
  chatSkillsPickerEmpty: { zh: '暂无已安装技能', en: 'No skills installed' },
  chatSkillsPickerSearchPlaceholder: { zh: '搜索技能', en: 'Search skills' },
  chatSkillsPickerNoDescription: { zh: '暂无描述', en: 'No description' },
  chatSkillsPickerOfficial: { zh: '官方', en: 'Official' },
  chatSkillsPickerManage: { zh: '管理技能', en: 'Manage Skills' },

  // Input bar
  chatInputAttach: { zh: '添加附件', en: 'Attach file' },
  chatInputAttachComingSoon: { zh: '即将支持', en: 'Coming soon' },

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
  ...MARKETPLACE_LABELS,

  // Remote & Status
  ...REMOTE_LABELS,

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
  docBrowserTitle: { zh: '内嵌浏览器', en: 'Embedded Browser' },
  docBrowserSearchPlaceholder: { zh: '搜索，也可以输入文档地址直接打开', en: 'Search, or enter a doc URL to open' },
  docBrowserUrlPlaceholder: { zh: '输入文档路径，如 /guide/channels', en: 'Enter a doc path, e.g. /guide/channels' },
  docBrowserOpenExternal: { zh: '文档中心打开', en: 'Open in Docs' },
  docBrowserFloatMode: { zh: '悬浮窗口', en: 'Float Window' },
  docBrowserDockMode: { zh: '固定到侧栏', en: 'Dock to Sidebar' },
  docBrowserClose: { zh: '关闭', en: 'Close' },
  docBrowserHelp: { zh: '帮助文档', en: 'Help Docs' },
  docBrowserNewTab: { zh: '新建标签', en: 'New Tab' },
  docBrowserCloseTab: { zh: '关闭标签', en: 'Close Tab' },
  docBrowserTabUntitled: { zh: '未命名', en: 'Untitled' },
  ...CHANNEL_AUTH_LABELS,
};

export function t(key: string, lang: I18nLanguage = getLanguage()): string {
  return LABELS[key]?.[lang] || LABELS[key]?.en || key;
}
