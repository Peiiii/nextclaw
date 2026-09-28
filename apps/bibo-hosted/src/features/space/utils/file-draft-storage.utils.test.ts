import assert from "node:assert/strict";
import test from "node:test";
import { readFileDrafts, writeFileDrafts } from "./file-draft-storage.utils";

test("file draft recovery isolates accounts, keeps base versions and clears only saved drafts", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  } });
  try {
    const draft = { content: "# 中文草稿", version: 4, dirty: true, saving: true };
    assert.equal(writeFileDrafts("one", { file: draft }), true);
    assert.deepEqual(readFileDrafts("two"), {});
    assert.deepEqual(readFileDrafts("one"), { file: { ...draft, saving: false } });
    writeFileDrafts("two", { other: draft });
    writeFileDrafts("one", { file: { ...draft, dirty: false, saving: false } });
    assert.deepEqual(readFileDrafts("one"), {});
    assert.ok(readFileDrafts("two").other);
    data.set("bibo-file-drafts:one", '{"bad":{"content":null,"version":-1}}');
    assert.deepEqual(readFileDrafts("one"), {});
    sessionStorage.setItem = () => { throw new Error("Quota exceeded"); };
    assert.equal(writeFileDrafts("one", { file: draft }), false, "backup failures cannot claim protection");
    assert.ok(readFileDrafts("two").other, "a failed backup does not erase another account");
  } finally {
    if (previous) Object.defineProperty(globalThis, "sessionStorage", previous);
    else Reflect.deleteProperty(globalThis, "sessionStorage");
  }
});
