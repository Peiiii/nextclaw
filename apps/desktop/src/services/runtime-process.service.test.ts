import assert from "node:assert/strict";
import test from "node:test";
import { createRuntimeScriptSpawnOptions } from "../runtime-service";
import { createDesktopRuntimeEnv } from "../utils/desktop-paths.utils";

test("hides runtime child process console windows on Windows", () => {
  const env = { NEXTCLAW_HOME: "/tmp/nextclaw" };

  assert.deepEqual(createRuntimeScriptSpawnOptions(env), {
    env,
    stdio: "pipe",
    windowsHide: true
  });
});

test("desktop runtime disables duplicate built-in extension child processes", () => {
  const runtimeEnv = createDesktopRuntimeEnv({
    NEXTCLAW_HOME: "/tmp/ambient",
    NEXTCLAW_COMMAND_SURFACE_BIN: "/tmp/nextclaw-command-surface/bin"
  });

  assert.equal(runtimeEnv.NEXTCLAW_DISABLE_BUILTIN_EXTENSIONS, "1");
  assert.equal(runtimeEnv.ELECTRON_RUN_AS_NODE, "1");
  assert.equal(runtimeEnv.NEXTCLAW_COMMAND_SURFACE_BIN, "/tmp/nextclaw-command-surface/bin");
});

test("desktop runtime passes packaged extension root to embedded runtime", () => {
  const runtimeEnv = createDesktopRuntimeEnv(
    {
      NEXTCLAW_HOME: "/tmp/ambient"
    },
    {
      packagedExtensionDir: "/tmp/nextclaw-desktop-bundle/plugins"
    }
  );

  assert.equal(runtimeEnv.NEXTCLAW_PACKAGED_EXTENSION_DIR, "/tmp/nextclaw-desktop-bundle/plugins");
});
