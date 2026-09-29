// Cloudflare's async Durable Object KV API accepts at most 128 keys per call.
// Multiple calls inside one explicit transaction still commit atomically.
const BATCH_SIZE = 100;

export async function applyBiboStorageChanges(storage: Pick<DurableObjectTransaction, "put" | "delete">,
  entries: Record<string, unknown>, deletedKeys: readonly string[] = []): Promise<void> {
  const values = Object.entries(entries);
  for (let offset = 0; offset < values.length; offset += BATCH_SIZE) {
    await storage.put(Object.fromEntries(values.slice(offset, offset + BATCH_SIZE)));
  }
  for (let offset = 0; offset < deletedKeys.length; offset += BATCH_SIZE) {
    await storage.delete(deletedKeys.slice(offset, offset + BATCH_SIZE));
  }
}
