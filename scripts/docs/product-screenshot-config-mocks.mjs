export const providerSpecs = [
  {
    name: 'openai',
    displayName: 'OpenAI',
    modelPrefix: 'openai',
    keywords: ['openai', 'gpt'],
    envKey: 'OPENAI_API_KEY',
    defaultApiBase: 'https://api.openai.com/v1',
    defaultModels: ['openai/gpt-5.1', 'openai/gpt-4.1'],
    supportsWireApi: true,
    wireApiOptions: ['auto', 'chat', 'responses'],
    defaultWireApi: 'auto'
  },
  {
    name: 'anthropic',
    displayName: 'Anthropic',
    modelPrefix: 'anthropic',
    keywords: ['anthropic', 'claude'],
    envKey: 'ANTHROPIC_API_KEY',
    defaultApiBase: 'https://api.anthropic.com/v1',
    defaultModels: ['anthropic/claude-opus-4-1'],
    supportsWireApi: true,
    wireApiOptions: ['auto', 'chat', 'responses'],
    defaultWireApi: 'auto'
  },
  {
    name: 'deepseek',
    displayName: 'DeepSeek',
    modelPrefix: 'deepseek',
    keywords: ['deepseek'],
    envKey: 'DEEPSEEK_API_KEY',
    defaultApiBase: 'https://api.deepseek.com/v1',
    defaultModels: ['deepseek/deepseek-chat'],
    supportsWireApi: true,
    wireApiOptions: ['auto', 'chat', 'responses'],
    defaultWireApi: 'auto'
  },
  {
    name: 'openrouter',
    displayName: 'OpenRouter',
    modelPrefix: 'openrouter',
    keywords: ['openrouter'],
    envKey: 'OPENROUTER_API_KEY',
    defaultApiBase: 'https://openrouter.ai/api/v1',
    defaultModels: ['openrouter/openai/gpt-5.3-codex'],
    supportsWireApi: true,
    wireApiOptions: ['auto', 'chat', 'responses'],
    defaultWireApi: 'auto'
  }
];

export const providerTemplatesPayload = {
  providerTemplates: providerSpecs.map((provider) => ({
    id: provider.name,
    providerType: provider.name,
    displayName: provider.displayName,
    apiProtocol: 'openai-compatible',
    modelPrefix: provider.modelPrefix,
    keywords: provider.keywords,
    envKey: provider.envKey,
    defaultApiBase: provider.defaultApiBase,
    defaultModels: provider.defaultModels,
    supportsWireApi: provider.supportsWireApi,
    wireApiOptions: provider.wireApiOptions,
    defaultWireApi: provider.defaultWireApi
  }))
};

export const channelSpecs = [
  {
    name: 'discord',
    displayName: 'Discord',
    enabled: true,
    tutorialUrls: {
      en: 'https://docs.nextclaw.io/en/guide/tutorials/feishu',
      zh: 'https://docs.nextclaw.io/zh/guide/tutorials/feishu'
    }
  },
  {
    name: 'telegram',
    displayName: 'Telegram',
    enabled: true
  },
  {
    name: 'feishu',
    displayName: 'Feishu',
    enabled: true
  },
  {
    name: 'qq',
    displayName: 'QQ',
    enabled: true
  },
  {
    name: 'email',
    displayName: 'Email',
    enabled: false
  },
  {
    name: 'wecom',
    displayName: 'WeCom',
    enabled: false
  }
];

