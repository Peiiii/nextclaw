import type { Context } from "hono";
import { fetchRemoteStaticAssetResponse, isRemoteStaticAssetRequest } from "../services/remote-static-assets-service";
import { ensurePlatformBootstrap } from "../services/platform-service";
import { resolveRemoteAccessSession, validateRemoteAccessSession } from "../services/remote-access-service";
import type { Env } from "../types/platform";

type RemoteStaticAssetsEnv = Env & {
  ASSETS?: {
    fetch(input: Request | URL | string): Promise<Response>;
  };
};

export async function remoteStaticAssetMiddleware(
  c: Context<{ Bindings: RemoteStaticAssetsEnv }>,
  next: () => Promise<void>
): Promise<Response | void> {
  if (!isRemoteStaticAssetRequest(c.req.raw)) {
    return await next();
  }

  await ensurePlatformBootstrap(c.env);
  const remoteContext = c as Context<{ Bindings: Env }>;
  const resolved = await validateRemoteAccessSession(remoteContext, await resolveRemoteAccessSession(remoteContext));
  if (!resolved.ok) {
    return resolved.response;
  }

  const response = await fetchRemoteStaticAssetResponse({
    assets: c.env.ASSETS,
    request: c.req.raw
  });
  if (response) {
    return response;
  }

  return await next();
}
