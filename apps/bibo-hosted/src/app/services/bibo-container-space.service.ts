import type { BiboSpaceState } from "@/features/bibo-domain";
import { json, publicError } from "../bibo-auth.utils";
import { errorDetails, logDiagnostic, readTrace } from "../diagnostics/bibo-diagnostics.utils";
import type { BiboSession } from "../utils/bibo-session.utils";
import { BiboSpaceStateStore } from "../bibo-space-state.service";

export type BiboContainerSpaceBridge = {
  exportSpace: () => Promise<BiboSpaceState>;
  syncSpace: (state: BiboSpaceState) => Promise<void>;
  containerFetch: (url: string, init?: RequestInit) => Promise<Response>;
  commitSnapshot: (metadata?: Record<string, unknown>) => Promise<Response | null>;
  stop: () => Promise<void>;
};

export async function restoreBiboContainer(storage: DurableObjectStorage, snapshots: R2Bucket, id: string,
  containerFetch: BiboContainerSpaceBridge["containerFetch"], syncSpace: BiboContainerSpaceBridge["syncSpace"]): Promise<void> {
  const snapshotKey = await storage.get<string>("snapshotKey");
  const archive = await snapshots.get(snapshotKey ?? id);
  if (snapshotKey && !archive?.body) throw new Error("Bibo committed snapshot is unavailable");
  if (archive?.body) {
    const response = await containerFetch("http://localhost/restore", { method: "POST", body: archive.body });
    await response.arrayBuffer();
    if (!response.ok) throw new Error(`Bibo snapshot restore failed: ${response.status}`);
  }
  const state = await new BiboSpaceStateStore(storage).load();
  if (state) await syncSpace(state);
}

/** Preserve the legacy container and R2 snapshot path while users migrate. */
export async function executeBiboContainerSpace(bridge: BiboContainerSpaceBridge, raw: string, write: boolean): Promise<Response> {
  let needsRestore = write;
  try {
    await bridge.syncSpace(await bridge.exportSpace());
    const response = await bridge.containerFetch("http://localhost/space", {
      method: "POST", headers: { "content-type": "application/json" }, body: raw,
    });
    const result = new Response(await response.text(), { status: response.status,
      headers: { ...Object.fromEntries(response.headers), "cache-control": "no-store" } });
    if (!response.ok || !write) return result;
    const failed = await bridge.commitSnapshot();
    if (!failed) needsRestore = false;
    return failed ?? result;
  } finally {
    if (needsRestore) await bridge.stop().catch(() => undefined);
  }
}

export async function deleteBiboLegacySession(bridge: BiboContainerSpaceBridge, id: string,
  sessions: BiboSession[], request: Request): Promise<Response> {
  let needsRestore = false;
  try {
    await bridge.syncSpace(await bridge.exportSpace());
    needsRestore = true;
    const response = await bridge.containerFetch("http://localhost/sessions/delete", { method: "POST",
      headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
    await response.arrayBuffer();
    if (!response.ok) return publicError("会话删除失败，请稍后再试。", 503);
    const failed = await bridge.commitSnapshot({ sessions: sessions.filter((item) => item.id !== id) });
    if (failed) return failed;
    needsRestore = false;
    return json({ ok: true });
  } catch (error) {
    logDiagnostic("worker", "session.delete-failed", { ...readTrace(request.headers), ...errorDetails(error), errorCode: "SESSION_DELETE_FAILED" }, "error");
    return publicError("会话删除失败，请稍后再试。", 503);
  } finally {
    if (needsRestore) await bridge.stop().catch(() => undefined);
  }
}
