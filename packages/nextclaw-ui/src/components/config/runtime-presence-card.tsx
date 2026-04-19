import { useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NoticeCard } from "@/components/ui/notice-card";
import { SettingRow } from "@/components/ui/setting-row";
import { Switch } from "@/components/ui/switch";
import { desktopPresenceManager } from "@/desktop/managers/desktop-presence.manager";
import { useDesktopPresenceStore } from "@/desktop/stores/desktop-presence.store";
import { t } from "@/lib/i18n";
import { useSystemStatus } from "@/system-status/hooks/use-system-status";

function PresenceHint(props: { title: string; description: string }) {
  const { description, title } = props;
  return <NoticeCard tone="neutral" title={title} description={description} />;
}

export function RuntimePresenceCard() {
  const systemStatus = useSystemStatus();
  const environment = systemStatus.runtimeControlView?.environment;
  const supported = useDesktopPresenceStore((state) => state.supported);
  const initialized = useDesktopPresenceStore((state) => state.initialized);
  const busyAction = useDesktopPresenceStore((state) => state.busyAction);
  const snapshot = useDesktopPresenceStore((state) => state.snapshot);

  useEffect(() => {
    if (environment === "desktop-embedded") {
      void desktopPresenceManager.start();
      return;
    }
    desktopPresenceManager.markUnsupported();
  }, [environment]);

  if (environment === "desktop-embedded") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("runtimePresenceTitle")}</CardTitle>
          <CardDescription>{t("runtimePresenceDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <NoticeCard
            tone="neutral"
            title={t("runtimePresenceBehaviorLabel")}
            description={
              snapshot?.closeToBackground
                ? t("runtimePresenceBehaviorBackground")
                : t("runtimePresenceBehaviorQuit")
            }
            className="rounded-xl"
          />

          {!initialized || (supported && !snapshot) ? (
            <p className="text-sm text-gray-500">
              {t("runtimePresenceLoading")}
            </p>
          ) : null}

          {snapshot ? (
            <div className="space-y-4">
              <SettingRow
                title={t("runtimePresenceCloseToBackground")}
                description={t("runtimePresenceCloseToBackgroundHelp")}
                control={
                  <Switch
                    id="runtime-presence-close-background"
                    aria-label={t("runtimePresenceCloseToBackground")}
                    checked={snapshot.closeToBackground}
                    disabled={busyAction === "saving-preferences"}
                    onCheckedChange={(checked) => {
                      void desktopPresenceManager.updatePreferences({
                        closeToBackground: checked,
                      });
                    }}
                  />
                }
              />

              <SettingRow
                title={t("runtimePresenceLaunchAtLogin")}
                description={
                  snapshot.supportsLaunchAtLogin
                    ? t("runtimePresenceLaunchAtLoginHelp")
                    : (snapshot.launchAtLoginReason ??
                      t("runtimePresenceLaunchAtLoginUnavailable"))
                }
                control={
                  <Switch
                    id="runtime-presence-launch-login"
                    aria-label={t("runtimePresenceLaunchAtLogin")}
                    checked={snapshot.launchAtLogin}
                    disabled={
                      !snapshot.supportsLaunchAtLogin ||
                      busyAction === "saving-preferences"
                    }
                    onCheckedChange={(checked) => {
                      void desktopPresenceManager.updatePreferences({
                        launchAtLogin: checked,
                      });
                    }}
                  />
                }
              />
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  if (environment === "managed-local-service") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("runtimePresenceTitle")}</CardTitle>
          <CardDescription>{t("runtimePresenceDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <PresenceHint
            title={t("runtimePresenceManagedLocalTitle")}
            description={t("runtimePresenceManagedLocalDescription")}
          />
        </CardContent>
      </Card>
    );
  }

  if (environment === "self-hosted-web") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("runtimePresenceTitle")}</CardTitle>
          <CardDescription>{t("runtimePresenceDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <PresenceHint
            title={t("runtimePresenceSelfHostedTitle")}
            description={t("runtimePresenceSelfHostedDescription")}
          />
        </CardContent>
      </Card>
    );
  }

  if (environment === "shared-web") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("runtimePresenceTitle")}</CardTitle>
          <CardDescription>{t("runtimePresenceDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <PresenceHint
            title={t("runtimePresenceSharedTitle")}
            description={t("runtimePresenceSharedDescription")}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("runtimePresenceTitle")}</CardTitle>
        <CardDescription>{t("runtimePresenceDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-500">{t("runtimePresenceLoading")}</p>
      </CardContent>
    </Card>
  );
}
