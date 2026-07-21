import type { Context } from "hono";
import { getRemoteInstanceById } from "@/repositories/remote-instance.repository";
import {
  getActiveOwnerRemoteAccessSessionByInstanceId,
  getRemoteAccessSessionById,
  touchRemoteAccessSession,
} from "@/repositories/remote.repository";
import type { Env, RemoteAccessSessionRow } from "@/types/platform";
import {
  optionalTrimmedString,
  parseCookieHeader,
} from "@/utils/platform.utils";
import {
  isPanelAppSandboxProxyRequest,
  readRemoteSessionIdFromHost,
} from "@/utils/remote-panel-app-request.utils";
import {
  readRequestOrigin,
  RemoteAccessService,
  REMOTE_SESSION_COOKIE,
  REMOTE_SESSION_TOUCH_THROTTLE_MS,
} from "./remote-access.service.js";

export class RemoteProxyAccessService {
  private readonly remoteAccess: RemoteAccessService;

  constructor(private readonly c: Context<{ Bindings: Env }>) {
    this.remoteAccess = new RemoteAccessService(c);
  }

  resolve = async () => {
    const resolved = await this.remoteAccess.validateAccessSession(
      await this.resolveSessionCandidate(),
    );
    if (!resolved.ok) {
      return resolved.response;
    }

    const instance = await getRemoteInstanceById(
      this.c.env.NEXTCLAW_PLATFORM_DB,
      resolved.session.instance_id,
    );
    if (!instance) {
      return new Response("Remote instance not found.", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    await this.touchSessionWhenDue(resolved.session);
    return { session: resolved.session, instance };
  };

  private resolveSessionCandidate =
    async (): Promise<RemoteAccessSessionRow | null> => {
      const directSession = await this.remoteAccess.resolveAccessSession();
      const cookieToken = parseCookieHeader(this.c.req.header("cookie"))[
        REMOTE_SESSION_COOKIE
      ]?.trim();
      if (
        directSession ||
        cookieToken ||
        !isPanelAppSandboxProxyRequest(this.c.req.raw)
      ) {
        return directSession;
      }

      const sessionId = readRemoteSessionIdFromHost(
        readRequestOrigin(this.c).hostname,
        optionalTrimmedString(this.c.env.REMOTE_ACCESS_BASE_DOMAIN ?? ""),
      );
      if (sessionId) {
        return await getRemoteAccessSessionById(
          this.c.env.NEXTCLAW_PLATFORM_DB,
          sessionId,
        );
      }

      const instance = await this.remoteAccess.resolveInstanceFromHost();
      return instance
        ? await getActiveOwnerRemoteAccessSessionByInstanceId(
            this.c.env.NEXTCLAW_PLATFORM_DB,
            instance.id,
            new Date().toISOString(),
          )
        : null;
    };

  private touchSessionWhenDue = async (
    session: RemoteAccessSessionRow,
  ): Promise<void> => {
    const now = Date.now();
    const lastUsedMs = Date.parse(session.last_used_at);
    if (
      Number.isFinite(lastUsedMs) &&
      now - lastUsedMs < REMOTE_SESSION_TOUCH_THROTTLE_MS
    ) {
      return;
    }
    await touchRemoteAccessSession(
      this.c.env.NEXTCLAW_PLATFORM_DB,
      session.id,
      new Date(now).toISOString(),
    );
  };
}
