import { describe, expect, it, vi } from "vitest";
import { AppPackageDependencyToolProvider } from "./app-package-dependency-tool.provider.js";

const view = {
  readiness: { status: "ready", requirements: [] },
  bindings: [],
  candidates: [],
  resolvedProviderIds: {},
};

function createManager() {
  return {
    inspectDependencies: vi.fn(async () => view),
    verifyDependencies: vi.fn(async () => view),
    setupDependencies: vi.fn(async () => view),
    bindDependency: vi.fn(async () => view),
    unbindDependency: vi.fn(async () => view),
    inspectSecrets: vi.fn(async () => ({ readiness: { status: "ready", requirements: [] }, slots: [] })),
    verifySecrets: vi.fn(async () => ({ readiness: { status: "ready", requirements: [] }, slots: [] })),
    bindSecret: vi.fn(async () => ({ readiness: { status: "ready", requirements: [] }, slots: [] })),
    unbindSecret: vi.fn(async () => ({ readiness: { status: "ready", requirements: [] }, slots: [] })),
  };
}

describe("AppPackageDependencyToolProvider", () => {
  it("exposes one tool for each dependency operation", async () => {
    const tools = new AppPackageDependencyToolProvider(
      createManager() as never,
    ).provide({} as never);
    expect(tools.map((tool) => tool.name)).toEqual([
      "app_dependencies_inspect",
      "app_dependencies_verify",
      "app_dependencies_setup",
      "app_dependency_bind",
      "app_dependency_unbind",
      "app_secrets_inspect",
      "app_secrets_verify",
      "app_secret_bind",
      "app_secret_unbind",
    ]);
  });

  it("never exposes a Secret value and asks before mutating a SecretRef", async () => {
    const manager = createManager();
    const tools = new AppPackageDependencyToolProvider(manager as never).provide({} as never);
    await expect(tools[7]?.execute({
      appId: "example.notes", slotId: "issue-api-token", source: "env", id: "ISSUE_API_TOKEN",
    })).resolves.toContain("requires_user_authorization");
    expect(manager.bindSecret).not.toHaveBeenCalled();
    await expect(tools[7]?.execute({
      appId: "example.notes", slotId: "issue-api-token", source: "env", id: "ISSUE_API_TOKEN", confirm: true,
    })).resolves.not.toContain("ISSUE_API_TOKEN_VALUE");
    expect(manager.bindSecret).toHaveBeenCalledWith("example.notes", {
      slotId: "issue-api-token",
      binding: { source: "env", provider: undefined, id: "ISSUE_API_TOKEN" },
    });
  });

  it("returns a structured authorization state before mutating local bindings", async () => {
    const manager = createManager();
    const tools = new AppPackageDependencyToolProvider(
      manager as never,
    ).provide({} as never);
    await expect(
      tools[2]?.execute({ appId: "example.notes" }),
    ).resolves.toContain("requires_user_authorization");
    expect(manager.setupDependencies).not.toHaveBeenCalled();
    await expect(
      tools[2]?.execute({ appId: "example.notes", confirm: true }),
    ).resolves.toContain('"status": "ready"');
    expect(manager.setupDependencies).toHaveBeenCalledWith("example.notes");
  });
});
