import { useRef, useState } from "react";
import { Link } from "react-router";
import { workspaceHref } from "@/app/workspace-router";
import { Plus } from "lucide-react";
import type { BiboSession } from "@nextclaw/bibo-client";
import {
  ActionMenu,
  ActionMenuItem,
  Button,
  Dialog,
  Field,
  IconButton,
  Input,
} from "@nextclaw/personal-agent-ui";
import { useBiboChatStore } from "@/features/chat/stores/bibo-chat.store";

function SessionActions({ session }: { session: BiboSession }) {
  const store = useBiboChatStore();
  const [mode, setMode] = useState<"rename" | "delete" | null>(null);
  const [name, setName] = useState(session.title);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const open = (value: "rename" | "delete") => {
    setName(session.title);
    setFailure("");
    setMode(value);
  };
  const submit = async () => {
    if (busy) return;
    setBusy(true);
    const done =
      mode === "delete"
        ? await store.deleteSession(session.id)
        : await store.renameSession(session.id, name.trim());
    setBusy(false);
    if (done) setMode(null);
    else
      setFailure(
        useBiboChatStore.getState().status || "请在本轮回复结束后重试。"
      );
  };
  return (
    <div className="session-actions">
      <ActionMenu
        label={`管理会话 ${session.title}`}
        triggerRef={trigger}
        transferringFocus={mode !== null}
      >
        <ActionMenuItem onSelect={() => open("rename")}>重命名</ActionMenuItem>
        <ActionMenuItem
          danger
          disabled={store.phase !== "idle"}
          onSelect={() => open("delete")}
        >
          删除会话
        </ActionMenuItem>
      </ActionMenu>
      <Dialog
        open={mode !== null}
        onOpenChange={(value) => {
          if (!value) setMode(null);
        }}
        title={mode === "delete" ? "删除会话？" : "重命名会话"}
        description={
          mode === "delete"
            ? `「${session.title}」及其对话记录将被删除，此操作无法撤销。`
            : undefined
        }
        closeLabel="关闭会话操作"
        busy={busy}
        returnFocusRef={trigger}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {mode === "rename" && (
            <Field label="会话名称">
              <Input
                required
                disabled={busy}
                maxLength={100}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
          )}
          {failure && (
            <p className="ui-overlay__error" role="alert">
              {failure}
            </p>
          )}
          <div className="ui-overlay__actions">
            <Button disabled={busy} onClick={() => setMode(null)}>
              取消
            </Button>
            <Button
              tone={mode === "delete" ? "danger" : "primary"}
              type="submit"
              disabled={busy || (mode === "rename" && !name.trim())}
            >
              {busy ? "正在处理…" : mode === "delete" ? "删除会话" : "保存名称"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

export function SessionNavigation({
  active,
  onNavigate,
  mobile = false,
}: {
  active: boolean;
  onNavigate: () => void;
  mobile?: boolean;
}) {
  const store = useBiboChatStore();
  return (
    <div className="bibo-session-nav">
      <div className="bibo-session-head">
        <span>最近对话</span>
        <IconButton
          label="新建会话"
          icon={<Plus />}
          tooltip={!mobile}
          disabled={store.phase !== "idle"}
          onClick={() => {
            onNavigate();
            void store.createSession();
          }}
        />
      </div>
      {store.sessions.map((session) => (
        <div key={session.id} className="bibo-session-wrap">
          <Link
            to={workspaceHref("chat", session.id)}
            className={`bibo-session-item${
              active && store.activeSessionId === session.id ? " is-active" : ""
            }`}
            title={session.title}
            aria-disabled={store.phase !== "idle"}
            onClick={(event) => {
              if (store.phase !== "idle") { event.preventDefault(); return; }
              onNavigate();
            }}
          >
            {session.title}
          </Link>
          <SessionActions session={session} />
        </div>
      ))}
    </div>
  );
}
