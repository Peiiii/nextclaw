import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NoticeCard } from "@/components/ui/notice-card";
import { useRemoteStatus } from "@/features/remote";
import { formatDateTime, t } from "@/lib/i18n";
import { useAppManager } from "@/app/components/app-manager-provider";
import { useAccountStore } from "@/features/account/stores/account.store";
import { KeyRound, LogOut, SquareArrowOutUpRight } from "lucide-react";
import { useEffect, useState } from "react";

function AccountValueRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-right text-gray-900">{value?.trim() || "-"}</span>
    </div>
  );
}

function SignedInAccountSection(props: {
  email?: string | null;
  username?: string | null;
  role?: string | null;
  canSubmitUsername: boolean;
  savingUsername: boolean;
  usernameDraft: string;
  onUsernameDraftChange: (value: string) => void;
  onSubmitUsername: () => Promise<void>;
  onOpenDeviceList: () => Promise<void>;
  onLogout: () => Promise<void>;
}) {
  const {
    email,
    username,
    role,
    canSubmitUsername,
    savingUsername,
    usernameDraft,
    onUsernameDraftChange,
    onSubmitUsername,
    onOpenDeviceList,
    onLogout,
  } = props;

  return (
    <div className="space-y-4">
      <NoticeCard
        tone="success"
        title={t("accountPanelSignedInTitle")}
        description={t("accountPanelSignedInDescription")}
      />
      <NoticeCard tone="neutral">
        <AccountValueRow label={t("remoteAccountEmail")} value={email} />
        <AccountValueRow label={t("remoteAccountUsername")} value={username} />
        <AccountValueRow label={t("remoteAccountRole")} value={role} />
      </NoticeCard>
      {username ? (
        <p className="text-xs text-gray-500">
          {t("remoteAccountUsernameLockedHelp")}
        </p>
      ) : (
        <NoticeCard
          tone="warning"
          title={t("remoteAccountUsernameRequiredTitle")}
          description={t("remoteAccountUsernameRequiredDescription")}
        >
          <div className="mt-4 space-y-2">
            <Label htmlFor="account-panel-username">
              {t("remoteAccountUsername")}
            </Label>
            <Input
              id="account-panel-username"
              value={usernameDraft}
              onChange={(event) => onUsernameDraftChange(event.target.value)}
              placeholder={t("remoteAccountUsernamePlaceholder")}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              disabled={!canSubmitUsername}
              onClick={() => void onSubmitUsername()}
            >
              {savingUsername
                ? t("remoteAccountUsernameSaving")
                : t("remoteAccountUsernameSave")}
            </Button>
          </div>
        </NoticeCard>
      )}
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => void onOpenDeviceList()}>
          <SquareArrowOutUpRight className="mr-2 h-4 w-4" />
          {t("remoteOpenDeviceList")}
        </Button>
        <Button variant="outline" onClick={() => void onLogout()}>
          <LogOut className="mr-2 h-4 w-4" />
          {t("remoteLogout")}
        </Button>
      </div>
    </div>
  );
}

function SignedOutAccountSection(props: {
  authSessionId?: string | null;
  authExpiresAt?: string | null;
  authStatusMessage?: string | null;
  authVerificationUri?: string | null;
  onStartBrowserSignIn: () => Promise<void>;
  onResumeBrowserSignIn: () => void;
}) {
  const {
    authSessionId,
    authExpiresAt,
    authStatusMessage,
    authVerificationUri,
    onStartBrowserSignIn,
    onResumeBrowserSignIn,
  } = props;

  return (
    <div className="space-y-4">
      <NoticeCard
        tone="neutral"
        title={t("accountPanelSignedOutTitle")}
        description={t("accountPanelSignedOutDescription")}
      >
        {authSessionId ? (
          <div className="mt-3 border-t border-white/80 pt-3">
            <AccountValueRow
              label={t("remoteBrowserAuthSession")}
              value={authSessionId}
            />
            <AccountValueRow
              label={t("remoteBrowserAuthExpiresAt")}
              value={authExpiresAt ? formatDateTime(authExpiresAt) : "-"}
            />
          </div>
        ) : null}
      </NoticeCard>
      {authStatusMessage ? (
        <p className="text-sm text-gray-600">{authStatusMessage}</p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => void onStartBrowserSignIn()}>
          {authSessionId
            ? t("remoteBrowserAuthActionRetry")
            : t("remoteBrowserAuthAction")}
        </Button>
        {authVerificationUri ? (
          <Button variant="outline" onClick={onResumeBrowserSignIn}>
            {t("remoteBrowserAuthResume")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function AccountPanel() {
  const manager = useAppManager();
  const remoteStatus = useRemoteStatus();
  const panelOpen = useAccountStore((state) => state.panelOpen);
  const authSessionId = useAccountStore((state) => state.authSessionId);
  const authVerificationUri = useAccountStore(
    (state) => state.authVerificationUri,
  );
  const authExpiresAt = useAccountStore((state) => state.authExpiresAt);
  const authStatusMessage = useAccountStore((state) => state.authStatusMessage);
  const status = remoteStatus.data;
  const [usernameDraft, setUsernameDraft] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);

  useEffect(() => {
    manager.accountManager.syncRemoteStatus(status);
  }, [manager, status]);

  const canSubmitUsername =
    !savingUsername &&
    usernameDraft.trim().length > 0 &&
    !status?.account.username;

  return (
    <Dialog
      open={panelOpen}
      onOpenChange={(open) =>
        open
          ? manager.accountManager.openAccountPanel()
          : manager.accountManager.closeAccountPanel()
      }
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            {t("accountPanelTitle")}
          </DialogTitle>
          <DialogDescription>{t("accountPanelDescription")}</DialogDescription>
        </DialogHeader>

        {status?.account.loggedIn ? (
          <SignedInAccountSection
            email={status.account.email}
            username={status.account.username}
            role={status.account.role}
            canSubmitUsername={canSubmitUsername}
            savingUsername={savingUsername}
            usernameDraft={usernameDraft}
            onUsernameDraftChange={setUsernameDraft}
            onSubmitUsername={async () => {
              setSavingUsername(true);
              try {
                await manager.accountManager.updateUsername(usernameDraft);
              } finally {
                setSavingUsername(false);
              }
            }}
            onOpenDeviceList={() => manager.accountManager.openNextClawWeb('/account')}
            onLogout={() => manager.accountManager.logout()}
          />
        ) : (
          <SignedOutAccountSection
            authSessionId={authSessionId}
            authExpiresAt={authExpiresAt}
            authStatusMessage={authStatusMessage}
            authVerificationUri={authVerificationUri}
            onStartBrowserSignIn={() =>
              manager.accountManager.startBrowserSignIn()
            }
            onResumeBrowserSignIn={() =>
              manager.accountManager.resumeBrowserSignIn()
            }
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
