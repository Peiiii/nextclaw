import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { EventBus } from "@nextclaw/shared";
import { createUiRouter } from "@nextclaw-server/app/router.js";
import { createRouterTestKernel } from "@nextclaw-server/app/tests/router-test-kernel.js";

const tempDirs: string[] = [];

function createTempConfigPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-minimax-auth-route-"));
  tempDirs.push(dir);
  return join(dir, "config.json");
}

afterEach(() => {
  vi.restoreAllMocks();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

async function createProviderInstance(app: ReturnType<typeof createUiRouter>, providerType: string): Promise<void> {
  const response = await app.request("http://localhost/api/providers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ providerType }),
  });
  expect(response.status).toBe(200);
}

describe("minimax portal auth routes", () => {
  it("defaults minimax-portal auth method to cn when methodId is omitted", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          user_code: "MINI-DEFAULT-CN",
          verification_uri: "https://www.minimaxi.com/oauth/device",
          expired_in: Date.now() + 600000,
          interval: 1500,
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );

    const app = createUiRouter({
      kernel: createRouterTestKernel(),
      configPath,
      appEventBus: new EventBus(),
    });
    await createProviderInstance(app, "minimax-portal");

    const startResponse = await app.request(
      "http://localhost/api/providers/minimax-portal/auth/start",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      },
    );
    expect(startResponse.status).toBe(200);
    const startPayload = (await startResponse.json()) as {
      ok: true;
      data: {
        methodId?: string;
      };
    };
    expect(startPayload.data.methodId).toBe("cn");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain(
      "https://api.minimaxi.com/oauth/code",
    );
  });

  it("completes minimax-portal auth with cn method and stores region api base", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementationOnce(async (_input, init) => {
        const params = new URLSearchParams(init?.body as URLSearchParams);
        const state = params.get("state") ?? "";
        return new Response(
          JSON.stringify({
            user_code: "MINI-CN-1234",
            verification_uri: "https://www.minimaxi.com/oauth/device",
            expired_in: Date.now() + 600000,
            interval: 1500,
            state,
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        );
      })
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "success",
            access_token: "minimax-cn-access-token",
            refresh_token: "minimax-cn-refresh-token",
            expired_in: 3600,
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        ),
      );

    const app = createUiRouter({
      kernel: createRouterTestKernel(),
      configPath,
      appEventBus: new EventBus(),
    });
    await createProviderInstance(app, "minimax-portal");

    const startResponse = await app.request(
      "http://localhost/api/providers/minimax-portal/auth/start",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          methodId: "cn",
        }),
      },
    );
    expect(startResponse.status).toBe(200);
    const startPayload = (await startResponse.json()) as {
      ok: true;
      data: {
        sessionId: string;
        methodId?: string;
      };
    };
    const sessionId = startPayload.data.sessionId;
    expect(sessionId).toBeTruthy();
    expect(startPayload.data.methodId).toBe("cn");

    const pollResponse = await app.request(
      "http://localhost/api/providers/minimax-portal/auth/poll",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
        }),
      },
    );
    expect(pollResponse.status).toBe(200);
    const pollPayload = (await pollResponse.json()) as {
      ok: true;
      data: {
        status: string;
      };
    };
    expect(pollPayload.data.status).toBe("authorized");

    const configResponse = await app.request("http://localhost/api/config");
    expect(configResponse.status).toBe(200);
    const configPayload = (await configResponse.json()) as {
      ok: true;
      data: {
        providers: Record<
          string,
          { apiKeySet: boolean; apiBase?: string | null }
        >;
      };
    };
    expect(configPayload.data.providers["minimax-portal"]?.apiKeySet).toBe(
      true,
    );
    expect(configPayload.data.providers["minimax-portal"]?.apiBase).toBe(
      "https://api.minimaxi.com/v1",
    );

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain(
      "https://api.minimaxi.com/oauth/code",
    );
    expect(String(fetchSpy.mock.calls[1]?.[0])).toContain(
      "https://api.minimaxi.com/oauth/token",
    );
    const tokenParams = new URLSearchParams(
      fetchSpy.mock.calls[1]?.[1]?.body as URLSearchParams,
    );
    expect(tokenParams.get("user_code")).toBe("MINI-CN-1234");
  });
});
