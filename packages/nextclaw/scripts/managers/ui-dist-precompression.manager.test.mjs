import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { UiDistPrecompressionManager } from "./ui-dist-precompression.manager.mjs";

describe("UiDistPrecompressionManager", () => {
  it("creates deterministic sidecars only for compressible assets above the size floor", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "nextclaw-ui-precompression-"));
    try {
      mkdirSync(join(rootDir, "assets"));
      writeFileSync(join(rootDir, "index.html"), "<main>ready</main>".repeat(100));
      writeFileSync(join(rootDir, "assets/app-HASH1234.js"), "export const ready = true;\n".repeat(100));
      writeFileSync(join(rootDir, "assets/tiny.js"), "export {};\n");
      writeFileSync(join(rootDir, "assets/image.png"), Buffer.alloc(2048, 1));
      writeFileSync(join(rootDir, "assets/stale.js.gz"), "stale");

      const manager = new UiDistPrecompressionManager({ rootDir });
      const first = manager.prepare();
      const firstAppSidecar = readFileSync(join(rootDir, "assets/app-HASH1234.js.gz"));
      const second = manager.prepare();

      expect(first).toMatchObject({ fileCount: 2 });
      expect(second).toEqual(first);
      expect(readFileSync(join(rootDir, "assets/app-HASH1234.js.gz"))).toEqual(firstAppSidecar);
      expect(() => readFileSync(join(rootDir, "assets/tiny.js.gz"))).toThrow();
      expect(() => readFileSync(join(rootDir, "assets/image.png.gz"))).toThrow();
      expect(() => readFileSync(join(rootDir, "assets/stale.js.gz"))).toThrow();
    } finally {
      rmSync(rootDir, { force: true, recursive: true });
    }
  });

  it("rejects missing, invalid, stale, and unexpected sidecars", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "nextclaw-ui-precompression-"));
    try {
      mkdirSync(join(rootDir, "assets"));
      const assetPath = join(rootDir, "assets/app-HASH1234.js");
      const sidecarPath = `${assetPath}.gz`;
      writeFileSync(assetPath, "export const ready = true;\n".repeat(100));
      const manager = new UiDistPrecompressionManager({ rootDir });
      manager.prepare();

      rmSync(sidecarPath);
      expect(() => manager.verify()).toThrow(/missing gzip sidecar/);
      writeFileSync(sidecarPath, "not-gzip");
      expect(() => manager.verify()).toThrow(/invalid gzip sidecar/);
      manager.prepare();
      writeFileSync(assetPath, "export const ready = false;\n".repeat(100));
      expect(() => manager.verify()).toThrow(/stale gzip sidecar/);
      manager.prepare();
      writeFileSync(join(rootDir, "assets/orphan.png.gz"), "orphan");
      expect(() => manager.verify()).toThrow(/unexpected gzip sidecar/);
    } finally {
      rmSync(rootDir, { force: true, recursive: true });
    }
  });
});
