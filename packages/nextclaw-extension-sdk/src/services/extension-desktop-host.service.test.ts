import { EventBus } from "@nextclaw/shared";
import { describe, expect, it, vi } from "vitest";
import { ExtensionDesktopHostService } from "./extension-desktop-host.service.js";

describe("ExtensionDesktopHostService", () => {
  it("uses injected transport and filters events by extension, generation, and watch id", async () => {
    const eventBus = new EventBus();
    const postIngress = vi.fn(async () => ({ online: true }));
    const service = new ExtensionDesktopHostService({
      eventBus,
      extensionId: "extension-a",
      generation: "generation-2",
      transport: { postIngress } as never,
    });

    await expect(service.status()).resolves.toEqual({ online: true });
    expect(postIngress).toHaveBeenCalledWith(
      "extension.host.desktop.invoke",
      { method: "host.status", payload: {} },
    );

    const handler = vi.fn();
    service.onEvent(handler);
    for (const payload of [
      { extensionId: "extension-b", generation: "generation-2", watchId: "watch-1" },
      { extensionId: "extension-a", generation: "generation-1", watchId: "watch-1" },
      { extensionId: "extension-a", generation: "generation-2", watchId: "" },
    ]) {
      eventBus.emitEnvelope({
        type: "extension.host.desktop.event",
        payload: { ...payload, event: { changed: false } },
      });
    }
    eventBus.emitEnvelope({
      type: "extension.host.desktop.event",
      payload: {
        extensionId: "extension-a",
        generation: "generation-2",
        watchId: "watch-1",
        event: { changed: true },
      },
    });

    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
    expect(handler).toHaveBeenCalledWith({
      watchId: "watch-1",
      event: { changed: true },
    });
  });
});
