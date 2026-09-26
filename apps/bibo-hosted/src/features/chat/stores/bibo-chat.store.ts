import { create, type StoreApi } from "zustand";
import { BiboClient, type BiboChatEvent, type BiboMessage, type BiboSession, type BiboUser } from "@nextclaw/bibo-client";
import { biboCopy } from "@/features/chat/configs/bibo-copy.config";
import { useBiboSpaceStore } from "@/features/space";

type Phase = "idle" | "generating" | "stopping" | "saving";
const biboClient = new BiboClient();
const pendingKey = (id: string) => `bibo-pending-${id}`;
type PendingRun = { message: string; previousLastAt?: string; sessionId: string };
const runWasSaved = (pending: PendingRun, sessionId: string | null, messages: BiboMessage[]) =>
  pending.sessionId === sessionId && messages.at(-1)?.at !== pending.previousLastAt && messages.at(-2)?.role === "user" && messages.at(-2)?.text === pending.message;
const errorText = (error: unknown) => error instanceof Error ? error.message : "操作暂时失败，请稍后重试。";
const sessionFromUrl = () => new URLSearchParams(window.location.search).get("session");
const showSessionInUrl = (id: string | null) => {
  const url = new URL(window.location.href);
  if (url.searchParams.get("view") !== "chat") return;
  if (id) url.searchParams.set("session", id); else url.searchParams.delete("session");
  window.history.replaceState({}, "", url);
};

class BiboChatOwner {
  user: BiboUser | null = null;
  authChecked = false;
  messages: BiboMessage[] = [];
  sessions: BiboSession[] = [];
  activeSessionId: string | null = null;
  draft = "";
  drafts: Record<string, string> = {};
  failedMessages: Record<string, string[]> = {};
  sessionLoading = false;
  private selectionRequest = 0;
  pendingMessage: string | null = null;
  partial = "";
  phase: Phase = "idle";
  runId: string | null = null;
  status = "";
  authError = "";
  authMode: "register" | "login" = "register";
  following = true;
  menuOpen = false;

  constructor(
    private readonly set: StoreApi<BiboChatOwner>["setState"],
    private readonly get: StoreApi<BiboChatOwner>["getState"],
  ) {}

  setDraft = (draft: string): void => this.set((state) => ({ draft, drafts: { ...state.drafts, [state.activeSessionId ?? "new"]: draft } }));
  setAuthMode = (authMode: "register" | "login"): void => this.set({ authMode, authError: "" });
  setFollowing = (following: boolean): void => this.set({ following });
  setMenuOpen = (menuOpen: boolean): void => this.set({ menuOpen });
  copied = (): void => this.set({ status: biboCopy.copied });
  copyFailed = (): void => this.set({ status: biboCopy.copyFailed });

  createSession = async (): Promise<void> => {
    if (this.get().phase !== "idle") return;
    this.selectionRequest += 1;
    this.set({ activeSessionId: null, messages: [], draft: this.get().drafts.new ?? "", status: "", following: true, sessionLoading: false });
    showSessionInUrl(null);
  };

  selectSession = async (id: string): Promise<void> => {
    if (this.get().phase !== "idle" || (this.get().activeSessionId === id && !this.get().sessionLoading)) return;
    const request = ++this.selectionRequest;
    const userId = this.get().user?.id;
    this.set({ sessionLoading: true, status: "" });
    try {
      const messages = await biboClient.history(id);
      if (request !== this.selectionRequest || this.get().user?.id !== userId) return;
      const stored = userId ? sessionStorage.getItem(pendingKey(userId)) : null;
      const pending = stored ? JSON.parse(stored) as PendingRun : null;
      if (pending && runWasSaved(pending, id, messages)) {
        sessionStorage.removeItem(pendingKey(userId!));
        this.clearFailedInput(id, pending.message);
        this.set((state) => ({ drafts: { ...state.drafts, [id]: state.drafts[id] === pending.message ? "" : state.drafts[id] ?? "" } }));
      }
      this.set({ activeSessionId: id, messages, draft: this.get().drafts[id] ?? "", status: "", following: true, menuOpen: false });
      showSessionInUrl(id);
    } catch (error) { if (request === this.selectionRequest) this.set({ status: errorText(error) }); }
    finally { if (request === this.selectionRequest) this.set({ sessionLoading: false }); }
  };

