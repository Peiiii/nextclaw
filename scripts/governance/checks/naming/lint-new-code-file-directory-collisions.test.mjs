import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { collectFileDirectoryCollisionViolations } from "./lint-new-code-file-directory-collisions.mjs";

const createFixture = (t, { relativeFilePath, createSiblingDirectory = true }) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nextclaw-file-dir-collision-governance-"));
  t.after(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  const filePath = path.join(tempRoot, relativeFilePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (createSiblingDirectory) {
    fs.mkdirSync(path.join(path.dirname(filePath), path.basename(relativeFilePath, path.extname(relativeFilePath))), {
      recursive: true
    });
  }

  return {
    tempRoot,
    filePath
  };
};

test("reports touched files whose basename collides with a sibling directory", (t) => {
  const { tempRoot, filePath } = createFixture(t, {
    relativeFilePath: "packages/demo/chat.ts"
  });

  const violations = collectFileDirectoryCollisionViolations([filePath], {
    rootDir: tempRoot
  });

  assert.equal(violations.length, 1);
  assert.match(violations[0].message, /collides with sibling directory/);
  assert.equal(violations[0].filePath, "packages/demo/chat.ts");
});

test("skips touched files that are explicitly grandfathered", (t) => {
  const { tempRoot, filePath } = createFixture(t, {
    relativeFilePath: "packages/demo/chat.ts"
  });

  const violations = collectFileDirectoryCollisionViolations([filePath], {
    rootDir: tempRoot,
    allowFilePaths: ["packages/demo/chat.ts"]
  });

  assert.equal(violations.length, 0);
});
