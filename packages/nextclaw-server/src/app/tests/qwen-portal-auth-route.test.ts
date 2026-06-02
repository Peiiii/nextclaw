import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { EventBus } from "@nextclaw/shared";
import { createUiRouter } from "@nextclaw-server/app/router.js";
import { createRouterTestKernel } from "@nextclaw-server/app/tests/router-test-kernel.js";

const tempDirs: string[] = [];

function createTempConfigPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-qwen-auth-route-"));
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

describe("qwen portal device auth route", () => {
  it("completes qwen-portal device auth and stores access token", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            device_code: "device-code-123",
            user_code: "ABCD-EFGH",
            verification_uri: "https://chat.qwen.ai/device",
            verification_uri_complete:
              "https://chat.qwen.ai/device?code=ABCD-EFGH",
            expires_in: 600,
            interval: 2,
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "qwen-access-token",
            refresh_token: "qwen-refresh-token",
            expires_in: 3600,
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
    await createProviderInstance(app, "qwen-portal");

    const startResponse = await app.request(
      "http://localhost/api/providers/qwen-portal/auth/start",
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
        sessionId: string;
      };
    };
    const sessionId = startPayload.data.sessionId;
    expect(sessionId).toBeTruthy();

    const pollResponse = await app.request(
      "http://localhost/api/providers/qwen-portal/auth/poll",
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
    expect(configPayload.data.providers["qwen-portal"]?.apiKeySet).toBe(true);
    expect(configPayload.data.providers["qwen-portal"]?.apiBase).toBe(
      "https://portal.qwen.ai/v1",
    );

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

describe("qwen portal cli import route", () => {
  it("imports qwen-portal access token from qwen cli credentials", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);
    const fakeHome = mkdtempSync(join(tmpdir(), "nextclaw-qwen-home-"));
    tempDirs.push(fakeHome);
    const qwenDir = join(fakeHome, ".qwen");
    mkdirSync(qwenDir, { recursive: true });
    writeFileSync(
      join(qwenDir, "oauth_creds.json"),
      JSON.stringify({
        access_token: "qwen-cli-access-token",
        refresh_token: "qwen-cli-refresh-token",
        expiry_date: Date.now() + 3600 * 1000,
      }),
    );

    const originalHome = process.env.HOME;
    process.env.HOME = fakeHome;
    try {
      const app = createUiRouter({
        kernel: createRouterTestKernel(),
        configPath,
        appEventBus: new EventBus(),
      });
      await createProviderInstance(app, "qwen-portal");

      const importResponse = await app.request(
        "http://localhost/api/providers/qwen-portal/auth/import-cli",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({}),
        },
      );
      expect(importResponse.status).toBe(200);
      const importPayload = (await importResponse.json()) as {
        ok: true;
        data: {
          status: string;
        };
      };
      expect(importPayload.data.status).toBe("imported");

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
      expect(configPayload.data.providers["qwen-portal"]?.apiKeySet).toBe(true);
      expect(configPayload.data.providers["qwen-portal"]?.apiBase).toBe(
        "https://portal.qwen.ai/v1",
      );
    } finally {
      process.env.HOME = originalHome;
    }
  });

  it("returns 400 when qwen cli credentials file is missing", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);
    const fakeHome = mkdtempSync(join(tmpdir(), "nextclaw-qwen-home-missing-"));
    tempDirs.push(fakeHome);

    const originalHome = process.env.HOME;
    process.env.HOME = fakeHome;
    try {
      const app = createUiRouter({
        kernel: createRouterTestKernel(),
        configPath,
        appEventBus: new EventBus(),
      });
      await createProviderInstance(app, "qwen-portal");

      const importResponse = await app.request(
        "http://localhost/api/providers/qwen-portal/auth/import-cli",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({}),
        },
      );
      expect(importResponse.status).toBe(400);
      const payload = (await importResponse.json()) as {
        ok: false;
        error: {
          code: string;
          message: string;
        };
      };
      expect(payload.error.code).toBe("AUTH_IMPORT_FAILED");
      expect(payload.error.message).toContain("failed to read CLI credential");
    } finally {
      process.env.HOME = originalHome;
    }
  });

  it("returns 400 when imported qwen cli credential is expired", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);
    const fakeHome = mkdtempSync(join(tmpdir(), "nextclaw-qwen-home-expired-"));
    tempDirs.push(fakeHome);
    const qwenDir = join(fakeHome, ".qwen");
    mkdirSync(qwenDir, { recursive: true });
    writeFileSync(
      join(qwenDir, "oauth_creds.json"),
      JSON.stringify({
        access_token: "expired-qwen-access-token",
        refresh_token: "expired-qwen-refresh-token",
        expiry_date: Date.now() - 1000,
      }),
    );

    const originalHome = process.env.HOME;
    process.env.HOME = fakeHome;
    try {
      const app = createUiRouter({
        kernel: createRouterTestKernel(),
        configPath,
        appEventBus: new EventBus(),
      });
      await createProviderInstance(app, "qwen-portal");

      const importResponse = await app.request(
        "http://localhost/api/providers/qwen-portal/auth/import-cli",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({}),
        },
      );
      expect(importResponse.status).toBe(400);
      const payload = (await importResponse.json()) as {
        ok: false;
        error: {
          code: string;
          message: string;
        };
      };
      expect(payload.error.code).toBe("AUTH_IMPORT_FAILED");
      expect(payload.error.message).toContain("expired");
    } finally {
      process.env.HOME = originalHome;
    }
  });
});
