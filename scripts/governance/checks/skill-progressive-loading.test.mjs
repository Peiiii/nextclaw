import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  auditSkillProgressiveLoading,
  containsSkillName,
  developmentLifecycleSkillName,
  developmentStageSkillNames
} from "./skill-progressive-loading.mjs";

const generousBudgets = {
  agentsBytes: 10_000,
  descriptionChars: 1_000,
  descriptionTotalChars: 10_000,
  skillBytes: 10_000,
  skillCount: 12,
  skillTotalBytes: 20_000
};

const createFixture = () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nextclaw-skill-audit-"));
  fs.mkdirSync(path.join(repoRoot, ".agents/skills/alpha"), { recursive: true });
  fs.mkdirSync(path.join(repoRoot, ".agents/skills/beta"), { recursive: true });
  fs.mkdirSync(path.join(repoRoot, "commands"), { recursive: true });
  fs.writeFileSync(path.join(repoRoot, "AGENTS.md"), "# Rules\n");
  fs.writeFileSync(path.join(repoRoot, "commands/commands.md"), "# Commands\n");
  fs.writeFileSync(
    path.join(repoRoot, ".agents/skills/alpha/SKILL.md"),
    "---\nname: alpha\ndescription: Alpha task.\n---\n\n# Alpha\n"
  );
  fs.writeFileSync(
    path.join(repoRoot, ".agents/skills/beta/SKILL.md"),
    "---\nname: beta\ndescription: Beta task.\n---\n\n# Beta\n"
  );
  return repoRoot;
};

test("accepts a minimal acyclic skill catalog", (t) => {
  const repoRoot = createFixture();
  t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));

  const result = auditSkillProgressiveLoading({
    budgets: generousBudgets,
    enforceDevelopmentLifecycle: false,
    repoRoot,
    retiredNames: []
  });

  assert.deepEqual(result.violations, []);
  assert.equal(result.metrics.skillCount, 2);
});

test("reports dependency cycles and broken local links", (t) => {
  const repoRoot = createFixture();
  t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
  fs.appendFileSync(
    path.join(repoRoot, ".agents/skills/alpha/SKILL.md"),
    "Use beta. [Details](references/missing.md)\n"
  );
  fs.appendFileSync(path.join(repoRoot, ".agents/skills/beta/SKILL.md"), "Use alpha.\n");

  const result = auditSkillProgressiveLoading({
    budgets: generousBudgets,
    enforceDevelopmentLifecycle: false,
    repoRoot,
    retiredNames: []
  });

  assert.ok(result.violations.some((violation) => violation.includes("dependency cycle")));
  assert.ok(result.violations.some((violation) => violation.includes("broken local Markdown link")));
});

test("reports duplicate names and retired references", (t) => {
  const repoRoot = createFixture();
  t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(repoRoot, ".agents/skills/beta/SKILL.md"),
    "---\nname: alpha\ndescription: Duplicate.\n---\n\n# Beta\n"
  );
  fs.appendFileSync(path.join(repoRoot, "AGENTS.md"), "Do not use retired-skill.\n");

  const result = auditSkillProgressiveLoading({
    budgets: generousBudgets,
    enforceDevelopmentLifecycle: false,
    repoRoot,
    retiredNames: ["retired-skill"]
  });

  assert.ok(result.violations.some((violation) => violation.includes("duplicate skill name")));
  assert.ok(result.violations.some((violation) => violation.includes("must match skill directory beta")));
  assert.ok(result.violations.some((violation) => violation.includes("retired skill")));
});

test("reports reference skill frontmatter and catalog count overflow", (t) => {
  const repoRoot = createFixture();
  t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
  const referencePath = path.join(repoRoot, ".agents/skills/alpha/references/policy.md");
  fs.mkdirSync(path.dirname(referencePath), { recursive: true });
  fs.writeFileSync(
    referencePath,
    "---\nname: hidden-skill\ndescription: Must not be indexed.\n---\n\n# Policy\n"
  );

  const result = auditSkillProgressiveLoading({
    budgets: { ...generousBudgets, skillCount: 1 },
    enforceDevelopmentLifecycle: false,
    repoRoot,
    retiredNames: []
  });

  assert.ok(result.violations.some((violation) => violation.includes("skill frontmatter")));
  assert.ok(result.violations.some((violation) => violation.includes("skill count")));
});

test("matches retired skill names exactly instead of matching longer active names", () => {
  assert.equal(containsSkillName("Use product-blog-storytelling.", "product-blog-storytelling"), true);
  assert.equal(
    containsSkillName("Use nextclaw-product-blog-storytelling.", "product-blog-storytelling"),
    false
  );
});

