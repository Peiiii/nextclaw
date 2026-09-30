import { hostedIdentity, preSearchIdentity } from "./bibo-identity.utils";
import type { AgentKernelResources, WorkspaceByteStore } from "@nextclaw/kernel";

export function createBiboContextFiles(workspace: WorkspaceByteStore, searchEnabled = false): NonNullable<AgentKernelResources["contextFiles"]> {
  const readText = async (root: string, name: string, maxChars?: number): Promise<string> => {
    const limit = maxChars && Number.isFinite(maxChars) ? Math.max(1, Math.floor(maxChars)) : undefined;
    const bytes = limit ? limit * 4 + 4 : undefined;
    const file = await workspace.read(`${root.replace(/\/$/, "")}/${name}`,
      bytes ? { offset: 0, length: bytes } : undefined);
    let text = file ? new TextDecoder().decode(await new Response(file.body).arrayBuffer(), { stream: Boolean(bytes) }) : "";
    if (limit && file && file.entry.bytes > bytes!) {
      const notice = "\n[Context truncated; use read_file for the remaining content.]";
      const head = text.slice(0, limit > notice.length ? limit - notice.length : limit).replace(/[\uD800-\uDBFF]$/, "");
      text = limit > notice.length ? head + notice : head;
    }
    if (text.trim()) return text;
    return name === "IDENTITY.md" && workspace.resolve(root) === workspace.resolve(".")
      ? (searchEnabled ? hostedIdentity : preSearchIdentity).trim() : "";
  };
  return { readText, readTexts: async (root, names, maxChars) => new Map(await Promise.all(
    names.map(async (name) => [name, await readText(root, name, maxChars)] as const),
  )) };
}
