import assert from "node:assert/strict";
import test from "node:test";
import type { RuntimeCommand } from "../runtime-config";
import { DesktopRuntimeCommandService } from "./desktop-runtime-command.service";
import type { DesktopBundleBootstrapService } from "./desktop-bundle-bootstrap.service";

test("prepares packaged seed before resolving the runtime command", async () => {
  const calls: string[] = [];
  const bundleBootstrap = {
    ensureInitialBundleAvailability: async () => {
      calls.push("ensure");
    },
    recoverPendingBundleCandidate: async () => {
      calls.push("recover");
    },
    pruneRetainedBundleArtifacts: async () => {
      calls.push("prune");
    }
  } as unknown as DesktopBundleBootstrapService;
  const runtimeCommand: RuntimeCommand = {
    source: "packaged-runtime",
    scriptPath: "/resources/app.asar/node_modules/nextclaw/dist/cli/app/index.js"
  };
  const service = new DesktopRuntimeCommandService(
    { warn: () => undefined },
    () => ({ resolveCommand: () => runtimeCommand })
  );

  assert.equal(await service.resolve(bundleBootstrap), runtimeCommand);
  assert.deepEqual(calls, ["ensure", "recover", "prune"]);
});

test("keeps environment runtime override immediate", async () => {
  const previousOverride = process.env.NEXTCLAW_DESKTOP_RUNTIME_SCRIPT;
  process.env.NEXTCLAW_DESKTOP_RUNTIME_SCRIPT = "/runtime/override/index.js";
  try {
    const bundleBootstrap = {
      ensureInitialBundleAvailability: async () => {
        throw new Error("seed install should not run for environment override");
      }
    } as unknown as DesktopBundleBootstrapService;
    const runtimeCommand: RuntimeCommand = {
      source: "environment-override",
      scriptPath: "/runtime/override/index.js"
    };
    const service = new DesktopRuntimeCommandService(
      { warn: () => undefined },
      () => ({ resolveCommand: () => runtimeCommand })
    );

    assert.equal(await service.resolve(bundleBootstrap), runtimeCommand);
  } finally {
    if (previousOverride === undefined) {
      delete process.env.NEXTCLAW_DESKTOP_RUNTIME_SCRIPT;
    } else {
      process.env.NEXTCLAW_DESKTOP_RUNTIME_SCRIPT = previousOverride;
    }
  }
});
