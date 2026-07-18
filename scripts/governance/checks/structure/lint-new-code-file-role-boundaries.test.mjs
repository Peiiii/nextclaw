import assert from "node:assert/strict";
import test from "node:test";

import {
  collectFileRoleBoundaryViolations,
  inspectFileRoleBoundaryEntry,
  runPlannedFileRoleBoundaryCheck
} from "./lint-new-code-file-role-boundaries.mjs";

test("planned-path preflight blocks unsupported role suffixes before files are created", () => {
  const report = runPlannedFileRoleBoundaryCheck([
    "apps/demo/src/api/platform-api.client.ts",
    "apps/demo/src/pages/login.page.tsx"
  ]);

  assert.equal(report.mode, "planned");
  assert.equal(report.violations.length, 2);
  assert.deepEqual(report.violations.map((violation) => violation.ruleId), [
    "default-role-suffix",
    "directory:pages:<domain>-page.ts(x)"
  ]);
});

test("planned-path preflight accepts truthful provider, page, and component paths", () => {
  const report = runPlannedFileRoleBoundaryCheck([
    "apps/demo/src/api/platform-api.provider.ts",
    "apps/demo/src/pages/login-page.tsx",
    "apps/demo/src/components/admin/user-list.tsx"
  ]);

  assert.deepEqual(report.violations, []);
});

