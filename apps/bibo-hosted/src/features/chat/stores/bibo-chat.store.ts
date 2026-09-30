import { create, type StoreApi } from "zustand";
import { BiboClient, type BiboChatEvent, type BiboMessage, type BiboQuestion, type BiboQuestionReference, type BiboRunSnapshot, type BiboSession, type BiboUser } from "@nextclaw/bibo-client";
import { BiboRunRecoveryStore } from "./bibo-run-recovery.store";
import { biboCopy } from "@/shared/configs/bibo-copy.config";
import { useBiboSpaceStore, workspaceResources } from "@/features/space";
import { navigateConversation, readWorkspaceRoute, replaceConversationContext } from "@/app/workspace-router";

type Phase = "idle" | "generating" | "stopping" | "saving";
export type BiboDisplayMessage = BiboMessage & { id: string; pending?: boolean };
const biboClient = new BiboClient();
const pendingKey = (id: string) => `bibo-pending-${id}`;
type PendingRun = { message: string; previousLastAt?: string; sessionId: string; questionId?: string; clientRequestId?: string };
const runWasSaved = (pending: PendingRun, sessionId: string | null, messages: BiboMessage[]) =>
  pending.sessionId === sessionId && messages.at(-1)?.at !== pending.previousLastAt && messages.at(-2)?.role === "user" &&
  messages.at(-2)?.text === pending.message && (!pending.questionId || messages.at(-2)?.replyToQuestion?.id === pending.questionId);
const errorText = (error: unknown) => error instanceof Error ? error.message : "操作暂时失败，请稍后重试。";
const seenKey = (id: string) => `bibo-seen-questions-${id}`;
const pendingQuestions = (messages: BiboMessage[]): BiboQuestion[] => messages.flatMap((message) => message.questions ?? []).filter((question) => question.status === "pending");

class BiboChatOwner {
  user: BiboUser | null = null;
  authChecked = false;
  messages: BiboDisplayMessage[] = [];
  pendingIds: [string, string] | null = null;
  sessions: BiboSession[] = [];
  activeSessionId: string | null = null;
  draft = "";
  drafts: Record<string, string> = {};
  failedMessages: Record<string, string[]> = {};
  replyErrors: Record<string, string> = {};
  sessionLoading = false;
  private selectionRequest = 0;
  private runRequest = 0;
  runSessionId: string | null = null;
  runMessages: BiboDisplayMessage[] = [];
  pendingMessage: string | null = null;
  pendingQuestion: BiboQuestionReference | null = null;
  openQuestionId: string | null = null;
  failedQuestionInput: { id: string; answer: string } | null = null;
  partial = "";
  phase: Phase = "idle";
  runId: string | null = null;
  runStartedAt = 0;
  recovering = false;
  activity: string | null = null;
  status = "";
  authFeedback: { kind: "success" | "error"; message: string } | null = null;
  authMode: "register" | "login" = "register";
  following = true;
  menuOpen = false;
  private readonly recovery = new BiboRunRecoveryStore(biboClient, {
    event: (event) => this.onRunEvent(event),
    snapshot: (run) => this.applyRunSnapshot(run),
    connection: (recovering) => this.set({ recovering }),
    idle: () => this.set({ phase: "idle", runId: null, runSessionId: null, pendingMessage: null, pendingQuestion: null, pendingIds: null, partial: "", activity: null }),
    failure: (error) => {
      const state = this.get();
      if (state.pendingMessage && !state.pendingQuestion) this.restoreFailedInput(state.pendingMessage, state.runSessionId);
      if (state.pendingQuestion) this.set({ openQuestionId: state.pendingQuestion.id,
        failedQuestionInput: state.pendingQuestion.action === "answered" && state.pendingMessage ? { id: state.pendingQuestion.id, answer: state.pendingMessage } : null });
      this.set((state) => ({ replyErrors: { ...state.replyErrors, [state.runSessionId ?? state.activeSessionId ?? "new"]: errorText(error) } }));
    },
  });
  reconnect = (): void => {
    if (this.get().user && this.get().authChecked) void this.recovery.sync(this.get().activeSessionId ?? undefined, true);
  };
  private applyRunSnapshot = (run: BiboRunSnapshot): void => {
    const active = run.phase === "generating" || run.phase === "saving";
    const history = this.get().messages.filter((message) => Date.parse(message.at) < run.startedAt);
    this.set((state) => ({ runId: run.runId, runStartedAt: run.startedAt, runSessionId: run.sessionId, pendingMessage: run.message,
      partial: run.partial, activity: run.activity ?? null, ...(active ? { phase: run.phase as "generating" | "saving" } : {}),
      pendingIds: state.runId === run.runId && state.pendingIds ? state.pendingIds : [crypto.randomUUID(), crypto.randomUUID()],
      ...(active && state.activeSessionId === run.sessionId ? { messages: history, runMessages: history,
        replyErrors: { ...state.replyErrors, [run.sessionId]: "" }, status: "",
        ...(state.draft === run.message ? { draft: "", drafts: { ...state.drafts, [run.sessionId]: "" } } : {}) } : {}) }));
  };