  renameSession = async (id: string, title: string): Promise<boolean> => {
    try {
      const session = await biboClient.renameSession(id, title);
      this.set((state) => ({ sessions: state.sessions.map((item) => item.id === id ? session : item), status: "" }));
      return true;
    } catch (error) { this.set({ status: errorText(error) }); return false; }
  };

  deleteSession = async (id: string): Promise<boolean> => {
    if (this.get().phase !== "idle") return false;
    const userId = this.get().user?.id;
    try {
      await biboClient.deleteSession(id);
      if (this.get().user?.id !== userId) return false;
      const sessions = this.get().sessions.filter((item) => item.id !== id);
      const drafts = { ...this.get().drafts };
      const failedMessages = { ...this.get().failedMessages };
      delete drafts[id];
      delete failedMessages[id];
      this.set({ sessions, drafts, failedMessages });
      if (this.get().activeSessionId === id) {
        await this.createSession();
        if (sessions[0]) await this.selectSession(sessions[0].id);
      }
      return true;
    } catch (error) { if (this.get().user?.id === userId) this.set({ status: errorText(error) }); return false; }
  };

  bootstrap = async (): Promise<void> => {
    const request = ++this.selectionRequest;
    try {
      const user = await biboClient.account();
      if (request !== this.selectionRequest) return;
      this.set({ user });
      const sessions = await biboClient.sessions();
      if (request !== this.selectionRequest) return;
      this.set({ sessions });
      const requestedSession = sessionFromUrl();
      const blankChat = new URLSearchParams(window.location.search).get("view") === "chat" && !requestedSession;
      const missingSession = Boolean(requestedSession && !sessions.some((session) => session.id === requestedSession));
      const activeSessionId = blankChat || missingSession ? null : requestedSession
        ? requestedSession
        : this.get().activeSessionId && sessions.some((session) => session.id === this.get().activeSessionId) ? this.get().activeSessionId : sessions[0]?.id ?? null;
      const messages = activeSessionId ? await biboClient.history(activeSessionId) : [];
      if (request !== this.selectionRequest) return;
      const stored = sessionStorage.getItem(pendingKey(user.id));
      const pending = stored ? JSON.parse(stored) as PendingRun : null;
      const matching = pending?.sessionId === activeSessionId;
      const saved = pending && runWasSaved(pending, activeSessionId, messages);
      const drafts = pending?.sessionId && !saved ? { [pending.sessionId]: pending.message } : {};
      this.set({ sessions, activeSessionId, messages, drafts, draft: activeSessionId ? drafts[activeSessionId] ?? "" : "", status: missingSession ? biboCopy.sessionMissing : matching && pending && !saved ? biboCopy.interrupted : "" });
      if (!missingSession) showSessionInUrl(activeSessionId);
      if (saved) sessionStorage.removeItem(pendingKey(user.id));
    } catch (error) {
      if (request !== this.selectionRequest) return;
      if (!this.get().user) this.set({ user: null });
      else this.set({ status: `对话记录暂时无法加载：${errorText(error)}` });
    } finally { if (request === this.selectionRequest) this.set({ authChecked: true }); }
  };

  sendCode = async (email: string): Promise<void> => {
    this.set({ authError: "" });
    try {
      const result = await biboClient.sendCode(email);
      this.set({ authError: `验证码已发往 ${result.maskedEmail ?? email}。请检查邮箱。` });
    } catch (error) { this.set({ authError: errorText(error) }); }
  };

  authenticate = async (email: string, password: string, code: string): Promise<void> => {
    this.set({ authError: "" });
    try {
      const user = this.get().authMode === "login"
        ? await biboClient.login(email, password)
        : await biboClient.register(email, password, code);
      this.set({ user });
      await this.bootstrap();
    } catch (error) { this.set({ authError: errorText(error) }); }
  };

  logout = async (): Promise<void> => {
    this.selectionRequest += 1;
    const user = this.get().user;
    if (user) sessionStorage.removeItem(pendingKey(user.id));
    try { await biboClient.logout(); } catch { /* Clear the local session view. */ }
    this.set({ user: null, sessions: [], activeSessionId: null, messages: [], draft: "", drafts: {}, failedMessages: {}, sessionLoading: false, status: "", menuOpen: false });
    showSessionInUrl(null);
  };

  reset = async (): Promise<boolean> => {
    try {
      await biboClient.reset();
      const user = this.get().user;
      if (user) sessionStorage.removeItem(pendingKey(user.id));
      this.selectionRequest += 1;
      this.set({ sessions: [], activeSessionId: null, messages: [], draft: "", drafts: {}, failedMessages: {}, sessionLoading: false, status: biboCopy.resetDone, menuOpen: false });
      useBiboSpaceStore.getState().bindAccount(user?.id ?? null, true);
      showSessionInUrl(null);
      return true;
    } catch (error) { this.set({ status: errorText(error) }); return false; }
  };

