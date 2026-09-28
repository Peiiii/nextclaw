import assert from "node:assert/strict";
import test from "node:test";
import { biboAssetsRoute, type BiboAssetStorage } from "./bibo-assets.route";

test("private image assets persist with tenant isolation and bounded, typed uploads", async () => {
  const objects = new Map<string, { bytes: Uint8Array; contentType: string }>();
  const bucket = {
    put: async (key: string, bytes: Uint8Array, options: { httpMetadata: { contentType: string } }) => {
      objects.set(key, { bytes: bytes.slice(), contentType: options.httpMetadata.contentType });
    },
    get: async (key: string) => {
      const object = objects.get(key);
      return object ? { body: object.bytes, size: object.bytes.length, httpMetadata: { contentType: object.contentType } } : null;
    },
  } satisfies BiboAssetStorage;
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]);
  const upload = await biboAssetsRoute(new Request("https://app.bibo.bot/api/assets", { method: "POST", body: png }), bucket, "owner");
  assert.equal(upload.status, 201);
  const { url } = await upload.json() as { url: string };
  const saved = await biboAssetsRoute(new Request(`https://app.bibo.bot${url}`), bucket, "owner");
  assert.equal(saved.status, 200);
  assert.equal(saved.headers.get("content-type"), "image/png");
  assert.equal(saved.headers.get("vary"), "Cookie");
  assert.equal(saved.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(new Uint8Array(await saved.arrayBuffer()), png);
  assert.equal((await biboAssetsRoute(new Request(`https://app.bibo.bot${url}`), bucket, "other")).status, 404);
  const fake = new Request("https://app.bibo.bot/api/assets", { method: "POST", headers: { "content-type": "image/png" }, body: "<svg onload='alert(1)'></svg>" });
  assert.equal((await biboAssetsRoute(fake, bucket, "owner")).status, 415);
  const huge = new Request("https://app.bibo.bot/api/assets", { method: "POST", headers: { "content-length": String(11 * 1024 * 1024) }, body: png });
  assert.equal((await biboAssetsRoute(huge, bucket, "owner")).status, 413);
  assert.equal(objects.size, 1, "rejected uploads cannot create objects");
});
