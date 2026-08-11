import * as childProcess from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NpmRuntimeLauncher } from "@nextclaw-service/launcher/npm-runtime-launcher.service.js";

vi.mock("node:child_process", async (importOriginal) => ({
  ...await importOriginal<typeof childProcess>(),
  spawnSync: vi.fn(() => ({ status: 0 }))
}));

describe("NpmRuntimeLauncher", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(childProcess.spawnSync).mockClear();
  });

  it("passes stable launcher metadata to the runtime bundle child", () => {
    vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process exit");
    }) as never);
    const launcher = new NpmRuntimeLauncher({
      argv: ["/usr/bin/node", "/usr/lib/node_modules/nextclaw/dist/cli/launcher/index.js", "serve"],
      env: { NEXTCLAW_DISABLE_RUNTIME_BUNDLE_LAUNCHER: "1" },
      launcherVersion: "0.30.0",
      packagedAppEntrypoint: "/usr/lib/node_modules/nextclaw/dist/cli/app/index.js"
    });

    expect(() => launcher.run()).toThrow("process exit");
    expect(childProcess.spawnSync).toHaveBeenCalledWith(
      process.execPath,
      ["/usr/lib/node_modules/nextclaw/dist/cli/app/index.js", "serve"],
      expect.objectContaining({
        env: expect.objectContaining({
          NEXTCLAW_RUNTIME_BUNDLE_CHILD: "1",
          NEXTCLAW_NPM_LAUNCHER_ENTRYPOINT: "/usr/lib/node_modules/nextclaw/dist/cli/launcher/index.js",
          NEXTCLAW_NPM_LAUNCHER_VERSION: "0.30.0"
        })
      })
    );
  });
});
