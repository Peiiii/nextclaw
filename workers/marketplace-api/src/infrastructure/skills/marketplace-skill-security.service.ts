import { DomainValidationError } from "@/domain/errors";
import type { MarketplaceSkillUpsertInput } from "./d1-section-types";
import type { D1MarketplaceSkillAdminSupport } from "./d1-marketplace-skill-admin-support";
import {
  scanDecodedMarketplaceSkillFiles,
  scanEncodedMarketplaceSkillFiles,
  type MarketplaceSkillSecurityScan
} from "./marketplace-skill-security.utils";

export class MarketplaceSkillSecurityService {
  constructor(
    private readonly adminSupport: D1MarketplaceSkillAdminSupport,
    private readonly decodeBase64: (raw: string, path: string) => Uint8Array
  ) {}

  scanUploadedFiles = (files: MarketplaceSkillUpsertInput["files"]): MarketplaceSkillSecurityScan => {
    return scanEncodedMarketplaceSkillFiles(files, this.decodeBase64);
  };

  assertAllowsStorage = (scan: MarketplaceSkillSecurityScan): void => {
    if (scan.verdict !== "blocked") {
      return;
    }
    const findingCodes = [...new Set(scan.findings
      .filter((finding) => finding.verdict === "blocked")
      .map((finding) => finding.code))]
      .sort();
    throw new DomainValidationError(`skill files blocked by marketplace security policy: ${findingCodes.join(", ")}`);
  };

  assertStoredSkillCanPublish = async (selector: string): Promise<void> => {
    const filesPayload = await this.adminSupport.getSkillFiles(selector, { includeUnpublished: true });
    if (!filesPayload) {
      throw new DomainValidationError(`skill item not found: ${selector}`);
    }
    const decodedFiles = await Promise.all(filesPayload.files.map(async (file) => {
      const content = await this.adminSupport.getSkillFileContent(selector, file.path, { includeUnpublished: true });
      if (!content) {
        throw new DomainValidationError(`skill file content missing: ${file.path}`);
      }
      return {
        path: file.path,
        bytes: content.bytes
      };
    }));
    this.assertAllowsStorage(scanDecodedMarketplaceSkillFiles(decodedFiles));
  };
}
