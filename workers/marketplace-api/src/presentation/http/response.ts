import type { Context } from "hono";

export class ApiResponseFactory {
  ok<T>(c: Context, data: T, status = 200) {
    return c.json({ ok: true, data }, status as 200);
  }

  error(c: Context, code: string, message: string, status = 400, details?: Record<string, unknown>) {
    return c.json(
      {
        ok: false,
        error: {
          code,
          message,
          details
        }
      },
      status as 400
    );
  }

  publicOk<T>(c: Context, data: T, options: {
    browserMaxAgeSeconds?: number;
    edgeMaxAgeSeconds?: number;
    staleWhileRevalidateSeconds?: number;
  } = {}): Response {
    const body = JSON.stringify({ ok: true, data });
    const etag = this.weakEtag(body);
    const headers = new Headers({
      "cache-control": `public, max-age=${options.browserMaxAgeSeconds ?? 60}, s-maxage=${options.edgeMaxAgeSeconds ?? 300}, stale-while-revalidate=${options.staleWhileRevalidateSeconds ?? 600}`,
      "cloudflare-cdn-cache-control": `public, max-age=${options.edgeMaxAgeSeconds ?? 300}, stale-while-revalidate=${options.staleWhileRevalidateSeconds ?? 600}`,
      "content-type": "application/json; charset=UTF-8",
      etag,
      vary: "Accept-Encoding",
    });
    if (c.req.header("if-none-match") === etag) {
      return new Response(null, { status: 304, headers });
    }
    return new Response(body, { status: 200, headers });
  }

  private weakEtag = (body: string): string => {
    let first = 0x811c9dc5;
    let second = 0x9e3779b9;
    for (let index = 0; index < body.length; index += 1) {
      const value = body.charCodeAt(index);
      first = Math.imul(first ^ value, 0x01000193) >>> 0;
      second = Math.imul(second ^ value, 0x85ebca6b) >>> 0;
    }
    return `W/"${body.length.toString(16)}-${first.toString(16)}-${second.toString(16)}"`;
  };
}
