import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { mergeLatestLocSnapshot, readLocHistory } from "./data-core.mjs";

const createFixtureDir = () => mkdtempSync(join(tmpdir(), "nextclaw-project-pulse-"));

test("readLocHistory keeps production and test LOC separated", () => {
  const fixtureDir = createFixtureDir();
  const historyPath = join(fixtureDir, "history.jsonl");
  writeFileSync(
    historyPath,
    [
      JSON.stringify({
        generatedAt: "2026-05-10T03:22:06.815Z",
        codeLines: 187293,
        testCodeLines: 59141
      }),
      ""
    ].join("\n"),
    "utf8"
  );

  assert.deepEqual(readLocHistory(historyPath), [
    {
      date: "2026-05-10",
      productionCodeLines: 187293,
      testCodeLines: 59141
    }
  ]);
});

test("mergeLatestLocSnapshot replaces legacy total LOC with latest production LOC", () => {
  const history = [
    {
      date: "2026-05-10",
      productionCodeLines: 245505,
      testCodeLines: 0,
      value: 245505
    }
  ];

  assert.deepEqual(
    mergeLatestLocSnapshot(history, {
      generatedAt: "2026-05-10T08:21:18.297Z",
      totals: {
        codeLines: 187293,
        testCodeLines: 59141
      }
    }),
    [
      {
        date: "2026-05-10",
        productionCodeLines: 187293,
        testCodeLines: 59141
      }
    ]
  );
});
