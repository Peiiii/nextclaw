import { create, type StoreApi } from "zustand";
import { BiboClient, type BiboChatEvent, type BiboMessage, type BiboQuestion, type BiboSession, type BiboUser } from "@nextclaw/bibo-client";
import { BiboConversationManager, type BiboSubmission } from "@/features/chat/managers/bibo-conversation.manager";
import { biboCopy, biboSelfHosted } from "@/shared/configs/bibo-copy.config";
import { useBiboSpaceStore, workspaceResources } from "@/features/space";
import { filePathHref, navigateConversation, readWorkspaceRoute, replaceConversationContext } from "@/app/workspace-router";
import { identifyMessages, type BiboDisplayMessage } from "@/features/chat/utils/chat-message.utils";

const biboClient = new BiboClient();
const errorText = (error: unknown) => error instanceof Error ? error.message : "操作暂时失败，请稍后重试。";
const seenKey = (id: string) => `bibo-seen-questions-${id}`;
const skippedKey = (id: string) => `bibo-skipped-questions-${id}`;
const pendingQuestions = (messages: BiboMessage[]): BiboQuestion[] => messages.flatMap((message) => message.questions ?? []).filter((question) => question.status === "pending");

class BiboChatOwner {
  user: BiboUser | null = null;
  authChecked = false;
  messages: BiboDisplayMessage[] = [];
  sessions: BiboSession[] = [];
  activeSessionId: string | null = null;
  draft = "";
  drafts: Record<string, string> = {};
  failedMessages: Record<string, string[]> = {};
  replyErrors: Record<string, string> = {};
  sessionLoading = false;
  private selectionRequest = 0;
  private readonly historyVersions = new Map<string, number>();
  openQuestionId: string | null = null;
  skippedQuestionIds: string[] = [];
  failedQuestionInput: { id: string; answer: string } | null = null;
  status = "";
  authFeedback: { kind: "success" | "error"; message: string } | null = null;
  authMode: "register" | "login" = biboSelfHosted ? "login" : "register";
  following = true;
  menuOpen = false;
  readonly conversation = new BiboConversationManager(biboClient, sessionStorage, {
    created: (session) => this.onSessionCreated(session),
    confirmed: (submission) => {
      if (!submission.sessionId) return;
      this.clearFailedInput(submission.sessionId, submission.message);
      if (this.get().drafts[submission.sessionId] === submission.message) this.set((state) => ({
        drafts: { ...state.drafts, [submission.sessionId!]: "" }, ...(state.activeSessionId === submission.sessionId ? { draft: "" } : {}),
      }));
    },
    committed: (result, sessionId, ids, message) => this.onCommitted(result, sessionId, ids, message),
    failed: (submission, error) => this.onFailed(submission, error),
    content: (shown) => {
      const userId = this.get().user?.id;
      const current = () => this.get().user?.id === userId && this.get().activeSessionId === shown.sessionId && useBiboSpaceStore.getState().view === "chat";
      if (current()) void workspaceResources.open(filePathHref(shown.target.payload.path), shown.target.payload.viewer !== "source", current);
    },
  });
  reconnect = (): void => {
    if (this.get().user && this.get().authChecked) void this.conversation.reconnect();
  };
  private onFailed = (submission: BiboSubmission, error: unknown): void => {
    const questionId = submission.question?.id ?? submission.questionId;
    if (!questionId) this.restoreFailedInput(submission.message, submission.sessionId);
    else if (this.get().activeSessionId === submission.sessionId) this.set({ openQuestionId: questionId,
      failedQuestionInput: submission.question?.action !== "dismiss" ? { id: questionId, answer: submission.message } : null });
    this.set((state) => ({ replyErrors: { ...state.replyErrors, [submission.sessionId ?? "new"]: errorText(error) } }));
  };
  private onCommitted = (result: Extract<BiboChatEvent, { name: "committed" }>["value"], sessionId: string, ids: [string, string] | null, message: string): void => {
    this.historyVersions.set(sessionId, (this.historyVersions.get(sessionId) ?? 0) + 1);
    this.set((state) => ({
      ...(state.activeSessionId === sessionId ? { messages: identifyMessages(result.messages, state.messages, ids), status: "", failedQuestionInput: null } : {}),
      ...(state.drafts[sessionId] === message ? { drafts: { ...state.drafts, [sessionId]: "" }, ...(state.activeSessionId === sessionId ? { draft: "" } : {}) } : {}),
      sessions: result.session ? [result.session, ...state.sessions.filter((item) => item.id !== result.session?.id)] : state.sessions,
    }));
    this.clearFailedInput(sessionId, message);
    if (this.get().activeSessionId === sessionId) this.openFirstUnseenQuestion(result.messages);
    void useBiboSpaceStore.getState().refreshAfterChat();
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
    if (this.conversation.view.busy && this.conversation.view.pendingQuestion?.id === id) return;
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
  skipQuestion = (): void => {
    const { user, openQuestionId, messages, skippedQuestionIds } = this.get();
    if (!user || this.conversation.view.busy || !pendingQuestions(messages).some((question) => question.id === openQuestionId)) return;
    const skipped = [...new Set([...skippedQuestionIds, openQuestionId!])];
    sessionStorage.setItem(skippedKey(user.id), JSON.stringify(skipped));
    this.set({ skippedQuestionIds: skipped, openQuestionId: null, failedQuestionInput: null });
  };
  private openFirstUnseenQuestion = (messages: BiboMessage[]): void => {
    const userId = this.get().user?.id;
    if (!userId) return;
    const seen = new Set(JSON.parse(sessionStorage.getItem(seenKey(userId)) ?? "[]") as string[]);
    const question = pendingQuestions(messages).find((item) => !seen.has(item.id) && !this.get().skippedQuestionIds.includes(item.id));
    if (question) this.openQuestion(question.id);
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
    const historyVersion = this.historyVersions.get(id);
    this.set({ activeSessionId: id, messages: [], draft: this.get().drafts[id] ?? "", sessionLoading: true, status: "" });
    try {
      const history = await biboClient.history(id);
      if (request !== this.selectionRequest || this.get().user?.id !== userId) return;
      if (this.historyVersions.get(id) !== historyVersion) return;
      this.set({ activeSessionId: id, messages: identifyMessages(history, this.get().messages), draft: this.get().drafts[id] ?? "", status: "", following: true, menuOpen: false, openQuestionId: null, failedQuestionInput: null });
      this.openFirstUnseenQuestion(history);
    } catch (error) { if (request === this.selectionRequest) this.set({ status: errorText(error) }); }
    finally { if (request === this.selectionRequest) { this.set({ sessionLoading: false }); void this.conversation.connect(id); } }
  };

  renameSession = async (id: string, title: string): Promise<boolean> => {
    try {
      const session = await biboClient.renameSession(id, title);
      this.set((state) => ({ sessions: state.sessions.map((item) => item.id === id ? session : item), status: "" }));
      return true;
    } catch (error) { this.set({ status: errorText(error) }); return false; }
  };

  deleteSession = async (id: string): Promise<boolean> => {
    if (this.conversation.view.busy) return false;
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
    this.set({ authChecked: false });
    try {
      const user = await biboClient.account();
      if (request !== this.selectionRequest) return;
      this.conversation.bindAccount(user.id);
      this.set({ user, skippedQuestionIds: JSON.parse(sessionStorage.getItem(skippedKey(user.id)) ?? "[]") as string[] });
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
      this.set({ sessions, activeSessionId, messages: identifyMessages(messages, this.get().messages), draft: this.get().drafts[activeSessionId ?? "new"] ?? "", status: missingSession ? biboCopy.sessionMissing : "" });
      this.openFirstUnseenQuestion(messages);
      if (!missingSession) replaceConversationContext(activeSessionId);
      await this.conversation.connect(activeSessionId ?? undefined);
    } catch (error) {
      if (request !== this.selectionRequest) return;
      if (!this.get().user) { this.conversation.dispose(); this.set({ user: null }); }
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
    this.conversation.dispose();
    this.selectionRequest += 1;
    this.historyVersions.clear();
    try { await biboClient.logout(); } catch { /* Clear the local session view. */ }
    this.set({ user: null, authChecked: true, authFeedback: null, sessions: [], activeSessionId: null, messages: [], draft: "", drafts: {}, failedMessages: {}, replyErrors: {}, sessionLoading: false, status: "", menuOpen: false, openQuestionId: null, failedQuestionInput: null, skippedQuestionIds: [] });
    replaceConversationContext(null);
  };

  reset = async (): Promise<boolean> => {
    try {
      await biboClient.reset();
      this.conversation.dispose({ discardInput: true });
      const user = this.get().user;
      this.conversation.bindAccount(user?.id ?? null);
      if (user) sessionStorage.removeItem(skippedKey(user.id));
      this.selectionRequest += 1;
      this.historyVersions.clear();
      this.set({ sessions: [], activeSessionId: null, messages: [], draft: "", drafts: {}, failedMessages: {}, replyErrors: {}, sessionLoading: false, status: biboCopy.resetDone, menuOpen: false, openQuestionId: null, failedQuestionInput: null, skippedQuestionIds: [] });
      useBiboSpaceStore.getState().bindAccount(user?.id ?? null, true);
      replaceConversationContext(null);
      await this.conversation.connect();
      return true;
    } catch (error) { this.set({ status: errorText(error) }); return false; }
  };

  private onSessionCreated = (session: BiboSession): void => {
    const route = readWorkspaceRoute();
    const selected = this.get().activeSessionId === null && route.view === "chat" && !route.sessionId;
    this.set((state) => {
      const failedMessages = { ...state.failedMessages };
      if (failedMessages.new) failedMessages[session.id] = failedMessages.new;
      delete failedMessages.new;
      const nextDraft = state.drafts.new ?? "";
      return { sessions: [session, ...state.sessions],
        ...(selected ? { activeSessionId: session.id, draft: nextDraft } : {}),
        drafts: { ...state.drafts, new: "", [session.id]: nextDraft }, failedMessages };
    });
    if (selected) replaceConversationContext(session.id);
  };

  send = async (retryMessage?: string, question?: { id: string; title: string; action: "answer" | "dismiss" }): Promise<void> => {
    const { user, draft, messages } = this.get();
    const message = (retryMessage ?? draft).trim();
    if (!user || !message || this.conversation.view.busy || this.get().sessionLoading ||
      (question && !pendingQuestions(messages).some((item) => item.id === question.id))) return;
    const previousLastAt = messages.at(-1)?.at;
    const sessionId = this.get().activeSessionId;
    this.set((state) => ({ status: "", following: true,
      openQuestionId: question ? null : state.openQuestionId,
      failedQuestionInput: question ? null : state.failedQuestionInput,
      replyErrors: { ...state.replyErrors, [sessionId ?? "new"]: "" } }));
    if (!retryMessage) this.setDraft("");
    await this.conversation.send({ sessionId, message, question, previousLastAt });
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
    const { runId, runSessionId } = this.conversation.view;
    if (runSessionId !== this.get().activeSessionId) return;
    try { await this.conversation.stop(); }
    catch (error) {
      if (this.conversation.view.runId === runId) this.set((state) => ({ replyErrors: { ...state.replyErrors, [runSessionId ?? "new"]: errorText(error) } }));
    }
  };
}

export const useBiboChatStore = create<BiboChatOwner>((set, get) => new BiboChatOwner(set, get));
