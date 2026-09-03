import { describe, expect, it, vi } from "vitest";
import { ProjectError } from "@nextclaw/kernel";
import { EventBus } from "@nextclaw/shared";
import { createUiRouter } from "@nextclaw-server/app/router.js";
import { createRouterTestKernel } from "@nextclaw-server/app/tests/router-test-kernel.js";

function createApp(projectMaterials: object) {
  return createUiRouter({
    appEventBus: new EventBus(),
    configPath: "/tmp/nextclaw-project-material-routes-test.json",
    kernel: createRouterTestKernel({ projectMaterials } as never),
  });
}

describe("project material routes", () => {
  it("mounts agreement and skill reads through the kernel owner", async () => {
    const getAgreement = vi.fn(async () => ({
      path: "AGENTS.md",
      available: true,
    }));
    const listSkills = vi.fn(async () => [
      {
        ref: "project:alpha",
        name: "alpha",
        path: ".agents/skills/alpha/SKILL.md",
      },
    ]);
    const app = createApp({ getAgreement, listSkills });

    const agreement = await app.request(
      "http://localhost/api/projects/project-1/agreement",
    );
    const skills = await app.request(
      "http://localhost/api/projects/project-1/skills",
    );

    expect(agreement.status).toBe(200);
    await expect(agreement.json()).resolves.toMatchObject({
      ok: true,
      data: { path: "AGENTS.md", available: true },
    });
    expect(skills.status).toBe(200);
    await expect(skills.json()).resolves.toMatchObject({
      ok: true,
      data: [{ name: "alpha" }],
    });
    expect(getAgreement).toHaveBeenCalledWith("project-1");
    expect(listSkills).toHaveBeenCalledWith("project-1");
  });

  it("maps unknown projects to not found", async () => {
    const missing = async () => {
      throw new ProjectError("PROJECT_NOT_FOUND", "project was not found");
    };
    const app = createApp({ getAgreement: missing, listSkills: missing });

    const response = await app.request(
      "http://localhost/api/projects/missing/agreement",
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "PROJECT_NOT_FOUND" },
    });
  });

  it("does not mount the removed observation endpoint", async () => {
    const app = createApp({
      getAgreement: vi.fn(),
      listSkills: vi.fn(),
    });

    const response = await app.request(
      "http://localhost/api/projects/project-1/observation",
    );

    expect(response.status).toBe(404);
  });
});
