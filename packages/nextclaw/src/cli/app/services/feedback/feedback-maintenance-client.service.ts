import { randomUUID } from "node:crypto";
import type { SupportAuthority, SupportMaintenance, SupportPage, SupportReport } from "@nextclaw/shared";

export function selectFeedback(queue: SupportReport[], now = Date.now(), limit = 10): SupportReport[] {
  const pending = queue.filter((r) => r.status === "received" && !r.runId);
  const sorted = pending.slice().sort((a, b) => a.priority - b.priority || Number(b.kind !== "unknown") - Number(a.kind !== "unknown") ||
    Number(b.identity === "verified") - Number(a.identity === "verified") || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const aged = pending.filter((r) => r.priority > 0 && r.kind !== "unknown" && now - Date.parse(r.createdAt) >= 48 * 3600000)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
  const selected = sorted.slice(0, limit);
  if (aged && !selected.includes(aged) && selected.length && selected.at(-1)!.priority > 0) selected[selected.length - 1] = aged;
  return selected;
}
type MaintenancePage = SupportPage & { paused: boolean; maxAuthority: SupportAuthority };
export class FeedbackMaintenanceClient {
  readonly endpoint: string;
  private readonly token: string;
  constructor({ endpoint, token }: { endpoint: string; token: string | undefined }) {
    const url = new URL(endpoint);
    if ((url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("Invalid feedback origin.");
    if (!token || token.length < 32) throw new Error("SUPPORT_MAINTAINER_TOKEN must be configured.");
    this.endpoint = url.origin; this.token = token;
  }
  request = async <T = MaintenancePage>(path: string, body?: unknown): Promise<T> => {
    const response = await fetch(this.endpoint + "/api/support/maintenance" + path, {
      method: body === undefined ? "GET" : "POST", redirect: "error", signal: AbortSignal.timeout(15000),
      headers: { Authorization: "Bearer " + this.token, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body)
    });
    const result = await response.json() as { ok: boolean; data: T; error?: { message: string } };
    if (!response.ok || !result.ok) throw new Error(result.error?.message ?? "Maintenance request failed.");
    return result.data;
  };
  list = async (): Promise<MaintenancePage> => {
    const reports = new Map<string, SupportReport>(); let cursor = "", paused = false, maxAuthority: SupportAuthority = "analyze";
    do {
      const page = await this.request("?cursor=" + encodeURIComponent(cursor));
      paused ||= page.paused; maxAuthority = page.maxAuthority;
      for (const report of page.items) reports.set(report.id, report);
      cursor = page.nextCursor ?? "";
    } while (cursor);
    return { items: [...reports.values()], paused, maxAuthority, nextCursor: null };
  };
  get = async (id: string): Promise<SupportReport> => {
    const report = (await this.list()).items.find((r) => r.id === id);
    if (!report) throw new Error("Feedback not found.");
    return report;
  };
  scan = async () => {
    const page = await this.list();
    return { paused: page.paused, maxAuthority: page.maxAuthority,
      candidates: page.paused ? [] : selectFeedback(page.items.filter((r) => !r.approval)),
      approved: page.paused ? [] : selectFeedback(page.items.filter((r) => r.approval?.inputVersion === r.inputVersion)),
      unfinished: page.items.filter((r) => ["working", "ready"].includes(r.status)) };
  };
  act = async (report: Pick<SupportReport, "id" | "revision" | "runId">, action: Omit<SupportMaintenance, "operationId" | "revision" | "runId"> & { operationId?: string }): Promise<SupportReport> => {
    const operationId = action.operationId ?? randomUUID();
    try {
      return await this.request<SupportReport>("/" + encodeURIComponent(report.id), { ...action, operationId, revision: report.revision, runId: report.runId });
    } catch (error) { throw new Error(`Operation ${operationId}: ${error instanceof Error ? error.message : "request failed"}`); }
  };
}
