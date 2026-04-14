import { competitiveLeaderboardApp } from "../server/leaderboard.controller.js";

type AssetsBinding = {
  fetch: (request: Request) => Promise<Response>;
};

type WorkerEnv = {
  ASSETS: AssetsBinding;
};

function isApiRequest(url: URL): boolean {
  return url.pathname === "/health" || url.pathname.startsWith("/api/");
}

async function serveAsset(request: Request, env: WorkerEnv): Promise<Response> {
  const assetResponse = await env.ASSETS.fetch(request);
  if (assetResponse.status !== 404) {
    return assetResponse;
  }

  const url = new URL(request.url);
  if (isApiRequest(url)) {
    return new Response("Not Found", { status: 404 });
  }

  const fallbackUrl = new URL(request.url);
  fallbackUrl.pathname = "/index.html";
  return await env.ASSETS.fetch(new Request(fallbackUrl.toString(), request));
}

export default {
  fetch(
    request: Request,
    env: WorkerEnv,
    executionContext: { waitUntil: (promise: Promise<unknown>) => void }
  ): Promise<Response> | Response {
    const url = new URL(request.url);
    if (isApiRequest(url)) {
      return competitiveLeaderboardApp.fetch(request, env, executionContext as never);
    }
    return serveAsset(request, env);
  }
};
