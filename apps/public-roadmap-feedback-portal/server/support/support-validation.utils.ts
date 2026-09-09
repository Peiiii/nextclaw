import { HTTPException } from "hono/http-exception";

export function reject(status: 400 | 401 | 403 | 404 | 409 | 413 | 429 | 503, message: string): never {
  throw new HTTPException(status, { message });
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) reject(400, "请求格式不正确。");
  return value as Record<string, unknown>;
}
export function textField(value: unknown, name: string, max: number, optional = false): string {
  if (optional && (value === undefined || value === "")) return "";
  if (typeof value !== "string" || !value.trim() || value.length > max) reject(400, `${name}不能为空且不能超过 ${max} 个字符。`);
  return value.trim();
}
export function identifier(value: unknown): string {
  const id = textField(value, "标识", 80);
  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(id)) reject(400, "标识格式不正确。");
  return id;
}
export function receiptKey(value: unknown): string {
  const key = textField(value, "反馈回执", 128);
  if (!/^[a-f0-9]{64}$/.test(key)) reject(401, "反馈回执无效。");
  return key;
}
export async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}
export function secureEqual(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left), b = new TextEncoder().encode(right);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}
export function safeUrl(value: unknown): string | null {
  if (!value) return null;
  const raw = textField(value, "链接", 500);
  try { const url = new URL(raw); if (url.protocol === "https:" && !url.username && !url.password) return url.href; } catch { return reject(400, "请提供 HTTPS 链接。"); }
  return reject(400, "请提供 HTTPS 链接。");
}
