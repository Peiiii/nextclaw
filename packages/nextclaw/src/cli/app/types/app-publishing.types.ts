import type { AppPublishValidationResult } from "@nextclaw/app-runtime";

export type AppPublishingCommandOptions = {
  meta?: string;
  json?: boolean;
};

export type AppPublishCommandOptions = AppPublishingCommandOptions & {
  allowWarnings?: boolean;
};

export type NextClawAppPublishValidationResult = AppPublishValidationResult & {
  profile: "components";
  distributionMode: "bundle";
};

export type NextClawAppPublishResult = {
  validation: NextClawAppPublishValidationResult;
  publish: {
    created: boolean;
    item: {
      slug: string;
      appId: string;
      ownerScope: string;
      appName: string;
      publishStatus: "pending" | "published";
      name: string;
      latestVersion: string;
      webUrl?: string;
    };
    fileCount: number;
  };
};
