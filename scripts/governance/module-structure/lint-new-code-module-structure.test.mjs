import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { findModuleStructureContract, isProtocolContract } from "./module-structure-contracts.mjs";
import {
  evaluateModuleStructureFindings,
  evaluateProtocolImportBoundaryFindings
} from "./lint-new-code-module-structure.mjs";

const withTemporaryModuleFixture = (fixtureName, config, run) => {
  const repoFixtureRoot = path.join("scripts/governance/module-structure/.tmp-test-fixtures", fixtureName);
  const absoluteFixtureRoot = path.resolve(process.cwd(), repoFixtureRoot);
  rmSync(absoluteFixtureRoot, { recursive: true, force: true });
  mkdirSync(path.join(absoluteFixtureRoot, "src"), { recursive: true });
  writeFileSync(path.join(absoluteFixtureRoot, "module-structure.config.json"), `${JSON.stringify(config, null, 2)}\n`);
  writeFileSync(path.join(absoluteFixtureRoot, "src/example.ts"), "export const example = true;\n");

  try {
    return run(`${repoFixtureRoot}/src/example.ts`);
  } finally {
    rmSync(absoluteFixtureRoot, { recursive: true, force: true });
  }
};

test("finds the protocol declaration for nextclaw-ui package root config", () => {
  const contract = findModuleStructureContract("packages/nextclaw-ui/src/features/chat/index.ts");
  assert.equal(contract?.modulePath, "packages/nextclaw-ui/src");
  assert.equal(contract?.protocol, "frontend-l3");
  assert.equal(isProtocolContract(contract), true);
});

test("finds the protocol declaration for nextclaw-kernel package root config", () => {
  const contract = findModuleStructureContract("packages/nextclaw-kernel/src/managers/agent.manager.ts");
  assert.equal(contract?.modulePath, "packages/nextclaw-kernel/src");
  assert.equal(contract?.protocol, "package-l1");
  assert.equal(isProtocolContract(contract), true);
});

test("finds the protocol declaration for nextclaw cli package root config", () => {
  const contract = findModuleStructureContract("packages/nextclaw/src/cli/commands/service/index.ts");
  assert.equal(contract?.modulePath, "packages/nextclaw/src/cli");
  assert.equal(contract?.protocol, "cli-command-first");
  assert.equal(isProtocolContract(contract), true);
});

test("rejects legacy configs that reuse protocol organizationModel names", () => {
  withTemporaryModuleFixture("invalid-legacy-protocol-prefix", {
    contractKind: "legacy",
    organizationModel: "protocol-package-l1",
    rootPolicy: "contract-only",
    allowedRootDirectories: ["src"],
    allowedRootFiles: []
  }, (fixtureEntryPath) => {
    assert.throws(
      () => findModuleStructureContract(fixtureEntryPath),
      /cannot reuse protocol organizationModel 'protocol-package-l1' in a legacy contract/,
    );
  });
});

test("accepts legacy configs that use the reserved legacy-\\* namespace", () => {
  withTemporaryModuleFixture("valid-legacy-package-shell", {
    contractKind: "legacy",
    organizationModel: "legacy-package-shell",
    rootPolicy: "contract-only",
    allowedRootDirectories: ["src", "tests"],
    allowedRootFiles: ["package.json"]
  }, (fixtureEntryPath) => {
    const contract = findModuleStructureContract(fixtureEntryPath);
    assert.equal(contract?.modulePath, "scripts/governance/module-structure/.tmp-test-fixtures/valid-legacy-package-shell");
    assert.equal(contract?.organizationModel, "legacy-package-shell");
    assert.equal(isProtocolContract(contract), false);
  });
});

