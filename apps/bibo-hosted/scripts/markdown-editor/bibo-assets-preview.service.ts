import type { IncomingMessage, ServerResponse } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import type { biboAssetsRoute, BiboAssetStorage } from "../../src/features/assets";

/** Persist local preview assets while exercising the production size/type/tenant contract. */
export async function serveBiboPreviewAsset(request: IncomingMessage, response: ServerResponse, home: string, route: typeof biboAssetsRoute): Promise<void> {
  const bucket = {
    put: async (key: string, bytes: Uint8Array, options: { httpMetadata: { contentType: string } }) => {
      const file = join(home, "assets", key);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, bytes);
      await writeFile(`${file}.json`, JSON.stringify(options.httpMetadata));
    },
    get: async (key: string) => {
      const file = join(home, "assets", key);
      try {
        const bytes = await readFile(file);
        return { body: bytes, size: bytes.length, httpMetadata: JSON.parse(await readFile(`${file}.json`, "utf8")) as { contentType: string } };
      } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
    },
  } satisfies BiboAssetStorage;
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(",") : value);
  const incoming = new Request(`http://localhost${request.url}`, { method: request.method, headers,
    ...(request.method === "POST" ? { body: Readable.toWeb(request), duplex: "half" } : {}),
  } as RequestInit);
  const result = await route(incoming, bucket, "local-ui-preview");
  const outgoing: Record<string, string> = {};
  result.headers.forEach((value, key) => { outgoing[key] = value; });
  response.writeHead(result.status, outgoing);
  response.end(Buffer.from(await result.arrayBuffer()));
}
