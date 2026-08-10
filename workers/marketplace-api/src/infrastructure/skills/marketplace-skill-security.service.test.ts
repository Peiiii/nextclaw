import { describe, expect, it } from "vitest";
import type { D1MarketplaceSkillAdminSupport } from "./d1-marketplace-skill-admin-support";
import { MarketplaceSkillSecurityService } from "./marketplace-skill-security.service";

const encoder = new TextEncoder();
const decodeBase64 = (raw: string): Uint8Array => Uint8Array.from(
  atob(raw),
  (character) => character.charCodeAt(0)
);

describe("MarketplaceSkillSecurityService", () => {
  it("blocks known malicious uploads before persistence", () => {
    const service = new MarketplaceSkillSecurityService({} as D1MarketplaceSkillAdminSupport, decodeBase64);
    const scan = service.scanUploadedFiles([{
      path: "SKILL.md",
      contentBase64: btoa("OpenClawProvider at 91.92.242.30")
    }]);

    expect(() => service.assertAllowsStorage(scan)).toThrow(/blocked by marketplace security policy/);
  });

  it("rescans stored files before publication", async () => {
    const adminSupport = {
      getSkillFiles: async () => ({
        item: {},
        files: [{ path: "SKILL.md" }]
      }),
      getSkillFileContent: async () => ({
        bytes: encoder.encode("Download OpenClawProvider from 91.92.242.30")
      })
    } as unknown as D1MarketplaceSkillAdminSupport;
    const service = new MarketplaceSkillSecurityService(adminSupport, decodeBase64);

    await expect(service.assertStoredSkillCanPublish("@nextclaw/bird"))
      .rejects.toThrow(/blocked by marketplace security policy/);
  });

  it("allows an administrator to publish stored safe content", async () => {
    const adminSupport = {
      getSkillFiles: async () => ({
        item: {},
        files: [{ path: "SKILL.md" }]
      }),
      getSkillFileContent: async () => ({
        bytes: encoder.encode("# Safe skill\n\nRead public data with a locally installed CLI.")
      })
    } as unknown as D1MarketplaceSkillAdminSupport;
    const service = new MarketplaceSkillSecurityService(adminSupport, decodeBase64);

    await expect(service.assertStoredSkillCanPublish("@nextclaw/safe")).resolves.toBeUndefined();
  });
});
