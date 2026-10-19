import { open } from "node:fs/promises";

/** Node cannot flush a Windows directory handle; source and intent files are still flushed. */
export async function syncSessionJournalDirectory(path: string): Promise<void> {
  if (process.platform === "win32") return;
  const handle = await open(path, "r");
  try { await handle.sync(); } finally { await handle.close(); }
}

/** FlushFileBuffers requires a writable handle on Windows, including copied backup files. */
export async function syncSessionJournalFile(path: string): Promise<void> {
  const handle = await open(path, process.platform === "win32" ? "r+" : "r");
  try { await handle.sync(); } finally { await handle.close(); }
}
