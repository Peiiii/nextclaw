import { test, after } from "node:test";
import assert from "node:assert/strict";
import { SupportReleaseService } from "../server/support/support-release.service.js";
import { SupportAuthService } from "../server/support/support-auth.service.js";
import type { SupportRelease } from "../shared/support-feedback.types.js";
const originalFetch = globalThis.fetch;
after(() => { globalThis.fetch = originalFetch; });
const sha = "a".repeat(40), fixed = "b".repeat(40);
const release: SupportRelease = { version: "1.2.3", sha, runId: "123", channel: "npm", url: "https://untrusted.invalid" };
const service = new SupportReleaseService({ SUPPORT_GITHUB_REPOSITORY: "test/repository" });
function responses(options: { target?: string; conclusion?: string; ancestor?: string; npm?: string; tagSha?: string } = {}) {
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
    const url = String(input);
    let data: unknown;
    if (url.includes("/compare/")) data = { status: options.ancestor ?? "ahead" };
    else if (url.includes("/artifacts")) data = { artifacts: [{ name: `feedback-release-1.2.3-${sha}-${options.target ?? "npm"}`, expired: false }] };
    else if (url.includes("/actions/runs/")) data = { status: "completed", conclusion: options.conclusion ?? "success", path: ".github/workflows/release.yml", head_branch: "master" };
    else if (url.includes("/releases/tags/")) data = { draft: false, prerelease: false, assets: [] };
    else if (url.includes("/commits/")) data = { sha: options.tagSha ?? sha };
    else if (url.includes("registry.npmjs.org")) data = { version: options.npm ?? "1.2.3" };
    else throw new Error("Unexpected external request " + url);
    return Response.json(data);
  }) as typeof fetch;
}
test("Worker-compatible requests reject redirects without forwarding credentials", async () => {
  let calls = 0;
  globalThis.fetch = (async (_input, init) => {
    calls += 1;
    assert.equal(init?.redirect, "manual");
    return new Response(null, { status: 302, headers: { location: "https://untrusted.invalid" } });
  }) as typeof fetch;
  const auth = new SupportAuthService({ SUPPORT_PLATFORM_API_BASE: "https://platform.example" });
  assert.equal(await auth.user("Bearer test-only"), null);
  await assert.rejects(service.verify(release, fixed), /无法核实/);
  assert.equal(calls, 2);
});
test("FB-11/12 independently verified npm release canonicalizes URL", async () => {
  responses();
  const verified = await service.verify(release, fixed);
  assert.equal(verified.url, "https://github.com/test/repository/releases/tag/nextclaw%401.2.3");
});
test("FB-11 partial failure and wrong commit cannot report completion", async () => {
  responses({ conclusion: "failure" }); await assert.rejects(service.verify(release, fixed), /尚未成功/);
  responses({ tagSha: fixed }); await assert.rejects(service.verify(release, fixed), /不一致/);
  responses({ ancestor: "diverged" }); await assert.rejects(service.verify(release, fixed), /未包含/);
  responses({ npm: "1.2.2" }); await assert.rejects(service.verify(release, fixed), /尚不可用/);
});
test("FB-12 npm success cannot claim desktop/runtime success", async () => {
  responses();
  await assert.rejects(service.verify({ ...release, channel: "desktop" }, fixed), /渠道的交付凭证/);
  await assert.rejects(service.verify({ ...release, channel: "runtime" }, fixed), /渠道的交付凭证/);
  responses({ target: "product" });
  await assert.rejects(service.verify({ ...release, channel: "runtime" }, fixed), /安装产物/);
});
