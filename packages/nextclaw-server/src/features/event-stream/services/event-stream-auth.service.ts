import type { IncomingMessage } from "node:http";
import type { ExtensionChannelBinding } from "@nextclaw/core";
import type { UiAuthService } from "@nextclaw-server/features/auth/index.js";
import type {
  ExtensionEventStreamAuthenticator,
  EventStreamPrincipal,
} from "@nextclaw-server/features/event-stream/types/event-stream-principal.types.js";

export type EventStreamAuthServiceDeps = {
  uiAuth: UiAuthService;
  extensionAuth?: ExtensionEventStreamAuthenticator;
  getChannelBindings?: () => ExtensionChannelBinding[];
};

function readHeaderValue(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function readBearerToken(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/iu.exec(value);
  return match?.[1]?.trim() || null;
}

export class EventStreamAuthService {
  constructor(private readonly deps: EventStreamAuthServiceDeps) {}

  authenticate = (request: IncomingMessage): EventStreamPrincipal | null =>
    this.authenticateExtension(request) ?? this.authenticateUi(request);

  private readonly authenticateExtension = (request: IncomingMessage): EventStreamPrincipal | null => {
    const token = readBearerToken(readHeaderValue(request.headers.authorization));
    const extensionId = readHeaderValue(request.headers["x-nextclaw-extension-id"]);
    const result = this.deps.extensionAuth?.authenticateEventStreamCredential({
      extensionId,
      token,
    });
    if (!result) {
      return null;
    }
    return {
      principalId: `extension:${result.extensionId}`,
      grants: [
        "event-stream:extension-requests",
        "event-stream:ncp-events",
        "event-stream:config-events",
      ],
      scopes: {
        extensionIds: [result.extensionId],
        channelIds: this.getExtensionChannelIds(result.extensionId),
      },
    };
  };

  private readonly authenticateUi = (request: IncomingMessage): EventStreamPrincipal | null => {
    if (!this.deps.uiAuth.isSocketAuthenticated(request)) {
      return null;
    }
    return {
      principalId: "ui",
      grants: ["event-stream:ui-events"],
      scopes: {},
    };
  };

  private readonly getExtensionChannelIds = (extensionId: string): string[] =>
    this.deps.getChannelBindings?.()
      .filter((binding) => binding.extensionId === extensionId)
      .map((binding) => binding.channelId)
      .filter((channelId) => channelId.trim().length > 0) ?? [];
}
