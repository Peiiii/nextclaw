import { describe, expect, it } from "vitest";
import { createCronCreateRequest } from "./cron-local.service.js";

describe("createCronCreateRequest", () => {
  it("passes the target session id from CLI options", () => {
    const result = createCronCreateRequest({
      name: "continue",
      message: "continue the existing thread",
      every: "300",
      session: "  session-existing  ",
    });

    expect(result.request).toMatchObject({
      name: "continue",
      message: "continue the existing thread",
      schedule: { kind: "every", everyMs: 300_000 },
      sessionId: "session-existing",
    });
  });
});
