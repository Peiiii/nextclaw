import { Command } from "commander";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProviderCommandController } from "@nextclaw-cli/cli/app/controllers/config/provider-command.controller.js";
import { ModelSearchCommandController } from "@nextclaw-cli/cli/app/controllers/config/model-search-command.controller.js";
import { registerProviderCommands } from "./provider-command-registration.utils.js";
import { registerModelSearchCommands } from "./model-search-command-registration.utils.js";
import type { UiApiClient } from "@nextclaw-cli/cli/app/services/local-api/local-ui-api-client.service.js";

function setup(result: unknown = {}) {
  const request = vi.fn(async (params: { path: string }) => params.path === "/api/provider-templates"
    ? { providerTemplates: [{ id: "openai" }] }
    : result);
  const createApi = () => ({ request }) as UiApiClient;
  const program = new Command().exitOverride().configureOutput({ writeErr: () => undefined });
  registerProviderCommands(program, new ProviderCommandController(createApi));
  registerModelSearchCommands(program, new ModelSearchCommandController(createApi));
  const output = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  return { request, output, run: (...args: string[]) => program.parseAsync(args, { from: "user" }) };
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); process.exitCode = 0; });

describe("object-level config CLI", () => {
  it("creates a provider using an environment key and never prints credentials or header values", async () => {
    vi.stubEnv("NEXTCLAW_TEST_PROVIDER_KEY", "secret-key");
    const app = setup({ providerId: "office", provider: { apiKeySet: true, extraHeaders: { Authorization: "secret-header" } } });
    await app.run("providers", "add", "office", "--type", "openai", "--api-key-env", "NEXTCLAW_TEST_PROVIDER_KEY", "--header", "Authorization=secret-header", "--json");
    expect(app.request).toHaveBeenCalledWith({ path: "/api/providers", method: "POST", body: {
      providerId: "office", providerType: "openai", apiKey: "secret-key", extraHeaders: { Authorization: "secret-header" },
    } });
    const output = app.output.mock.calls.flat().join("");
    expect(output).not.toContain("secret-key");
    expect(output).not.toContain("secret-header");
    expect(output).toContain("[redacted]");
  });

  it("updates only supplied fields and explicitly clears credentials", async () => {
    const app = setup();
    await app.run("providers", "update", "office", "--name", "Office", "--clear-api-key");
    expect(app.request).toHaveBeenCalledWith({ path: "/api/providers/office", method: "PUT", body: { displayName: "Office", apiKey: null } });
  });

  it.each([
    ["providers", "add", "bad/id"],
    ["providers", "update", "office"],
    ["providers", "update", "office", "--api-key-env", "MISSING_CONFIG_CLI_TEST_KEY"],
    ["providers", "update", "office", "--header", "invalid"],
    ["providers", "update", "office", "--wire-api", "invalid"],
    ["providers", "models", "configure", "office", "--thinking-default", "m=high"],
    ["providers", "models", "configure", "office", "--vision", "m=true", "--clear"],
    ["search", "provider", "brave", "--summary", "true"],
    ["search", "provider", "unknown", "--base-url", "https://example.test"],
    ["search", "configure", "--max-results", "51"],
    ["search", "configure", "--provider", "unknown"],
    ["search", "configure", "--enabled-provider", "exa", "--clear-enabled-providers"],
  ])("rejects invalid or ambiguous input before writing: %s", async (...args) => {
    const app = setup();
    await expect(app.run(...args)).rejects.toThrow();
    expect(app.request).not.toHaveBeenCalled();
  });

  it("discovers without changing models, and replaces/clears models only on request", async () => {
    const app = setup({ models: ["office/a"] });
    await app.run("providers", "models", "discover", "office");
    expect(app.request).toHaveBeenLastCalledWith({ path: "/api/providers/office/models/discover", method: "POST", body: {} });
    await app.run("providers", "models", "set", "office", "office/a", "office/b");
    expect(app.request).toHaveBeenLastCalledWith({ path: "/api/providers/office", method: "PUT", body: { models: ["office/a", "office/b"] } });
    await app.run("providers", "models", "set", "office");
    expect(app.request).toHaveBeenLastCalledWith({ path: "/api/providers/office", method: "PUT", body: { models: [] } });
  });

  it("expresses model capabilities without raw configuration", async () => {
    const app = setup();
    await app.run("providers", "models", "configure", "office", "--vision", "office/a=true", "--thinking", "office/a=off,high", "--thinking-default", "office/a=high");
    expect(app.request).toHaveBeenCalledWith({ path: "/api/providers/office", method: "PUT", body: {
      modelConfig: { "office/a": { vision: true, thinking: { supported: ["off", "high"], default: "high" } } },
    } });
  });

  it("returns failed provider tests with a non-zero exit code", async () => {
    const app = setup({ success: false, message: "Connection refused" });
    await app.run("providers", "test", "office", "--model", "office/a");
    expect(process.exitCode).toBe(1);
    expect(app.output.mock.calls.flat().join("")).toContain("Connection refused");
  });

  it.each(["pending", "authorized", "denied", "expired", "error"])("preserves authorization status %s", async (status) => {
    const app = setup({ status, nextPollMs: 5000 });
    await app.run("providers", "auth", "poll", "office", "session-1");
    expect(app.request).toHaveBeenCalledWith({ path: "/api/providers/office/auth/poll", method: "POST", body: { sessionId: "session-1" } });
    expect(process.exitCode ?? 0).toBe(["pending", "authorized"].includes(status) ? 0 : 1);
  });

  it("reports unknown provider without falling through to inherited object properties", async () => {
    const app = setup({ providers: {} });
    await expect(app.run("providers", "show", "constructor")).rejects.toThrow("Unknown provider");
  });

  it("rejects a misspelled template rather than silently creating a custom provider", async () => {
    const app = setup();
    await expect(app.run("providers", "add", "office", "--type", "opneai")).rejects.toThrow("Unknown provider type");
    expect(app.request).toHaveBeenCalledTimes(1);
    expect(app.request).toHaveBeenCalledWith({ path: "/api/provider-templates" });
  });

  it("routes authorization start and import through the provider API", async () => {
    const app = setup();
    await app.run("providers", "auth", "start", "office", "--method", "device");
    expect(app.request).toHaveBeenLastCalledWith({ path: "/api/providers/office/auth/start", method: "POST", body: { methodId: "device" } });
    await app.run("providers", "auth", "import", "office");
    expect(app.request).toHaveBeenLastCalledWith({ path: "/api/providers/office/auth/import-cli", method: "POST", body: {} });
  });

  it("manages search credentials and settings separately", async () => {
    const app = setup();
    await app.run("search", "configure", "--provider", "exa", "--enabled-provider", "exa", "tavily", "--max-results", "20");
    expect(app.request).toHaveBeenLastCalledWith({ path: "/api/config/search", method: "PUT", body: {
      provider: "exa", enabledProviders: ["exa", "tavily"], defaults: { maxResults: 20 },
    } });
    await app.run("search", "provider", "tavily", "--search-depth", "advanced", "--include-answer", "false");
    expect(app.request).toHaveBeenLastCalledWith({ path: "/api/config/search", method: "PUT", body: {
      providers: { tavily: { searchDepth: "advanced", includeAnswer: false } },
    } });
  });
});
