/** The sole user-facing command grammar for installing a Marketplace App. */
export function formatNextClawAppInstallCommand(appId: string): string {
  const normalizedAppId = appId.trim();
  if (!normalizedAppId) throw new Error("App id is required to format an install command.");
  return `nextclaw app install ${normalizedAppId}`;
}