  private onRunEvent = (event: BiboChatEvent): void => {
    if (event.name === "accepted") this.set({ runId: event.value.runId });
    if (event.name === "delta") this.set((state) => ({ partial: state.partial + event.value.text }));
    if (event.name === "saving") this.set({ phase: "saving", activity: null });
    if (event.name === "show-content") {
      const userId = this.get().user?.id;
      const shown = event.value;
      const current = () => this.get().user?.id === userId && this.get().activeSessionId === shown.sessionId && useBiboSpaceStore.getState().view === "chat";
      if (current()) void workspaceResources.open(`/files/path/${encodeURIComponent(shown.target.payload.path)}`, shown.target.payload.viewer !== "source", current);
    }
    if (event.name === "committed") {
      const sessionId = this.get().runSessionId;
      const message = this.get().pendingMessage;
      this.set((state) => {
        const history = this.identifyMessages(event.value.messages, state.pendingIds, state.runMessages);
        return { runMessages: history, ...(state.activeSessionId === sessionId ? { messages: history, status: "" } : {}), pendingMessage: null,
          ...(sessionId && state.drafts[sessionId] === message ? { drafts: { ...state.drafts, [sessionId]: "" }, ...(state.activeSessionId === sessionId ? { draft: "" } : {}) } : {}),
          pendingQuestion: null, pendingIds: null, partial: "", failedQuestionInput: null,
          sessions: event.value.session ? [event.value.session, ...state.sessions.filter((item) => item.id !== event.value.session?.id)] : state.sessions };
      });
      const user = this.get().user;
      if (user) sessionStorage.removeItem(pendingKey(user.id));
      if (sessionId) this.clearFailedInput(sessionId, message ?? "");
      if (this.get().activeSessionId === sessionId) this.openFirstUnseenQuestion(event.value.messages);
      void useBiboSpaceStore.getState().refreshAfterChat();
    }
  };

  constructor(
    private readonly set: StoreApi<BiboChatOwner>["setState"],
    private readonly get: StoreApi<BiboChatOwner>["getState"],
  ) {}

  setDraft = (draft: string): void => this.set((state) => ({ draft, drafts: { ...state.drafts, [state.activeSessionId ?? "new"]: draft } }));
  setAuthMode = (authMode: "register" | "login"): void => this.set({ authMode, authFeedback: null });
  setFollowing = (following: boolean): void => this.set({ following });
  setMenuOpen = (menuOpen: boolean): void => this.set({ menuOpen });
  openQuestion = (id: string): void => {
    if (this.get().phase !== "idle" && this.get().pendingQuestion?.id === id) return;
    const question = pendingQuestions(this.get().messages).find((item) => item.id === id);
    if (!question) return;
    const userId = this.get().user?.id;
    if (userId) {
      const seen = new Set(JSON.parse(sessionStorage.getItem(seenKey(userId)) ?? "[]") as string[]);
      seen.add(id);
      sessionStorage.setItem(seenKey(userId), JSON.stringify([...seen]));
    }
    this.set({ openQuestionId: id });
  };
  closeQuestion = (): void => this.set({ openQuestionId: null });
  private openFirstUnseenQuestion = (messages: BiboMessage[]): void => {
    const userId = this.get().user?.id;
    if (!userId) return;
    const seen = new Set(JSON.parse(sessionStorage.getItem(seenKey(userId)) ?? "[]") as string[]);
    const question = pendingQuestions(messages).find((item) => !seen.has(item.id));
    if (question) this.openQuestion(question.id);
  };

  private identifyMessages = (messages: BiboMessage[], pendingIds: [string, string] | null = null, previous = this.get().messages): BiboDisplayMessage[] => {
    const existing = new Map(previous.map((message) => [`${message.role}:${message.at}`, message]));
    return messages.map((message, index) => {
      const previous = existing.get(`${message.role}:${message.at}`);
      if (previous?.text === message.text && JSON.stringify(previous.content) === JSON.stringify(message.content) && JSON.stringify(previous.questions) === JSON.stringify(message.questions) &&
        JSON.stringify(previous.replyToQuestion) === JSON.stringify(message.replyToQuestion)) return previous;
      const pendingId = pendingIds && index >= messages.length - 2 ? pendingIds[index - (messages.length - 2)] : undefined;
      return { ...message, id: previous?.id ?? pendingId ?? crypto.randomUUID() };
    });
  };

