import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { validateFeedbackPaths } from "#feedback-workflow-tools/configs/feedback-policy.config.mjs";
const exec = promisify(execFile);

export function validateFeedbackBatch(batch, commits, reports) {
  if (!/^[a-f0-9]{40}$/.test(batch.baselineSha ?? "") || !/^[a-f0-9]{40}$/.test(batch.headSha ?? "")) throw new Error("Batch requires immutable baseline and head.");
  if (!Array.isArray(batch.approvedCommits) || !Array.isArray(batch.reports) || !batch.reports.length) throw new Error("Batch approval is incomplete.");
  if (new Set(batch.approvedCommits).size !== commits.length || commits.some((sha) => !batch.approvedCommits.includes(sha))) throw new Error("Master contains changes outside this approved batch.");
  if (new Set(batch.reports.map((r) => r.id)).size !== batch.reports.length) throw new Error("Duplicate feedback in batch.");
  for (const entry of batch.reports) {
    const report = reports.find((r) => r.id === entry.id);
    if (!report || report.status !== "ready" || report.runId !== entry.runId || report.inputVersion !== entry.inputVersion ||
      report.approval?.authority !== "deliver" || report.approval.inputVersion !== report.inputVersion ||
      !batch.approvedCommits.includes(entry.fixedCommit)) throw new Error("Feedback changed or its repair is missing: " + entry.id);
  }
  if (!["npm", "product", "all"].includes(batch.target)) throw new Error("Invalid release target.");
  return createHash("sha256").update(JSON.stringify(batch)).digest("hex");
}

/** Delivery consumes a maintainer-reviewed batch; it never grants repair or merge permission. */
export class FeedbackDeliveryService {
  constructor({ repository, githubRepository, client, policy }) {
    if (!/^[\w.-]+\/[\w.-]+$/.test(githubRepository ?? "")) throw new Error("Configure the GitHub release repository.");
    this.repository = repository; this.githubRepository = githubRepository; this.client = client; this.policy = policy;
  }
  gh = async (args) => {
    return (await exec("gh", args, { cwd: this.repository, timeout: 30000, maxBuffer: 1024 * 1024 })).stdout.trim();
  };
  check = async (batch) => {
    const queue = await this.client.scan();
    if (queue.paused || queue.maxAuthority !== "deliver") throw new Error("Delivery is paused or not authorized.");
    const comparison = JSON.parse(await this.gh(["api", `repos/${this.githubRepository}/compare/${batch.baselineSha}...${batch.headSha}?per_page=100`]));
    // GitHub caps compare output. Refuse a large batch instead of silently ignoring unlisted changes.
    if (comparison.status !== "ahead" || comparison.total_commits > 100 || comparison.commits.length !== comparison.total_commits) throw new Error("Batch history is incomplete or not ahead of baseline.");
    if (!Array.isArray(comparison.files) || comparison.files.length >= 300) throw new Error("Batch file list is incomplete.");
    validateFeedbackPaths(comparison.files.flatMap((file) => file.previous_filename ? [file.previous_filename, file.filename] : [file.filename]), this.policy.allowedPaths);
    const master = JSON.parse(await this.gh(["api", `repos/${this.githubRepository}/commits/master`]));
    if (master.sha !== batch.headSha) throw new Error("Master moved; review the new batch before dispatching.");
    const key = validateFeedbackBatch(batch, comparison.commits.map((c) => c.sha), queue.unfinished);
    return { key, reports: queue.unfinished };
  };
  dispatch = async (batch, journalFile) => {
    if (!this.policy.allowRelease) throw new Error("Automatic release is disabled in the maintainer policy.");
    const { key } = await this.check(batch);
    // Persist intent BEFORE network dispatch. An uncertain dispatch is reconciled, never repeated.
    await writeFile(journalFile, JSON.stringify({ key, batch, state: "dispatch-intent" }), { flag: "wx", mode: 0o600 });
    await this.gh(["workflow", "run", "release.yml", "--repo", this.githubRepository, "--ref", "master", "-f", "target=" + batch.target, "-f", "expected_head=" + batch.headSha, "-f", "feedback_batch=" + key]);
    await writeFile(journalFile, JSON.stringify({ key, batch, state: "dispatched" }), { mode: 0o600 });
    return { state: "dispatched", journalFile };
  };
  resolveRelease = async (journal) => {
    const runs = JSON.parse(await this.gh(["run", "list", "--repo", this.githubRepository, "--workflow", "release.yml", "--limit", "100", "--json", "databaseId,displayTitle,headSha,status,conclusion"]));
    const matches = runs.filter((run) => run.displayTitle === "feedback-" + journal.key && run.headSha === journal.batch.headSha);
    if (matches.length !== 1) throw new Error("Release dispatch requires reconciliation; no unique matching run. Do not dispatch again.");
    const run = matches[0];
    if (run.status !== "completed" || run.conclusion !== "success") throw new Error("The existing release run is incomplete or failed; recover that run through the release owner.");
    const page = JSON.parse(await this.gh(["api", `repos/${this.githubRepository}/actions/runs/${run.databaseId}/artifacts?per_page=100`]));
    const proofs = page.artifacts.filter((artifact) => !artifact.expired).map((artifact) => /^feedback-release-(\d+\.\d+\.\d+)-([a-f0-9]{40})-(npm|product|all)$/.exec(artifact.name)).filter((match) => match?.[3] === journal.batch.target);
    if (proofs.length !== 1) throw new Error("Release proof is not uniquely available.");
    return { version: proofs[0][1], sha: proofs[0][2], runId: String(run.databaseId),
      channel: journal.batch.target === "all" ? "desktop" : journal.batch.target === "product" ? "runtime" : "npm" };
  };
  reconcile = async (journalFile) => {
    const journal = JSON.parse(await readFile(journalFile, "utf8"));
    const release = await this.resolveRelease(journal);
    const queue = await this.client.scan();
    if (queue.paused || queue.maxAuthority !== "deliver") throw new Error("Delivery is paused or not authorized.");
    const run = JSON.parse(await this.gh(["api", `repos/${this.githubRepository}/actions/runs/${release.runId}`]));
    if (run.head_sha !== journal.batch.headSha) throw new Error("Workflow was started from a different master revision.");
    // Return release facts only. Codex reads current reports and writes its own CLI responses.
    const result = { state: "release-verified", release, reports: journal.batch.reports };
    await writeFile(journalFile, JSON.stringify({ ...journal, ...result }), { mode: 0o600 });
    return result;
  };
}
