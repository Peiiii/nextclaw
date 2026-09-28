import { json, publicError } from "@/app/bibo-auth.utils";

const maxImageBytes = 10 * 1024 * 1024;
const assetId = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export type BiboAssetStorage = {
  put: (key: string, bytes: Uint8Array, options: { httpMetadata: { contentType: string } }) => Promise<unknown>;
  get: (key: string) => Promise<{ body: ReadableStream<Uint8Array> | Uint8Array; size: number; httpMetadata?: { contentType?: string } } | null>;
};

function imageType(bytes: Uint8Array): string | null {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (bytes.length < 12) return null;
  if (bytes[0] === 137 && ascii(1, 4) === "PNG" && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10) return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (["GIF87a", "GIF89a"].includes(ascii(0, 6))) return "image/gif";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(4, 8) === "ftyp" && ["avif", "avis"].includes(ascii(8, 12))) return "image/avif";
  return null;
}

async function readImage(request: Request): Promise<Uint8Array | null> {
  if (Number(request.headers.get("content-length")) > maxImageBytes || !request.body) return null;
  const reader = request.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    size += next.value.byteLength;
    if (size > maxImageBytes) { await reader.cancel(); return null; }
    chunks.push(next.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

/** Caller authenticates the user and checks Origin before reaching this tenant-scoped route. */
export async function biboAssetsRoute(request: Request, bucket: BiboAssetStorage, userId: string): Promise<Response> {
  const path = new URL(request.url).pathname;
  const prefix = `document-assets/${encodeURIComponent(userId)}/`;
  if (path === "/api/assets" && request.method === "POST") {
    const bytes = await readImage(request);
    if (!bytes) return publicError("图片最大支持 10 MiB。", 413);
    const contentType = imageType(bytes);
    if (!contentType) return publicError("请选择 PNG、JPEG、GIF、WebP 或 AVIF 图片。", 415);
    const id = crypto.randomUUID();
    await bucket.put(prefix + id, bytes, { httpMetadata: { contentType } });
    return json({ url: `/api/assets/${id}` }, 201);
  }
  const id = path.slice("/api/assets/".length);
  if (request.method !== "GET" || !path.startsWith("/api/assets/") || !assetId.test(id)) return publicError("图片不存在。", 404);
  const object = await bucket.get(prefix + id);
  if (!object) return publicError("图片不存在或无权访问。", 404);
  const body = object.body instanceof Uint8Array ? new Uint8Array(object.body).buffer : object.body;
  return new Response(body, { headers: {
    "content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
    "content-length": String(object.size), "x-content-type-options": "nosniff",
    "cache-control": "private, max-age=300", vary: "Cookie",
    "content-security-policy": "default-src 'none'; sandbox",
  } });
}
