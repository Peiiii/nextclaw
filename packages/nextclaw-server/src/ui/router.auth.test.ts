import type { IncomingMessage } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigSchema, loadConfig, saveConfig } from "@nextclaw/core";
import { UiAuthService } from "./auth.service.js";
import { createUiRouter } from "./router.js";

const tempDirs: string[] = [];
const originalHome = process.env.NEXTCLAW_HOME;

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function createTempConfigPath(): string {
  const dir = createTempDir("nextclaw-ui-auth-config-");
  return join(dir, "config.json");
}

function useIsolatedHome(): string {
  const homeDir = createTempDir("nextclaw-ui-auth-home-");
  process.env.NEXTCLAW_HOME = homeDir;
  return homeDir;
}

function createApp(configPath: string) {
  return createUiRouter({
    configPath,
    publish: () => {}
  });
}

function readSessionCookie(response: Response): string {
  const setCookie = response.headers.get("set-cookie");
  expect(setCookie).toBeTruthy();
  return setCookie!.split(";")[0];
}

async function setupUiAuth(app: ReturnType<typeof createApp>): Promise<string> {
  const response = await app.request("http://localhost/api/auth/setup", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      username: "admin",
      password: "password123"
    })
  });
  expect(response.status).toBe(201);
  return readSessionCookie(response);
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  if (typeof originalHome === "string") {
    process.env.NEXTCLAW_HOME = originalHome;
  } else {
    delete process.env.NEXTCLAW_HOME;
  }
});

describe("ui auth config", () => {
  it("defaults to disabled and unconfigured auth", () => {
    const parsed = ConfigSchema.parse({});
    expect(parsed.ui.auth).toEqual({
      enabled: false,
      username: "",
      passwordHash: "",
      passwordSalt: ""
    });
  });
});

describe("ui auth routes", () => {
  it("keeps config routes public when auth is disabled", async () => {
    useIsolatedHome();
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);

    const app = createApp(configPath);
    const response = await app.request("http://localhost/api/config");

    expect(response.status).toBe(200);
  });

  it("persists hashed credentials, auto-authenticates setup, and hides password fields from config", async () => {
    useIsolatedHome();
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);

    const app = createApp(configPath);
    const cookie = await setupUiAuth(app);

    const saved = loadConfig(configPath);
    expect(saved.ui.auth.enabled).toBe(true);
    expect(saved.ui.auth.username).toBe("admin");
    expect(saved.ui.auth.passwordHash).toBeTruthy();
    expect(saved.ui.auth.passwordHash).not.toBe("password123");
    expect(saved.ui.auth.passwordSalt).toBeTruthy();

    const statusResponse = await app.request("http://localhost/api/auth/status", {
      headers: { cookie }
    });
    expect(statusResponse.status).toBe(200);
    const statusPayload = await statusResponse.json() as {
      ok: boolean;
      data: {
        enabled: boolean;
        configured: boolean;
        authenticated: boolean;
        username?: string;
      };
    };
    expect(statusPayload.ok).toBe(true);
    expect(statusPayload.data).toMatchObject({
      enabled: true,
      configured: true,
      authenticated: true,
      username: "admin"
    });

    const configResponse = await app.request("http://localhost/api/config", {
      headers: { cookie }
    });
    expect(configResponse.status).toBe(200);
    const configPayload = await configResponse.json() as {
      ok: boolean;
      data: {
        ui?: {
          auth?: {
            enabled?: boolean;
            username?: string;
            passwordHash?: string;
            passwordSalt?: string;
          };
        };
      };
    };
    expect(configPayload.ok).toBe(true);
    expect(configPayload.data.ui?.auth).toEqual({
      enabled: true,
      username: "admin"
    });
  });
});

describe("ui auth protection flows", () => {
  it("requires login for protected routes while keeping health and auth status public", async () => {
    useIsolatedHome();
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);

    const app = createApp(configPath);
    await setupUiAuth(app);

    const configResponse = await app.request("http://localhost/api/config");
    expect(configResponse.status).toBe(401);

    const healthResponse = await app.request("http://localhost/api/health");
    expect(healthResponse.status).toBe(200);

    const bootstrapStatusResponse = await app.request("http://localhost/api/runtime/bootstrap-status");
    expect(bootstrapStatusResponse.status).toBe(200);

    const statusResponse = await app.request("http://localhost/api/auth/status");
    expect(statusResponse.status).toBe(200);
    const statusPayload = await statusResponse.json() as {
      ok: boolean;
      data: {
        enabled: boolean;
        configured: boolean;
        authenticated: boolean;
      };
    };
    expect(statusPayload.ok).toBe(true);
    expect(statusPayload.data).toMatchObject({
      enabled: true,
      configured: true,
      authenticated: false
    });
  });

  it("supports logout, rejects wrong passwords, and allows logging back in", async () => {
    useIsolatedHome();
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);

    const app = createApp(configPath);
    const cookie = await setupUiAuth(app);

    const logoutResponse = await app.request("http://localhost/api/auth/logout", {
      method: "POST",
      headers: { cookie }
    });
    expect(logoutResponse.status).toBe(200);

    const protectedAfterLogout = await app.request("http://localhost/api/config", {
      headers: { cookie }
    });
    expect(protectedAfterLogout.status).toBe(401);

    const wrongLoginResponse = await app.request("http://localhost/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        username: "admin",
        password: "wrong-password"
      })
    });
    expect(wrongLoginResponse.status).toBe(401);

    const loginResponse = await app.request("http://localhost/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        username: "admin",
        password: "password123"
      })
    });
    expect(loginResponse.status).toBe(200);
    const newCookie = readSessionCookie(loginResponse);

    const protectedAfterLogin = await app.request("http://localhost/api/config", {
      headers: { cookie: newCookie }
    });
    expect(protectedAfterLogin.status).toBe(200);
  });

  it("makes protected routes public again after auth is disabled", async () => {
    useIsolatedHome();
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);

    const app = createApp(configPath);
    const cookie = await setupUiAuth(app);

    const disableResponse = await app.request("http://localhost/api/auth/enabled", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        cookie
      },
      body: JSON.stringify({
        enabled: false
      })
    });
    expect(disableResponse.status).toBe(200);

    const publicConfigResponse = await app.request("http://localhost/api/config");
    expect(publicConfigResponse.status).toBe(200);
  });
});

describe("ui auth sessions", () => {
  it("accepts websocket cookies only for the current process lifetime", () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);

    const authService = new UiAuthService(configPath);
    const result = authService.setup(
      new Request("http://localhost/api/auth/setup"),
      {
        username: "admin",
        password: "password123"
      }
    );
    const cookie = result.cookie.split(";")[0];

    expect(authService.isSocketAuthenticated({
      headers: { cookie }
    } as IncomingMessage)).toBe(true);

    const restartedAuthService = new UiAuthService(configPath);
    expect(restartedAuthService.isSocketAuthenticated({
      headers: { cookie }
    } as IncomingMessage)).toBe(false);
  });
});
