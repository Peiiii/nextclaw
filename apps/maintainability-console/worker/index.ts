type AssetsBinding = {
  fetch: (request: Request) => Promise<Response>;
};

type WorkerEnv = {
  ASSETS: AssetsBinding;
};

const VALID_PROFILES = new Set(["source", "repo-volume"]);

function okEnvelope<T>(data: T) {
  return {
    ok: true,
    data
  };
}

function errorEnvelope(code: string, message: string) {
  return {
    ok: false,
    error: {
      code,
      message
    }
  };
}

function isApiRequest(url: URL): boolean {
  return url.pathname === "/health" || url.pathname.startsWith("/api/");
}

function getSnapshotAssetPath(profile: string): string {
  return `/_snapshot/maintainability-overview-${profile}.json`;
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
  fallbackUrl.search = "";
  return await env.ASSETS.fetch(new Request(fallbackUrl.toString(), request));
}

async function serveOverviewSnapshot(request: Request, env: WorkerEnv): Promise<Response> {
  const url = new URL(request.url);
  const profile = `${url.searchParams.get("profile") ?? "source"}`.trim() || "source";
  if (!VALID_PROFILES.has(profile)) {
    return Response.json(errorEnvelope("INVALID_PROFILE", `Unsupported maintainability profile: ${profile}`), {
      status: 400
    });
  }

  const snapshotUrl = new URL(request.url);
  snapshotUrl.pathname = getSnapshotAssetPath(profile);
  snapshotUrl.search = "";
  const snapshotResponse = await env.ASSETS.fetch(new Request(snapshotUrl.toString(), request));
  if (snapshotResponse.status === 404) {
    return Response.json(
      errorEnvelope("SNAPSHOT_MISSING", `Published snapshot is missing for profile: ${profile}`),
      {
        status: 500
      }
    );
  }

  return new Response(snapshotResponse.body, {
    status: snapshotResponse.status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      "x-maintainability-delivery-mode": "published-snapshot"
    }
  });
}

export default {
  async fetch(
    request: Request,
    env: WorkerEnv
  ): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json(okEnvelope({
        status: "ok",
        deliveryMode: "published-snapshot"
      }));
    }

    if (url.pathname === "/api/maintainability/overview") {
      return await serveOverviewSnapshot(request, env);
    }

    return await serveAsset(request, env);
  }
};