export const configPayload = {
  agents: {
    defaults: {
      model: 'openai/gpt-5.1',
      workspace: '~/workspace-nextclaw',
      contextTokens: 64000,
      maxToolIterations: 1000
    },
    list: [
      {
        id: 'default',
        default: true,
        model: 'openai/gpt-5.1'
      }
    ]
  },
  providers: {
    openai: {
      apiKeySet: true,
      apiKeyMasked: 'sk-****',
      apiBase: 'https://api.openai.com/v1',
      wireApi: 'auto',
      models: ['openai/gpt-5.1', 'openai/gpt-4.1']
    },
    anthropic: {
      apiKeySet: true,
      apiKeyMasked: 'sk-ant-****',
      apiBase: 'https://api.anthropic.com/v1',
      wireApi: 'auto',
      models: ['anthropic/claude-opus-4-1']
    },
    deepseek: {
      apiKeySet: false,
      apiBase: 'https://api.deepseek.com/v1',
      wireApi: 'auto',
      models: ['deepseek/deepseek-chat']
    },
    openrouter: {
      apiKeySet: true,
      apiKeyMasked: 'sk-or-****',
      apiBase: 'https://openrouter.ai/api/v1',
      wireApi: 'responses',
      models: ['openrouter/openai/gpt-5.3-codex']
    }
  },
  channels: {
    discord: {
      enabled: true,
      token: '',
      allowBots: false,
      dmPolicy: 'pairing',
      groupPolicy: 'allowlist'
    },
    telegram: {
      enabled: true,
      token: '',
      dmPolicy: 'open',
      groupPolicy: 'allowlist'
    },
    feishu: {
      enabled: true,
      appId: '',
      appSecret: ''
    },
    qq: {
      enabled: true,
      appId: '',
      markdownSupport: true
    },
    email: {
      enabled: false,
      consentGranted: false
    },
    wecom: {
      enabled: false,
      corpId: '',
      agentId: ''
    }
  },
  session: {
    dmScope: 'per-channel-peer'
  },
  bindings: [],
  secrets: {
    enabled: true,
    defaults: {
      env: 'global'
    },
    providers: {
      global: {
        source: 'env',
        prefix: 'NEXTCLAW_'
      }
    },
    refs: {}
  }
};

export const providersPayload = {
  providers: Object.fromEntries(
    Object.entries(configPayload.providers).map(([providerId, provider]) => {
      const spec = providerSpecs.find((item) => item.name === providerId) || null;
      return [
        providerId,
        {
          providerId,
          providerType: spec?.name ?? null,
          isBuiltInType: false,
          isCustom: !spec,
          enabled: provider.enabled !== false,
          displayName: spec?.displayName,
          apiKeySet: Boolean(provider.apiKeySet),
          apiKeyMasked: provider.apiKeyMasked,
          apiBase: provider.apiBase,
          wireApi: provider.wireApi,
          models: provider.models ?? [],
          modelConfig: provider.modelConfig ?? {}
        }
      ];
    })
  )
};

export const schemaPayload = {
  schema: {
    type: 'object',
    properties: {}
  },
  uiHints: {
    'providers.openai': {
      help: 'OpenAI official endpoint with Responses API support.'
    },
    'channels.discord': {
      help: 'Connect Discord bot and forward mentions to your agent.'
    },
    'channels.telegram': {
      help: 'Connect Telegram bot token and manage DM/group policy.'
    }
  },
  actions: [],
  version: 'screenshot-mock-v1',
  generatedAt: new Date().toISOString()
};

export const agentsPayload = {
  agents: [
    {
      id: 'main',
      default: true,
      displayName: 'Main Agent',
      description: 'Default entry for everyday work, coordination, and follow-up tasks.',
      workspace: '~/workspace-nextclaw/main',
      model: 'openai/gpt-5.1',
      runtime: 'native',
      contextTokens: 64000,
      builtIn: true
    },
    {
      id: 'researcher',
      displayName: 'Researcher',
      description: 'Collects references, compares sources, and prepares concise research notes.',
      workspace: '~/workspace-nextclaw/researcher',
      model: 'openai/gpt-5.1',
      runtime: 'codex',
      contextTokens: 128000
    },
    {
      id: 'builder',
      displayName: 'Builder',
      description: 'Turns repetitive work into scripts, small tools, and local automations.',
      workspace: '~/workspace-nextclaw/builder',
      model: 'openai/gpt-5.1',
      runtime: 'native',
      contextTokens: 96000
    },
    {
      id: 'writer',
      displayName: 'Writer',
      description: 'Drafts reports, release notes, proposals, and user-facing content.',
      workspace: '~/workspace-nextclaw/writer',
      model: 'anthropic/claude-sonnet-4.5',
      runtime: 'native',
      contextTokens: 64000
    }
  ]
};
