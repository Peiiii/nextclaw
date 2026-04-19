import { describe, expect, it } from "vitest";
import { resolvePublishPackageName } from "./marketplace-identity.utils.js";

describe("resolvePublishPackageName", () => {
  it("includes exact NextClaw Web and CLI guidance when username is missing", () => {
    expect(() =>
      resolvePublishPackageName({
        slug: "publish-to-nextclaw-marketplace",
        adminTokenPresent: false,
        currentUser: {
          token: "token-1",
          platformBase: "https://platform.nextclaw.io",
          v1Base: "https://ai-gateway-api.nextclaw.io/v1",
          user: {
            id: "user-1",
            email: "publisher@example.com",
            role: "user",
            username: null
          }
        }
      })
    ).toThrowError(
      /https:\/\/platform\.nextclaw\.io\/account.*nextclaw account set-username <username>/
    );
  });

  it("uses the personal username scope when the account is ready", () => {
    expect(
      resolvePublishPackageName({
        slug: "publish-to-nextclaw-marketplace",
        adminTokenPresent: false,
        currentUser: {
          token: "token-2",
          platformBase: "https://platform.nextclaw.io",
          v1Base: "https://ai-gateway-api.nextclaw.io/v1",
          user: {
            id: "user-2",
            email: "publisher@example.com",
            role: "user",
            username: "alice-dev"
          }
        }
      })
    ).toBe("@alice-dev/publish-to-nextclaw-marketplace");
  });
});
