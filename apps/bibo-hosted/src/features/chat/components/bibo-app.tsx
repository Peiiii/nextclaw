import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router";
import { navigateConversation, readWorkspaceRoute, workspaceHref } from "@/app/workspace-router";
import { Button, Composer, IconButton, Input, Message, SegmentedControl, Sheet } from "@nextclaw/personal-agent-ui";
import { biboCopy as copy } from "@/features/chat/configs/bibo-copy.config";
import { useBiboChatStore } from "@/features/chat/stores/bibo-chat.store";
import { BiboSpaceView, BiboWorkspace, useBiboSpaceStore, type BiboView } from "@/features/space";

import { ArrowDown, Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { SessionNavigation } from "./session-navigation";
import { AccountMenu } from "./account-menu";

const suggestions = [
  { mark: "✳", label: "先认识我", text: "我想让你成为我的个人搭档。先问我三个关键问题，了解我最近最在意的目标，然后帮我选一件今天能推进的事。" },
  { mark: "▤", label: "梳理一个项目", text: "我正在做一个项目，想和你一起理清现状、目标和下一步。请先问我必要的问题。" },
  { mark: "◷", label: "整理今天", text: "今天我有不少事要做。请帮我根据重要性和精力安排一个现实可执行的计划，先问我需要的信息。" },
];
const navigation: { view: BiboView; label: string; mark: string }[] = [
  { view: "overview", label: "概览", mark: "▦" }, { view: "chat", label: "对话", mark: "✳" },
  { view: "inbox", label: "收件箱", mark: "✉" }, { view: "calendar", label: "日程", mark: "◷" },
  { view: "tasks", label: "任务", mark: "✓" }, { view: "notes", label: "笔记", mark: "≡" },
  { view: "files", label: "文件", mark: "▤" },
];

function AuthPanel() {
  const mode = useBiboChatStore((state) => state.authMode);
  const error = useBiboChatStore((state) => state.authError);
  const setMode = useBiboChatStore((state) => state.setAuthMode);
  const sendCode = useBiboChatStore((state) => state.sendCode);
  const authenticate = useBiboChatStore((state) => state.authenticate);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [working, setWorking] = useState(false);
  const [codeWorking, setCodeWorking] = useState(false);
  const requestCode = async () => {
    setCodeWorking(true);
    try { await sendCode(email.trim()); }
    finally { setCodeWorking(false); }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setWorking(true);
    try { await authenticate(email.trim(), password, code.trim()); }
    finally { setWorking(false); }
  };
  return <div className="bibo-auth-overlay"><section className="bibo-auth-card" aria-labelledby="bibo-auth-title">
    <div className="bibo-auth-mark">✳</div>
    <p className="bibo-eyebrow">WELCOME TO BIBO</p>
    <h2 id="bibo-auth-title">认识你的新搭档</h2>
    <p>{copy.accountIntro}</p>
    <div className="bibo-auth-tabs"><SegmentedControl label="账号操作" value={mode} options={[{ value: "register", label: copy.register }, { value: "login", label: copy.login }]} onChange={setMode} /></div>
    <form onSubmit={submit}>
      <label htmlFor="bibo-email">{copy.email}</label>
      <Input id="bibo-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
      {mode === "register" && <><label htmlFor="bibo-code">{copy.code}</label><div className="bibo-code-row">
        <Input id="bibo-code" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(event) => setCode(event.target.value)} placeholder="输入 6 位验证码" />
        <Button disabled={!email || codeWorking} onClick={() => void requestCode()}>{copy.sendCode}</Button>
      </div></>}
      <label htmlFor="bibo-password">{copy.password}</label>
      <Input id="bibo-password" type="password" minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 8 个字符" />
      <p className="bibo-auth-error" role="alert">{error}</p>
      <Button tone="primary" type="submit" disabled={working}>{mode === "login" ? copy.login : copy.createAccount} ↗</Button>
    </form>
    <p className="bibo-auth-note">账号使用 NextClaw 基础服务；Bibo 提供有上限的模型试用。请勿输入无需分享的敏感信息。</p>
  </section></div>;
}

