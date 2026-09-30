import { memo, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Link, Outlet, useLocation, useNavigation } from "react-router";
import { readWorkspaceRoute, workspaceHref } from "@/app/workspace-router";
import { Button, Composer, IconButton, Message, Sheet, NavigationItem } from "@nextclaw/personal-agent-ui";
import { biboCopy as copy } from "@/shared/configs/bibo-copy.config";
import { useBiboChatStore, type BiboDisplayMessage } from "@/features/chat/stores/bibo-chat.store";
import { BiboSpaceView, BiboWorkspace, FileTabs, FileEditorHeader, NoteNavigation, useBiboSpaceStore, type BiboView } from "@/features/space";

import { ArrowDown, CalendarDays, CheckCheck, FileText, Folder, Home, Inbox, Menu, MessageCircle, MessageCircleQuestion, PanelLeftClose, PanelLeftOpen, PanelRight, Plus, Sparkles, type LucideIcon } from "lucide-react";
import { SessionNavigation } from "./session-navigation";
import { BiboCompanion } from "@/shared/components/bibo-companion";
import { AccountMenu } from "./account-menu";
import { AuthPanel } from "./auth-panel";
import { workspaceResources } from "@/features/space";
import { QuestionPanel, QuestionReference, QuestionTags } from "./session-user-questions";
import { WorkspaceDivider } from "./workspace-divider";
import { messageTime } from "@/features/chat/utils/chat-message.utils";

