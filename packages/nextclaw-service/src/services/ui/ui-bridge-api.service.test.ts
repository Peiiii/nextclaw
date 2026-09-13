import { afterEach, describe, expect, it, vi } from "vitest";
import { UiBridgeApiClient, resolveLocalUiApiBase } from "./ui-bridge-api.service.js";
import * as utils from "@nextclaw-service/utils/cli.utils.js";
import { localUiRuntimeStore } from "@nextclaw-service/stores/local-ui-runtime.store.js";
import { managedServiceStateStore } from "@nextclaw-service/stores/managed-service-state.store.js";

vi.mock("@nextclaw/server", () => ({ ensureUiBridgeSecret: () => "local-secret" }));
describe("resolveLocalUiApiBase", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prefers live foreground ui discovery over managed service state", () => {
    vi.spyOn(localUiRuntimeStore, "read").mockReturnValue({
      pid: 18792,
      startedAt: "2026-04-10T00:00:00.000Z",
      uiUrl: "http://127.0.0.1:18792",
      apiUrl: "http://127.0.0.1:18792/api",
      uiHost: "0.0.0.0",
      uiPort: 18792
    });
    vi.spyOn(managedServiceStateStore, "read").mockReturnValue({
      pid: 55667,
      startedAt: "2026-04-10T00:00:00.000Z",
      uiUrl: "http://127.0.0.1:55667",
      apiUrl: "http://127.0.0.1:55667/api",
      uiHost: "0.0.0.0",
      uiPort: 55667,
      logPath: "/tmp/service.log"
    });
    vi.spyOn(utils, "isProcessRunning").mockImplementation((pid) => pid === 18792 || pid === 55667);

    expect(resolveLocalUiApiBase()).toBe("http://127.0.0.1:18792");
  });

  it("falls back to managed service state when ui discovery is missing", () => {
    vi.spyOn(localUiRuntimeStore, "read").mockReturnValue(null);
    vi.spyOn(managedServiceStateStore, "read").mockReturnValue({
      pid: 55667,
      startedAt: "2026-04-10T00:00:00.000Z",
      uiUrl: "http://127.0.0.1:55667",
      apiUrl: "http://127.0.0.1:55667/api",
      uiHost: "0.0.0.0",
      uiPort: 55667,
      logPath: "/tmp/service.log"
    });
    vi.spyOn(utils, "isProcessRunning").mockReturnValue(true);

    expect(resolveLocalUiApiBase()).toBe("http://127.0.0.1:55667");
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("local bridge HTTP authentication", () => {
  it("authenticates a rejected request once and retains its cookie for the next request", async () => {
    const requests: Array<{ url: string; headers: Headers }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      const headers = new Headers(init.headers);
      requests.push({ url, headers });
      if (url.endsWith("/api/auth/bridge")) {
        expect(headers.get("x-nextclaw-ui-bridge-secret")).toBe("local-secret");
        return Response.json({ ok: true, data: { cookie: "nextclaw_ui_session=trusted" } });
      }
      return headers.has("cookie") ? Response.json({ ok: true, data: { accepted: true } }) : new Response(null, { status: 401 });
    }));
    const client = new UiBridgeApiClient("http://127.0.0.1:18791");
    expect((await client.requestResponse("/api/runtime/control/restart-service", { method: "POST" })).status).toBe(200);
    await client.requestResponse("/api/app/meta");
    expect(requests).toHaveLength(4);
    expect(requests[3].headers.get("cookie")).toBe("nextclaw_ui_session=trusted");
    expect(requests.filter((r) => r.headers.has("x-nextclaw-ui-bridge-secret"))).toHaveLength(1);
  });

  it.each([200, 404, 503])("preserves HTTP %i without obtaining credentials", async (status) => {
    const fetchMock = vi.fn(async () => new Response(null, { status }));
    vi.stubGlobal("fetch", fetchMock);
    expect((await new UiBridgeApiClient("http://127.0.0.1:18791").requestResponse("/api/app/meta")).status).toBe(status);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("does not loop when the refreshed session is rejected", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ ok: true, data: { cookie: "invalid" } }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    expect((await new UiBridgeApiClient("http://127.0.0.1:18791").requestResponse("/api/app/meta")).status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("refuses to transmit the bridge secret to a non-loopback target", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(new UiBridgeApiClient("https://example.com").requestResponse("/api/app/meta")).rejects.toThrow("loopback");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("blocks cross-origin paths before sending a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(new UiBridgeApiClient("http://127.0.0.1").requestResponse("https://example.com/api")).rejects.toThrow("origin");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shares cancellation and refuses redirects during authentication", async () => {
    const signal = AbortSignal.timeout(1000);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockRejectedValueOnce(new Error("redirect rejected"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(new UiBridgeApiClient("http://127.0.0.1").requestResponse("/api/app/meta", { signal })).rejects.toThrow("redirect rejected");
    for (const [, init] of fetchMock.mock.calls) {
      expect(init).toMatchObject({ signal, redirect: "error" });
    }
  });
});
