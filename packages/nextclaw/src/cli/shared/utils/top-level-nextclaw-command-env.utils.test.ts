import { describe, expect, it } from "vitest";
import { createTopLevelNextclawCommandEnv } from "./top-level-nextclaw-command-env.utils.js";

describe("createTopLevelNextclawCommandEnv", () => {
  it("removes runtime bundle relaunch markers", () => {
    const env = createTopLevelNextclawCommandEnv({
      PATH: process.env.PATH,
      NEXTCLAW_RUNTIME_BUNDLE_CHILD: "1",
      NEXTCLAW_DISABLE_RUNTIME_BUNDLE_LAUNCHER: "1",
      KEEP_ME: "ok",
    });

    expect(env.NEXTCLAW_RUNTIME_BUNDLE_CHILD).toBeUndefined();
    expect(env.NEXTCLAW_DISABLE_RUNTIME_BUNDLE_LAUNCHER).toBeUndefined();
    expect(env.KEEP_ME).toBe("ok");
  });
});
