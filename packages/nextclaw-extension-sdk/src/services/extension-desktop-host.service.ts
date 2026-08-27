import { getKeyId, ingressKeys, type Unsubscribe } from "@nextclaw/shared";
import type {
  DesktopHost,
  DesktopHostEvent,
  DesktopHostInvokeInput,
} from "../types/extension-sdk.types.js";
import type { ExtensionTransportService } from "./extension-transport.service.js";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export class ExtensionDesktopHostService implements DesktopHost {
  constructor(private readonly params: {
    eventBus: {
      subscribeAll: (
        handler: (event: { type: string; payload: unknown }) => void,
      ) => Unsubscribe;
    };
    extensionId: string;
    generation: string;
    transport: ExtensionTransportService;
  }) {}

  readonly invoke = async <T = unknown>(
    input: DesktopHostInvokeInput,
  ): Promise<T> =>
    await this.params.transport.postIngress<T>(
      getKeyId(ingressKeys.extension.desktopHostInvoke),
      input,
    );

  readonly status = async <T = unknown>(): Promise<T> =>
    await this.invoke<T>({ method: "host.status", payload: {} });

  readonly onEvent = (
    handler: (event: DesktopHostEvent) => void | Promise<void>,
  ): Unsubscribe =>
    this.params.eventBus.subscribeAll((envelope) => {
      if (envelope.type !== "extension.host.desktop.event") return;
      const payload = asRecord(envelope.payload);
      if (payload.extensionId !== this.params.extensionId) return;
      if (payload.generation !== this.params.generation) return;
      if (typeof payload.watchId !== "string" || !payload.watchId.trim()) return;
      void handler({
        watchId: payload.watchId,
        event: payload.event,
      });
    });
}
