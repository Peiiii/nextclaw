import assert from "node:assert/strict";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { MODULE_STRUCTURE_PROTOCOLS, findModuleStructureContract, isProtocolContract } from "./module-structure-contracts.mjs";
import {
  collectModuleStructureViolations,
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

const APPROVED_MODULE_STRUCTURE_PROTOCOLS = [
  "app-l1",
  "app-l2",
  "app-l3",
  "cli-command-first",
  "electron-shell-l1"
];

const listWorkspaceRoots = () => {
  const repoRoot = process.cwd();
  const collectImmediateWorkspaceRoots = (relativeDirectory) => {
    const absoluteDirectory = path.join(repoRoot, relativeDirectory);
    return readdirSync(absoluteDirectory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.posix.join(relativeDirectory, entry.name))
      .filter((workspaceRoot) => readdirSync(path.join(repoRoot, workspaceRoot)).includes("package.json"));
  };

  return [
    ...collectImmediateWorkspaceRoots("apps"),
    ...collectImmediateWorkspaceRoots("apps/ncp-demo"),
    ...collectImmediateWorkspaceRoots("packages"),
    ...collectImmediateWorkspaceRoots("packages/extensions"),
    ...collectImmediateWorkspaceRoots("packages/ncp-packages"),
    ...collectImmediateWorkspaceRoots("workers")
  ].sort();
};

test("module-structure protocols stay inside the approved fixed list", () => {
  assert.deepEqual([...MODULE_STRUCTURE_PROTOCOLS.keys()].sort(), APPROVED_MODULE_STRUCTURE_PROTOCOLS);
});

test("finds the protocol declaration for nextclaw-ui package root config", () => {
  const contract = findModuleStructureContract("packages/nextclaw-ui/src/features/chat/index.ts");
  assert.equal(contract?.modulePath, "packages/nextclaw-ui/src");
  assert.equal(contract?.protocol, "app-l3");
  assert.equal(isProtocolContract(contract), true);
});

test("finds the protocol declaration for nextclaw-kernel package root config", () => {
  const contract = findModuleStructureContract("packages/nextclaw-kernel/src/managers/agent.manager.ts");
  assert.equal(contract?.modulePath, "packages/nextclaw-kernel/src");
  assert.equal(contract?.protocol, "app-l1");
  assert.equal(isProtocolContract(contract), true);
  assert.equal(contract?.allowedRootDirectories.has("tools"), true);
  assert.equal(contract?.allowedRootFiles.has("index.ts"), true);
});

test("finds the protocol declaration for nextclaw cli package root config", () => {
  const contract = findModuleStructureContract("packages/nextclaw/src/cli/commands/service/index.ts");
  assert.equal(contract?.modulePath, "packages/nextclaw/src/cli");
  assert.equal(contract?.protocol, "cli-command-first");
  assert.equal(isProtocolContract(contract), true);
});

test("finds the renderer root declaration for companion src config", () => {
  const contract = findModuleStructureContract("apps/companion/src/services/companion-runtime-client.service.ts");
  assert.equal(contract?.modulePath, "apps/companion/src");
  assert.equal(contract?.organizationModel, "legacy-apps-companion-renderer-root");
  assert.equal(isProtocolContract(contract), false);
  assert.equal(contract?.requiredRootDirectories.has("presenters"), true);
  assert.equal(contract?.requiredRootDirectories.has("managers"), true);
  assert.equal(contract?.requiredRootDirectories.has("stores"), true);
});

test("finds the workspace-root legacy declaration for companion electron shell files", () => {
  const contract = findModuleStructureContract("apps/companion/electron/main.ts");
  assert.equal(contract?.modulePath, "apps/companion");
  assert.equal(contract?.organizationModel, "legacy-apps-companion-workspace-root");
  assert.equal(isProtocolContract(contract), false);
});

test("finds the protocol declaration for desktop electron shell config", () => {
  const contract = findModuleStructureContract("apps/desktop/src/services/desktop-runtime-control.service.ts");
  assert.equal(contract?.modulePath, "apps/desktop/src");
  assert.equal(contract?.protocol, "electron-shell-l1");
  assert.equal(isProtocolContract(contract), true);
  assert.equal(contract?.allowedRootFiles.has("runtime-config.ts"), true);
  assert.equal(contract?.allowedRootFiles.has("runtime-service.ts"), true);
});

test("finds the strict package L2 declaration for nextclaw-server", () => {
  const contract = findModuleStructureContract("packages/nextclaw-server/src/index.ts");
  assert.equal(contract?.modulePath, "packages/nextclaw-server/src");
  assert.equal(contract?.protocol, "app-l2");
  assert.equal(isProtocolContract(contract), true);
  assert.equal(contract?.allowedRootDirectories.has("ui"), false);
  assert.equal(contract?.allowedRootFiles.has("index.ts"), true);
});

test("finds the package L2 declaration for single-platform multi-feature apps", () => {
  const contract = findModuleStructureContract("apps/public-roadmap-feedback-portal/src/features/community-feedback/components/community-feedback-section.tsx");
  assert.equal(contract?.modulePath, "apps/public-roadmap-feedback-portal/src");
  assert.equal(contract?.protocol, "app-l2");
  assert.equal(isProtocolContract(contract), true);
  assert.deepEqual([...contract.allowedRootDirectories].sort(), ["app", "features", "shared"]);
  assert.equal(contract?.allowedRootFiles.has("index.ts"), true);
});

test("requires nextclaw-core package L2 root index entry", () => {
  const contract = findModuleStructureContract("packages/nextclaw-core/src/index.ts");
  assert.equal(contract?.modulePath, "packages/nextclaw-core/src");
  assert.equal(contract?.protocol, "app-l2");
  assert.equal(isProtocolContract(contract), true);
  assert.equal(contract?.allowedRootFiles.has("index.ts"), true);
  assert.equal(contract?.requiredRootFiles.has("index.ts"), true);
});

test("blocks package L2 configs when the required root index is missing", () => {
  withTemporaryModuleFixture("missing-required-root-file", {
    contractKind: "protocol",
    protocol: "app-l2",
    rootPolicy: "contract-only",
    requiredRootFiles: ["index.ts"]
  }, (fixtureEntryPath) => {
    const contract = findModuleStructureContract(fixtureEntryPath);
    const findings = collectModuleStructureViolations([fixtureEntryPath], new Map(), { baseRef: "HEAD" });
    assert.equal(contract?.requiredRootFiles.has("index.ts"), true);
    assert.match(
      findings.map((finding) => finding.message).join("\n"),
      /missing required root entries: 'index\.ts'/,
    );
  });
});

test("rejects the removed package-src-explicit protocol", () => {
  withTemporaryModuleFixture("removed-package-src-explicit-protocol", {
    contractKind: "protocol",
    protocol: "package-src-explicit",
    rootPolicy: "contract-only",
    allowedRootDirectories: [],
    allowedRootFiles: ["example.ts"]
  }, (fixtureEntryPath) => {
    assert.throws(
      () => findModuleStructureContract(fixtureEntryPath),
      /Unknown module-structure protocol 'package-src-explicit'/,
    );
  });
});

test("rejects the removed source-root-open protocol", () => {
  withTemporaryModuleFixture("removed-source-root-open-protocol", {
    contractKind: "protocol",
    protocol: "source-root-open",
    rootPolicy: "contract-only",
    allowedRootDirectories: [],
    allowedRootFiles: ["example.ts"]
  }, (fixtureEntryPath) => {
    assert.throws(
      () => findModuleStructureContract(fixtureEntryPath),
      /Unknown module-structure protocol 'source-root-open'/,
    );
  });
});

test("every workspace root declares module-structure config", () => {
  const missing = listWorkspaceRoots()
    .filter((workspaceRoot) => !findModuleStructureContract(`${workspaceRoot}/module-structure.config.json`));

  assert.deepEqual(missing, []);
});

test("rejects legacy configs that reuse protocol organizationModel names", () => {
  withTemporaryModuleFixture("invalid-legacy-protocol-prefix", {
    contractKind: "legacy",
    organizationModel: "protocol-app-l1",
    rootPolicy: "contract-only",
    allowedRootDirectories: ["src"],
    allowedRootFiles: []
  }, (fixtureEntryPath) => {
    assert.throws(
      () => findModuleStructureContract(fixtureEntryPath),
      /cannot reuse protocol organizationModel 'protocol-app-l1' in a legacy contract/,
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

test("allows app-l1 root index files as package boundary entries", () => {
  const contract = findModuleStructureContract("packages/nextclaw-kernel/src/index.ts");
  const findings = evaluateModuleStructureFindings({
    filePath: "packages/nextclaw-kernel/src/index.ts",
    contract,
    existedInComparisonRef: false,
    rootEntryExistedInComparisonRef: false
  });

  assert.equal(findings.length, 0);
});

test("allows electron shell launcher entry files", () => {
  const contract = findModuleStructureContract("apps/desktop/src/launcher/README.md");
  const findings = evaluateModuleStructureFindings({
    filePath: "apps/desktop/src/launcher/README.md",
    contract,
    existedInComparisonRef: false,
    rootEntryExistedInComparisonRef: false
  });

  assert.equal(findings.length, 0);
});

test("blocks touched workspaces that are missing module-structure config", () => {
  const repoFixtureRoot = path.join("apps", ".tmp-test-workspaces", "missing-workspace-config");
  const absoluteFixtureRoot = path.resolve(process.cwd(), repoFixtureRoot);
  rmSync(absoluteFixtureRoot, { recursive: true, force: true });
  mkdirSync(path.join(absoluteFixtureRoot, "src"), { recursive: true });
  writeFileSync(path.join(absoluteFixtureRoot, "package.json"), "{\n  \"name\": \"@tmp/missing-workspace-config\"\n}\n");
  writeFileSync(path.join(absoluteFixtureRoot, "src/index.ts"), "export const example = true;\n");

  try {
    const findings = collectModuleStructureViolations([
      `${repoFixtureRoot}/src/index.ts`
    ], new Map(), {});

    assert.equal(findings.length, 1);
    assert.equal(findings[0].level, "error");
    assert.match(findings[0].message, /missing 'module-structure\.config\.json'/);
    assert.match(findings[0].reason, /rule=missing-module-structure-config/);
  } finally {
    rmSync(absoluteFixtureRoot, { recursive: true, force: true });
  }
});

test("blocks protocol modules that are missing required root directories", () => {
  const repoFixtureRoot = path.join("apps", ".tmp-test-workspaces", "missing-electron-roles");
  const absoluteFixtureRoot = path.resolve(process.cwd(), repoFixtureRoot);
  rmSync(absoluteFixtureRoot, { recursive: true, force: true });
  mkdirSync(path.join(absoluteFixtureRoot, "src", "services"), { recursive: true });
  writeFileSync(path.join(absoluteFixtureRoot, "package.json"), "{\n  \"name\": \"@tmp/missing-electron-roles\"\n}\n");
  writeFileSync(path.join(absoluteFixtureRoot, "module-structure.config.json"), `${JSON.stringify({
    contractKind: "protocol",
    protocol: "app-l3",
    rootPolicy: "contract-only",
    enforcement: "error",
    allowedRootDirectories: ["services"],
    requiredRootDirectories: ["presenters", "managers", "stores"]
  }, null, 2)}\n`);
  writeFileSync(path.join(absoluteFixtureRoot, "src", "services", "example.service.ts"), "export const example = true;\n");

  try {
    const findings = collectModuleStructureViolations([
      `${repoFixtureRoot}/src/services/example.service.ts`
    ], new Map(), {});

    assert.equal(findings.length, 1);
    assert.equal(findings[0].level, "error");
    assert.match(findings[0].message, /missing required root entries/);
    assert.match(findings[0].message, /'presenters\/'/);
    assert.match(findings[0].message, /'managers\/'/);
    assert.match(findings[0].message, /'stores\/'/);
    assert.match(findings[0].reason, /rule=missing-required-root-entries/);
  } finally {
    rmSync(absoluteFixtureRoot, { recursive: true, force: true });
  }
});

test("blocks nested directories under flat role dirs at package root", () => {
  const contract = findModuleStructureContract("packages/nextclaw-kernel/src/services/runtime/runtime.service.ts");
  const findings = evaluateModuleStructureFindings({
    filePath: "packages/nextclaw-kernel/src/services/runtime/runtime.service.ts",
    contract,
    existedInComparisonRef: false,
    rootEntryExistedInComparisonRef: false
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "error");
  assert.match(findings[0].message, /may only contain direct files/);
});

test("blocks nested directories under hooks at package root", () => {
  const contract = findModuleStructureContract("packages/nextclaw-kernel/src/hooks/runtime/use-runtime.ts");
  const findings = evaluateModuleStructureFindings({
    filePath: "packages/nextclaw-kernel/src/hooks/runtime/use-runtime.ts",
    contract,
    existedInComparisonRef: false,
    rootEntryExistedInComparisonRef: false
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "error");
  assert.match(findings[0].message, /hooks\/ may only contain direct files/);
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

test("blocks touched legacy files under old roots for nextclaw-ui", () => {
  const contract = findModuleStructureContract("packages/nextclaw-ui/src/components/chat/ncp/ncp-chat-page.tsx");
  const findings = evaluateModuleStructureFindings({
    filePath: "packages/nextclaw-ui/src/components/chat/ncp/ncp-chat-page.tsx",
    contract,
    existedInComparisonRef: true,
    rootEntryExistedInComparisonRef: true
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "error");
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

test("blocks nested directories under flat role dirs inside features", () => {
  const contract = findModuleStructureContract("packages/nextclaw-ui/src/features/chat/services/runtime/chat-runtime.service.ts");
  const findings = evaluateModuleStructureFindings({
    filePath: "packages/nextclaw-ui/src/features/chat/services/runtime/chat-runtime.service.ts",
    contract,
    existedInComparisonRef: false,
    rootEntryExistedInComparisonRef: false,
    repoPathExists: () => true
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "error");
  assert.match(findings[0].message, /may only contain direct files/);
});

test("blocks nested directories under hooks inside features", () => {
  const contract = findModuleStructureContract("packages/nextclaw-ui/src/features/chat/hooks/runtime/use-chat-runtime.ts");
  const findings = evaluateModuleStructureFindings({
    filePath: "packages/nextclaw-ui/src/features/chat/hooks/runtime/use-chat-runtime.ts",
    contract,
    existedInComparisonRef: false,
    rootEntryExistedInComparisonRef: false,
    repoPathExists: () => true
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "error");
  assert.match(findings[0].message, /hooks\/ may only contain direct files/);
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

test("blocks nested directories under flat role dirs inside shared", () => {
  const repoFixtureRoot = path.join("packages", ".tmp-test-workspaces", "cli-command-shared-services");
  const absoluteFixtureRoot = path.resolve(process.cwd(), repoFixtureRoot);
  const filePath = `${repoFixtureRoot}/src/cli/shared/services/update/self-update.service.ts`;
  rmSync(absoluteFixtureRoot, { recursive: true, force: true });
  mkdirSync(path.join(absoluteFixtureRoot, "src", "cli", "shared", "services", "update"), { recursive: true });
  writeFileSync(path.join(absoluteFixtureRoot, "package.json"), "{\n  \"name\": \"@tmp/cli-command-shared-services\"\n}\n");
  writeFileSync(path.join(absoluteFixtureRoot, "module-structure.config.json"), `${JSON.stringify({
    contractKind: "protocol",
    protocol: "cli-command-first",
    rootPolicy: "contract-only"
  }, null, 2)}\n`);
  writeFileSync(path.join(absoluteFixtureRoot, "src", "cli", "shared", "services", "update", "self-update.service.ts"), "export const example = true;\n");

  try {
    const contract = findModuleStructureContract(filePath);
    const findings = evaluateModuleStructureFindings({
      filePath,
      contract,
      existedInComparisonRef: false,
      rootEntryExistedInComparisonRef: false,
      repoPathExists: () => true
    });

    assert.equal(findings.length, 1);
    assert.equal(findings[0].level, "error");
    assert.match(findings[0].message, /may only contain direct files/);
  } finally {
    rmSync(absoluteFixtureRoot, { recursive: true, force: true });
  }
});

test("blocks nested directories under hooks inside shared", () => {
  const contract = findModuleStructureContract("packages/nextclaw/src/cli/shared/hooks/runtime/use-runtime.ts");
  const findings = evaluateModuleStructureFindings({
    filePath: "packages/nextclaw/src/cli/shared/hooks/runtime/use-runtime.ts",
    contract,
    existedInComparisonRef: false,
    rootEntryExistedInComparisonRef: false,
    repoPathExists: () => true
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "error");
  assert.match(findings[0].message, /hooks\/ may only contain direct files/);
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

test("blocks nested directories under flat role dirs inside platforms", () => {
  const contract = findModuleStructureContract("packages/nextclaw-ui/src/platforms/desktop/services/runtime/desktop-runtime.service.ts");
  const findings = evaluateModuleStructureFindings({
    filePath: "packages/nextclaw-ui/src/platforms/desktop/services/runtime/desktop-runtime.service.ts",
    contract,
    existedInComparisonRef: false,
    rootEntryExistedInComparisonRef: false,
    repoPathExists: () => true
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "error");
  assert.match(findings[0].message, /may only contain direct files/);
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

test("errors when a contract-only module still carries a deep import", () => {
  const contract = findModuleStructureContract("packages/nextclaw-ui/src/app.tsx");
  const findings = evaluateProtocolImportBoundaryFindings({
    filePath: "packages/nextclaw-ui/src/app.tsx",
    contract,
    source: `import { ChatPanel } from "@/features/chat/components/chat-panel";\n`,
    addedLines: new Set()
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "error");
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
  const repoFixtureRoot = path.join("packages", ".tmp-test-workspaces", "cli-command-alias-imports");
  const absoluteFixtureRoot = path.resolve(process.cwd(), repoFixtureRoot);
  const filePath = `${repoFixtureRoot}/src/cli/shared/services/self-update.service.ts`;
  rmSync(absoluteFixtureRoot, { recursive: true, force: true });
  mkdirSync(path.join(absoluteFixtureRoot, "src", "cli", "shared", "services"), { recursive: true });
  writeFileSync(path.join(absoluteFixtureRoot, "package.json"), "{\n  \"name\": \"@tmp/cli-command-alias-imports\"\n}\n");
  writeFileSync(path.join(absoluteFixtureRoot, "module-structure.config.json"), `${JSON.stringify({
    contractKind: "protocol",
    protocol: "cli-command-first",
    rootPolicy: "contract-only",
    importAliasPrefixes: ["@/"]
  }, null, 2)}\n`);
  writeFileSync(path.join(absoluteFixtureRoot, "src", "cli", "shared", "services", "self-update.service.ts"), "export const example = true;\n");

  try {
    const contract = findModuleStructureContract(filePath);
    const findings = evaluateProtocolImportBoundaryFindings({
      filePath,
      contract,
      source: `import { which } from "../utils/cli.utils.js";\n`,
      addedLines: new Set([1])
    });

    assert.equal(findings.length, 1);
    assert.equal(findings[0].level, "error");
    assert.match(findings[0].message, /cross-directory imports must use '@\/'/);
  } finally {
    rmSync(absoluteFixtureRoot, { recursive: true, force: true });
  }
});

test("prefers explicit config import alias over protocol default alias", () => {
  const repoFixtureRoot = path.join("packages", ".tmp-test-workspaces", "explicit-alias-imports");
  const absoluteFixtureRoot = path.resolve(process.cwd(), repoFixtureRoot);
  const filePath = `${repoFixtureRoot}/src/cli/shared/services/self-update.service.ts`;
  rmSync(absoluteFixtureRoot, { recursive: true, force: true });
  mkdirSync(path.join(absoluteFixtureRoot, "src", "cli", "shared", "services"), { recursive: true });
  writeFileSync(path.join(absoluteFixtureRoot, "package.json"), "{\n  \"name\": \"@tmp/explicit-alias-imports\"\n}\n");
  writeFileSync(path.join(absoluteFixtureRoot, "module-structure.config.json"), `${JSON.stringify({
    contractKind: "protocol",
    protocol: "cli-command-first",
    rootPolicy: "contract-only",
    importAliasPrefixes: ["@custom/"]
  }, null, 2)}\n`);
  writeFileSync(path.join(absoluteFixtureRoot, "src", "cli", "shared", "services", "self-update.service.ts"), "export const example = true;\n");

  try {
    const contract = findModuleStructureContract(filePath);
    const findings = evaluateProtocolImportBoundaryFindings({
      filePath,
      contract,
      source: `import { which } from "../utils/cli.utils.js";\n`,
      addedLines: new Set([1])
    });

    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /cross-directory imports must use '@custom\/'/);
  } finally {
    rmSync(absoluteFixtureRoot, { recursive: true, force: true });
  }
});

test("allows package contracts to replace protocol default import aliases", () => {
  const repoFixtureRoot = path.join("packages", ".tmp-test-workspaces", "package-alias-imports");
  const absoluteFixtureRoot = path.resolve(process.cwd(), repoFixtureRoot);
  const filePath = `${repoFixtureRoot}/src/components/chat/ui/chat-input-bar/chat-input-bar-skill-picker.tsx`;
  rmSync(absoluteFixtureRoot, { recursive: true, force: true });
  mkdirSync(path.join(absoluteFixtureRoot, "src", "components", "chat", "ui", "chat-input-bar"), { recursive: true });
  mkdirSync(path.join(absoluteFixtureRoot, "src", "components", "chat", "hooks"), { recursive: true });
  writeFileSync(path.join(absoluteFixtureRoot, "package.json"), "{\n  \"name\": \"@tmp/disabled-alias-imports\"\n}\n");
  writeFileSync(path.join(absoluteFixtureRoot, "module-structure.config.json"), `${JSON.stringify({
    contractKind: "protocol",
    protocol: "app-l1",
    rootPolicy: "contract-only",
    importAliasPrefixes: ["@package-ui/"]
  }, null, 2)}\n`);
  writeFileSync(path.join(absoluteFixtureRoot, "src", "components", "chat", "hooks", "use-active-item-scroll.ts"), "export const example = true;\n");

  try {
    const contract = findModuleStructureContract(filePath);
    const aliasFindings = evaluateProtocolImportBoundaryFindings({
      filePath,
      contract,
      source: `import { useActiveItemScroll } from "@package-ui/components/chat/hooks/use-active-item-scroll";\n`,
      addedLines: new Set([1])
    });
    const relativeFindings = evaluateProtocolImportBoundaryFindings({
      filePath,
      contract,
      source: `import { useActiveItemScroll } from "../../hooks/use-active-item-scroll";\n`,
      addedLines: new Set([1])
    });

    assert.equal(aliasFindings.length, 0);
    assert.equal(relativeFindings.length, 1);
    assert.match(relativeFindings[0].message, /cross-directory imports must use '@package-ui\/'/);
  } finally {
    rmSync(absoluteFixtureRoot, { recursive: true, force: true });
  }
});

test("allows same-directory relative imports when alias imports are configured", () => {
  const contract = findModuleStructureContract("packages/nextclaw/src/cli/shared/services/self-update.service.test.ts");
  const findings = evaluateProtocolImportBoundaryFindings({
    filePath: "packages/nextclaw/src/cli/shared/services/self-update.service.test.ts",
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

test("blocks nested directories under flat role dirs inside commands", () => {
  const contract = findModuleStructureContract("packages/nextclaw/src/cli/commands/service/services/runtime/service-runner.service.ts");
  const findings = evaluateModuleStructureFindings({
    filePath: "packages/nextclaw/src/cli/commands/service/services/runtime/service-runner.service.ts",
    contract,
    existedInComparisonRef: false,
    rootEntryExistedInComparisonRef: false,
    repoPathExists: () => true
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "error");
  assert.match(findings[0].message, /may only contain direct files/);
});

test("blocks new deep imports into another command", () => {
  const contract = findModuleStructureContract("packages/nextclaw/src/cli/app/bootstrap.ts");
  const findings = evaluateProtocolImportBoundaryFindings({
    filePath: "packages/nextclaw/src/cli/app/bootstrap.ts",
    contract,
    source: `import { runServiceCommand } from "@nextclaw-cli/commands/service/services/service-runner.service";\n`,
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
