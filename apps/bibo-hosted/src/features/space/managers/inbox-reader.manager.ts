import type { StoreApi } from "zustand";
import type { BiboClient, BiboInboxItem } from "@nextclaw/bibo-client";
import type { useBiboSpaceStore } from "@/features/space/stores/bibo-space.store";
import { biboCopy } from "@/shared/configs/bibo-copy.config";
import { navigateResource } from "@/app/workspace-router";

type SpaceState = ReturnType<typeof useBiboSpaceStore.getState>;
const message = (error: unknown) => error instanceof Error ? error.message : biboCopy.inboxReadRetry;

/** Owns reader selection and acknowledged inbox writes for one account lifecycle. */
export class InboxReaderManager {
  revision = 0;
  private readonly requests = new Map<string, Promise<BiboInboxItem | null>>();
  constructor(private readonly store: StoreApi<SpaceState>, private readonly client: BiboClient) {}
  private active = (): boolean => this.store.getState().inboxReader === this;
  private set = (update: Partial<SpaceState> | ((state: SpaceState) => Partial<SpaceState>)): void => {
    if (this.active()) this.store.setState(update);
  };
  scope = (inboxScope: SpaceState["inboxScope"]): void => {
    if (!this.active()) return;
    this.set({ inboxScope, selectedInboxId: null, inboxSelection: null, inboxReadError: null });
    navigateResource("/inbox");
    void this.store.getState().load("inbox");
  };
  select = (id: string | null, fromRoute = false): void => {
    if (!this.active()) return;
    if (!fromRoute && navigateResource(`/inbox${id ? `/${encodeURIComponent(id)}` : ""}`)) return;
    const known = this.store.getState().inbox.find(item => item.id === id);
    this.set({ selectedInboxId: id, inboxSelection: known ?? null, inboxReadError: null });
    if (!id) return;
    if (known) { void this.read(known); return; }
    void this.client.space<BiboInboxItem>("inbox.get", { id }).then(item => {
      if (!this.active() || this.store.getState().selectedInboxId !== id) return;
      this.set({ inboxSelection: item });
      void this.read(item);
    }).catch(error => { if (this.store.getState().selectedInboxId === id) this.set({ error: message(error) }); });
  };
  read = (item: BiboInboxItem): Promise<BiboInboxItem | null> => {
    if (!this.active()) return Promise.resolve(null);
    if (item.readAt) return Promise.resolve(item);
    const pending = this.requests.get(item.id);
    if (pending) return pending;
    this.set(state => ({ inboxReadError: null, inboxReading: { ...state.inboxReading, [item.id]: true } }));
    const request = this.persistRead(item).finally(() => {
      this.requests.delete(item.id);
      this.set(state => { const inboxReading = { ...state.inboxReading }; delete inboxReading[item.id]; return { inboxReading }; });
    });
    this.requests.set(item.id, request);
    return request;
  };
  private persistRead = async (item: BiboInboxItem): Promise<BiboInboxItem | null> => {
    try {
      const saved = await this.client.space<BiboInboxItem>("inbox.read", { id: item.id, version: item.version });
      if (!this.active()) return null;
      this.revision++;
      // A saved row may leave the unread filter; its open reader remains visible.
      this.set(state => ({ inbox: state.inbox.flatMap(entry => entry.id !== saved.id ? [entry] : state.inboxScope === "unread" ? [] : [saved]), ...(state.selectedInboxId === saved.id ? { inboxSelection: saved } : {}) }));
      await this.store.getState().load("overview");
      return saved;
    } catch (error) { this.set({ inboxReadError: { id: item.id, message: message(error) } }); return null; }
  };
  act = async (action: string, input: Record<string, unknown>): Promise<BiboInboxItem | null> => {
    const state = this.store.getState();
    const item = state.inbox.find(entry => entry.id === input.id) ?? state.inboxSelection;
    if (action === "inbox.read") return item && item.id === input.id ? this.read(item) : null;
    const read = await this.requests.get(String(input.id));
    if (!this.active() || this.store.getState().saving) return null;
    this.set({ actionError: "", saving: true });
    try {
      const saved = await this.client.space<BiboInboxItem>(action, { ...input, ...(read ? { version: read.version } : {}) });
      if (!this.active()) return null;
      this.revision++;
      if (this.store.getState().selectedInboxId === saved.id) {
        if (this.store.getState().inboxScope === "all") this.set({ inboxSelection: saved });
        else this.select(null);
      }
      const refreshed = await this.store.getState().load("inbox");
      const overviewRefreshed = await this.store.getState().load("overview");
      this.set({ feedback: { message: biboCopy.operationSaved, task: null }, ...(!refreshed || !overviewRefreshed ? { error: biboCopy.savedReadFailed } : {}) });
      return saved;
    } catch (error) { this.set({ actionError: message(error) }); return null; }
    finally { this.set({ saving: false }); }
  };
}
