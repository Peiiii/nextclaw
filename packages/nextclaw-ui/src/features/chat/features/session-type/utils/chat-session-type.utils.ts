import type {
  AgentProfileView,
  ChatSessionTypeOptionView,
  RuntimeDefaultThinkingView,
  SessionTypeIconView,
} from "@/shared/lib/api";
import type { RuntimeModelSelectionMode } from "@nextclaw/shared";
import { t } from "@/shared/lib/i18n";

export const DEFAULT_SESSION_TYPE = "native";

export type ChatSessionTypeOption = {
  value: string;
  label: string;
  icon: SessionTypeIconView | null;
  ready: boolean;
  reason?: string | null;
  reasonMessage?: string | null;
  supportedModels?: string[];
  recommendedModel?: string | null;
  modelSelectionMode?: RuntimeModelSelectionMode;
  runtimeDefaultThinking?: RuntimeDefaultThinkingView | null;
  cta?: {
    kind: string;
    label?: string;
    href?: string;
  } | null;
};

export function normalizeSessionType(value: unknown): string {
  if (typeof value !== "string") {
    return DEFAULT_SESSION_TYPE;
  }
  const normalized = value.trim().toLowerCase();
  return normalized || DEFAULT_SESSION_TYPE;
}

export function resolveAgentRuntimeSessionType(
  agent: Pick<AgentProfileView, "runtime" | "engine"> | null | undefined,
  fallbackSessionType: string = DEFAULT_SESSION_TYPE,
): string {
  const runtime = agent?.runtime?.trim() || agent?.engine?.trim() || fallbackSessionType;
  return normalizeSessionType(runtime);
}

export function resolveSessionTypeLabel(
  sessionType: string,
  fallbackLabel?: string,
): string {
  if (sessionType === "native") {
    return t("chatSessionTypeNative");
  }
  const normalizedFallback = fallbackLabel?.trim();
  if (normalizedFallback) {
    return normalizedFallback;
  }
  return sessionType
    .trim()
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || sessionType;
}

export function buildSessionTypeOptions(
  options: ChatSessionTypeOptionView[],
): ChatSessionTypeOption[] {
  const deduped = new Map<string, ChatSessionTypeOption>();
  for (const option of options) {
    const value = normalizeSessionType(option.value);
    deduped.set(value, {
      value,
      label: option.label?.trim() || resolveSessionTypeLabel(value),
      icon: option.icon ?? null,
      ready: option.ready ?? true,
      reason: option.reason ?? null,
      reasonMessage: option.reasonMessage ?? null,
      supportedModels: option.supportedModels,
      recommendedModel: option.recommendedModel ?? null,
      modelSelectionMode: option.modelSelectionMode ?? "nextclaw",
      runtimeDefaultThinking: option.runtimeDefaultThinking ?? null,
      cta: option.cta ?? null,
    });
  }
  if (!deduped.has(DEFAULT_SESSION_TYPE)) {
    deduped.set(DEFAULT_SESSION_TYPE, {
      value: DEFAULT_SESSION_TYPE,
      label: resolveSessionTypeLabel(DEFAULT_SESSION_TYPE),
      icon: null,
      ready: true,
      reason: null,
      reasonMessage: null,
      supportedModels: undefined,
      recommendedModel: null,
      modelSelectionMode: "nextclaw",
      runtimeDefaultThinking: null,
      cta: null,
    });
  }
  return Array.from(deduped.values()).sort((left, right) => {
    if (left.value === DEFAULT_SESSION_TYPE) {
      return -1;
    }
    if (right.value === DEFAULT_SESSION_TYPE) {
      return 1;
    }
    return left.value.localeCompare(right.value);
  });
}
