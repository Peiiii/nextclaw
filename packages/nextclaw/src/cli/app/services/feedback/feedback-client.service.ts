import { mkdir, readFile, readdir, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import type { SupportReceipt, SupportReport, SupportSubmission, SupportOperation, SupportPage } from "@nextclaw/shared";

type SavedFeedback = { receipt: SupportReceipt; submission?: SupportSubmission };
export class FeedbackClient {
  readonly endpoint: string;
  constructor(private readonly options: { directory: string; endpoint?: string; platformToken?: string }) {
    const url = new URL(options.endpoint ?? "https://roadmap.nextclaw.io");
    if ((url.protocol !== "https:" && !(url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname))) || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
      throw new Error("Feedback endpoint must be an HTTPS origin (or local HTTP for acceptance).");
    }
    this.endpoint = url.origin;
  }
  private file = (id: string): string => {
    if (!/^[a-zA-Z0-9_-]{16,80}$/.test(id)) throw new Error("Invalid feedback ID.");
    return join(this.options.directory, id + ".json");
  };
  private save = async (value: SavedFeedback): Promise<void> => {
    await mkdir(this.options.directory, { recursive: true, mode: 0o700 });
    const target = this.file(value.receipt.id), temp = target + "." + randomUUID() + ".tmp";
    await writeFile(temp, JSON.stringify(value), { mode: 0o600 }); await rename(temp, target);
  };
  private load = async (id: string): Promise<SavedFeedback> => {
    const value = JSON.parse(await readFile(this.file(id), "utf8")) as SavedFeedback;
    if (value.receipt.endpoint !== this.endpoint) throw new Error("Receipt belongs to another feedback service.");
    return value;
  };
  private request = async <T>(path: string, body?: unknown, receipt?: SupportReceipt): Promise<T> => {
    // Never forward platform credentials to caller-selected hosts.
    const token = this.endpoint === "https://roadmap.nextclaw.io" ? this.options.platformToken : undefined;
    const response = await fetch(this.endpoint + "/api/support" + path, {
      method: body === undefined ? "GET" : "POST", redirect: "error", signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}),
        ...(receipt?.key ? { "x-feedback-receipt": receipt.key } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const payload = await response.json() as { ok: boolean; data: T; error?: { message: string } };
    if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "Feedback request failed.");
    return payload.data;
  };
  submit = async (input: { title: string; description: string; environment?: string; version?: string; requestId?: string }): Promise<SupportReport> => {
    const id = input.requestId ?? randomUUID();
    let saved: SavedFeedback;
    try {
      saved = await this.load(id);
      if (!saved.submission) return await this.get(id);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const key = randomBytes(32).toString("hex");
      saved = { receipt: { id, key, title: input.title, endpoint: this.endpoint }, submission: { ...input, requestId: id, receiptKey: key } };
      await this.save(saved);
    }
    try {
      const report = await this.request<SupportReport>("", saved.submission);
      await this.save({ receipt: saved.receipt }); return report;
    } catch (error) {
      throw new Error(`Feedback request ${id} is saved locally for retry. ${error instanceof Error ? error.message : "Request failed."}`);
    }
  };
  list = async (): Promise<{ id: string; title: string; pending: boolean }[]> => {
    let files: string[];
    try { files = await readdir(this.options.directory); } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error;
    }
    const results: { id: string; title: string; pending: boolean }[] = [];
    for (const file of files.filter((name) => name.endsWith(".json"))) {
      const value = JSON.parse(await readFile(join(this.options.directory, file), "utf8")) as SavedFeedback;
      if (value.receipt.endpoint === this.endpoint) results.push({ id: value.receipt.id, title: value.receipt.title, pending: Boolean(value.submission) });
    }
    return results;
  };
  get = async (id: string): Promise<SupportReport> => {
    return this.request<SupportReport>("/" + id, undefined, (await this.load(id)).receipt);
  };
  update = async (id: string, action: SupportOperation["action"], body?: string, operationId: string = randomUUID()): Promise<SupportReport> => {
    return this.request<SupportReport>("/" + id, { operationId, action, body }, (await this.load(id)).receipt);
  };
  syncAccount = async (): Promise<{ count: number }> => {
    let cursor: string | null = "", count = 0;
    do {
      const page: SupportPage = await this.request<SupportPage>("?cursor=" + encodeURIComponent(cursor));
      for (const report of page.items) {
        try { await this.load(report.id); } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
          await this.save({ receipt: { id: report.id, key: "", endpoint: this.endpoint, title: report.title } });
        }
        count++;
      }
      cursor = page.nextCursor;
    } while (cursor);
    return { count };
  };
  exportReceipt = async (id: string, destination: string): Promise<void> => {
    const { receipt } = await this.load(id);
    if (!receipt.key) throw new Error("Account-linked report has no anonymous receipt.");
    await writeFile(destination, JSON.stringify(receipt), { mode: 0o600, flag: "wx" });
  };
  importReceipt = async (source: string): Promise<SupportReport> => {
    const receipt = JSON.parse(await readFile(source, "utf8")) as SupportReceipt;
    this.file(receipt.id);
    if (receipt.endpoint !== this.endpoint || !/^[a-f0-9]{64}$/.test(receipt.key)) throw new Error("Invalid receipt or endpoint mismatch.");
    const report = await this.request<SupportReport>("/" + receipt.id, undefined, receipt);
    await this.save({ receipt: { ...receipt, title: report.title } }); return report;
  };
}
