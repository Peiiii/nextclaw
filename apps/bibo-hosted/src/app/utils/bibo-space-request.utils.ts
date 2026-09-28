import { publicError } from "../bibo-auth.utils";

export async function parseBiboSpaceRequest(request: Request): Promise<{
  raw: string;
  action: string;
  input: unknown;
  readOnly: boolean;
  structured: boolean;
} | Response> {
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > 1_100_000) return publicError("内容过大。", 413);
  const body = JSON.parse(raw) as { action?: unknown; input?: unknown };
  if (!body || typeof body.action !== "string") return publicError("缺少操作名称。", 400);
  return { raw, action: body.action, input: body.input ?? {},
    readOnly: body.action === "overview.get" || /^(project|task|event|inbox|file)\.(list|get)$/.test(body.action),
    structured: /^(task|project|event)\./.test(body.action) };
}
