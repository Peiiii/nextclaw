import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { auditSkillProgressiveLoading } from "./skill-progressive-loading.mjs";

const generousBudgets = {
  agentsBytes: 10_000,
  descriptionChars: 1_000,
  descriptionTotalChars: 10_000,
  skillBytes: 10_000,
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
    repoRoot,
    retiredNames: ["retired-skill"]
  });

  assert.ok(result.violations.some((violation) => violation.includes("duplicate skill name")));
  assert.ok(result.violations.some((violation) => violation.includes("retired skill")));
});
