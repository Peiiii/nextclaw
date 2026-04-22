import { type ReactNode, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { NoticeCard } from "@/shared/components/ui/notice-card";
import { SettingRow } from "@/shared/components/ui/setting-row";
import { Switch } from "@/shared/components/ui/switch";
import {
  desktopPresenceManager,
  useDesktopPresenceStore,
} from "@/platforms/desktop";
import { useSystemStatus } from "@/features/system-status";
import { t } from "@/shared/lib/i18n";

function PresenceHint(props: { title: string; description: string }) {
  const { description, title } = props;
  return <NoticeCard tone="neutral" title={title} description={description} />;
}

function PresenceCardFrame(props: { children: ReactNode }) {
  const { children } = props;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("runtimePresenceTitle")}</CardTitle>
        <CardDescription>{t("runtimePresenceDescription")}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
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
      <PresenceCardFrame>
        <div className="space-y-4">
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
        </div>
      </PresenceCardFrame>
    );
  }

  if (environment === "managed-local-service") {
    return (
      <PresenceCardFrame>
          <PresenceHint
            title={t("runtimePresenceManagedLocalTitle")}
            description={t("runtimePresenceManagedLocalDescription")}
          />
      </PresenceCardFrame>
    );
  }

  if (environment === "self-hosted-web") {
    return (
      <PresenceCardFrame>
          <PresenceHint
            title={t("runtimePresenceSelfHostedTitle")}
            description={t("runtimePresenceSelfHostedDescription")}
          />
      </PresenceCardFrame>
    );
  }

  if (environment === "shared-web") {
    return (
      <PresenceCardFrame>
          <PresenceHint
            title={t("runtimePresenceSharedTitle")}
            description={t("runtimePresenceSharedDescription")}
          />
      </PresenceCardFrame>
    );
  }

  return (
    <PresenceCardFrame>
        <p className="text-sm text-gray-500">{t("runtimePresenceLoading")}</p>
    </PresenceCardFrame>
  );
}
