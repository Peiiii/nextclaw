import { describe, expect, it } from "vitest";
import { eventKeys } from "./index.js";

describe("eventKeys", () => {
  it("keeps kernel event key ids stable", () => {
    expect(eventKeys.sessionRunStatus.id).toBe("session.run-status");
    expect(eventKeys.runtimeUpdateSnapshot.id).toBe("runtime.update.snapshot");
  });
});
