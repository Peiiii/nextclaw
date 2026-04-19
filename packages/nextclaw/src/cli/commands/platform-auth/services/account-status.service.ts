import type { PlatformMeResult } from "../index.js";

const NEXTCLAW_WEB_ACCOUNT_URL = "https://platform.nextclaw.io/account";
const ACCOUNT_SET_USERNAME_HELP = "nextclaw account set-username <username>";

export type AccountStatusView = {
  email: string;
  role: string;
  username: string | null;
  platformBase: string;
  v1Base: string;
  publishReadiness: "ready" | "needs_username";
  personalScope: string | null;
  nextClawWebAccountUrl: string;
  cliSetUsernameCommand: string;
};

export function toAccountStatusView(result: PlatformMeResult): AccountStatusView {
  const username = result.user.username?.trim() || null;
  return {
    email: result.user.email,
    role: result.user.role,
    username,
    platformBase: result.platformBase,
    v1Base: result.v1Base,
    publishReadiness: username ? "ready" : "needs_username",
    personalScope: username ? `@${username}/*` : null,
    nextClawWebAccountUrl: NEXTCLAW_WEB_ACCOUNT_URL,
    cliSetUsernameCommand: ACCOUNT_SET_USERNAME_HELP
  };
}

export function printAccountStatus(view: AccountStatusView): void {
  console.log("NextClaw account status");
  console.log(`Email: ${view.email}`);
  console.log(`Role: ${view.role}`);
  console.log(`Username: ${view.username ?? "(not set)"}`);
  console.log(
    `Publish readiness: ${view.publishReadiness === "ready" ? "ready" : "action required - username missing"}`
  );
  console.log(`Personal scope: ${view.personalScope ?? "(blocked until username is set)"}`);
  console.log(`NextClaw Web account settings: ${view.nextClawWebAccountUrl}`);
  console.log(`CLI fallback: ${view.cliSetUsernameCommand}`);
}

export function printUsernameUpdated(view: AccountStatusView): void {
  console.log(`✓ Username saved: ${view.username}`);
  console.log(`✓ Personal publish scope: ${view.personalScope}`);
  console.log(`✓ NextClaw Web account settings: ${view.nextClawWebAccountUrl}`);
}
