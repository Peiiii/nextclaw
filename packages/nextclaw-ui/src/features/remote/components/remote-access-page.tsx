import { PageHeader, PageLayout } from "@/app/components/layout/page-layout";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { NoticeCard } from "@/shared/components/ui/notice-card";
import { StatusDot } from "@/shared/components/ui/status-dot";
import { useAppManager } from "@/app/components/app-manager-provider";
import {
  buildRemoteAccessFeedbackView,
  resolveRemoteWebBase,
  useRemoteAccessStore,
} from "@/features/remote";
import { useRemoteStatus } from "@/features/remote/hooks/use-remote-access";
import { formatDateTime, t } from "@/shared/lib/i18n";
import { Laptop, RefreshCcw, SquareArrowOutUpRight } from "lucide-react";
import { useEffect, useMemo } from "react";

function KeyValueRow(props: {
  label: string;
  value?: string | number | null;
  muted?: boolean;
}) {
  const { label, muted, value: rawValue } = props;
  const value =
    rawValue === undefined || rawValue === null || rawValue === ""
      ? "-"
      : String(rawValue);
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <span className="text-gray-500">{label}</span>
      <span
        className={
          muted ? "text-right text-gray-500" : "text-right text-gray-900"
        }
      >
        {value}
      </span>
    </div>
  );
}

export function RemoteAccessPage() {
  const manager = useAppManager();
  const remoteStatus = useRemoteStatus();
  const status = remoteStatus.data;
  const actionLabel = useRemoteAccessStore((state) => state.actionLabel);
  const feedbackView = useMemo(
    () => buildRemoteAccessFeedbackView(status),
    [status],
  );
  const busy = Boolean(actionLabel);
  const deviceName =
    status?.runtime?.deviceName?.trim() ||
    status?.settings.deviceName?.trim() ||
    t("remoteDeviceNameAuto");
  const canOpenDeviceList = Boolean(
    status?.account.loggedIn && resolveRemoteWebBase(status),
  );
  const { hero: heroView, issueHint } = feedbackView;

  useEffect(() => {
    manager.remoteAccessManager.syncStatus(status);
  }, [manager, status]);

  if (remoteStatus.isLoading && !status) {
    return <div className="p-8 text-gray-400">{t("remoteLoading")}</div>;
  }

  return (
    <PageLayout className="space-y-6">
      <PageHeader
        title={t("remotePageTitle")}
        description={t("remotePageDescription")}
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <CardTitle>{heroView.title}</CardTitle>
              <StatusDot
                status={heroView.badgeStatus}
                label={heroView.badgeLabel}
              />
            </div>
            <CardDescription>{heroView.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <NoticeCard tone="neutral">
              <KeyValueRow
                label={t("remoteSignedInAccount")}
                value={status?.account.email}
              />
              <KeyValueRow label={t("remoteDeviceName")} value={deviceName} />
              <KeyValueRow
                label={t("remoteConnectionStatus")}
                value={heroView.badgeLabel}
              />
              <KeyValueRow
                label={t("remoteLastConnectedAt")}
                value={
                  status?.runtime?.lastConnectedAt
                    ? formatDateTime(status.runtime.lastConnectedAt)
                    : "-"
                }
                muted
              />
            </NoticeCard>

            <div className="flex flex-wrap gap-3">
              {feedbackView.primaryAction ? (
                <Button
                  onClick={() => {
                    if (feedbackView.primaryAction?.kind === "reauthorize") {
                      void manager.remoteAccessManager.reauthorizeRemoteAccess(
                        status,
                      );
                      return;
                    }
                    if (feedbackView.primaryAction?.kind === "repair") {
                      void manager.remoteAccessManager.repairRemoteAccess(
                        status,
                      );
                      return;
                    }
                    void manager.remoteAccessManager.enableRemoteAccess(
                      status,
                    );
                  }}
                  disabled={busy}
                >
                  {feedbackView.primaryAction.showRefreshIcon ? (
                    <RefreshCcw className="mr-2 h-4 w-4" />
                  ) : null}
                  {actionLabel || feedbackView.primaryAction.label}
                </Button>
              ) : null}

              <Button
                variant="outline"
                onClick={() => void manager.accountManager.openNextClawWeb()}
                disabled={busy || !canOpenDeviceList}
              >
                <SquareArrowOutUpRight className="mr-2 h-4 w-4" />
                {t("remoteOpenDeviceList")}
              </Button>

              {status?.settings.enabled ? (
                <Button
                  variant="outline"
                  onClick={() =>
                    void manager.remoteAccessManager.disableRemoteAccess(
                      status,
                    )
                  }
                  disabled={busy}
                >
                  {t("remoteDisable")}
                </Button>
              ) : null}
            </div>

            {feedbackView.shouldShowIssueHint && issueHint ? (
              <NoticeCard
                tone="warning"
                title={issueHint.title}
                description={issueHint.body}
              />
            ) : null}

            <p className="text-xs text-gray-500">{t("remoteOpenWebHint")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Laptop className="h-4 w-4 text-primary" />
              {t("remoteDeviceSectionTitle")}
            </CardTitle>
            <CardDescription>
              {t("remoteDeviceSectionDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <StatusDot
                status={status?.account.loggedIn ? "ready" : "inactive"}
                label={
                  status?.account.loggedIn
                    ? t("remoteAccountConnected")
                    : t("remoteAccountNotConnected")
                }
              />
              <StatusDot
                status={status?.settings.enabled ? "active" : "inactive"}
                label={
                  status?.settings.enabled
                    ? t("remoteEnabled")
                    : t("remoteStateDisabled")
                }
              />
              <StatusDot
                status={status?.service.running ? "active" : "inactive"}
                label={
                  status?.service.running
                    ? t("remoteServiceRunning")
                    : t("remoteServiceStopped")
                }
              />
            </div>

            <NoticeCard tone="neutral">
              <KeyValueRow label={t("remoteDeviceName")} value={deviceName} />
              <KeyValueRow
                label={t("remoteConnectionStatus")}
                value={heroView.badgeLabel}
              />
              <KeyValueRow
                label={t("remoteLastConnectedAt")}
                value={
                  status?.runtime?.lastConnectedAt
                    ? formatDateTime(status.runtime.lastConnectedAt)
                    : "-"
                }
                muted
              />
            </NoticeCard>

            <NoticeCard
              tone="neutral"
              borderStyle="dashed"
              description={
                status?.account.loggedIn
                  ? t("remoteOpenWebHint")
                  : t("remoteStatusNeedsSignInDescription")
              }
              className="text-sm"
            />
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
