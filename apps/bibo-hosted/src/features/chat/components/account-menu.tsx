import { useRef, useState } from "react";
import { CircleUserRound, ChevronsUpDown } from "lucide-react";
import {
  ActionMenu,
  ActionMenuItem,
  ActionMenuLink,
  Button,
  Dialog,
} from "@nextclaw/personal-agent-ui";
import { useBiboChatStore } from "@/features/chat/stores/bibo-chat.store";
import { biboCopy as copy } from "@/features/chat/configs/bibo-copy.config";

export function AccountMenu() {
  const store = useBiboChatStore();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const reset = async () => {
    if (busy) return;
    setBusy(true);
    const done = await store.reset();
    setBusy(false);
    if (done) setConfirming(false);
    else setFailure(useBiboChatStore.getState().status);
  };
  return (
    <>
      <ActionMenu
        label="账号与帮助"
        transferringFocus={confirming}
        trigger={
          <Button
            ref={trigger}
            className="account-menu-trigger"
            aria-label="账号与帮助"
          >
            <CircleUserRound aria-hidden="true" />
            <span>{store.user?.email ?? "账号与帮助"}</span>
            <ChevronsUpDown aria-hidden="true" />
          </Button>
        }
      >
        <ActionMenuLink href="https://bibo.bot/" external>
          认识 Bibo ↗
        </ActionMenuLink>
        <ActionMenuLink href="/help.html">{copy.help}</ActionMenuLink>
        {store.user && (
          <>
            <ActionMenuItem
              onSelect={() => void store.logout()}
              disabled={store.phase !== "idle"}
            >
              {copy.logout}
            </ActionMenuItem>
            <ActionMenuItem
              danger
              disabled={store.phase !== "idle"}
              onSelect={() => {
                setFailure("");
                setConfirming(true);
              }}
            >
              {copy.reset}
            </ActionMenuItem>
          </>
        )}
      </ActionMenu>
      <Dialog
        open={confirming}
        onOpenChange={setConfirming}
        title="清空个人空间？"
        description={copy.resetConfirm}
        closeLabel="取消清空"
        busy={busy}
        returnFocusRef={trigger}
      >
        {failure && (
          <p className="ui-overlay__error" role="alert">
            {failure}
          </p>
        )}
        <div className="ui-overlay__actions">
          <Button disabled={busy} onClick={() => setConfirming(false)}>
            保留个人空间
          </Button>
          <Button tone="danger" disabled={busy} onClick={() => void reset()}>
            {busy ? "正在清空…" : "确认清空"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
