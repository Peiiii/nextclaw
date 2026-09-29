import { hostedIdentity, preSearchIdentity } from "./bibo-identity.utils";
import type { AgentKernelResources, WorkspaceByteStore } from "@nextclaw/kernel";

export function createBiboContextFiles(workspace: WorkspaceByteStore, searchEnabled = false): NonNullable<AgentKernelResources["contextFiles"]> {
  return { readText: async (root, name) => {
    const file = await workspace.read(`${root.replace(/\/$/, "")}/${name}`);
    const text = file ? await new Response(file.body).text() : "";
    if (text.trim()) return text;
    return name === "IDENTITY.md" && workspace.resolve(root) === workspace.resolve(".")
      ? (searchEnabled ? hostedIdentity : preSearchIdentity).trim() : "";
  } };
}
