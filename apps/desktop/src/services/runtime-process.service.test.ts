import assert from "node:assert/strict";
import test from "node:test";
import { createRuntimeScriptSpawnOptions } from "../runtime-service";

test("hides runtime child process console windows on Windows", () => {
  const env = { NEXTCLAW_HOME: "/tmp/nextclaw" };

  assert.deepEqual(createRuntimeScriptSpawnOptions(env), {
    env,
    stdio: "pipe",
    windowsHide: true
  });
});
