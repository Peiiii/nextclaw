import { describe, expect, it, vi } from "vitest";
import { printCronJobs } from "./cron-job.utils.js";

describe("printCronJobs", () => {
  it("shows whether each job is enabled or disabled", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => void 0);

    try {
      printCronJobs([
        { id: "job-1", name: "daily", enabled: true, schedule: { kind: "cron", expr: "0 9 * * *" }, payload: { message: "x" } },
        { id: "job-2", name: "paused", enabled: false, schedule: { kind: "every", everyMs: 60_000 }, payload: { message: "y" } }
      ]);

      expect(log).toHaveBeenNthCalledWith(1, "job-1 [enabled] daily 0 9 * * *");
      expect(log).toHaveBeenNthCalledWith(2, "job-2 [disabled] paused every 60s");
    } finally {
      log.mockRestore();
    }
  });
});