test("blocks a new root directory outside the L3 skeleton", () => {
  const contract = findModuleStructureContract("packages/nextclaw-ui/src/runtime-control/runtime-control.manager.ts");
  const findings = evaluateModuleStructureFindings({
    filePath: "packages/nextclaw-ui/src/runtime-control/runtime-control.manager.ts",
    contract,
    existedInComparisonRef: false,
    rootEntryExistedInComparisonRef: false
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "error");
  assert.match(findings[0].message, /outside the module structure whitelist/);
});

test("blocks a new root directory outside the L1 minimal skeleton", () => {
  const contract = findModuleStructureContract("packages/nextclaw-kernel/src/kernel/runtime.ts");
  const findings = evaluateModuleStructureFindings({
    filePath: "packages/nextclaw-kernel/src/kernel/runtime.ts",
    contract,
    existedInComparisonRef: false,
    rootEntryExistedInComparisonRef: false
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "error");
  assert.match(findings[0].message, /outside the module structure whitelist/);
});

test("blocks new root files outside the L1 minimal allowed root-file set", () => {
  const contract = findModuleStructureContract("packages/nextclaw-kernel/src/runtime.ts");
  const findings = evaluateModuleStructureFindings({
    filePath: "packages/nextclaw-kernel/src/runtime.ts",
    contract,
    existedInComparisonRef: false,
    rootEntryExistedInComparisonRef: false
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "error");
  assert.match(findings[0].message, /allowed root-file set/);
});

test("blocks a new file added under an existing legacy root directory", () => {
  const contract = findModuleStructureContract("packages/nextclaw-ui/src/components/chat/new-toolbar.tsx");
  const findings = evaluateModuleStructureFindings({
    filePath: "packages/nextclaw-ui/src/components/chat/new-toolbar.tsx",
    contract,
    existedInComparisonRef: false,
    rootEntryExistedInComparisonRef: true
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "error");
  assert.match(findings[0].message, /new file was added under legacy root directory/);
});

test("downgrades touched legacy files under old roots to warnings", () => {
  const contract = findModuleStructureContract("packages/nextclaw-ui/src/components/chat/ncp/ncp-chat-page.tsx");
  const findings = evaluateModuleStructureFindings({
    filePath: "packages/nextclaw-ui/src/components/chat/ncp/ncp-chat-page.tsx",
    contract,
    existedInComparisonRef: true,
    rootEntryExistedInComparisonRef: true
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "warn");
  assert.match(findings[0].message, /legacy root directory/);
});

test("blocks reserved role names under features", () => {
  const contract = findModuleStructureContract("packages/nextclaw-ui/src/features/hooks/index.ts");
  const findings = evaluateModuleStructureFindings({
    filePath: "packages/nextclaw-ui/src/features/hooks/index.ts",
    contract,
    existedInComparisonRef: false,
    rootEntryExistedInComparisonRef: false,
    repoPathExists: () => true
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "error");
  assert.match(findings[0].message, /must use business directory names/);
});

test("blocks feature files outside index or role directories", () => {
  const contract = findModuleStructureContract("packages/nextclaw-ui/src/features/chat/chat-page.tsx");
  const findings = evaluateModuleStructureFindings({
    filePath: "packages/nextclaw-ui/src/features/chat/chat-page.tsx",
    contract,
    existedInComparisonRef: false,
    rootEntryExistedInComparisonRef: false,
    repoPathExists: () => true
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "error");
  assert.match(findings[0].message, /may only expose 'index.ts' or 'index.tsx'/);
});

test("requires feature index entry when adding files under a feature role directory", () => {
  const contract = findModuleStructureContract("packages/nextclaw-ui/src/features/chat/components/chat-panel.tsx");
  const findings = evaluateModuleStructureFindings({
    filePath: "packages/nextclaw-ui/src/features/chat/components/chat-panel.tsx",
    contract,
    existedInComparisonRef: false,
    rootEntryExistedInComparisonRef: false,
    repoPathExists: (repoPath) => repoPath.endsWith("/components/chat-panel.tsx")
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "error");
  assert.match(findings[0].message, /missing 'index\.ts' or 'index\.tsx'/);
});

test("blocks shared root barrel index files", () => {
  const contract = findModuleStructureContract("packages/nextclaw-ui/src/shared/components/index.ts");
  const findings = evaluateModuleStructureFindings({
    filePath: "packages/nextclaw-ui/src/shared/components/index.ts",
    contract,
    existedInComparisonRef: false,
    rootEntryExistedInComparisonRef: false
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "error");
  assert.match(findings[0].message, /forbids root-level 'index\.ts' or 'index\.tsx'/);
});

test("blocks direct files under shared lib root", () => {
  const contract = findModuleStructureContract("packages/nextclaw-ui/src/shared/lib/date-format.utils.ts");
  const findings = evaluateModuleStructureFindings({
    filePath: "packages/nextclaw-ui/src/shared/lib/date-format.utils.ts",
    contract,
    existedInComparisonRef: false,
    rootEntryExistedInComparisonRef: false
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "error");
  assert.match(findings[0].message, /files cannot live directly under 'shared\/lib\/'/);
});

test("requires platform index entry and role directories", () => {
  const contract = findModuleStructureContract("packages/nextclaw-ui/src/platforms/desktop/chat/chat-bridge.ts");
  const findings = evaluateModuleStructureFindings({
    filePath: "packages/nextclaw-ui/src/platforms/desktop/chat/chat-bridge.ts",
    contract,
    existedInComparisonRef: false,
    rootEntryExistedInComparisonRef: false,
    repoPathExists: () => false
  });

  assert.equal(findings.length, 2);
  assert.equal(findings[0].level, "error");
  assert.equal(findings[1].level, "error");
  assert.match(findings[0].message, /missing 'index\.ts' or 'index\.tsx'/);
  assert.match(findings[1].message, /may only contain role directories/);
});

test("blocks new deep imports into another feature", () => {
  const contract = findModuleStructureContract("packages/nextclaw-ui/src/app.tsx");
  const findings = evaluateProtocolImportBoundaryFindings({
    filePath: "packages/nextclaw-ui/src/app.tsx",
    contract,
    source: `import { ChatPanel } from "@/features/chat/components/chat-panel";\n`,
    addedLines: new Set([1])
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "error");
  assert.match(findings[0].message, /feature imports must go through 'features\/chat'/);
});

test("allows alias imports inside the same feature boundary", () => {
  const contract = findModuleStructureContract("packages/nextclaw-ui/src/features/chat/components/chat-page.tsx");
  const findings = evaluateProtocolImportBoundaryFindings({
    filePath: "packages/nextclaw-ui/src/features/chat/components/chat-page.tsx",
    contract,
    source: `import { useChatStore } from "@/features/chat/stores/chat.store";\n`,
    addedLines: new Set([1])
  });

  assert.equal(findings.length, 0);
});

test("blocks new deep imports into shared lib internals", () => {
  const contract = findModuleStructureContract("packages/nextclaw-ui/src/app.tsx");
  const findings = evaluateProtocolImportBoundaryFindings({
    filePath: "packages/nextclaw-ui/src/app.tsx",
    contract,
    source: `import { formatDate } from "@/shared/lib/date-format/date-format.utils";\n`,
    addedLines: new Set([1])
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "error");
  assert.match(findings[0].message, /shared\/lib imports must go through 'shared\/lib\/date-format'/);
});

test("warns when a touched file still carries a legacy deep import", () => {
  const contract = findModuleStructureContract("packages/nextclaw-ui/src/app.tsx");
  const findings = evaluateProtocolImportBoundaryFindings({
    filePath: "packages/nextclaw-ui/src/app.tsx",
    contract,
    source: `import { ChatPanel } from "@/features/chat/components/chat-panel";\n`,
    addedLines: new Set()
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "warn");
  assert.match(findings[0].message, /feature imports must go through 'features\/chat'/);
});

test("allows shared component file imports", () => {
  const contract = findModuleStructureContract("packages/nextclaw-ui/src/app.tsx");
  const findings = evaluateProtocolImportBoundaryFindings({
    filePath: "packages/nextclaw-ui/src/app.tsx",
    contract,
    source: `import { Button } from "@/shared/components/button";\n`,
    addedLines: new Set([1])
  });

  assert.equal(findings.length, 0);
});

test("blocks parent-relative imports when alias imports are configured", () => {
  const contract = findModuleStructureContract("packages/nextclaw/src/cli/shared/services/update/self-update.service.ts");
  const findings = evaluateProtocolImportBoundaryFindings({
    filePath: "packages/nextclaw/src/cli/shared/services/update/self-update.service.ts",
    contract,
    source: `import { which } from "../../utils/cli.utils.js";\n`,
    addedLines: new Set([1])
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "error");
  assert.match(findings[0].message, /cross-directory imports must use '@\/'/);
});

test("allows same-directory relative imports when alias imports are configured", () => {
  const contract = findModuleStructureContract("packages/nextclaw/src/cli/shared/services/update/self-update.service.test.ts");
  const findings = evaluateProtocolImportBoundaryFindings({
    filePath: "packages/nextclaw/src/cli/shared/services/update/self-update.service.test.ts",
    contract,
    source: `import { runSelfUpdate } from "./self-update.service.js";\n`,
    addedLines: new Set([1])
  });

  assert.equal(findings.length, 0);
});

test("finds config from package root when linting the config file itself", () => {
  const contract = findModuleStructureContract("packages/nextclaw/module-structure.config.json");
  assert.equal(contract?.modulePath, "packages/nextclaw/src/cli");
  assert.equal(contract?.protocol, "cli-command-first");
});

test("blocks a new root directory outside the CLI command-first skeleton", () => {
  const contract = findModuleStructureContract("packages/nextclaw/src/cli/gateway/controller.ts");
  const findings = evaluateModuleStructureFindings({
    filePath: "packages/nextclaw/src/cli/gateway/controller.ts",
    contract,
    existedInComparisonRef: true,
    rootEntryExistedInComparisonRef: true
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "error");
  assert.match(findings[0].message, /outside the module structure whitelist/);
});

test("blocks new root files outside the CLI command-first skeleton", () => {
  const contract = findModuleStructureContract("packages/nextclaw/src/cli/runtime.ts");
  const findings = evaluateModuleStructureFindings({
    filePath: "packages/nextclaw/src/cli/runtime.ts",
    contract,
    existedInComparisonRef: true,
    rootEntryExistedInComparisonRef: false
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "error");
  assert.match(findings[0].message, /outside the allowed root-file set/);
});

test("blocks reserved role names under commands", () => {
  const contract = findModuleStructureContract("packages/nextclaw/src/cli/commands/services/index.ts");
  const findings = evaluateModuleStructureFindings({
    filePath: "packages/nextclaw/src/cli/commands/services/index.ts",
    contract,
    existedInComparisonRef: false,
    rootEntryExistedInComparisonRef: false,
    repoPathExists: () => true
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "error");
  assert.match(findings[0].message, /commands must use business directory names/);
});

test("requires command index entry when adding files under a command role directory", () => {
  const contract = findModuleStructureContract("packages/nextclaw/src/cli/commands/service/services/service-runner.service.ts");
  const findings = evaluateModuleStructureFindings({
    filePath: "packages/nextclaw/src/cli/commands/service/services/service-runner.service.ts",
    contract,
    existedInComparisonRef: false,
    rootEntryExistedInComparisonRef: false,
    repoPathExists: (repoPath) => repoPath.endsWith("/services/service-runner.service.ts")
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "error");
  assert.match(findings[0].message, /command 'service\/' is missing 'index\.ts' or 'index\.tsx'/);
});

test("blocks new deep imports into another command", () => {
  const contract = findModuleStructureContract("packages/nextclaw/src/cli/app/bootstrap.ts");
  const findings = evaluateProtocolImportBoundaryFindings({
    filePath: "packages/nextclaw/src/cli/app/bootstrap.ts",
    contract,
    source: `import { runServiceCommand } from "@/commands/service/services/service-runner.service";\n`,
    addedLines: new Set([1])
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "error");
  assert.match(findings[0].message, /command imports must go through 'commands\/service'/);
});

test("allows explicit index imports at a command boundary", () => {
  const contract = findModuleStructureContract("packages/nextclaw/src/cli/app/bootstrap.ts");
  const findings = evaluateProtocolImportBoundaryFindings({
    filePath: "packages/nextclaw/src/cli/app/bootstrap.ts",
    contract,
    source: `import { runCliAgentCommand } from "@/commands/agent/index.js";\n`,
    addedLines: new Set([1])
  });

  assert.equal(findings.length, 0);
});

test("allows alias imports inside the same command boundary", () => {
  const contract = findModuleStructureContract("packages/nextclaw/src/cli/commands/service/controllers/service.controller.ts");
  const findings = evaluateProtocolImportBoundaryFindings({
    filePath: "packages/nextclaw/src/cli/commands/service/controllers/service.controller.ts",
    contract,
    source: `import { runService } from "@/commands/service/services/service-runner.service";\n`,
    addedLines: new Set([1])
  });

  assert.equal(findings.length, 0);
});
