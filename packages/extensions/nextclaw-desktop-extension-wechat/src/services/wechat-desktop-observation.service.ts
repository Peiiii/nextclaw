import type {
  DesktopHost,
  DesktopHostEvent,
  ExtensionObservationHandlers,
} from "@nextclaw/extension-sdk";
import type {
  WechatDesktopObservationConfig,
  WechatDesktopSnapshot,
} from "../types/wechat-desktop-extension.types.js";
import {
  findNewWechatMessages,
  normalizeWechatObservationConfig,
  toWechatDesktopSnapshot,
} from "../utils/wechat-desktop-snapshot.utils.js";

type WatchState = {
  config: WechatDesktopObservationConfig;
  snapshot: WechatDesktopSnapshot;
  emit: Parameters<NonNullable<ExtensionObservationHandlers["subscribe"]>>[0]["emit"];
};

export class WechatDesktopObservationService {
  private readonly watches = new Map<string, WatchState>();
  private readonly removeEventListener: () => void;

  constructor(private readonly desktop: DesktopHost) {
    this.removeEventListener = desktop.onEvent(this.onDesktopEvent);
  }

  readonly handlers: ExtensionObservationHandlers = {
    read: async ({ config }) =>
      await this.readSnapshot(normalizeWechatObservationConfig(config)),
    subscribe: async ({ config, emit, signal, subscriptionId }) => {
      const normalized = normalizeWechatObservationConfig(config);
      const baseline = await this.readSnapshot(normalized);
      const observed = await this.desktop.invoke<{ watchId: string }>({
        method: "host.ui.observe",
        payload: {
          target: { applicationId: "wechat" },
          maxDepth: 24,
          maxNodes: 10_000,
        },
        caller: { subscriptionId },
      });
      this.watches.set(observed.watchId, {
        config: normalized,
        snapshot: baseline,
        emit,
      });
      const cleanup = async () => {
        this.watches.delete(observed.watchId);
        await this.desktop.invoke({
          method: "host.ui.unobserve",
          payload: { watchId: observed.watchId },
          caller: { subscriptionId },
        }).catch(() => undefined);
      };
      signal.addEventListener("abort", () => void cleanup(), { once: true });
      return cleanup;
    },
    replay: "unsupported",
  };

  close = (): void => {
    this.removeEventListener();
    this.watches.clear();
  };

  private readSnapshot = async (
    config: ReturnType<typeof normalizeWechatObservationConfig>,
  ): Promise<WechatDesktopSnapshot> => {
    const root = await this.desktop.invoke({
      method: "host.ui.snapshot",
      payload: {
        target: { applicationId: "wechat" },
        maxDepth: 24,
        maxNodes: 10_000,
      },
    });
    return toWechatDesktopSnapshot({ root, config });
  };

  private readonly onDesktopEvent = async (
    event: DesktopHostEvent,
  ): Promise<void> => {
    const state = this.watches.get(event.watchId);
    if (!state) return;
    const root = readEventSnapshot(event.event);
    if (!root) return;
    const next = toWechatDesktopSnapshot({
      root,
      config: state.config,
    });
    const added = findNewWechatMessages(state.snapshot, next);
    state.snapshot = next;
    for (const message of added) {
      await state.emit({
        id: `wechat-${message.id}`,
        type: "wechat.desktop.message.visible",
        occurredAt: next.capturedAt,
        cursor: message.id,
        dedupeKey: message.id,
        payload: {
          applicationId: next.applicationId,
          ...(next.conversation ? { conversation: next.conversation } : {}),
          text: message.text,
          path: message.path,
        },
        sourceRefs: [`desktop://wechat/${message.id}`],
      });
    }
  };
}

function readEventSnapshot(value: unknown): unknown | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const event = value as Record<string, unknown>;
  return event.type === "snapshotChanged" ? event.snapshot ?? null : null;
}
