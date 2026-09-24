import { create, type StoreApi } from "zustand";
import { biboCopy } from "@/features/chat/configs/bibo-copy.config";
import { biboChatManager } from "@/features/chat/managers/bibo-chat.manager";
import type { BiboMessage, BiboUser, ChatEvent } from "@/features/chat/types/bibo-chat.types";

type Phase = "idle" | "generating" | "saving";
const pendingKey = (id: string) => `bibo-pending-${id}`;
const errorText = (error: unknown) => error instanceof Error ? error.message : "操作暂时失败，请稍后重试。";

class BiboChatOwner {
  user: BiboUser | null = null;
  authChecked = false;
  messages: BiboMessage[] = [];
  draft = "";
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

  setDraft = (draft: string): void => this.set({ draft });
  setAuthMode = (authMode: "register" | "login"): void => this.set({ authMode, authError: "" });
  setFollowing = (following: boolean): void => this.set({ following });
  setMenuOpen = (menuOpen: boolean): void => this.set({ menuOpen });
  copied = (): void => this.set({ status: biboCopy.copied });
  copyFailed = (): void => this.set({ status: biboCopy.copyFailed });

  bootstrap = async (): Promise<void> => {
    try {
      const user = await biboChatManager.account();
      this.set({ user });
      const messages = await biboChatManager.history();
      const stored = sessionStorage.getItem(pendingKey(user.id));
      const pending = stored ? JSON.parse(stored) as { message: string; historyCount: number } : null;
      const saved = pending && messages.length > pending.historyCount && messages.at(-2)?.role === "user" && messages.at(-2)?.text === pending.message;
      this.set({ messages, draft: pending && !saved ? pending.message : "", status: pending && !saved ? biboCopy.interrupted : "" });
      sessionStorage.removeItem(pendingKey(user.id));
    } catch (error) {
      if (!this.get().user) this.set({ user: null });
      else this.set({ status: `对话记录暂时无法加载：${errorText(error)}` });
    } finally { this.set({ authChecked: true }); }
  };

  sendCode = async (email: string): Promise<void> => {
    this.set({ authError: "" });
    try {
      const result = await biboChatManager.sendCode(email);
      this.set({ authError: `验证码已发往 ${result.maskedEmail ?? email}。请检查邮箱。` });
    } catch (error) { this.set({ authError: errorText(error) }); }
  };

  authenticate = async (email: string, password: string, code: string): Promise<void> => {
    this.set({ authError: "" });
    try {
      const user = this.get().authMode === "login"
        ? await biboChatManager.login(email, password)
        : await biboChatManager.register(email, password, code);
      this.set({ user });
      await this.bootstrap();
    } catch (error) { this.set({ authError: errorText(error) }); }
  };

  logout = async (): Promise<void> => {
    const user = this.get().user;
    if (user) sessionStorage.removeItem(pendingKey(user.id));
    try { await biboChatManager.logout(); } catch { /* Clear the local session view. */ }
    this.set({ user: null, messages: [], draft: "", status: "", menuOpen: false });
  };

  reset = async (): Promise<void> => {
    try {
      await biboChatManager.reset();
      const user = this.get().user;
      if (user) sessionStorage.removeItem(pendingKey(user.id));
      this.set({ messages: [], draft: "", status: biboCopy.resetDone, menuOpen: false });
    } catch (error) { this.set({ status: errorText(error) }); }
  };

  send = async (): Promise<void> => {
    const { user, draft, phase, messages } = this.get();
    const message = draft.trim();
    if (!user || !message || phase !== "idle") return;
    const historyCount = messages.length;
    sessionStorage.setItem(pendingKey(user.id), JSON.stringify({ message, historyCount }));
    this.set({ draft: "", pendingMessage: message, partial: "", phase: "generating", runId: null,
      status: biboCopy.busy, following: true });
    let committed = false;
    try {
      await biboChatManager.send(message, (event: ChatEvent) => {
        if (event.name === "accepted") this.set({ runId: event.value.runId });
        if (event.name === "delta") this.set((state) => ({ partial: state.partial + event.value.text, status: biboCopy.replying }));
        if (event.name === "saving") this.set({ phase: "saving", status: biboCopy.saving });
        if (event.name === "committed") {
          committed = true;
          this.set({ messages: event.value.messages, pendingMessage: null, partial: "", status: "" });
        }
        if (event.name === "error") throw new Error(event.value.error);
      });
      if (!committed) throw new Error("连接中断，无法确认回答是否保存。");
      sessionStorage.removeItem(pendingKey(user.id));
    } catch (error) {
      let saved = false;
      try {
        const history = await biboChatManager.history();
        saved = history.length > historyCount && history.at(-2)?.role === "user" && history.at(-2)?.text === message;
        this.set({ messages: history });
      } catch { /* Keep the local input for a later retry. */ }
      if (saved) {
        sessionStorage.removeItem(pendingKey(user.id));
        this.set({ status: "回答已保存。" });
      } else this.set({ draft: message, status: `${errorText(error)} ${biboCopy.retry}` });
    } finally { this.set({ phase: "idle", runId: null, pendingMessage: null, partial: "" }); }
  };

  stop = async (): Promise<void> => {
    const { runId, phase } = this.get();
    if (!runId || phase !== "generating") return;
    try { await biboChatManager.cancel(runId); this.set({ status: "正在停止，本轮不会保存。" }); }
    catch (error) { this.set({ status: errorText(error) }); }
  };
}

export const useBiboChatStore = create<BiboChatOwner>((set, get) => new BiboChatOwner(set, get));
