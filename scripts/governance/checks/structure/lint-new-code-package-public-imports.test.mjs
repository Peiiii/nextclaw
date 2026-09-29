import assert from "node:assert/strict";
import test from "node:test";

import {
  collectPackagePublicImportViolations,
  collectPackageSourceAliasViolations,
} from "./lint-new-code-package-public-imports.mjs";

const workspacePackages = [
  {
    name: "@fixture/consumer",
    rootPath: "packages/fixture-consumer",
  },
  {
    name: "@fixture/shared",
    rootPath: "packages/fixture-shared",
  },
];

test("blocks a test alias that uses a workspace package subpath", () => {
  const findings = collectPackageSourceAliasViolations({
    filePath: "packages/fixture-consumer/vitest.config.ts",
    source: `export default { resolve: { alias: {
      "@fixture/shared/lifecycle": new URL("../fixture-shared/src/features/lifecycle/index.ts", import.meta.url).pathname,
    } } };`,
    workspacePackages,
  });

  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /@fixture\/shared\/lifecycle/);
});

test("blocks a cross-workspace import even when the target declares an exports subpath", () => {
  const findings = collectPackagePublicImportViolations(
    ["packages/fixture-consumer/src/index.ts"],
    workspacePackages,
    new Map([
      [
        "packages/fixture-consumer/src/index.ts",
        'import { Contribution } from "@fixture/shared/lifecycle";\n',
      ],
    ]),
  );

  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /root public entry/);
});

test("allows an explicitly governed dual-mode Desktop host contract", () => {
  const findings = collectPackagePublicImportViolations(
    ["apps/desktop/src/main.ts"],
    [
      { name: "@nextclaw/desktop", rootPath: "apps/desktop" },
      { name: "@nextclaw/kernel", rootPath: "packages/nextclaw-kernel" },
    ],
    new Map([
      [
        "apps/desktop/src/main.ts",
        'import { resolveAutomaticUpdateCheckIntervalMs } from "@nextclaw/kernel/automatic-update-check";\n',
      ],
    ]),
  );

  assert.deepEqual(findings, []);
});

test("allows the shared Node and Worker model input budget contract", () => {
  const findings = collectPackagePublicImportViolations(
    ["packages/nextclaw-kernel/src/services/model-input.ts"],
    [
      { name: "@nextclaw/kernel", rootPath: "packages/nextclaw-kernel" },
      { name: "@nextclaw/core", rootPath: "packages/nextclaw-core" },
    ],
    new Map([["packages/nextclaw-kernel/src/services/model-input.ts",
      'import { InputBudgetPruner } from "@nextclaw/core/model-input-budget";\n']]),
  );
  assert.deepEqual(findings, []);
});

test("allows the portable context checkpoint contract without opening other core subpaths", () => {
  const file = "packages/nextclaw-kernel/src/features/context-compaction/utils/context-compaction.utils.ts";
  const packages = [
    { name: "@nextclaw/kernel", rootPath: "packages/nextclaw-kernel" },
    { name: "@nextclaw/core", rootPath: "packages/nextclaw-core" },
  ];
  assert.deepEqual(collectPackagePublicImportViolations([file], packages, new Map([
    [file, 'import { readCompressedContextCompactionCheckpoint } from "@nextclaw/core/context-compaction-checkpoint";\n'],
  ])), []);
  assert.equal(collectPackagePublicImportViolations([file], packages, new Map([
    [file, 'import { hidden } from "@nextclaw/core/other";\n'],
  ])).length, 1);
});

test("allows a package-root development alias", () => {
  const findings = collectPackageSourceAliasViolations({
    filePath: "packages/fixture-consumer/vitest.config.ts",
    source: `export default { resolve: { alias: {
      "@fixture/shared": new URL("../fixture-shared/src/index.ts", import.meta.url).pathname,
    } } };`,
    workspacePackages,
  });

  assert.deepEqual(findings, []);
});

test("parses JSX when inspecting aliases in a TSX config", () => {
  const findings = collectPackageSourceAliasViolations({
    filePath: "packages/fixture-consumer/vite.config.tsx",
    source: `const app = <main />;
      export default { resolve: { alias: {
        "@fixture/shared": new URL("../fixture-shared/src/index.ts", import.meta.url).pathname,
      } } };`,
    workspacePackages,
  });

  assert.deepEqual(findings, []);
});
