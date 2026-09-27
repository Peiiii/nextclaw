import { memo, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { Link, Outlet, useLocation, useNavigation } from "react-router";
import { readWorkspaceRoute, workspaceHref } from "@/app/workspace-router";
import { Button, Composer, IconButton, Input, Message, SegmentedControl, Sheet, NavigationItem } from "@nextclaw/personal-agent-ui";
import { biboCopy as copy } from "@/shared/configs/bibo-copy.config";
import { useBiboChatStore, type BiboDisplayMessage } from "@/features/chat/stores/bibo-chat.store";
import { BiboSpaceView, BiboWorkspace, FileTabs, useBiboSpaceStore, type BiboView } from "@/features/space";

import { ArrowDown, CalendarDays, CheckCheck, FileText, Folder, Home, Inbox, Menu, MessageCircle, PanelLeftClose, PanelLeftOpen, PanelRight, Plus, Sparkles, type LucideIcon } from "lucide-react";
import { SessionNavigation } from "./session-navigation";
import { AccountMenu } from "./account-menu";
import { workspaceResources } from "@/features/space";

const suggestions = [
  { mark: "✳", label: "先认识我", text: "我想让你成为我的个人搭档。先问我三个关键问题，了解我最近最在意的目标，然后帮我选一件今天能推进的事。" },
  { mark: "▤", label: "梳理一个项目", text: "我正在做一个项目，想和你一起理清现状、目标和下一步。请先问我必要的问题。" },
  { mark: "◷", label: "整理今天", text: "今天我有不少事要做。请帮我根据重要性和精力安排一个现实可执行的计划，先问我需要的信息。" },
];
const MessageRow = memo(function MessageRow({ message }: { message: BiboDisplayMessage }) {
  return <Message role={message.role} text={message.text} pending={message.pending} mark={<Sparkles size={14} />} waitingLabel={copy.waiting}
    label={message.role === "assistant" ? "Bibo" : copy.you} copyLabel={copy.copy}
    copiedLabel={copy.copied} copyFailedLabel={copy.copyFailed} resolveResourceHref={workspaceResources.href} />;
});
const navigation: { view: BiboView; label: string; icon: LucideIcon }[] = [
  { view: "overview", label: copy.overview, icon: Home }, { view: "chat", label: copy.conversation, icon: MessageCircle },
  { view: "inbox", label: copy.inbox, icon: Inbox }, { view: "calendar", label: copy.calendar, icon: CalendarDays },
  { view: "tasks", label: copy.tasks, icon: CheckCheck }, { view: "notes", label: copy.notes, icon: FileText },
  { view: "files", label: copy.files, icon: Folder },
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
  useLayoutEffect(() => {
    document.documentElement.dataset.biboTheme = space.theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      "content", getComputedStyle(document.documentElement).getPropertyValue("--ui-canvas").trim(),
    );
  }, [space.theme]);
  const location = useLocation();
  const route = readWorkspaceRoute(location.pathname);
  const shellRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 760px)").matches);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const update = () => { setMobile(media.matches); if (!media.matches) useBiboChatStore.getState().setMenuOpen(false); };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const viewport = window.visualViewport;
    const shell = shellRef.current;
    if (!viewport || !shell) return;
    const syncHeight = () => {
      if (window.matchMedia("(pointer: coarse)").matches && viewport.scale === 1) {
        shell.style.setProperty("--bibo-viewport-height", `${viewport.height}px`);
      } else shell.style.removeProperty("--bibo-viewport-height");
    };
    syncHeight();
    viewport.addEventListener("resize", syncHeight);
    return () => {
      viewport.removeEventListener("resize", syncHeight);
      shell.style.removeProperty("--bibo-viewport-height");
    };
  }, []);
  useEffect(() => { void store.bootstrap(); }, []);
  useLayoutEffect(() => {
    useBiboSpaceStore.getState().activateView(route.view);
    const chat = useBiboChatStore.getState();
    if (route.view !== "chat" || !chat.authChecked || !chat.user) return;
    if (route.sessionId) void chat.selectSession(route.sessionId, true);
    else if (chat.activeSessionId || chat.sessionLoading) void chat.createSession(true);
  }, [location.pathname, store.authChecked, store.user?.id]);
  useEffect(() => { useBiboSpaceStore.getState().bindAccount(store.user?.id ?? null); }, [store.user?.id]);
  useEffect(() => {
    const guardDrafts = (event: BeforeUnloadEvent) => {
      const state = useBiboSpaceStore.getState();
      const chat = useBiboChatStore.getState();
      if (chat.phase !== "idle" || Object.values(chat.drafts).some((draft) => draft.trim()) || Object.values(state.fileDrafts).some((draft) => draft.dirty) || Object.keys(state.taskDrafts).length || Object.keys(state.eventDrafts).length) {
        event.preventDefault(); event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guardDrafts);
    return () => window.removeEventListener("beforeunload", guardDrafts);
  }, []);
  useEffect(() => { if (store.user && store.messages.length) void useBiboSpaceStore.getState().refreshAfterChat(); }, [store.messages]);
  useEffect(() => {
    document.addEventListener("click", workspaceResources.intercept);
    return () => document.removeEventListener("click", workspaceResources.intercept);
  }, []);
  const closeMenu = () => store.setMenuOpen(false);
  const collapsedFileTree = space.view === "files" && space.treeCollapsed;
  const fileHeader = (space.view === "files" || space.view === "notes") && (space.tabs.length > 0 || collapsedFileTree) && (!mobile || !space.fileBrowserVisible || collapsedFileTree);
  const workspaceTitle = space.view === "chat" ? store.sessions.find((session) => session.id === store.activeSessionId)?.title ?? "新对话" : navigation.find((item) => item.view === space.view)?.label;
  const workspaceNavigation = <nav className="bibo-primary-nav" aria-label="工作空间">{navigation.map((item) => <NavigationItem key={item.view} label={item.label} selected={space.view === item.view} tooltip={!mobile}><Link to={workspaceHref(item.view, store.activeSessionId)} className={`bibo-nav-item${space.view === item.view ? " is-active" : ""}`} aria-label={item.label} aria-current={space.view === item.view ? "page" : undefined} onClick={closeMenu}><item.icon aria-hidden="true" className="bibo-nav-mark" /><span className="bibo-nav-text">{item.label}</span>{item.view === "inbox" && (space.overview?.counts.unread ?? 0) > 0 && <small>{space.overview?.counts.unread}</small>}</Link></NavigationItem>)}</nav>;
  const sidebarContent = <>
      <div className="sidebar-header">
      <Link className="bibo-brand" to="/" aria-label="Bibo 首页"><span>Bibo<span className="bibo-brand-dot">.</span></span></Link>
      </div>
      {mobile && workspaceNavigation}
      <SessionNavigation active={space.view === "chat"} onNavigate={closeMenu} mobile={mobile} />
      <div className="bibo-sidebar-spacer" />
      {mobile && <nav className="bibo-sidebar-foot" aria-label="帮助和账号">
        <AccountMenu />
      </nav>}
  </>;
  return <div ref={shellRef} className={`bibo-shell${space.view === "chat" ? " is-chat" : ""}${space.sidebarCollapsed ? " is-sidebar-collapsed" : ""}${space.workspaceOpen && space.view === "chat" ? " has-workspace" : ""}`}>
    {mobile ? <Sheet open={store.menuOpen} onOpenChange={store.setMenuOpen} title="个人空间" closeLabel="关闭导航" returnFocusRef={menuButtonRef}><aside className="bibo-sidebar is-drawer" aria-label="导航">{sidebarContent}</aside></Sheet> : <aside className="bibo-sidebar" aria-label="导航"><div className="bibo-navigation-rail"><IconButton label={space.sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"} icon={space.sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />} aria-expanded={!space.sidebarCollapsed} onClick={space.toggleSidebar} />{workspaceNavigation}<div className="bibo-sidebar-spacer" /><AccountMenu /></div><div className="bibo-sidebar-panel">{sidebarContent}</div></aside>}
    <main className="bibo-main">
      <header className={`bibo-topbar${fileHeader ? " is-file-header" : ""}`} data-ui-surface="frame"><div className="bibo-topbar-leading">
        <IconButton ref={menuButtonRef} className="bibo-menu-button" label="打开菜单" icon={<Menu />} tooltip={false} aria-expanded={store.menuOpen} onClick={() => store.setMenuOpen(!store.menuOpen)} />
        <h1 className={fileHeader ? "visually-hidden" : "workspace-title"} title={workspaceTitle}>{workspaceTitle}</h1>
      </div>{fileHeader && <FileTabs />}{space.view === "chat" && <div className="bibo-topbar-actions"><IconButton label={copy.newConversation} icon={<Plus />} onClick={() => void store.createSession()} /><IconButton label={copy.workspace} icon={<PanelRight />} aria-pressed={space.workspaceOpen} onClick={space.workspaceOpen ? space.closeWorkspace : space.showWorkspace} /></div>}</header>
      <Outlet />
      {route.view === "chat" && <BiboWorkspace />}
    </main>
    <nav className="bibo-mobile-nav" aria-label="手机快捷导航">{navigation.slice(0, 5).map((item) => <Link key={item.view} to={workspaceHref(item.view, store.activeSessionId)} className={space.view === item.view ? "is-active" : ""} aria-current={space.view === item.view ? "page" : undefined} onClick={closeMenu}><item.icon aria-hidden="true" />{item.label}</Link>)}<button className={space.view === "notes" || space.view === "files" ? "is-active" : ""} onClick={() => store.setMenuOpen(true)}><Menu aria-hidden="true" />更多</button></nav>
    {store.authChecked && !store.user && <AuthPanel />}
  </div>;
}


export function ChatPage() {
  const store = useBiboChatStore();
  const pendingNavigation = useNavigation();
  const route = readWorkspaceRoute(useLocation().pathname);
  const sessionSwitching = !store.authChecked || store.sessionLoading || pendingNavigation.state !== "idle" || route.sessionId !== store.activeSessionId;
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messages = store.displayMessages();
  const hasMessages = messages.length > 0;
  const failedMessages = store.failedMessages[store.activeSessionId ?? "new"] ?? [];
  const status = store.status || store.replyErrors[store.activeSessionId ?? "new"];
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
  return <div className="bibo-chat-layout"><div className="bibo-chat-column"><section className="bibo-conversation" aria-label="与 Bibo 对话">
        {!hasMessages && <div className="bibo-welcome">
          <div className="bibo-orb" aria-hidden="true">✳</div>
          <h1>{copy.greeting}</h1>
          <div className="bibo-suggestions">{suggestions.map((suggestion) => <Button key={suggestion.label} onClick={() => { store.setDraft(suggestion.text); inputRef.current?.focus(); }}><span>{suggestion.mark}</span>{suggestion.label}<span>↗</span></Button>)}</div>
        </div>}
        {hasMessages && <div className="bibo-messages" ref={listRef} onScroll={onScroll} role="log" aria-live="polite" aria-relevant="additions text">
          <div className="bibo-message-content">{messages.map((message) => <MessageRow key={message.id} message={message} />)}</div>
        </div>}
        {hasMessages && !store.following && <IconButton className="bibo-jump" label={copy.backToLatest} icon={<ArrowDown size={18} />} feedback="filled" tooltipSide="top" onClick={jumpToLatest} />}
      </section>
      <div className="bibo-composer-wrap">
        {status && <div className="bibo-status" role="status" aria-live="polite">{status}</div>}
        {store.phase === "idle" && failedMessages.length > 0 && <Button tone="text" onClick={() => void store.send(failedMessages[0])}>{copy.retryFailed}{failedMessages.length > 1 ? ` (${failedMessages.length})` : ""}</Button>}
        <Composer inputRef={inputRef} value={store.draft} onChange={store.setDraft} onSend={() => void store.send()} onStop={() => void store.stop()}
          busy={store.phase !== "idle" || sessionSwitching} canStop={store.phase === "generating" && Boolean(store.runId) && store.runSessionId === store.activeSessionId}
          readOnly={sessionSwitching} busyLabel={copy.busy}
          placeholder={copy.placeholder} sendLabel={copy.send} stopLabel={copy.stop} />
      </div>
      </div></div>;
}

export function SpacePage() {
  const route = readWorkspaceRoute(useLocation().pathname);
  const view = route.view;
  const account = useBiboSpaceStore((state) => state.accountId);
  const ready = useBiboSpaceStore((state) => state.readStatus[view] === "ready");
  useEffect(() => {
    if (account && ready && route.resourceId) void workspaceResources.open(`/${view}/${encodeURIComponent(route.resourceId)}`);
    else if (account && ready && route.filePath) void workspaceResources.open(`/files/path/${encodeURIComponent(route.filePath)}`);
  }, [account, ready, view, route.resourceId, route.filePath]);
  const selectSession = useBiboChatStore((state) => state.selectSession);
  return <BiboSpaceView view={view} onOpenSession={selectSession} />;
}

export function NotFoundPage() {
  return <section className="workspace-not-found"><h1>页面不存在</h1><Link to="/">返回概览</Link></section>;
}
