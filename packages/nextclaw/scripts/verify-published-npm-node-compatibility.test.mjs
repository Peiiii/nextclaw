import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("uses a Windows shell to launch npm.cmd in published-install verification", () => {
  const source = readFileSync(
    new URL("./verify-published-npm-node-compatibility.mjs", import.meta.url),
    "utf8",
  );

  assert.match(source, /function installPublishedPackage\(args\)/);
  assert.match(source, /process\.platform === "win32" \? "npm\.cmd" : "npm"/);
  assert.match(source, /shell: process\.platform === "win32"/);
});
