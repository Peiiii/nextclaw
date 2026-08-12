import type { Context, Env, Hono } from "hono";
import { cache } from "hono/cache";

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,HEAD,POST,OPTIONS",
  "access-control-allow-headers": "authorization, content-type, if-none-match, range",
  "access-control-expose-headers": "accept-ranges, content-length, content-range, etag, x-app-bundle-sha256, x-app-file-sha256",
};

type PublicCacheRoute = {
  cacheName: string;
  includeRange?: boolean;
  path: string;
};

const PUBLIC_CACHE_ROUTES: PublicCacheRoute[] = [
  { path: "/api/v2/apps/items", cacheName: "nextclaw-app-catalog-v2" },
  { path: "/api/v1/apps/items", cacheName: "nextclaw-app-catalog-v1" },
  { path: "/api/v1/apps/items/:selector", cacheName: "nextclaw-app-detail-v1" },
  { path: "/api/v1/apps/registry/:appId", cacheName: "nextclaw-app-registry-v1" },
  { path: "/api/v1/apps/items/:selector/files/blob", cacheName: "nextclaw-app-assets-v1" },
  {
    path: "/api/v1/apps/items/:selector/bundles/:version",
    cacheName: "nextclaw-app-bundles-v1",
    includeRange: true,
  },
];

function publicCacheKey(context: Context, includeRange = false): string {
  const { req } = context;
  const etag = req.header("if-none-match");
  const range = includeRange ? req.header("range") : undefined;
  if (!etag && !range) {
    return req.url;
  }
  const url = new URL(req.url);
  if (etag) {
    url.searchParams.set("__nextclaw_if_none_match", etag);
  }
  if (range) {
    url.searchParams.set("__nextclaw_range", range);
  }
  return url.toString();
}

export function registerMarketplacePublicHttpPolicies<TEnv extends Env>(app: Hono<TEnv>): void {
  app.use("*", async (context, next) => {
    if (context.req.method.toUpperCase() === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }
    await next();
    Object.entries(CORS_HEADERS).forEach(([key, value]) => {
      context.res.headers.set(key, value);
    });
    return context.res;
  });

  PUBLIC_CACHE_ROUTES.forEach((route) => {
    app.use(
      route.path,
      cache({
        cacheName: route.cacheName,
        keyGenerator: async (context) => publicCacheKey(context, route.includeRange),
        wait: false,
      }),
    );
  });
}
