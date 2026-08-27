import type { CapabilityGrantView } from "@nextclaw/client-sdk";
import { Button } from "@/shared/components/ui/button";
import { SettingsPage } from "@/shared/components/settings/settings-page";
import {
  SettingRow,
  SettingsGroup,
  SettingsSection,
} from "@/shared/components/settings/setting-row";
import { t } from "@/shared/lib/i18n";
import {
  useDesktopCapabilityGrants,
  useDesktopCapabilityStatus,
  useOpenDesktopSystemSettings,
  useRequestDesktopSystemPermission,
  useRevokeDesktopGrant,
} from "../hooks/use-desktop-capabilities";

export function DesktopCapabilitiesPage() {
  const statusQuery = useDesktopCapabilityStatus();
  const grantsQuery = useDesktopCapabilityGrants();
  const requestPermission = useRequestDesktopSystemPermission();
  const openSettings = useOpenDesktopSystemSettings();
  const revokeGrant = useRevokeDesktopGrant();
  const status = statusQuery.data;
  const busy = requestPermission.isPending || openSettings.isPending;

  return (
    <SettingsPage
      title={t("desktopCapabilitiesPageTitle")}
      description={t("desktopCapabilitiesPageDescription")}
    >
      <SettingsSection
        title={t("desktopCapabilitiesSystemTitle")}
        description={t("desktopCapabilitiesSystemDescription")}
      >
        <SettingsGroup>
          <SettingRow
            title={t("desktopCapabilitiesHostStatus")}
            description={
              statusQuery.isLoading
                ? t("loading")
                : status?.online
                  ? t("desktopCapabilitiesHostOnline")
                  : t("desktopCapabilitiesHostOffline")
            }
            control={(
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={statusQuery.isFetching}
                onClick={() => void statusQuery.refetch()}
              >
                {t("desktopCapabilitiesRecheck")}
              </Button>
            )}
          />
          <SettingRow
            title={t("desktopCapabilitiesAccessibility")}
            description={formatPermission(status?.permissions.accessibility)}
            control={(
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => openSettings.mutate()}
                >
                  {t("desktopCapabilitiesOpenSettings")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={() => requestPermission.mutate()}
                >
                  {t("desktopCapabilitiesRequestPermission")}
                </Button>
              </div>
            )}
          />
        </SettingsGroup>
      </SettingsSection>

      <SettingsSection
        title={t("desktopCapabilitiesGrantsTitle")}
        description={t("desktopCapabilitiesGrantsDescription")}
      >
        <SettingsGroup>
          {grantsQuery.isLoading ? (
            <SettingRow title={t("loading")} />
          ) : grantsQuery.data?.length ? (
            grantsQuery.data.map((grant) => (
              <DesktopGrantRow
                key={grantKey(grant)}
                grant={grant}
                disabled={revokeGrant.isPending}
                onRevoke={() => revokeGrant.mutate(grant)}
              />
            ))
          ) : (
            <SettingRow
              title={t("desktopCapabilitiesNoGrants")}
              description={t("desktopCapabilitiesNoGrantsDescription")}
            />
          )}
        </SettingsGroup>
      </SettingsSection>
    </SettingsPage>
  );
}

function DesktopGrantRow({
  disabled,
  grant,
  onRevoke,
}: {
  disabled: boolean;
  grant: CapabilityGrantView;
  onRevoke: () => void;
}) {
  const target = readApplicationId(grant.resource.target);
  const subject = grant.subject.type === "agent"
    ? `${t("desktopCapabilitiesAgent")} · ${grant.subject.id}`
    : `${t("desktopCapabilitiesExtension")} · ${grant.subject.id}`;
  return (
    <SettingRow
      title={subject}
      description={`${target} · ${grant.access.join(", ")}`}
      control={(
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={disabled}
          onClick={onRevoke}
        >
          {t("desktopCapabilitiesRevoke")}
        </Button>
      )}
    />
  );
}

function readApplicationId(target: unknown): string {
  if (!target || typeof target !== "object" || Array.isArray(target)) {
    return t("desktopCapabilitiesUnknownApplication");
  }
  const { applicationId } = target as { applicationId?: unknown };
  return typeof applicationId === "string" && applicationId.trim()
    ? applicationId.trim()
    : t("desktopCapabilitiesUnknownApplication");
}

function formatPermission(value: string | undefined): string {
  switch (value) {
    case "granted":
      return t("desktopCapabilitiesPermissionGranted");
    case "not_granted":
      return t("desktopCapabilitiesPermissionNotGranted");
    case "not_supported":
      return t("desktopCapabilitiesPermissionNotSupported");
    default:
      return t("desktopCapabilitiesPermissionUnknown");
  }
}

function grantKey(grant: CapabilityGrantView): string {
  return `${grant.subject.type}:${grant.subject.id}:${JSON.stringify(grant.resource.target)}:${grant.access.join(",")}`;
}
