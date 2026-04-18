import type { SessionEntryView, SessionTypeIconView } from '@/api/types';
import { t } from '@/lib/i18n';
import { getChannelLogo } from '@/lib/logos';

type SessionContextSymbolIcon = 'heartbeat' | 'cron';

export type SessionContextIcon =
  | { kind: 'channel-logo'; channel: string }
  | { kind: 'runtime-image'; src: string; alt?: string | null; name?: string | null }
  | { kind: 'symbol'; icon: SessionContextSymbolIcon };

export type SessionContextView = {
  icon: SessionContextIcon | null;
  label: string | null;
};

const CHANNEL_ALIAS_REGISTRY: Record<string, string> = {
  wx: 'weixin',
  lark: 'feishu',
};

const TYPE_CONTEXT_REGISTRY: Record<string, { icon: SessionContextSymbolIcon }> = {
  heartbeat: { icon: 'heartbeat' },
  cron: { icon: 'cron' },
};

const SESSION_TYPE_LABEL_REGISTRY: Record<string, string> = {
  codex: 'chatSessionTypeCodex',
  claude: 'chatSessionTypeClaude',
};

function normalize(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

function toTitleCaseByDelimiter(value: string): string {
  return value
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function resolveSessionTypeLabel(
  sessionType: string,
  options: Array<{ value: string; label: string }>
): string | null {
  const normalized = normalize(sessionType);
  if (!normalized || normalized === 'native') {
    return null;
  }
  const matchedOption = options.find((option) => normalize(option.value) === normalized);
  if (matchedOption?.label.trim()) {
    return matchedOption.label.trim();
  }
  return toTitleCaseByDelimiter(normalized);
}

function resolveSessionTypeOption(
  sessionType: string,
  options: Array<{ value: string; label: string; icon?: SessionTypeIconView | null }>
): { value: string; label: string; icon?: SessionTypeIconView | null } | null {
  const normalized = normalize(sessionType);
  if (!normalized || normalized === 'native') {
    return null;
  }
  return options.find((option) => normalize(option.value) === normalized) ?? null;
}

function resolveChannelLogoName(channel: string): string | null {
  const normalized = normalize(channel);
  if (!normalized) {
    return null;
  }
  const withAlias = CHANNEL_ALIAS_REGISTRY[normalized] ?? normalized;
  return getChannelLogo(withAlias) ? withAlias : null;
}

export function resolveSessionContextView(
  session: SessionEntryView,
  options: Array<{ value: string; label: string; icon?: SessionTypeIconView | null }>
): SessionContextView {
  const logoChannel = resolveChannelLogoName(session.channel ?? '');
  if (logoChannel) {
    return {
      icon: { kind: 'channel-logo', channel: logoChannel },
      label: null,
    };
  }

  const ncpType = normalize(session.type);
  const typeView = TYPE_CONTEXT_REGISTRY[ncpType];
  if (typeView) {
    return { icon: { kind: 'symbol', icon: typeView.icon }, label: null };
  }

  const sessionType = normalize(session.sessionType);
  const matchedSessionTypeOption = resolveSessionTypeOption(sessionType, options);
  if (matchedSessionTypeOption?.icon?.src?.trim()) {
    return {
      icon: {
        kind: 'runtime-image',
        src: matchedSessionTypeOption.icon.src,
        alt: matchedSessionTypeOption.icon.alt ?? null,
        name: matchedSessionTypeOption.label
      },
      label: null,
    };
  }
  const labelKey = SESSION_TYPE_LABEL_REGISTRY[sessionType];
  if (labelKey) {
    return { icon: null, label: t(labelKey) };
  }

  return {
    icon: null,
    label:
      matchedSessionTypeOption?.label?.trim() || resolveSessionTypeLabel(session.sessionType, options),
  };
}
