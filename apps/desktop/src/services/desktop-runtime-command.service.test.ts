import assert from "node:assert/strict";
import test from "node:test";
import type { RuntimeCommand } from "../runtime-config";
import { DesktopRuntimeCommandService } from "./desktop-runtime-command.service";
import type { DesktopBundleBootstrapService } from "./desktop-bundle-bootstrap.service";

test("uses packaged runtime before installing the seed bundle", async () => {
  const bundleBootstrap = {
    ensureInitialBundleAvailability: async () => {
      throw new Error("seed install should be deferred");
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
});

test("installs seed bundle only when no runtime command is immediately available", async () => {
  const calls: string[] = [];
  const bundleRuntime: RuntimeCommand = {
    source: "bundle",
    scriptPath: "/runtime/current/index.js",
    bundleVersion: "0.19.9"
  };
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
  let attempt = 0;
  const service = new DesktopRuntimeCommandService(
    { warn: () => undefined },
    () => ({
      resolveCommand: () => {
        attempt += 1;
        if (attempt === 1) {
          throw new Error("missing runtime");
        }
        return bundleRuntime;
      }
    })
  );

  assert.equal(await service.resolve(bundleBootstrap), bundleRuntime);
  assert.deepEqual(calls, ["ensure", "recover", "prune"]);
});