  displayMessages = (): BiboDisplayMessage[] => {
    const { messages, pendingIds, pendingMessage, pendingQuestion, partial } = this.get();
    if (this.get().activeSessionId !== this.get().runSessionId || !pendingIds || !pendingMessage) return messages;
    return [...messages,
      { id: pendingIds[0], role: "user", text: pendingMessage, at: "", pending: true, ...(pendingQuestion ? { replyToQuestion: pendingQuestion } : {}) },
      { id: pendingIds[1], role: "assistant", text: partial, at: "", pending: true }];
  };

  createSession = async (fromRoute = false): Promise<void> => {
    if (!fromRoute) {
      const route = readWorkspaceRoute();
      if (route.view === "chat" && !route.sessionId) return;
      this.set({ sessionLoading: true });
      navigateConversation(null);
      return;
    }
    this.selectionRequest += 1;
    this.set({ activeSessionId: null, messages: [], draft: this.get().drafts.new ?? "", status: "", following: true, sessionLoading: false, openQuestionId: null, failedQuestionInput: null });
  };

  selectSession = async (id: string, fromRoute = false): Promise<void> => {
    if (!fromRoute) { navigateConversation(id); return; }
    if (this.get().activeSessionId === id && !this.get().sessionLoading) return;
    if (!this.get().sessions.some((session) => session.id === id)) {
      await this.createSession(true);
      this.set({ status: biboCopy.sessionMissing });
      return;
    }
    const request = ++this.selectionRequest;
    const userId = this.get().user?.id;
    this.set({ activeSessionId: id, messages: [], draft: this.get().drafts[id] ?? "", sessionLoading: true, status: "" });
    try {
      const history = await biboClient.history(id);
      const running = this.get().phase !== "idle" && this.get().runSessionId === id;
      const messages = running ? history.filter((message) => Date.parse(message.at) < this.get().runStartedAt) : history;
      if (request !== this.selectionRequest || this.get().user?.id !== userId) return;
      const stored = userId ? sessionStorage.getItem(pendingKey(userId)) : null;
      const pending = stored ? JSON.parse(stored) as PendingRun : null;
      if (pending && runWasSaved(pending, id, messages)) {
        sessionStorage.removeItem(pendingKey(userId!));
        this.clearFailedInput(id, pending.message);
        this.set((state) => ({ drafts: { ...state.drafts, [id]: state.drafts[id] === pending.message ? "" : state.drafts[id] ?? "" } }));
      }
      this.set({ activeSessionId: id, messages: this.identifyMessages(messages), ...(running ? { runMessages: this.identifyMessages(messages) } : {}), draft: this.get().drafts[id] ?? "", status: "", following: true, menuOpen: false, openQuestionId: null, failedQuestionInput: null });
      this.openFirstUnseenQuestion(messages);
    } catch (error) { if (request === this.selectionRequest) this.set({ status: errorText(error) }); }
    finally { if (request === this.selectionRequest) { this.set({ sessionLoading: false }); void this.recovery.sync(id); } }
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
      const replyErrors = { ...this.get().replyErrors };
      delete drafts[id];
      delete failedMessages[id];
      delete replyErrors[id];
      this.set({ sessions, drafts, failedMessages, replyErrors });
      if (this.get().activeSessionId === id) {
        await this.createSession(true);
        replaceConversationContext(sessions[0]?.id ?? null);
      }
      return true;
    } catch (error) { if (this.get().user?.id === userId) this.set({ status: errorText(error) }); return false; }
  };

  bootstrap = async (): Promise<void> => {
    const request = ++this.selectionRequest;
    this.set({ authChecked: false, recovering: true });
    try {
      const user = await biboClient.account();
      if (request !== this.selectionRequest) return;
      this.set({ user });
      const sessions = await biboClient.sessions();
      if (request !== this.selectionRequest) return;
      this.set({ sessions });
      const { view, sessionId: requestedSession } = readWorkspaceRoute();
      const blankChat = view === "chat" && !requestedSession;
      const missingSession = Boolean(requestedSession && !sessions.some((session) => session.id === requestedSession));
      const activeSessionId = blankChat || missingSession ? null : requestedSession
        ? requestedSession
        : this.get().activeSessionId && sessions.some((session) => session.id === this.get().activeSessionId) ? this.get().activeSessionId : sessions[0]?.id ?? null;
      const messages = activeSessionId ? await biboClient.history(activeSessionId) : [];
      if (request !== this.selectionRequest) return;
      const currentRoute = readWorkspaceRoute();
      if (currentRoute.view !== view || currentRoute.sessionId !== requestedSession) return;
      const stored = sessionStorage.getItem(pendingKey(user.id));
      const pending = stored ? JSON.parse(stored) as PendingRun : null;
      const matching = pending?.sessionId === activeSessionId;
      const saved = pending && runWasSaved(pending, activeSessionId, messages);
      const drafts = pending?.sessionId && !saved ? { [pending.sessionId]: pending.message } : {};
      this.set({ sessions, activeSessionId, messages: this.identifyMessages(messages), drafts, draft: activeSessionId ? drafts[activeSessionId] ?? "" : "", status: missingSession ? biboCopy.sessionMissing : matching && pending && !saved ? biboCopy.interrupted : "" });
      this.openFirstUnseenQuestion(messages);
      if (!missingSession) replaceConversationContext(activeSessionId);
      if (saved) sessionStorage.removeItem(pendingKey(user.id));
      await this.recovery.sync(activeSessionId ?? undefined);
    } catch (error) {
      if (request !== this.selectionRequest) return;
      if (!this.get().user) this.set({ user: null });
      else this.set({ status: `对话记录暂时无法加载：${errorText(error)}` });
    } finally { if (request === this.selectionRequest) this.set({ authChecked: true }); }
  };

  sendCode = async (email: string): Promise<void> => {
    this.set({ authFeedback: null });
    try {
      const result = await biboClient.sendCode(email);
      if (this.get().authMode === "register" && !this.get().user) this.set({ authFeedback: { kind: "success", message: `验证码已发往 ${result.maskedEmail ?? email}。请检查邮箱。` } });
    } catch (error) { if (this.get().authMode === "register") this.set({ authFeedback: { kind: "error", message: errorText(error) } }); }
  };

  authenticate = async (email: string, password: string, code: string): Promise<void> => {
    this.set({ authFeedback: null });
    try {
      const user = this.get().authMode === "login"
        ? await biboClient.login(email, password)
        : await biboClient.register(email, password, code);
      this.set({ user, authFeedback: null });
      await this.bootstrap();
    } catch (error) { this.set({ authFeedback: { kind: "error", message: errorText(error) } }); }
  };

  logout = async (): Promise<void> => {
    this.recovery.dispose();
    this.selectionRequest += 1;
    this.runRequest += 1;
    const user = this.get().user;
    if (user) sessionStorage.removeItem(pendingKey(user.id));
    try { await biboClient.logout(); } catch { /* Clear the local session view. */ }
    this.set({ user: null, authChecked: true, authFeedback: null, sessions: [], activeSessionId: null, messages: [], draft: "", drafts: {}, failedMessages: {}, replyErrors: {}, phase: "idle", runSessionId: null, runMessages: [], runId: null, pendingMessage: null, pendingQuestion: null, pendingIds: null, partial: "", sessionLoading: false, status: "", menuOpen: false, openQuestionId: null, failedQuestionInput: null });
    replaceConversationContext(null);
  };

  reset = async (): Promise<boolean> => {
    try {
      await biboClient.reset();
      this.recovery.dispose();
      const user = this.get().user;
      if (user) sessionStorage.removeItem(pendingKey(user.id));
      this.selectionRequest += 1;
      this.runRequest += 1;
      this.set({ sessions: [], activeSessionId: null, messages: [], draft: "", drafts: {}, failedMessages: {}, replyErrors: {}, phase: "idle", runSessionId: null, runMessages: [], runId: null, pendingMessage: null, pendingQuestion: null, pendingIds: null, partial: "", sessionLoading: false, status: biboCopy.resetDone, menuOpen: false, openQuestionId: null, failedQuestionInput: null });
      useBiboSpaceStore.getState().bindAccount(user?.id ?? null, true);
      replaceConversationContext(null);
      return true;
    } catch (error) { this.set({ status: errorText(error) }); return false; }
  };

  private createRunSession = async (message: string, current: () => boolean): Promise<string | null> => {
    try {
      const session = await biboClient.createSession();
      if (!current()) return null;
      const route = readWorkspaceRoute();
      const selected = this.get().activeSessionId === null && route.view === "chat" && !route.sessionId;
      this.set((state) => {
        const failedMessages = { ...state.failedMessages };
        if (failedMessages.new) failedMessages[session.id] = failedMessages.new;
        delete failedMessages.new;
        const nextDraft = state.drafts.new ?? "";
        return { sessions: [session, ...state.sessions], runSessionId: session.id,
          ...(selected ? { activeSessionId: session.id, draft: nextDraft } : {}),
          drafts: { ...state.drafts, new: "", [session.id]: nextDraft }, failedMessages };
      });
      if (selected) replaceConversationContext(session.id);
      return session.id;
    } catch (error) {
      if (current()) {
        this.restoreFailedInput(message, null);
        this.set((state) => ({ phase: "idle", runSessionId: null, runMessages: [], replyErrors: { ...state.replyErrors, new: errorText(error) } }));
      }
      return null;
    }
  };

  send = async (retryMessage?: string, question?: { id: string; title: string; action: "answer" | "dismiss" }): Promise<void> => {
    const { user, draft, phase, messages } = this.get();
    const message = (retryMessage ?? draft).trim();
    if (!user || !message || phase !== "idle" || this.get().recovering || this.get().sessionLoading ||
      (question && !pendingQuestions(messages).some((item) => item.id === question.id))) return;
    const previousLastAt = messages.at(-1)?.at;
    const request = ++this.runRequest;
    const currentRun = () => this.runRequest === request && this.get().user?.id === user.id;
    let sessionId = this.get().activeSessionId;
    // Lock before the first await: sending from a blank conversation must create only once.
    this.set((state) => ({ phase: "generating", status: "", runStartedAt: Date.now(), runSessionId: sessionId, runMessages: messages,
      openQuestionId: question ? null : state.openQuestionId,
      failedQuestionInput: question ? null : state.failedQuestionInput,
      pendingQuestion: question ? { id: question.id, title: question.title, action: question.action === "answer" ? "answered" : "dismissed" } : null,
      replyErrors: { ...state.replyErrors, [sessionId ?? "new"]: "" } }));
    if (!retryMessage) this.setDraft("");
    if (!sessionId) {
      sessionId = await this.createRunSession(message, currentRun);
      if (!sessionId) return;
    }
    const previousPending = JSON.parse(sessionStorage.getItem(pendingKey(user.id)) ?? "null") as PendingRun | null;
    const clientRequestId = previousPending?.message === message && previousPending.sessionId === sessionId &&
      previousPending.previousLastAt === previousLastAt && previousPending.questionId === question?.id && previousPending.clientRequestId
      ? previousPending.clientRequestId : crypto.randomUUID();
    sessionStorage.setItem(pendingKey(user.id), JSON.stringify({ message, previousLastAt, sessionId, clientRequestId,
      ...(question ? { questionId: question.id } : {}) }));
    this.set({ pendingMessage: message,
      pendingIds: [crypto.randomUUID(), crypto.randomUUID()], partial: "", phase: "generating", runId: null,
      ...(this.get().activeSessionId === sessionId ? { status: "", following: true } : {}) });
    await this.recovery.start(sessionId, clientRequestId, (signal, onEvent) =>
      biboClient.chat(message, onEvent, sessionId!, question, clientRequestId, signal));
  };

  private restoreFailedInput = (message: string, sessionId: string | null): void => {
    const id = sessionId ?? "new";
    const draft = this.get().drafts[id] ?? "";
    if (!draft.trim()) this.set((state) => ({ drafts: { ...state.drafts, [id]: message }, ...(state.activeSessionId === sessionId ? { draft: message } : {}) }));
    else if (draft !== message) this.set((state) => {
      const failed = state.failedMessages[id] ?? [];
      return { failedMessages: { ...state.failedMessages, [id]: failed.includes(message) ? failed : [...failed, message] } };
    });
  };

  private clearFailedInput = (sessionId: string, message: string): void => this.set((state) => ({
    failedMessages: { ...state.failedMessages, [sessionId]: (state.failedMessages[sessionId] ?? []).filter((text) => text !== message) },
    replyErrors: { ...state.replyErrors, [sessionId]: "" },
  }));

  stop = async (): Promise<void> => {
    const { runId, phase, runSessionId, activeSessionId } = this.get();
    if (!runId || phase !== "generating" || runSessionId !== activeSessionId) return;
    this.set((state) => ({ phase: "stopping", replyErrors: { ...state.replyErrors, [runSessionId ?? "new"]: "" } }));
    try { await biboClient.cancel(runId); }
    catch (error) { if (this.get().phase === "stopping" && this.get().runId === runId) this.set((state) => ({ phase: "generating", replyErrors: { ...state.replyErrors, [runSessionId ?? "new"]: errorText(error) } })); }
  };
}

export const useBiboChatStore = create<BiboChatOwner>((set, get) => new BiboChatOwner(set, get));