export function BiboApp() {
  const store = useBiboChatStore();
  const space = useBiboSpaceStore();
  const location = useLocation();
  const route = readWorkspaceRoute(location.search);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 760px)").matches);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const update = () => { setMobile(media.matches); if (!media.matches) useBiboChatStore.getState().setMenuOpen(false); };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => { void store.bootstrap(); }, []);
  useEffect(() => {
    useBiboSpaceStore.getState().activateView(route.view);
    const chat = useBiboChatStore.getState();
    if (route.view !== "chat" || !chat.authChecked || !chat.user) return;
    if (chat.phase !== "idle") {
      if (route.sessionId !== chat.activeSessionId) navigateConversation(chat.activeSessionId, true);
      return;
    }
    if (route.sessionId) void chat.selectSession(route.sessionId, true);
    else if (chat.activeSessionId || chat.sessionLoading) void chat.createSession(true);
  }, [location.search, store.authChecked, store.user?.id, store.phase]);
  useEffect(() => { useBiboSpaceStore.getState().bindAccount(store.user?.id ?? null); }, [store.user?.id]);
  useEffect(() => {
    const guardDrafts = (event: BeforeUnloadEvent) => {
      const state = useBiboSpaceStore.getState();
      const chat = useBiboChatStore.getState();
      if (Object.values(chat.drafts).some((draft) => draft.trim()) || Object.values(state.fileDrafts).some((draft) => draft.dirty) || Object.keys(state.taskDrafts).length || Object.keys(state.eventDrafts).length) {
        event.preventDefault(); event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guardDrafts);
    return () => window.removeEventListener("beforeunload", guardDrafts);
  }, []);
  useEffect(() => { if (store.user && store.messages.length) void useBiboSpaceStore.getState().refreshAfterChat(); }, [store.messages]);
  useEffect(() => {
    const list = listRef.current;
    if (list && store.following) list.scrollTop = list.scrollHeight;
  }, [store.messages.length, store.pendingMessage, store.partial, store.following]);
  const onScroll = () => {
    const list = listRef.current;
    if (list) store.setFollowing(list.scrollHeight - list.scrollTop - list.clientHeight < 90);
  };
  const jumpToLatest = () => {
    store.setFollowing(true);
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  };
  const closeMenu = () => store.setMenuOpen(false);
  const hasMessages = store.messages.length > 0 || Boolean(store.pendingMessage);
  const failedMessages = store.failedMessages[store.activeSessionId ?? "new"] ?? [];
  const workspaceTitle = space.view === "chat" ? store.sessions.find((session) => session.id === store.activeSessionId)?.title ?? "新对话" : navigation.find((item) => item.view === space.view)?.label;
  const sidebarContent = <>
      <div className="sidebar-header">
      <Link className="bibo-brand" to="/" aria-label="Bibo 首页"><span className="bibo-brand-mark">✳</span><span>Bibo<span className="bibo-brand-dot">.</span></span></Link>
      {!mobile && <IconButton label={space.sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"} icon={space.sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />} onClick={space.toggleSidebar} />}
      </div>
      <p className="bibo-sidebar-label">{copy.space}</p>
      <nav className="bibo-primary-nav" aria-label="工作空间">{navigation.map((item) => <Link key={item.view} to={workspaceHref(item.view, route.sessionId)} className={`bibo-nav-item${space.view === item.view ? " is-active" : ""}`} title={item.label} aria-current={space.view === item.view ? "page" : undefined} onClick={closeMenu}><span aria-hidden="true" className="bibo-nav-mark">{item.mark}</span><span className="bibo-nav-text">{item.label}</span>{item.view === "inbox" && (space.overview?.counts.unread ?? 0) > 0 && <small>{space.overview?.counts.unread}</small>}</Link>)}</nav>
      <SessionNavigation active={space.view === "chat"} onNavigate={closeMenu} mobile={mobile} />
      <div className="bibo-sidebar-spacer" />
      <nav className="bibo-sidebar-foot" aria-label="帮助和账号">
        <AccountMenu />
      </nav>
  </>;
  return <div className={`bibo-shell${space.sidebarCollapsed ? " is-sidebar-collapsed" : ""}${space.workspaceOpen && space.view === "chat" ? " has-workspace" : ""}`}>
    {mobile ? <Sheet open={store.menuOpen} onOpenChange={store.setMenuOpen} title="个人空间" closeLabel="关闭导航" returnFocusRef={menuButtonRef}><aside className="bibo-sidebar is-drawer" aria-label="导航">{sidebarContent}</aside></Sheet> : <aside className="bibo-sidebar" aria-label="导航">{sidebarContent}</aside>}
    <main className="bibo-main">
      <header className="bibo-topbar"><div className="bibo-topbar-leading">
        <IconButton ref={menuButtonRef} className="bibo-menu-button" label="打开菜单" icon={<Menu />} tooltip={false} aria-expanded={store.menuOpen} onClick={() => store.setMenuOpen(!store.menuOpen)} />
        <h1 className="workspace-title" title={workspaceTitle}>{workspaceTitle}</h1>
      </div><div className="bibo-topbar-actions">{space.view === "chat" && <><Button disabled={store.phase !== "idle"} onClick={() => void store.createSession()}>＋ 新对话</Button><Button aria-label="打开右侧工作区" onClick={space.workspaceOpen ? space.closeWorkspace : space.showWorkspace}>工作区</Button></>}<span className="bibo-account">{store.user?.email}</span></div></header>
      {space.view === "chat" ? <div className="bibo-chat-layout"><div className="bibo-chat-column"><section className="bibo-conversation" aria-label="与 Bibo 对话">
        {!hasMessages && <div className="bibo-welcome">
          <div className="bibo-orb" aria-hidden="true">✳</div>
          <h1>{copy.greeting}</h1>
          <div className="bibo-suggestions">{suggestions.map((suggestion) => <Button key={suggestion.label} onClick={() => { store.setDraft(suggestion.text); inputRef.current?.focus(); }}><span>{suggestion.mark}</span>{suggestion.label}<span>↗</span></Button>)}</div>
        </div>}
        {hasMessages && <div className="bibo-messages" ref={listRef} onScroll={onScroll} role="log" aria-live="polite" aria-relevant="additions text">
          {store.messages.map((message, index) => <Message key={`${message.at}-${index}`} role={message.role} text={message.text} mark="✳" waitingLabel={copy.waiting}
            label={message.role === "assistant" ? "Bibo" : copy.you} copyLabel={copy.copy}
            onCopy={message.role === "assistant" ? () => { void navigator.clipboard.writeText(message.text).then(store.copied).catch(store.copyFailed); } : undefined} />)}
          {store.pendingMessage && <><Message role="user" text={store.pendingMessage} label={copy.you} pending />
            <Message role="assistant" text={store.partial} label="Bibo" mark="✳" waitingLabel={copy.waiting} pending /></>}
        </div>}
        {hasMessages && !store.following && <IconButton className="bibo-jump" label={copy.backToLatest} icon={<ArrowDown size={18} />} tooltip={false} onClick={jumpToLatest} />}
      </section>
      <div className="bibo-composer-wrap">
        {store.status && <div className="bibo-status" role="status" aria-live="polite">{store.status}</div>}
        {store.phase === "idle" && failedMessages.length > 0 && <Button tone="text" onClick={() => void store.send(failedMessages[0])}>{copy.retryFailed}{failedMessages.length > 1 ? ` (${failedMessages.length})` : ""}</Button>}
        <Composer inputRef={inputRef} value={store.draft} onChange={store.setDraft} onSend={() => void store.send()} onStop={() => void store.stop()}
          busy={store.phase !== "idle" || store.sessionLoading} canStop={store.phase === "generating" && Boolean(store.runId)}
          readOnly={store.sessionLoading} busyLabel={store.sessionLoading ? copy.loading : store.phase === "saving" ? copy.saving : store.phase === "stopping" ? copy.stopping : copy.connecting}
          placeholder={copy.placeholder} sendLabel={copy.send} stopLabel={copy.stop} />
      </div>
      </div><BiboWorkspace /></div> : <BiboSpaceView view={space.view} onOpenSession={store.selectSession} />}
    </main>
    <nav className="bibo-mobile-nav" aria-label="手机快捷导航">{navigation.slice(0, 5).map((item) => <Link key={item.view} to={workspaceHref(item.view, route.sessionId)} className={space.view === item.view ? "is-active" : ""} onClick={closeMenu}><span aria-hidden="true">{item.mark}</span>{item.label}</Link>)}<button className={space.view === "notes" || space.view === "files" ? "is-active" : ""} onClick={() => store.setMenuOpen(true)}><span aria-hidden="true">☷</span>更多</button></nav>
    {store.authChecked && !store.user && <AuthPanel />}
  </div>;
}
