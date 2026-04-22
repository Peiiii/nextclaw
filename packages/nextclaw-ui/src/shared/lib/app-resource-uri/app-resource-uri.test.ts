import { describe, expect, it } from "vitest";
import { resolveAppResourceUri } from "@/shared/lib/app-resource-uri";

describe("resolveAppResourceUri", () => {
  it("maps app resource uris to public app paths", () => {
    expect(resolveAppResourceUri("app://runtime-icons/codex-openai.svg")).toBe(
      "/runtime-icons/codex-openai.svg",
    );
  });

  it("passes through ordinary image src values for compatibility", () => {
    expect(resolveAppResourceUri("https://example.com/icon.png")).toBe(
      "https://example.com/icon.png",
    );
  });

  it("rejects app resource uris that escape the app resource directory", () => {
    expect(resolveAppResourceUri("app://../icon.png")).toBeNull();
  });
});
