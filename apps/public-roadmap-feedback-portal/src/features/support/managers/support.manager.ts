import type { SupportOperation, SupportReceipt, SupportReport, SupportSubmission } from "@shared/support-feedback.types";
import { useSupportStore as state } from "@/features/support/stores/support.store";
import { supportText as t } from "@/features/support/configs/support-messages.config";
const key = "nextclaw.support.receipts.v1", draftKey = "nextclaw.support.draft.v1";
const endpoint = "/api/support";
function newKey(): string { return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join(""); }

export class SupportManager {
  private submission: SupportSubmission | null = null;
  private operation: SupportOperation | null = null;
  constructor() {
    try {
      const receipts = JSON.parse(localStorage.getItem(key) ?? "[]") as SupportReceipt[];
      state.setState({ receipts: receipts.filter((r) => /^[\w-]{16,80}$/.test(r.id) && (r.key === "" || /^[a-f0-9]{64}$/.test(r.key))) });
      const pending = localStorage.getItem(draftKey);
      if (pending) {
        this.submission = JSON.parse(pending) as SupportSubmission;
        const { title, description, environment = "", version = "" } = this.submission!;
        state.setState({ draft: { title, description, environment, version } });
      }
    } catch { state.setState({ error: t.receiptError }); }
  }
  patchDraft = (field: keyof ReturnType<typeof state.getState>["draft"], value: string): void => {
    state.setState({ draft: { ...state.getState().draft, [field]: value } });
    this.submission = null;
  };
  patch = (patch: Partial<ReturnType<typeof state.getState>>): void => { state.setState(patch); };
  private request = async <T>(path: string, body?: unknown, receipt?: SupportReceipt): Promise<T> => {
    const response = await fetch(endpoint + path, {
      method: body === undefined ? "GET" : "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/json",
        ...(receipt?.key ? { "x-feedback-receipt": receipt.key } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const payload = await response.json() as { ok: boolean; data: T; error?: { message: string } };
    if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? t.unavailable);
    return payload.data;
  };
  private run = async (action: () => Promise<void>): Promise<void> => {
    if (state.getState().busy) return;
    state.setState({ busy: true, error: "", notice: "" });
    try { await action(); } catch (error) { state.setState({ error: error instanceof Error ? error.message : t.failed }); }
    finally { state.setState({ busy: false }); }
  };
  private saveReceipt = (receipt: SupportReceipt): void => {
    const receipts = [receipt, ...state.getState().receipts.filter((r) => r.id !== receipt.id)];
    localStorage.setItem(key, JSON.stringify(receipts));
    state.setState({ receipts });
  };
  submit = () => this.run(async () => {
    this.submission ??= { ...state.getState().draft, requestId: crypto.randomUUID(), receiptKey: newKey() };
    localStorage.setItem(draftKey, JSON.stringify(this.submission));
    // Save access before sending; response loss cannot strand the report.
    this.saveReceipt({ id: this.submission.requestId, key: this.submission.receiptKey, title: this.submission.title, endpoint: location.origin });
    const report = await this.request<SupportReport>("", this.submission);
    localStorage.removeItem(draftKey); this.submission = null;
    state.setState({ selected: report, notice: t.saved, draft: { title: "", description: "", environment: "", version: "" } });
  });
  open = (id: string) => this.run(async () => {
    const receipt = state.getState().receipts.find((r) => r.id === id);
    state.setState({ selected: await this.request<SupportReport>("/" + id, undefined, receipt), reply: "" });
  });
  operate = (action: SupportOperation["action"]) => this.run(async () => {
    const selected = state.getState().selected;
    if (!selected) return;
    const body = state.getState().reply;
    if (!this.operation || this.operation.action !== action || this.operation.body !== body) this.operation = { operationId: crypto.randomUUID(), action, body };
    const receipt = state.getState().receipts.find((r) => r.id === selected.id);
    const report = await this.request<SupportReport>("/" + selected.id, this.operation, receipt);
    this.operation = null; state.setState({ selected: report, reply: "" });
  });
  restore = (file: File) => this.run(async () => {
    const receipt = JSON.parse(await file.text()) as SupportReceipt;
    if (!/^[\w-]{16,80}$/.test(receipt.id) || !/^[a-f0-9]{64}$/.test(receipt.key) || receipt.endpoint !== location.origin) throw new Error(t.invalidReceipt);
    const report = await this.request<SupportReport>("/" + receipt.id, undefined, receipt);
    this.saveReceipt({ ...receipt, title: report.title }); state.setState({ selected: report });
  });
  exportReceipt = (): void => {
    const receipt = state.getState().receipts.find((r) => r.id === state.getState().selected?.id);
    if (!receipt?.key) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(receipt)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "nextclaw-feedback-" + receipt.id + ".json"; link.click(); URL.revokeObjectURL(url);
  };
}
export const supportManager = new SupportManager();
