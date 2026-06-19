import { t } from "@/shared/lib/i18n";

const PRODUCT = "NextClaw";

type UiDocumentTitleLocation = Pick<Location, "host" | "hostname" | "port">;

const ROUTE_TITLE_KEYS: Array<{ prefix: string; key: string }> = [
  { prefix: "/marketplace/mcp", key: "marketplaceMcpPageTitle" },
  { prefix: "/marketplace/skills", key: "marketplaceSkillsPageTitle" },
  { prefix: "/marketplace", key: "marketplace" },
  { prefix: "/skills", key: "marketplaceSkillsPageTitle" },
  { prefix: "/cron", key: "cronPageTitle" },
  { prefix: "/agents", key: "agentsPageTitle" },
  { prefix: "/chat", key: "chat" },
  { prefix: "/model", key: "modelPageTitle" },
  { prefix: "/search", key: "searchPageTitle" },
  { prefix: "/providers", key: "providersPageTitle" },
  { prefix: "/channels", key: "channelsPageTitle" },
  { prefix: "/runtime", key: "runtimePageTitle" },
  { prefix: "/updates", key: "runtimeUpdatesPageTitle" },
  { prefix: "/remote", key: "remotePageTitle" },
  { prefix: "/security", key: "authSecurityTitle" },
  { prefix: "/secrets", key: "secretsPageTitle" },
];

function pathMatchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function segmentTitle(pathname: string): string {
  const p = pathname.toLowerCase();
  for (const { prefix, key } of ROUTE_TITLE_KEYS) {
    if (pathMatchesPrefix(p, prefix)) {
      return t(key);
    }
  }
  return t("settings");
}

function isLocalInstanceHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "::1" ||
    normalized === "[::1]" ||
    normalized.startsWith("127.")
  );
}

function resolveInstanceTitleSegment(
  location?: UiDocumentTitleLocation | null,
): string | null {
  const host = location?.host.trim();
  const hostname = location?.hostname.trim();
  const port = location?.port.trim();
  if (!host || !hostname) {
    return null;
  }
  return isLocalInstanceHostname(hostname) ? port || null : host;
}

/** Browser tab / window title; kept in sync with the active UI route. */
export function resolveUiDocumentTitle(
  pathname: string,
  location?: UiDocumentTitleLocation | null,
): string {
  const instance = resolveInstanceTitleSegment(location);
  return `${PRODUCT}${instance ? ` ${instance}` : ""} - ${segmentTitle(pathname)}`;
}
