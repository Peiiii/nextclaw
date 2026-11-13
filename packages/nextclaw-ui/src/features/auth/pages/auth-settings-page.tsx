import { ChevronRight, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppPresenter } from "@/app/components/app-presenter-provider";
import { useRemoteStatus } from "@/features/remote";
import {
  SettingRow,
  SettingsGroup,
  SettingsSection,
} from "@/shared/components/settings/setting-row";
import { SettingsPage } from "@/shared/components/settings/settings-page";
import { Button } from "@/shared/components/ui/button";
import { t } from "@/shared/lib/i18n";

function AdvancedSettingLinkRow({
  to,
  title,
  description,
}: {
  to: string;
  title: string;
  description: string;
}) {
  const navigate = useNavigate();
  return (
    <SettingRow
      title={title}
      description={description}
      control={
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(to)}
          className="desktop-window-no-drag"
        >
          {t("advancedManageSettings")}
          <ChevronRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      }
    />
  );
}

export function AuthSettingsPage() {
  const { data: remoteStatus } = useRemoteStatus();
  const accountManager = useAppPresenter().accountManager;
  const accountConnected = Boolean(remoteStatus?.account.loggedIn);
  const accountEmail = remoteStatus?.account.email?.trim() || "";

  return (
    <SettingsPage
      title={t("advancedAuth")}
      description={t("advancedAuthDescription")}
    >
      <SettingsSection title={t("advancedAccountTitle")}>
        <SettingsGroup>
          <SettingRow
            title={t("advancedAccountTitle")}
            description={
              accountConnected
                ? [
                    accountEmail,
                    t("advancedAccountSignedIn"),
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : t("advancedAccountSignedOut")
            }
            control={
              accountConnected ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => accountManager.logout()}
                  className="desktop-window-no-drag"
                >
                  <LogOut className="mr-1 h-3.5 w-3.5" />
                  {t("advancedLogout")}
                </Button>
              ) : undefined
            }
          />
        </SettingsGroup>
      </SettingsSection>

      <SettingsSection title={t("advancedAuth")}>
        <SettingsGroup>
          <AdvancedSettingLinkRow
            to="/remote"
            title={t("remoteAccessTitle")}
            description={t("remoteAccessDescription")}
          />
          <AdvancedSettingLinkRow
            to="/privacy"
            title={t("productAnalyticsTitle")}
            description={t("productAnalyticsDescription")}
          />
          <AdvancedSettingLinkRow
            to="/secrets"
            title={t("apiKeyManagementTitle")}
            description={t("apiKeyManagementDescription")}
          />
        </SettingsGroup>
      </SettingsSection>
    </SettingsPage>
  );
}