const suggestions = [
  { icon: MessageCircle, label: "先认识我", text: "我想让你成为我的个人搭档。先问我三个关键问题，了解我最近最在意的目标，然后帮我选一件今天能推进的事。" },
  { icon: Folder, label: "梳理一个项目", text: "我正在做一个项目，想和你一起理清现状、目标和下一步。请先问我必要的问题。" },
  { icon: CalendarDays, label: "整理今天", text: "今天我有不少事要做。请帮我根据重要性和精力安排一个现实可执行的计划，先问我需要的信息。" },
];
const MessageRow = memo(function MessageRow({ message, time, onOpenQuestion, submittingQuestionId }: { message: BiboDisplayMessage; time: string | null; onOpenQuestion: (id: string) => void; submittingQuestionId?: string }) {
  const questionById = new Map(message.questions?.map((question) => [question.id, question]));
  const content = message.content ?? [
    ...(message.text ? [{ type: "text" as const, text: message.text }] : []),
    ...(message.questions?.length ? [{ type: "questions" as const, ids: message.questions.map((question) => question.id) }] : []),
  ];
  let textIndex = 0;
  const textCount = content.filter(part => part.type === "text").length;
  const cards = message.role === "assistant" ? (content.length ? content : [{ type: "text" as const, text: "" }]).map(part => {
    if (part.type === "questions") return <QuestionTags key={`questions-${part.ids.join(":")}`} questions={part.ids.flatMap(id => { const question = questionById.get(id); return question ? [question] : []; })}
      submittingId={submittingQuestionId} onOpen={onOpenQuestion} />;
    const index = textIndex++;
    return <Message key={`text-${index}`} role="assistant" text={part.text} pending={message.pending} mark={<Sparkles size={14} />} waitingLabel={copy.waiting}
      label="Bibo" copyLabel={index === textCount - 1 ? copy.copy : undefined} copyText={message.text} copiedLabel={copy.copied} copyFailedLabel={copy.copyFailed} resolveResourceHref={workspaceResources.href} />;
  }) : null;
  return <div className={`bibo-message-row bibo-message-row--${message.role}`}>
    {time && <time className="bibo-message-time" dateTime={message.at}>{time}</time>}
    {message.replyToQuestion && <QuestionReference reference={message.replyToQuestion} />}
    {cards ? <div className="bibo-ordered-content">{cards}</div> : <Message role="user" text={message.text} pending={message.pending} label={copy.you} resolveResourceHref={workspaceResources.href} />}
  </div>;
});
const navigation: { view: BiboView; label: string; icon: LucideIcon }[] = [
  { view: "overview", label: copy.overview, icon: Home }, { view: "chat", label: copy.conversation, icon: MessageCircle },
  { view: "inbox", label: copy.inbox, icon: Inbox }, { view: "calendar", label: copy.calendar, icon: CalendarDays },
  { view: "tasks", label: copy.tasks, icon: CheckCheck }, { view: "notes", label: copy.notes, icon: FileText },
  { view: "files", label: copy.files, icon: Folder },
];
const mobileNavigation = navigation.filter(item => ["overview", "chat", "inbox", "tasks"].includes(item.view));

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
  const sidebarRef = useRef<HTMLElement>(null);
  const sidebarPanelRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const workspaceMotionKey = useRef<string | null>(null);
  const toggleWorkspace = (open: boolean) => {
    workspaceMotionKey.current = location.key;
    const main = mainRef.current;
    if (main) {
      main.dataset.workspaceMotion = "true";
      // Establish the current geometry before this explicit opening/closing action.
      void getComputedStyle(main).gridTemplateColumns;
    }
    if (open) space.showWorkspace(); else space.closeWorkspace();
  };
  const mobileNavRef = useRef<HTMLElement>(null);
  const [fileHeaderContainer, setFileHeaderContainer] = useState<HTMLDivElement | null>(null);
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
    document.addEventListener("click", workspaceResources.intercept);
    return () => document.removeEventListener("click", workspaceResources.intercept);
  }, []);
  const closeMenu = () => store.setMenuOpen(false);
  const authOpen = store.authChecked && !store.user;
  useLayoutEffect(() => {
    for (const element of [sidebarRef.current, mainRef.current, mobileNavRef.current]) {
      if (element) element.inert = authOpen;
    }
    if (sidebarPanelRef.current) sidebarPanelRef.current.inert = authOpen || space.sidebarCollapsed;
  }, [authOpen, mobile, space.sidebarCollapsed]);
  const collapsedFileTree = space.view === "files" && space.treeCollapsed,
    fileHeader = (space.view === "files" || space.view === "notes") && (space.tabs.length > 0 || collapsedFileTree) && (space.view !== "notes" || !space.fileBrowserVisible) && (!mobile || !space.fileBrowserVisible || collapsedFileTree);
  const workspaceTitle = space.view === "chat" ? store.sessions.find((session) => session.id === store.activeSessionId)?.title ?? "新对话" : navigation.find((item) => item.view === space.view)?.label;
  const workspaceNavigation = <nav className="bibo-primary-nav" aria-label="工作空间">{navigation.map((item) => <NavigationItem key={item.view} label={item.label} selected={space.view === item.view} tooltip={!mobile}><Link to={workspaceHref(item.view, store.activeSessionId)} className={`bibo-nav-item${space.view === item.view ? " is-active" : ""}`} aria-label={item.label} aria-current={space.view === item.view ? "page" : undefined} onClick={closeMenu}><item.icon aria-hidden="true" className="bibo-nav-mark" /><span className="bibo-nav-text">{item.label}</span>{item.view === "inbox" && (space.overview?.counts.unread ?? 0) > 0 && <small>{space.overview?.counts.unread}</small>}</Link></NavigationItem>)}</nav>;
  const sidebarContent = <>
      <div className="sidebar-header">
      {space.view === "notes" ? <span className="bibo-brand">{copy.notes}</span> : <Link className="bibo-brand" to="/" aria-label="Bibo 首页"><span>Bibo<span className="bibo-brand-dot">.</span></span></Link>}
      </div>
      {mobile && workspaceNavigation}
      {space.view === "notes" ? <NoteNavigation onNavigate={closeMenu} /> : <SessionNavigation active={space.view === "chat"} onNavigate={closeMenu} mobile={mobile} />}
      <div className="bibo-sidebar-spacer" />
      {mobile && <nav className="bibo-sidebar-foot" aria-label="帮助和账号">
        <AccountMenu />
      </nav>}
  </>;
  return <div ref={shellRef} className={`bibo-shell${space.view === "chat" ? " is-chat" : ""}${space.view === "overview" ? " is-overview" : ""}${space.view === "notes" && space.fileBrowserVisible ? " is-notes-collection" : ""}${space.sidebarCollapsed ? " is-sidebar-collapsed" : ""}${space.workspaceOpen && space.view === "chat" ? " has-workspace" : ""}`}>
    {mobile ? <Sheet open={store.menuOpen && !authOpen} onOpenChange={store.setMenuOpen} title="个人空间" closeLabel="关闭导航" returnFocusRef={menuButtonRef}><aside className="bibo-sidebar is-drawer" aria-label="导航">{sidebarContent}</aside></Sheet> : <aside ref={sidebarRef} className="bibo-sidebar" aria-label="导航"><div className="bibo-navigation-rail" data-ui-surface="frame"><IconButton label={space.sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"} icon={space.sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />} aria-expanded={!space.sidebarCollapsed} onClick={space.toggleSidebar} />{workspaceNavigation}<div className="bibo-sidebar-spacer" /><AccountMenu compact /></div><div ref={sidebarPanelRef} className="bibo-sidebar-panel" data-ui-surface="sidebar">{sidebarContent}</div></aside>}
    <main ref={mainRef} className="bibo-main" style={{ "--workspace-ratio": `${space.workspaceRatio * 100}%` } as CSSProperties} data-workspace-motion={workspaceMotionKey.current === location.key}>
      <header className={`bibo-topbar${fileHeader ? " is-file-header" : ""}${fileHeader && space.view === "notes" ? " is-note-header" : ""}`} data-ui-surface="frame"><div className="bibo-topbar-leading">
        <IconButton ref={menuButtonRef} className="bibo-menu-button" label="打开菜单" icon={<Menu />} tooltip={false} aria-expanded={store.menuOpen} onClick={() => store.setMenuOpen(!store.menuOpen)} />
        <h1 className={fileHeader ? "visually-hidden" : "workspace-title"} title={workspaceTitle}>{workspaceTitle}</h1>
      </div>{fileHeader && <FileTabs />}{fileHeader && <div className="bibo-file-header-tools" ref={setFileHeaderContainer} />}{space.view === "chat" && <div className="bibo-topbar-actions"><IconButton label={copy.newConversation} icon={<Plus />} onClick={() => void store.createSession()} /><IconButton label={copy.workspace} icon={<PanelRight />} aria-pressed={space.workspaceOpen} onClick={() => toggleWorkspace(!space.workspaceOpen)} /></div>}</header>
      <FileEditorHeader.Provider value={fileHeaderContainer}><Outlet /></FileEditorHeader.Provider>
      {route.view === "chat" && <BiboWorkspace onClose={() => toggleWorkspace(false)} />}
      {route.view === "chat" && space.workspaceOpen && !mobile && <WorkspaceDivider container={mainRef} />}
    </main>
    <nav ref={mobileNavRef} className="bibo-mobile-nav" aria-label="手机快捷导航">{mobileNavigation.map((item) => <NavigationItem key={item.view} label={item.label} layout="stack" selected={space.view === item.view} tooltip={false}><Link to={workspaceHref(item.view, store.activeSessionId)} className={space.view === item.view ? "is-active" : ""} onClick={closeMenu}><item.icon aria-hidden="true" /><span>{item.label}</span></Link></NavigationItem>)}<NavigationItem label={copy.more} layout="stack" selected={["calendar", "notes", "files"].includes(space.view)} tooltip={false}><button onClick={() => store.setMenuOpen(true)}><Menu aria-hidden="true" /><span>{copy.more}</span></button></NavigationItem></nav>
    {authOpen && <AuthPanel />}
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
  const questions = store.messages.flatMap((message) => message.questions ?? []).filter((question) => question.status === "pending");
  const openQuestion = questions.find((question) => question.id === store.openQuestionId);
  const submittingQuestionId = store.phase !== "idle" ? store.pendingQuestion?.id : undefined;
  const reopenQuestions = questions.filter((question) => question.id !== submittingQuestionId);
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
          <BiboCompanion className="bibo-welcome-companion" />
          <h1>{copy.greeting}</h1>
          <p className="bibo-welcome-subtitle">{copy.overviewCompanion}</p>
          <div className="bibo-suggestions">{suggestions.map((suggestion) => <Button key={suggestion.label} onClick={() => { store.setDraft(suggestion.text); inputRef.current?.focus(); }}><suggestion.icon aria-hidden="true" />{suggestion.label}</Button>)}</div>
        </div>}
        {hasMessages && <div className="bibo-messages" ref={listRef} onScroll={onScroll} role="log" aria-live="polite" aria-relevant="additions text">
          <div className="bibo-message-content">{messages.map((message, index) => <MessageRow key={message.id} message={message} time={messageTime(message.at, messages[index - 1]?.at)}
            onOpenQuestion={store.openQuestion} submittingQuestionId={submittingQuestionId} />)}</div>
        </div>}
        {hasMessages && !store.following && <IconButton className="bibo-jump" label={copy.backToLatest} icon={<ArrowDown size={18} />} feedback="filled" tooltipSide="top" onClick={jumpToLatest} />}
      </section>
      <div className="bibo-composer-wrap">
        {status && <div className="bibo-status" role="status" aria-live="polite">{status}</div>}
        {store.phase === "idle" && failedMessages.length > 0 && <Button tone="text" onClick={() => void store.send(failedMessages[0])}>{copy.retryFailed}{failedMessages.length > 1 ? ` (${failedMessages.length})` : ""}</Button>}
        {openQuestion && <QuestionPanel key={openQuestion.id} question={openQuestion} busy={store.phase !== "idle" || sessionSwitching}
          initialCustom={store.failedQuestionInput?.id === openQuestion.id ? store.failedQuestionInput.answer : ""}
          onClose={store.closeQuestion}
          onAnswer={(answer) => void store.send(answer, { id: openQuestion.id, title: openQuestion.title, action: "answer" })}
          onDismiss={() => void store.send("跳过", { id: openQuestion.id, title: openQuestion.title, action: "dismiss" })} />}
        {!openQuestion && reopenQuestions.length > 0 && <button type="button" className="bibo-question-reopen" onClick={() => store.openQuestion(reopenQuestions[0].id)}>
          <MessageCircleQuestion size={15} aria-hidden="true" />{copy.questionPending} {reopenQuestions.length}</button>}
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
