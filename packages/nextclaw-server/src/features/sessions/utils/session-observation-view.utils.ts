import type {
  ContextBinding,
  EventDelivery,
  EventSubscription,
  ObservationCapabilityDescriptor,
} from "@nextclaw/kernel";
import type {
  UiNcpSessionObservationView,
  UiNcpSessionObservationsView,
} from "@nextclaw-server/features/sessions/types/session-observation-api.types.js";

const SENSITIVE_KEY_PATTERN = /(token|secret|password|cookie|api[-_]?key|credential|authorization)/i;
const MAX_PREVIEW_ENTRIES = 6;
const MAX_PREVIEW_VALUE_LENGTH = 80;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function previewValue(key: string, value: unknown): string {
  if (SENSITIVE_KEY_PATTERN.test(key)) return "••••••";
  if (value === null) return "null";
  if (typeof value === "string") {
    const normalized = value.trim();
    if (normalized.length <= MAX_PREVIEW_VALUE_LENGTH) return normalized || "空字符串";
    return `${normalized.slice(0, MAX_PREVIEW_VALUE_LENGTH - 1)}…`;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `[${value.length} 项]`;
  if (isRecord(value)) return "已配置";
  return "已配置";
}

export function buildSafeConfigPreview(config: unknown): string | undefined {
  if (!isRecord(config)) return config === undefined ? undefined : "已配置";
  const entries = Object.entries(config).slice(0, MAX_PREVIEW_ENTRIES);
  if (entries.length === 0) return undefined;
  const preview = entries.map(([key, value]) => `${key}: ${previewValue(key, value)}`);
  if (Object.keys(config).length > MAX_PREVIEW_ENTRIES) preview.push("…");
  return preview.join(" · ");
}

function buildDescriptorMap(
  descriptors: readonly ObservationCapabilityDescriptor[],
): Map<string, ObservationCapabilityDescriptor> {
  return new Map(descriptors.map((descriptor) => [`${descriptor.kind}:${descriptor.extensionId}`, descriptor]));
}

function buildDeliveryCounts(deliveries: readonly EventDelivery[]): Map<string, { pending: number; failures: number }> {
  const counts = new Map<string, { pending: number; failures: number }>();
  for (const delivery of deliveries) {
    const current = counts.get(delivery.subscriptionId) ?? { pending: 0, failures: 0 };
    if (delivery.status === "pending" || delivery.status === "submitted") current.pending += 1;
    if (delivery.status === "failed") current.failures += 1;
    counts.set(delivery.subscriptionId, current);
  }
  return counts;
}

function buildContextView(
  binding: ContextBinding,
  descriptors: ReadonlyMap<string, ObservationCapabilityDescriptor>,
): UiNcpSessionObservationView {
  const descriptor = descriptors.get(`context:${binding.extensionId}`);
  const safeConfigPreview = buildSafeConfigPreview(binding.config);
  return {
    id: binding.bindingId,
    kind: "context",
    extensionId: binding.extensionId,
    title: descriptor?.title ?? binding.extensionId,
    ...(descriptor?.description ? { description: descriptor.description } : {}),
    status: binding.status,
    ...(binding.statusReason ? { statusReason: binding.statusReason } : {}),
    createdAt: binding.createdAt,
    ...(binding.expiresAt ? { expiresAt: binding.expiresAt } : {}),
    ...(binding.lastReadAt ? { lastReadAt: binding.lastReadAt } : {}),
    ...(safeConfigPreview ? { safeConfigPreview } : {}),
  };
}

function buildSubscriptionView(
  subscription: EventSubscription,
  descriptors: ReadonlyMap<string, ObservationCapabilityDescriptor>,
  deliveryCounts: ReadonlyMap<string, { pending: number; failures: number }>,
): UiNcpSessionObservationView {
  const descriptor = descriptors.get(`events:${subscription.extensionId}`);
  const counts = deliveryCounts.get(subscription.subscriptionId) ?? { pending: 0, failures: 0 };
  const safeConfigPreview = buildSafeConfigPreview(subscription.config);
  return {
    id: subscription.subscriptionId,
    kind: "events",
    extensionId: subscription.extensionId,
    title: descriptor?.title ?? subscription.extensionId,
    ...(descriptor?.description ? { description: descriptor.description } : {}),
    status: subscription.status,
    ...(subscription.statusReason ? { statusReason: subscription.statusReason } : {}),
    createdAt: subscription.createdAt,
    ...(subscription.expiresAt ? { expiresAt: subscription.expiresAt } : {}),
    ...(safeConfigPreview ? { safeConfigPreview } : {}),
    pendingCount: counts.pending,
    ...(subscription.suppressedCount ? { suppressedCount: subscription.suppressedCount } : {}),
    ...(counts.failures > 0 ? { deliveryFailureCount: counts.failures } : {}),
    ...(subscription.lastSuppressionReason ? { lastSuppressionReason: subscription.lastSuppressionReason } : {}),
    ...(subscription.lastGapAt ? { lastGapAt: subscription.lastGapAt } : {}),
    ...(subscription.gapReason ? { gapReason: subscription.gapReason } : {}),
    delivery: subscription.delivery,
  };
}

function needsAttention(observation: UiNcpSessionObservationView): boolean {
  return observation.status !== "active" || (observation.deliveryFailureCount ?? 0) > 0 || Boolean(observation.lastGapAt);
}

export function buildSessionObservationsView(input: {
  sessionId: string;
  bindings: readonly ContextBinding[];
  subscriptions: readonly EventSubscription[];
  deliveries: readonly EventDelivery[];
  descriptors: readonly ObservationCapabilityDescriptor[];
}): UiNcpSessionObservationsView {
  const descriptors = buildDescriptorMap(input.descriptors);
  const deliveryCounts = buildDeliveryCounts(input.deliveries);
  const bindings = input.bindings.map((binding) => buildContextView(binding, descriptors));
  const subscriptions = input.subscriptions.map((subscription) => buildSubscriptionView(subscription, descriptors, deliveryCounts));
  return {
    sessionId: input.sessionId,
    bindings,
    subscriptions,
    counts: {
      total: bindings.length + subscriptions.length,
      context: bindings.length,
      events: subscriptions.length,
      needsAttention: [...bindings, ...subscriptions].filter(needsAttention).length,
    },
  };
}
