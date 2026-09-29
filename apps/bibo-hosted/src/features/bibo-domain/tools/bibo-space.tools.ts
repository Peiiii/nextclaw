import type { NcpTool } from "@nextclaw/harness";
import { BiboSpaceError, type BiboSpaceService } from "../services/bibo-space.service";

export const biboSpaceToolParameters = {
  type: "object",
  properties: {
    operation: { type: "string", enum: ["help", "call"], description: "help lists usage on demand; call executes a known action." },
    domain: { type: "string", description: "For help: projects, tasks, events, inbox, files, or overview." },
    query: { type: "string", description: "For help: filter relevant operations by keyword." },
    action: { type: "string", description: "For call: operation name, e.g. task.create." },
    input: { type: "object", description: "Action input. Use help for field names and meanings." },
  },
  required: ["operation"],
  additionalProperties: false,
} as const;

function validatePortableArgs(value: Record<string, unknown>): string[] {
  const issues: string[] = [];
  for (const key of biboSpaceToolParameters.required) {
    if (!(key in value)) issues.push(`${key} is required`);
  }
  const properties: Record<string, { type: string; enum?: readonly string[] }> = biboSpaceToolParameters.properties;
  for (const [key, item] of Object.entries(value)) {
    const property = properties[key];
    if (!property) { issues.push(`${key} is not allowed`); continue; }
    const validType = property.type === "object"
      ? item !== null && typeof item === "object" && !Array.isArray(item)
      : typeof item === property.type;
    if (!validType) issues.push(`${key} must be ${property.type}`);
    else if (property.enum && !property.enum.includes(item as string)) issues.push(`${key} must be one of ${property.enum.join(", ")}`);
  }
  return issues;
}

function params(value: unknown): Record<string, unknown> {
  let parsed = value;
  if (typeof value === "string") {
    try { parsed = JSON.parse(value); } catch { return {}; }
  }
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
}

export function createBiboSpaceTool(space: BiboSpaceService, sessionId: string, portableValidation = false): NcpTool {
  return {
    name: "bibo",
    description: "Read and update the user's Bibo personal space: tasks, calendar, notes, files, and attention inbox. Use help to discover operations by domain or keyword; known actions can be called directly. Save generated documents, HTML/SVG or Markdown diagrams with file.create kind=artifact. To open a saved file for the user, call show_file with the returned path; use viewer=rendered for an HTML preview or viewer=source for source. The workspace opens after the reply is saved. File details return a stable uri: cite it as [title](uri) in your answer so the user can reopen the artifact. Never invent a uri or claim a code block is a saved artifact. This is a first-party capability and needs no installation. Never edit Bibo's structured JSON by hand.",
    ...(portableValidation
      ? { modelParameters: biboSpaceToolParameters, validateArgs: validatePortableArgs }
      : { parameters: biboSpaceToolParameters }),
    execute: async (raw: unknown) => {
      const value = params(raw);
      if (value.operation === "help") {
        const actions = space.listActions(typeof value.domain === "string" ? value.domain : undefined, typeof value.query === "string" ? value.query : undefined);
        return { ok: true, actions };
      }
      if (value.operation !== "call" || typeof value.action !== "string") return { ok: false, error: "Use operation=help or operation=call with an action." };
      try {
        const result = await space.execute(value.action, value.input ?? {}, { kind: "agent", sessionId });
        return { ok: true, action: value.action, result, persistence: "Saved with the completed Bibo reply." };
      } catch (error) {
        return { ok: false, action: value.action, error: error instanceof BiboSpaceError ? error.message : "Bibo operation failed; do not claim success." };
      }
    },
  };
}
