import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { ApiResponseFactory } from "@/presentation/http/utils/api-response.utils";
import { registerAppRoutes } from "./app.controller";

describe("app bundle HTTP contract", () => {
  it("returns 200 for a complete bundle and 206 only for a requested range", async () => {
    const dataSource = {
      getBundle: async (_selector: string, _version: string, range?: string) => ({
        item: { slug: "probe" },
        version: {
          bundle_sha256: "bundle-sha",
          distribution_mode: "bundle",
        },
        object: {
          body: new Uint8Array(range ? 10 : 100),
          size: 100,
          range: range ? { offset: 0, length: 10 } : { offset: 0, length: 100 },
        },
      }),
    };
    const app = new Hono();
    registerAppRoutes(app as never, () => ({
      responses: new ApiResponseFactory(),
      parser: {} as never,
      appDataSource: dataSource as never,
      invalidateCache: () => undefined,
    }));

    const complete = await app.request(
      "/api/v1/apps/items/probe/bundles/1.0.0?sha256=bundle-sha",
    );
    expect(complete.status).toBe(200);
    expect(complete.headers.get("content-range")).toBeNull();
    expect(complete.headers.get("content-length")).toBe("100");

    const partial = await app.request(
      "/api/v1/apps/items/probe/bundles/1.0.0?sha256=bundle-sha",
      { headers: { range: "bytes=0-9" } },
    );
    expect(partial.status).toBe(206);
    expect(partial.headers.get("content-range")).toBe("bytes 0-9/100");
    expect(partial.headers.get("content-length")).toBe("10");
  });
});

describe("app registry HTTP contract", () => {
  it("returns the NPM-style registry document at the response root", async () => {
    const document = {
      name: "nextclaw.personal-organizer",
      "dist-tags": { latest: "0.1.3" },
      versions: {},
    };
    const app = new Hono();
    registerAppRoutes(app as never, () => ({
      responses: new ApiResponseFactory(),
      parser: {} as never,
      appDataSource: {
        getRegistryDocument: async () => document,
      } as never,
      invalidateCache: () => undefined,
    }));

    const response = await app.request(
      "/api/v1/apps/registry/nextclaw.personal-organizer",
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(document);
  });
});
