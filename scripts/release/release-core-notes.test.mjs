import assert from "node:assert/strict";
import test from "node:test";

import { resolveCoreReleaseNotes } from "./release-core-notes.mjs";

test("prefers structured release notes for an enriched release", () => {
  const result = resolveCoreReleaseNotes({
    changelog:
      "# nextclaw\n\n## 1.2.3\n\n### Patch Changes\n\n- Fixed update handling.\n",
    structuredMetadata: {
      version: "1.2.3",
      links: { html: { "en-US": "https://docs.nextclaw.io/en/notes/v1-2-3" } },
    },
    version: "1.2.3",
  });
  assert.equal(result.contentReady, true);
  assert.equal(
    result.releaseNotesUrl,
    "https://docs.nextclaw.io/en/notes/v1-2-3",
  );
  assert.match(result.notes, /Fixed update handling/);
  assert.match(result.notes, /## 中文[\s\S]*## English/);
});

test("rejects structured notes for a different immutable version", () => {
  assert.throws(
    () =>
      resolveCoreReleaseNotes({
        structuredMetadata: {
          version: "1.2.2",
          links: {
            html: { "en-US": "https://docs.nextclaw.io/en/notes/v1-2-2" },
          },
        },
        version: "1.2.3",
      }),
    /version mismatch/,
  );
});

test("falls back to the immutable GitHub release identity without AI content", () => {
  const result = resolveCoreReleaseNotes({
    changelog: "# nextclaw\n",
    repo: "Peiiii/nextclaw",
    version: "1.2.3",
  });
  assert.equal(result.contentReady, false);
  assert.equal(
    result.releaseNotesUrl,
    "https://github.com/Peiiii/nextclaw/releases/tag/nextclaw@1.2.3",
  );
  assert.match(result.notes, /deterministic release pipeline/);
  assert.doesNotMatch(result.notes, /OPENAI|anthropic|model|prompt/i);
});
