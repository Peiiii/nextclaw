import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { LocalAssetStore } from "../assets/stores/local-asset.store.js";

const tempDirs: string[] = [];

function createStore(): LocalAssetStore {
  const rootDir = mkdtempSync(join(tmpdir(), "nextclaw-asset-store-test-"));
  tempDirs.push(rootDir);
  return new LocalAssetStore({ rootDir });
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("LocalAssetStore", () => {
  it("preserves the original file name while storing a sanitized file name on disk", async () => {
    const store = createStore();
    const record = await store.putBytes({
      fileName: "my config.json",
      mimeType: "application/json",
      bytes: Buffer.from('{"ok":true}', "utf8"),
    });

    expect(record.fileName).toBe("my config.json");
    expect(record.storedName).toBe("my_config.json");
    expect(store.resolveContentPath(record.uri)).toContain("my_config.json");
  });

  it("infers a media mime type from the file name when the input mime type is missing", async () => {
    const store = createStore();
    const record = await store.putBytes({
      fileName: "chill_beats.mp3",
      bytes: Buffer.from("fake-mp3", "utf8"),
    });

    expect(record.mimeType).toBe("audio/mpeg");
  });

  it("keeps asset api methods bound when passed across package boundaries", async () => {
    const store = createStore();
    const putBytes = store.putBytes;
    const statRecord = store.statRecord;
    const resolveContentPath = store.resolveContentPath;
    const record = await putBytes({
      fileName: "screen.png",
      mimeType: "image/png",
      bytes: Buffer.from("fake-png", "utf8"),
    });

    await expect(statRecord(record.uri)).resolves.toMatchObject({
      uri: record.uri,
      fileName: "screen.png",
    });
    expect(resolveContentPath(record.uri)).toContain("screen.png");
  });
});
