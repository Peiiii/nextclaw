import { describe, expect, it } from "vitest";
import {
  AUTOMATIC_UPDATE_CHECK_INTERVAL_MS,
  getAutomaticUpdateCheckDelay,
  resolveAutomaticUpdateCheckIntervalMs,
} from "./automatic-update-check.utils.js";

describe("automatic update check policy", () => {
  it("uses a fixed two-hour production interval", () => {
    expect(AUTOMATIC_UPDATE_CHECK_INTERVAL_MS).toBe(2 * 60 * 60 * 1000);
    expect(resolveAutomaticUpdateCheckIntervalMs({
      verificationMode: false,
      verificationIntervalMs: "500",
    })).toBe(AUTOMATIC_UPDATE_CHECK_INTERVAL_MS);
  });

  it("calculates the remaining delay from the last completed check", () => {
    const now = Date.parse("2026-07-17T12:00:00.000Z");
    expect(getAutomaticUpdateCheckDelay("2026-07-17T11:00:00.000Z", now)).toBe(60 * 60 * 1000);
    expect(getAutomaticUpdateCheckDelay("2026-07-17T10:00:00.000Z", now)).toBe(0);
  });

  it("treats missing, invalid, or future timestamps as due", () => {
    const now = Date.parse("2026-07-17T12:00:00.000Z");
    expect(getAutomaticUpdateCheckDelay(null, now)).toBe(0);
    expect(getAutomaticUpdateCheckDelay("invalid", now)).toBe(0);
    expect(getAutomaticUpdateCheckDelay("2026-07-17T12:00:01.000Z", now)).toBe(0);
  });

  it("allows only explicit valid verification intervals", () => {
    expect(resolveAutomaticUpdateCheckIntervalMs({
      verificationMode: true,
      verificationIntervalMs: "500",
    })).toBe(500);
    expect(() => resolveAutomaticUpdateCheckIntervalMs({
      verificationMode: true,
      verificationIntervalMs: "99",
    })).toThrow("must be an integer of at least 100");
  });
});
