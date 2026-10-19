import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { syncSessionJournalDirectory, syncSessionJournalFile } from "../session-journal-durability.utils.js";

const directories: string[] = [];
const platform = Object.getOwnPropertyDescriptor(process, "platform")!;
afterEach(async () => {
  Object.defineProperty(process, "platform", platform);
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

it("flushes written files and supported directories without changing their contents", async () => {
  const directory = await mkdtemp(join(tmpdir(), "journal-durability-")); directories.push(directory);
  const path = join(directory, "intent"); await writeFile(path, "durable source intent");
  await syncSessionJournalFile(path); await syncSessionJournalDirectory(directory);
  expect(await readFile(path, "utf8")).toBe("durable source intent");
});

it("does not attempt the unsupported Windows directory flush", async () => {
  Object.defineProperty(process, "platform", { ...platform, value: "win32" });
  await expect(syncSessionJournalDirectory(join(tmpdir(), "missing-directory-for-windows-flush"))).resolves.toBeUndefined();
});

it("preserves POSIX directory errors and file errors on every platform", async () => {
  const directory = await mkdtemp(join(tmpdir(), "journal-durability-errors-")); directories.push(directory);
  Object.defineProperty(process, "platform", { ...platform, value: "linux" });
  const missing = join(directory, "missing");
  await expect(syncSessionJournalDirectory(missing)).rejects.toMatchObject({ code: "ENOENT" });
  Object.defineProperty(process, "platform", { ...platform, value: "win32" });
  await expect(syncSessionJournalFile(missing)).rejects.toMatchObject({ code: "ENOENT" });
});