test("blocks new files in role directories when the suffix does not match the directory", () => {
  const violations = collectFileRoleBoundaryViolations([
    {
      filePath: "packages/demo/src/services/chat-manager.ts",
      status: "A"
    }
  ]);

  assert.equal(violations.length, 1);
  assert.equal(violations[0].level, "error");
  assert.match(violations[0].message, /services\/' must match '\*\.service\.ts'/);
});

test("requires .config suffix inside configs directories", () => {
  const violation = inspectFileRoleBoundaryEntry({
    filePath: "packages/demo/src/configs/runtime.ts",
    status: "A"
  });

  assert.ok(violation);
  assert.match(violation.message, /configs\/' must match '\*\.config\.ts\(x\)'/);
});

test("allows .config files inside configs directories", () => {
  assert.equal(inspectFileRoleBoundaryEntry({
    filePath: "packages/demo/src/configs/runtime.config.ts",
    status: "A"
  }), null);
});

test("blocks config role-directory siblings when a config directory is touched", () => {
  const violations = collectFileRoleBoundaryViolations([
    {
      filePath: "packages/demo/src/configs/runtime.config.ts",
      status: "M"
    }
  ], {
    listDirectGovernedFiles: (directoryPath) => {
      assert.equal(directoryPath, "packages/demo/src/configs");
      return [
        "packages/demo/src/configs/runtime.config.ts",
        "packages/demo/src/configs/brand.ts"
      ];
    }
  });

  assert.equal(violations.length, 1);
  assert.equal(violations[0].filePath, "packages/demo/src/configs/brand.ts");
  assert.match(violations[0].message, /touched file in 'configs\/' does not match/);
});

test("does not sweep non-config role directories into unrelated legacy debt", () => {
  const violations = collectFileRoleBoundaryViolations([
    {
      filePath: "packages/demo/src/utils/runtime-paths.utils.ts",
      status: "M"
    }
  ], {
    listDirectGovernedFiles: () => [
      "packages/demo/src/utils/runtime-paths.utils.ts",
      "packages/demo/src/utils/helpers.ts"
    ]
  });

  assert.deepEqual(violations, []);
});

test("allows .route files inside routes directories", () => {
  assert.equal(inspectFileRoleBoundaryEntry({
    filePath: "packages/demo/src/routes/app.route.ts",
    status: "A"
  }), null);
});

test("allows .presenter files inside presenters directories", () => {
  assert.equal(inspectFileRoleBoundaryEntry({
    filePath: "packages/demo/src/presenters/chat-session.presenter.tsx",
    status: "A"
  }), null);
});

test("requires .route suffix inside routes directories", () => {
  const violation = inspectFileRoleBoundaryEntry({
    filePath: "packages/demo/src/routes/app.controller.ts",
    status: "A"
  });

  assert.ok(violation);
  assert.match(violation.message, /routes\/' must match '\*\.route\.ts\(x\)'/);
});

test("allows test files whose underlying role still matches the directory", () => {
  const violation = inspectFileRoleBoundaryEntry({
    filePath: "packages/demo/src/services/chat.service.contract.test.ts",
    status: "A"
  });

  assert.equal(violation, null);
});

test("requires .service.ts files to declare a class", () => {
  const filePath = "packages/demo/src/services/chat.service.ts";
  const violation = inspectFileRoleBoundaryEntry({
    filePath,
    status: "A"
  }, {
    sourceByFilePath: new Map([[filePath, "export const createChat = () => true;\n"]])
  });

  assert.ok(violation);
  assert.equal(violation.ruleId, "service-requires-class");
  assert.match(violation.message, /\.service\.ts file must declare an internal class/);
});

test("allows .service.ts files with an internal class", () => {
  const filePath = "packages/demo/src/services/chat.service.ts";

  assert.equal(inspectFileRoleBoundaryEntry({
    filePath,
    status: "A"
  }, {
    sourceByFilePath: new Map([[filePath, "export class ChatService {}\n"]])
  }), null);
});

test("blocks new non-component files outside exempt directories when they do not use a role suffix", () => {
  const violation = inspectFileRoleBoundaryEntry({
    filePath: "packages/demo/src/features/chat/session-cache.ts",
    status: "A"
  });

  assert.ok(violation);
  assert.equal(violation.level, "error");
  assert.match(violation.message, /must use an approved secondary suffix/);
});

test("allows root entry files without role suffixes", () => {
  assert.equal(inspectFileRoleBoundaryEntry({
    filePath: "apps/demo/src/main.tsx",
    status: "A"
  }), null);

  assert.equal(inspectFileRoleBoundaryEntry({
    filePath: "packages/demo/src/app.ts",
    status: "A"
  }), null);
});

test("allows electron shell root entry files without role suffixes", () => {
  assert.equal(inspectFileRoleBoundaryEntry({
    filePath: "apps/companion/electron/main.ts",
    status: "A"
  }), null);

  assert.equal(inspectFileRoleBoundaryEntry({
    filePath: "apps/companion/electron/preload.ts",
    status: "A"
  }), null);

  assert.equal(inspectFileRoleBoundaryEntry({
    filePath: "apps/companion/electron/launcher.ts",
    status: "A"
  }), null);
});

test("allows module-contract root files without role suffixes", () => {
  assert.equal(inspectFileRoleBoundaryEntry({
    filePath: "packages/demo/src/nextclaw-kernel.ts",
    status: "A"
  }, {
    moduleContract: {
      modulePath: "packages/demo/src",
      allowedRootFiles: new Set(["index.ts", "nextclaw-kernel.ts"])
    }
  }), null);
});

test("does not treat nested files as module-contract root files", () => {
  const violation = inspectFileRoleBoundaryEntry({
    filePath: "packages/demo/src/services/nextclaw-kernel.ts",
    status: "A"
  }, {
    moduleContract: {
      modulePath: "packages/demo/src",
      allowedRootFiles: new Set(["nextclaw-kernel.ts"])
    }
  });

  assert.ok(violation);
  assert.match(violation.message, /services\/' must match '\*\.service\.ts'/);
});

test("allows sitecustomize bridge entry files without role suffixes", () => {
  assert.equal(inspectFileRoleBoundaryEntry({
    filePath: "packages/demo/src/hermes-acp-route-bridge/sitecustomize.py",
    status: "M"
  }), null);
});

test("allows standard web public entry files without role suffixes", () => {
  assert.equal(inspectFileRoleBoundaryEntry({
    filePath: "packages/demo/public/sw.js",
    status: "M"
  }), null);

  assert.equal(inspectFileRoleBoundaryEntry({
    filePath: "packages/demo/public/manifest.webmanifest",
    status: "M"
  }), null);
});

test("allows component files without role suffixes", () => {
  assert.equal(inspectFileRoleBoundaryEntry({
    filePath: "packages/demo/src/components/chat-shell.tsx",
    status: "A"
  }), null);
});

test("allows hook files without extra .hook suffix when they still use use-* naming", () => {
  assert.equal(inspectFileRoleBoundaryEntry({
    filePath: "packages/demo/src/hooks/use-chat-session.ts",
    status: "A"
  }), null);
});

test("skips role-boundary enforcement for script support paths", () => {
  assert.equal(inspectFileRoleBoundaryEntry({
    filePath: ".agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs",
    status: "M"
  }), null);

  assert.equal(inspectFileRoleBoundaryEntry({
    filePath: "apps/demo/scripts/smoke-test.sh",
    status: "A"
  }), null);
});

test("skips generated VitePress data files", () => {
  assert.equal(inspectFileRoleBoundaryEntry({
    filePath: "apps/docs/.vitepress/data/project-pulse.generated.mjs",
    status: "M"
  }), null);
});

test("requires use-* naming inside hooks directories", () => {
  const violation = inspectFileRoleBoundaryEntry({
    filePath: "packages/demo/src/hooks/chat-session.ts",
    status: "A"
  });

  assert.ok(violation);
  assert.match(violation.message, /hooks\/' must match 'use-<domain>\.ts\(x\)'/);
});

test("requires -page naming inside pages directories", () => {
  const violation = inspectFileRoleBoundaryEntry({
    filePath: "apps/demo/src/pages/chat.tsx",
    status: "A"
  });

  assert.ok(violation);
  assert.match(violation.message, /pages\/' must match '<domain>-page\.ts\(x\)'/);
});

test("blocks touched files when they still violate the directory mapping", () => {
  const violation = inspectFileRoleBoundaryEntry({
    filePath: "packages/demo/src/providers/openai.ts",
    status: "M"
  });

  assert.ok(violation);
  assert.equal(violation.level, "error");
  assert.match(violation.message, /touched file in 'providers\//);
});

test("requires tools suffix inside agent tools directories", () => {
  const violation = inspectFileRoleBoundaryEntry({
    filePath: "packages/demo/src/tools/session-search.tool.ts",
    status: "A"
  });

  assert.ok(violation);
  assert.match(violation.message, /tools\/' must match '\*\.tools\.ts/);
});

test("blocks touched files outside page naming rules too", () => {
  const violation = inspectFileRoleBoundaryEntry({
    filePath: "apps/platform-admin/src/pages/LoginPage.tsx",
    status: "M"
  });

  assert.ok(violation);
  assert.equal(violation.level, "error");
  assert.match(violation.message, /touched file in 'pages\//);
});

test("does not turn a package move into a forced legacy role-boundary rename", () => {
  const violations = collectFileRoleBoundaryViolations([
    {
      oldFilePath: "packages/old/src/services/service-bootstrap-status.ts",
      filePath: "packages/new/src/services/service-bootstrap-status.ts",
      status: "R"
    }
  ]);

  assert.deepEqual(violations, []);
});

test("does not crash when a renamed old service path no longer exists on disk", () => {
  assert.doesNotThrow(() => collectFileRoleBoundaryViolations([
    {
      oldFilePath: "packages/old/src/services/missing.service.ts",
      filePath: "packages/new/src/services/missing.service.ts",
      status: "R"
    }
  ]));
});

test("still blocks renames that introduce a role-boundary violation", () => {
  const violations = collectFileRoleBoundaryViolations([
    {
      oldFilePath: "packages/demo/src/providers/openai.provider.ts",
      filePath: "packages/demo/src/providers/openai.ts",
      status: "R"
    }
  ]);

  assert.equal(violations.length, 1);
  assert.match(violations[0].message, /providers\/' must match '\*\.provider\.ts/);
});
