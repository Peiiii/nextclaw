export const defaultSkillBudgets = Object.freeze({
  agentsBytes: 12_000,
  discoveryChars: 3_500,
  descriptionChars: 260,
  descriptionTotalChars: 2_000,
  skillBytes: 8_000,
  skillCount: 16,
  skillTotalBytes: 90_000
});

export const developmentLifecycleSkillName = "development-lifecycle";
export const acceptanceContractSkillName = "acceptance-contract-governance";

export const developmentStageSkillNames = Object.freeze([
  "development-task-understanding",
  "development-design",
  "development-implementation",
  "development-validation",
  "development-review",
  "development-delivery",
  "development-retrospective"
]);

export const wikiSkillNames = Object.freeze(
  `acceptance-contract-governance development-task-telemetry file-organization-governance
frontend-code-optimization frontend-interaction-quality frontend-style-encapsulation
iteration-work-notes iterative-quality-convergence mvp-view-logic-decoupling
nextclaw-dead-code-governance nextclaw-desktop-release nextclaw-http-agent-runtime-integration
nextclaw-iteration-log-governance nextclaw-marketplace-skill-integration nextclaw-narp-stdio-runtime-integration
nextclaw-npm-release nextclaw-release-notes predictable-behavior-first project-knowledge-governance
react-rendering-lifecycle-safety replicating-reference-skins user-facing-content-boundary`.split(/\s+/)
);

export const retiredSkillNames = Object.freeze([
  "collapsible-feature-root-architecture",
  "code-investigation-workflow",
  "code-review",
  "contract-driven-delivery-campaign",
  "development-discovery",
  "desktop-release-contract-guard",
  "directory-structure-governance-overview",
  "file-naming-convention",
  "goal-progress-anchor",
  "integrating-http-agent-runtime",
  "integrating-narp-stdio-runtime",
  "isolated-npm-release-worktree",
  "kernel-branch-owner-architecture",
  "layered-root-cause-analysis",
  "learning-from-failures",
  "local-source-runtime-validation",
  "long-chain-debugging",
  "marketplace-skill-publisher",
  "nextclaw-clean-implementation",
  "nextclaw-delivery-workflow",
  "nextclaw-release-notes-automation",
  "nextclaw-solution-design",
  "nextclaw-validation-workflow",
  "node-pnpm-locator",
  "npm-beta-release",
  "npm-release-contract-guard",
  "post-edit-maintainability-guard",
  "post-edit-maintainability-review",
  "proactive-work-continuation",
  "product-blog-storytelling",
  "project-os",
  "refresh-product-visual-assets",
  "role-first-file-organization",
  "smoke-testing-ncp-chat",
  "testing-local-extension-development-source",
  "classic-software-design-principles",
  "writing-beautiful-code",
  "unsigned-desktop-release-playbook"
]);
