import { describe, expect, it } from "vitest";
import { setLanguage } from "@/shared/lib/i18n";
import { resolveUiDocumentTitle } from "@/shared/lib/ui-document-title";

type TestLocation = Pick<Location, "host" | "hostname" | "port">;

function testLocation(host: string, hostname: string, port = ""): TestLocation {
  return { host, hostname, port };
}

describe("resolveUiDocumentTitle", () => {
  it("keeps the previous title shape when the browser location is unavailable", () => {
    setLanguage("en");

    expect(resolveUiDocumentTitle("/chat")).toBe("NextClaw - Chat");
  });

  it("uses only the port for localhost instances", () => {
    setLanguage("en");

    expect(
      resolveUiDocumentTitle(
        "/chat",
        testLocation("localhost:5173", "localhost", "5173"),
      ),
    ).toBe("NextClaw 5173 - Chat");
  });

  it("uses only the port for loopback IP instances", () => {
    setLanguage("en");

    expect(
      resolveUiDocumentTitle(
        "/model",
        testLocation("127.0.0.1:3000", "127.0.0.1", "3000"),
      ),
    ).toBe("NextClaw 3000 - Model Configuration");
  });

  it("uses the full host for non-local instances", () => {
    setLanguage("en");
    const title = resolveUiDocumentTitle(
      "/providers",
      testLocation("nextclaw.example.com:8443", "nextclaw.example.com", "8443"),
    );

    expect(title).toBe("NextClaw nextclaw.example.com:8443 - AI Providers");
  });
});
