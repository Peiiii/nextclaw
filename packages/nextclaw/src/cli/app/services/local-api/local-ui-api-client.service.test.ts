import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalUiApiClient } from "./local-ui-api-client.service.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LocalUiApiClient", () => {
  it("preserves the structured server error for non-2xx responses", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, data: { cookie: null } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: false,
        error: {
          code: "APP_PACKAGE_CONFLICT",
          message: "Service component id 冲突：example-service",
        },
      }), { status: 409, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(new LocalUiApiClient("http://127.0.0.1:5177").request({
      path: "/api/app-packages/example/enable",
      method: "POST",
    })).rejects.toThrow(
      "409: APP_PACKAGE_CONFLICT: Service component id 冲突：example-service",
    );
  });
});