const createLifecycleFixture = () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nextclaw-lifecycle-audit-"));
  fs.mkdirSync(path.join(repoRoot, "commands"), { recursive: true });
  fs.writeFileSync(path.join(repoRoot, "AGENTS.md"), "# Rules\n");
  fs.writeFileSync(path.join(repoRoot, "commands/commands.md"), "# Commands\n");

  const coreNames = [developmentLifecycleSkillName, ...developmentStageSkillNames];
  for (const name of coreNames) {
    const directoryPath = path.join(repoRoot, ".agents/skills", name);
    fs.mkdirSync(directoryPath, { recursive: true });
    const routes = name === developmentLifecycleSkillName ? developmentStageSkillNames.join("\n") : "";
    fs.writeFileSync(
      path.join(directoryPath, "SKILL.md"),
      `---\nname: ${name}\ndescription: ${name}.\n---\n\n# ${name}\n\n${routes}\n`
    );
  }

  const contractFiles = {
    ".agents/skills/acceptance-contract-governance/SKILL.md": [
      "---",
      "name: acceptance-contract-governance",
      "description: Acceptance contract.",
      "---",
      "active contract stable acceptance IDs"
    ].join("\n"),
    ".agents/skills/acceptance-contract-governance/references/acceptance-contract-method.md":
      "`contract-id` `parent-goal` `scope-confirmation: user-confirmed` `acceptance_updates` `parent_status: in-progress` `active-contract` `open-required` 全部 `Required: true` ID 当前均为 passed",
    ".agents/skills/nextclaw-npm-release/SKILL.md": [
      "---",
      "name: nextclaw-npm-release",
      "description: NPM release.",
      "---",
      "stable acceptance IDs `acceptance_updates` parent-goal"
    ].join("\n"),
    ".agents/skills/nextclaw-desktop-release/SKILL.md": [
      "---",
      "name: nextclaw-desktop-release",
      "description: Desktop release.",
      "---",
      "stable ID `acceptance_updates` parent-goal"
    ].join("\n")
  };
  for (const [relativePath, text] of Object.entries(contractFiles)) {
    const filePath = path.join(repoRoot, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${text}\n`);
  }

  fs.appendFileSync(
    path.join(repoRoot, ".agents/skills/development-lifecycle/SKILL.md"),
    "acceptance-contract-governance Required acceptance IDs `parent_status` scope reduction 上下文压缩\n"
  );
  fs.appendFileSync(
    path.join(repoRoot, ".agents/skills/development-delivery/SKILL.md"),
    "`acceptance_updates` `parent_status` completion gate\n"
  );
  return repoRoot;
};

test("accepts the standard development lifecycle topology", (t) => {
  const repoRoot = createLifecycleFixture();
  t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));

  const result = auditSkillProgressiveLoading({
    budgets: generousBudgets,
    repoRoot,
    retiredNames: []
  });

  assert.deepEqual(result.violations, []);
});

test("reports missing lifecycle owners and cross-stage routing", (t) => {
  const repoRoot = createLifecycleFixture();
  t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
  fs.rmSync(path.join(repoRoot, ".agents/skills/development-retrospective"), {
    recursive: true,
    force: true
  });
  fs.appendFileSync(
    path.join(repoRoot, ".agents/skills/development-design/SKILL.md"),
    "Route development-validation directly.\n"
  );

  const result = auditSkillProgressiveLoading({
    budgets: generousBudgets,
    repoRoot,
    retiredNames: []
  });

  assert.ok(
    result.violations.some((violation) =>
      violation.includes("missing required owner development-retrospective")
    )
  );
  assert.ok(
    result.violations.some((violation) =>
      violation.includes("stage development-design must not route core owner development-validation")
    )
  );
});

test("reports drift in the acceptance completion contract", (t) => {
  const repoRoot = createLifecycleFixture();
  t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(
      repoRoot,
      ".agents/skills/acceptance-contract-governance/references/acceptance-contract-method.md"
    ),
    "`contract-id` `parent-goal` `acceptance_updates`\n"
  );
  fs.writeFileSync(
    path.join(repoRoot, ".agents/skills/nextclaw-npm-release/SKILL.md"),
    "---\nname: nextclaw-npm-release\ndescription: NPM release.\n---\n"
  );

  const result = auditSkillProgressiveLoading({
    budgets: generousBudgets,
    repoRoot,
    retiredNames: []
  });

  assert.ok(
    result.violations.some((violation) =>
      violation.includes("acceptance completion contract") && violation.includes("open-required")
    )
  );
  assert.ok(
    result.violations.some((violation) => violation.includes("scope-confirmation: user-confirmed"))
  );
  assert.ok(
    result.violations.some((violation) =>
      violation.includes("nextclaw-npm-release/SKILL.md") && violation.includes("parent-goal")
    )
  );
});
