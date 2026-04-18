import { describe, expect, it } from "vitest";
import { createAppResourceUri, parseAppResourceUri } from "./app-resource-uri.js";

describe("app resource uri helpers", () => {
  it("creates app resource uris", () => {
    expect(createAppResourceUri("runtime-icons/codex-openai.svg")).toBe(
      "app://runtime-icons/codex-openai.svg",
    );
  });

  it("normalizes and parses app resource uris", () => {
    expect(parseAppResourceUri("app:///runtime-icons/hermes-agent.png")).toBe(
      "runtime-icons/hermes-agent.png",
    );
  });

  it("rejects escaping app resource uris", () => {
    expect(parseAppResourceUri("app://../runtime-icons/hermes-agent.png")).toBeNull();
  });
});
