import { describe, expect, it } from "vitest";
import { HermesHttpAdapterSessionStore } from "./hermes-http-adapter-session-store.service.js";

describe("HermesHttpAdapterSessionStore session identity", () => {
  it("binds the first Hermes session id and accepts the same id again", () => {
    const sessions = new HermesHttpAdapterSessionStore();

    sessions.bindHermesSessionId("nextclaw-session-1", " hermes-session-1 ");
    sessions.bindHermesSessionId("nextclaw-session-1", "hermes-session-1");

    expect(sessions.readHermesSessionId("nextclaw-session-1")).toBe(
      "hermes-session-1",
    );
  });

  it("rejects a different Hermes session id after identity is bound", () => {
    const sessions = new HermesHttpAdapterSessionStore();
    sessions.bindHermesSessionId("nextclaw-session-1", "hermes-session-stable");

    expect(() => {
      sessions.bindHermesSessionId(
        "nextclaw-session-1",
        "hermes-session-replacement",
      );
    }).toThrow(
      '[hermes-http-adapter] session identity for nextclaw-session-1 cannot change: "hermes-session-stable" -> "hermes-session-replacement".',
    );
    expect(sessions.readHermesSessionId("nextclaw-session-1")).toBe(
      "hermes-session-stable",
    );
  });
});