  send = async (retryMessage?: string): Promise<void> => {
    const { user, draft, phase, messages } = this.get();
    const message = (retryMessage ?? draft).trim();
    if (!user || !message || phase !== "idle" || this.get().sessionLoading) return;
    const previousLastAt = messages.at(-1)?.at;
    // Lock before the first await: sending from a blank conversation must create only once.
    this.set({ phase: "generating", status: "" });
    if (!retryMessage) this.setDraft("");
    let sessionId = this.get().activeSessionId;
    if (!sessionId) {
      try {
        await biboClient.chatAvailability();
        const session = await biboClient.createSession();
        sessionId = session.id;
        this.set((state) => {
          const failedMessages = { ...state.failedMessages };
          if (failedMessages.new) failedMessages[session.id] = failedMessages.new;
          delete failedMessages.new;
          return { sessions: [session, ...state.sessions], activeSessionId: session.id,
            drafts: { ...state.drafts, new: "", [session.id]: state.draft }, failedMessages };
        });
        showSessionInUrl(session.id);
      } catch (error) { this.restoreFailedInput(message); this.set({ phase: "idle", status: errorText(error) }); return; }
    }
    sessionStorage.setItem(pendingKey(user.id), JSON.stringify({ message, previousLastAt, sessionId }));
    this.set({ pendingMessage: message, partial: "", phase: "generating", runId: null,
      status: "", following: true });
    try {
      await biboClient.chat(message, (event: BiboChatEvent) => {
        if (event.name === "accepted") this.set({ runId: event.value.runId });
        if (event.name === "delta") this.set((state) => ({ partial: state.partial + event.value.text }));
        if (event.name === "saving") this.set({ phase: "saving", status: "" });
        if (event.name === "committed") {
          this.set((state) => ({ messages: event.value.messages, pendingMessage: null, partial: "", status: "",
            sessions: event.value.session ? [event.value.session, ...state.sessions.filter((item) => item.id !== event.value.session?.id)] : state.sessions }));
        }
      }, sessionId);
      sessionStorage.removeItem(pendingKey(user.id));
      this.clearFailedInput(sessionId, message);
    } catch (error) {
      await this.recoverRun(sessionId, message, previousLastAt, error);
    } finally { this.set({ phase: "idle", runId: null, pendingMessage: null, partial: "" }); }
  };

  private restoreFailedInput = (message: string): void => {
    if (!this.get().draft.trim()) this.setDraft(message);
    else if (this.get().draft !== message) this.set((state) => {
      const id = state.activeSessionId ?? "new";
      const failed = state.failedMessages[id] ?? [];
      return { failedMessages: { ...state.failedMessages, [id]: failed.includes(message) ? failed : [...failed, message] } };
    });
  };

  private clearFailedInput = (sessionId: string, message: string): void => this.set((state) => ({
    failedMessages: { ...state.failedMessages, [sessionId]: (state.failedMessages[sessionId] ?? []).filter((text) => text !== message) },
  }));

  private recoverRun = async (sessionId: string, message: string, previousLastAt: string | undefined, error: unknown): Promise<void> => {
    let saved = false;
    try {
      const history = await biboClient.history(sessionId);
      saved = runWasSaved({ sessionId, message, previousLastAt }, sessionId, history);
      this.set({ messages: history });
    } catch { /* Keep the local input for a later retry. */ }
    if (saved) {
      const user = this.get().user;
      if (user) sessionStorage.removeItem(pendingKey(user.id));
      this.clearFailedInput(sessionId, message);
      this.set({ status: "回答已保存。" });
    } else {
      this.restoreFailedInput(message);
      this.set({ status: `${errorText(error)} ${biboCopy.retry}` });
    }
  };

  stop = async (): Promise<void> => {
    const { runId, phase } = this.get();
    if (!runId || phase !== "generating") return;
    this.set({ phase: "stopping", status: "" });
    try { await biboClient.cancel(runId); }
    catch (error) { if (this.get().phase === "stopping" && this.get().runId === runId) this.set({ phase: "generating", status: errorText(error) }); }
  };
}

export const useBiboChatStore = create<BiboChatOwner>((set, get) => new BiboChatOwner(set, get));
