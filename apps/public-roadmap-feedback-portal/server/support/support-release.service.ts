import type { SupportRelease } from "../../shared/support-feedback.types.js";
import type { PortalWorkerEnv } from "../portal-env.types.js";
import { reject } from "./support-validation.utils.js";

export class SupportReleaseService {
  constructor(private readonly env: PortalWorkerEnv) {}
  private github = async (path: string): Promise<Record<string, unknown>> => {
    const response = await fetch("https://api.github.com" + path, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "NextClaw-Feedback",
        ...(this.env.SUPPORT_GITHUB_TOKEN ? { Authorization: "Bearer " + this.env.SUPPORT_GITHUB_TOKEN } : {}) },
      signal: AbortSignal.timeout(10000), redirect: "error"
    });
    if (!response.ok) reject(503, "暂时无法核实发布记录。");
    return await response.json() as Record<string, unknown>;
  };
  verify = async (input: SupportRelease | undefined, fixedCommit?: string): Promise<SupportRelease> => {
    const repo = this.env.SUPPORT_GITHUB_REPOSITORY;
    if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) reject(503, "尚未配置发布证据来源。");
    if (!input || !/^\d+\.\d+\.\d+$/.test(input.version) || !/^[a-f0-9]{40}$/.test(input.sha) || !/^\d+$/.test(input.runId)) reject(400, "发布身份不正确。");
    if (!["npm", "runtime", "desktop"].includes(input.channel)) reject(400, "发布渠道不正确。");
    if (!fixedCommit || !/^[a-f0-9]{40}$/.test(fixedCommit)) reject(409, "缺少该反馈的修复提交。");
    const comparison = await this.github(`/repos/${repo}/compare/${fixedCommit}...${input.sha}`);
    if (!["ahead", "identical"].includes(String(comparison.status))) reject(409, "发布版本未包含该反馈的修复。");
    const run = await this.github(`/repos/${repo}/actions/runs/${input.runId}`);
    if (run.status !== "completed" || run.conclusion !== "success" || run.path !== ".github/workflows/release.yml" || run.head_branch !== "master") reject(409, "发布流程尚未成功完成。");
    const tag = "nextclaw@" + input.version;
    const release = await this.github(`/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`);
    const commit = await this.github(`/repos/${repo}/commits/${encodeURIComponent(tag)}`);
    if (release.draft || release.prerelease || commit.sha !== input.sha) reject(409, "发布版本与提交不一致。");
    const proofPage = await this.github(`/repos/${repo}/actions/runs/${input.runId}/artifacts?per_page=100`);
    const proofs = Array.isArray(proofPage.artifacts) ? proofPage.artifacts as { name: string; expired: boolean }[] : [];
    const targets = input.channel === "npm" ? ["npm", "product", "all"] : input.channel === "runtime" ? ["product", "all"] : ["all"];
    if (!targets.some((target) => proofs.some((proof) => !proof.expired && proof.name === `feedback-release-${input.version}-${input.sha}-${target}`))) {
      reject(409, "该工作流没有此版本与渠道的交付凭证。");
    }
    if (input.channel === "npm") {
      const response = await fetch("https://registry.npmjs.org/nextclaw/" + input.version, { signal: AbortSignal.timeout(10000) });
      const npm = response.ok ? await response.json() as { version?: string; gitHead?: string } : null;
      if (!npm || npm.version !== input.version) reject(409, "NPM 版本尚不可用。");
    } else if (input.channel === "runtime") {
      const assets = Array.isArray(release.assets) ? release.assets as { name?: string }[] : [];
      const names = assets.map((a) => a.name ?? "");
      const ready = ["darwin-arm64", "darwin-x64", "linux-x64", "win32-x64"].every((p) => names.includes(`nextclaw-runtime-${p}-${input.version}.zip`));
      if (!ready) reject(409, "所选渠道的安装产物尚不可用。");
    }
    return { ...input, url: `https://github.com/${repo}/releases/tag/${encodeURIComponent(tag)}` };
  };
}
