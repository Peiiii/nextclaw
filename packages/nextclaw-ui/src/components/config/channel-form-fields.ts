import { t } from '@/lib/i18n';

export type ChannelFieldType = 'boolean' | 'text' | 'email' | 'password' | 'number' | 'tags' | 'select' | 'json';
export type ChannelOption = { value: string; label: string };
export type ChannelField = {
  name: string;
  type: ChannelFieldType;
  label: string;
  options?: ChannelOption[];
  section?: 'primary' | 'advanced';
};
export type ChannelFormFieldSection = 'all' | 'primary' | 'advanced';
export type ChannelFormBlock =
  | {
    type: 'fields';
    section: ChannelFormFieldSection;
    collapsible?: {
      title: string;
      description?: string;
    };
  }
  | {
    type: 'custom';
    sectionId: string;
  };
export type ChannelFormDefinition = {
  fields: ChannelField[];
  layout?: ChannelFormBlock[];
};

const DM_POLICY_OPTIONS: ChannelOption[] = [
  { value: 'pairing', label: 'pairing' },
  { value: 'allowlist', label: 'allowlist' },
  { value: 'open', label: 'open' },
  { value: 'disabled', label: 'disabled' }
];

const GROUP_POLICY_OPTIONS: ChannelOption[] = [
  { value: 'open', label: 'open' },
  { value: 'allowlist', label: 'allowlist' },
  { value: 'disabled', label: 'disabled' }
];

const STREAMING_MODE_OPTIONS: ChannelOption[] = [
  { value: 'off', label: 'off' },
  { value: 'partial', label: 'partial' },
  { value: 'block', label: 'block' },
  { value: 'progress', label: 'progress' }
];

