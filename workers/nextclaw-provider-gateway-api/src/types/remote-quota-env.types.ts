import type { Env } from "@/types/platform";

export type RemoteQuotaEnv = Env & {
  REMOTE_CLOUDFLARE_PLAN_PROFILE?: string;
  REMOTE_QUOTA_WS_USAGE_REPORT_SIZE?: string;
};
