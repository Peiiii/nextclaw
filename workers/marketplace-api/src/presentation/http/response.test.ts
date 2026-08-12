import { describe, expect, it } from "vitest";
import type { Context } from "hono";
import { ApiResponseFactory } from "./response";

describe("ApiResponseFactory.publicOk", () => {
  it("sets public edge cache headers and returns 304 for a matching ETag", async () => {
    const factory = new ApiResponseFactory();
    const first = factory.publicOk(buildContext(), { items: [{ id: "app-1" }] });
    const etag = first.headers.get("etag");

    expect(first.headers.get("cache-control")).toContain("stale-while-revalidate=600");
    expect(first.headers.get("cloudflare-cdn-cache-control")).toContain("max-age=300");
    expect(etag).toMatch(/^W\//);

    const conditional = factory.publicOk(buildContext(etag ?? undefined), {
      items: [{ id: "app-1" }],
    });
    expect(conditional.status).toBe(304);
    expect(await conditional.text()).toBe("");
  });
});

function buildContext(ifNoneMatch?: string): Context {
  return {
    req: {
      header: (name: string) => name.toLowerCase() === "if-none-match" ? ifNoneMatch : undefined,
    },
  } as unknown as Context;
}