export function buildChannelFormDefinitions(): Record<string, ChannelFormDefinition> {
  return {
    telegram: {
      fields: [
      { name: 'enabled', type: 'boolean', label: t('enabled') },
      { name: 'token', type: 'password', label: t('botToken') },
      { name: 'allowFrom', type: 'tags', label: t('allowFrom') },
      { name: 'proxy', type: 'text', label: t('proxy') },
      { name: 'accountId', type: 'text', label: t('accountId') },
      { name: 'dmPolicy', type: 'select', label: t('dmPolicy'), options: DM_POLICY_OPTIONS },
      { name: 'groupPolicy', type: 'select', label: t('groupPolicy'), options: GROUP_POLICY_OPTIONS },
      { name: 'groupAllowFrom', type: 'tags', label: t('groupAllowFrom') },
      { name: 'requireMention', type: 'boolean', label: t('requireMention') },
      { name: 'mentionPatterns', type: 'tags', label: t('mentionPatterns') },
      { name: 'groups', type: 'json', label: t('groupRulesJson') }
      ]
    },
    discord: {
      fields: [
      { name: 'enabled', type: 'boolean', label: t('enabled') },
      { name: 'token', type: 'password', label: t('botToken') },
      { name: 'allowBots', type: 'boolean', label: t('allowBotMessages') },
      { name: 'allowFrom', type: 'tags', label: t('allowFrom') },
      { name: 'gatewayUrl', type: 'text', label: t('gatewayUrl') },
      { name: 'intents', type: 'number', label: t('intents') },
      { name: 'proxy', type: 'text', label: t('proxy') },
      { name: 'mediaMaxMb', type: 'number', label: t('attachmentMaxSizeMb') },
      { name: 'streaming', type: 'select', label: t('streamingMode'), options: STREAMING_MODE_OPTIONS },
      { name: 'draftChunk', type: 'json', label: t('draftChunkingJson') },
      { name: 'textChunkLimit', type: 'number', label: t('textChunkLimit') },
      { name: 'accountId', type: 'text', label: t('accountId') },
      { name: 'dmPolicy', type: 'select', label: t('dmPolicy'), options: DM_POLICY_OPTIONS },
      { name: 'groupPolicy', type: 'select', label: t('groupPolicy'), options: GROUP_POLICY_OPTIONS },
      { name: 'groupAllowFrom', type: 'tags', label: t('groupAllowFrom') },
      { name: 'requireMention', type: 'boolean', label: t('requireMention') },
      { name: 'mentionPatterns', type: 'tags', label: t('mentionPatterns') },
      { name: 'groups', type: 'json', label: t('groupRulesJson') }
      ]
    },
    whatsapp: {
      fields: [
      { name: 'enabled', type: 'boolean', label: t('enabled') },
      { name: 'bridgeUrl', type: 'text', label: t('bridgeUrl') },
      { name: 'allowFrom', type: 'tags', label: t('allowFrom') }
      ]
    },
    feishu: {
      fields: [
      { name: 'enabled', type: 'boolean', label: t('enabled') },
      { name: 'appId', type: 'text', label: t('appId') },
      { name: 'appSecret', type: 'password', label: t('appSecret') },
      { name: 'encryptKey', type: 'password', label: t('encryptKey') },
      { name: 'verificationToken', type: 'password', label: t('verificationToken') },
      { name: 'domain', type: 'text', label: 'Domain' },
      { name: 'allowFrom', type: 'tags', label: t('allowFrom') },
      { name: 'dmPolicy', type: 'select', label: t('dmPolicy'), options: DM_POLICY_OPTIONS },
      { name: 'groupPolicy', type: 'select', label: t('groupPolicy'), options: GROUP_POLICY_OPTIONS },
      { name: 'groupAllowFrom', type: 'tags', label: t('groupAllowFrom') },
      { name: 'requireMention', type: 'boolean', label: t('requireMention') },
      { name: 'mentionPatterns', type: 'tags', label: t('mentionPatterns') },
      { name: 'groups', type: 'json', label: t('groupRulesJson') },
      { name: 'accounts', type: 'json', label: t('accountsJson') }
      ]
    },
    dingtalk: {
      fields: [
      { name: 'enabled', type: 'boolean', label: t('enabled') },
      { name: 'clientId', type: 'text', label: t('clientId') },
      { name: 'clientSecret', type: 'password', label: t('clientSecret') },
      { name: 'allowFrom', type: 'tags', label: t('allowFrom') }
      ]
    },
    wecom: {
      fields: [
      { name: 'enabled', type: 'boolean', label: t('enabled') },
      { name: 'corpId', type: 'text', label: t('corpId') },
      { name: 'agentId', type: 'text', label: t('agentId') },
      { name: 'secret', type: 'password', label: t('secret') },
      { name: 'token', type: 'password', label: t('token') },
      { name: 'callbackPort', type: 'number', label: t('callbackPort') },
      { name: 'callbackPath', type: 'text', label: t('callbackPath') },
      { name: 'allowFrom', type: 'tags', label: t('allowFrom') }
      ]
    },
    weixin: {
      fields: [
        { name: 'enabled', type: 'boolean', label: t('enabled'), section: 'primary' },
        { name: 'defaultAccountId', type: 'text', label: t('defaultAccountId') },
        { name: 'baseUrl', type: 'text', label: t('baseUrl') },
        { name: 'pollTimeoutMs', type: 'number', label: t('pollTimeoutMs') },
        { name: 'allowFrom', type: 'tags', label: t('allowFrom') },
        { name: 'accounts', type: 'json', label: t('accountsJson') }
      ],
      layout: [
        { type: 'fields', section: 'primary' },
        { type: 'custom', sectionId: 'weixin-auth' },
        {
          type: 'fields',
          section: 'advanced',
          collapsible: {
            title: t('weixinAuthAdvancedTitle'),
            description: t('weixinAuthAdvancedDescription')
          }
        }
      ]
    },
    slack: {
      fields: [
      { name: 'enabled', type: 'boolean', label: t('enabled') },
      { name: 'mode', type: 'text', label: t('mode') },
      { name: 'webhookPath', type: 'text', label: t('webhookPath') },
      { name: 'allowBots', type: 'boolean', label: t('allowBotMessages') },
      { name: 'botToken', type: 'password', label: t('botToken') },
      { name: 'appToken', type: 'password', label: t('appToken') }
      ]
    },
    email: {
      fields: [
      { name: 'enabled', type: 'boolean', label: t('enabled') },
      { name: 'consentGranted', type: 'boolean', label: t('consentGranted') },
      { name: 'imapHost', type: 'text', label: t('imapHost') },
      { name: 'imapPort', type: 'number', label: t('imapPort') },
      { name: 'imapUsername', type: 'text', label: t('imapUsername') },
      { name: 'imapPassword', type: 'password', label: t('imapPassword') },
      { name: 'fromAddress', type: 'email', label: t('fromAddress') }
      ]
    },
    mochat: {
      fields: [
      { name: 'enabled', type: 'boolean', label: t('enabled') },
      { name: 'baseUrl', type: 'text', label: t('baseUrl') },
      { name: 'clawToken', type: 'password', label: t('clawToken') },
      { name: 'agentUserId', type: 'text', label: t('agentUserId') },
      { name: 'allowFrom', type: 'tags', label: t('allowFrom') }
      ]
    },
    qq: {
      fields: [
      { name: 'enabled', type: 'boolean', label: t('enabled') },
      { name: 'appId', type: 'text', label: t('appId') },
      { name: 'secret', type: 'password', label: t('appSecret') },
      { name: 'markdownSupport', type: 'boolean', label: t('markdownSupport') },
      { name: 'allowFrom', type: 'tags', label: t('allowFrom') }
      ]
    }
  };
}

export function buildChannelFields(): Record<string, ChannelField[]> {
  const definitions = buildChannelFormDefinitions();
  return Object.fromEntries(
    Object.entries(definitions).map(([channelName, definition]) => [channelName, definition.fields])
  );
}
