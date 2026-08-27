import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import type { AppInstallationService } from "@nextclaw/app-runtime";
import { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";

const tempDirectories: string[] = [];
const builtInAppsDirectory = resolve(
  import.meta.dirname,
  "../../../../nextclaw/resources/apps",
);

function createKernel(): NextclawKernel {
  const homeDirectory = mkdtempSync(
    join(tmpdir(), "nextclaw-app-package-uninstall-test-"),
  );
  tempDirectories.push(homeDirectory);
  const configPath = join(homeDirectory, "config.json");
  saveConfig(
    ConfigSchema.parse({
      agents: { defaults: { workspace: join(homeDirectory, "workspace") } },
    }),
    configPath,
  );
  return new NextclawKernel({
    builtInAppsDirectory,
    configPath,
    homeDir: homeDirectory,
    productVersion: "0.32.0",
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("AppPackageManager uninstall recovery", () => {
  it("restores panel state, grants, bridge sessions, and service runtime after filesystem uninstall fails", async () => {
    const kernel = createKernel();
    try {
      const fixture = await prepareOrganizerUninstallFixture(kernel);
      vi.spyOn(
        readPackageInstallationService(kernel),
        "uninstall",
      ).mockRejectedValueOnce(new Error("filesystem uninstall failed"));

      await expect(
        kernel.appPackageManager.uninstall(
          "nextclaw.personal-organizer",
          false,
        ),
      ).rejects.toThrow("filesystem uninstall failed");

      await expect(
        kernel.appPackageManager.getPackage("nextclaw.personal-organizer"),
      ).resolves.toMatchObject({ enabled: true });
      expect(
        kernel.panelAppManager.resolvePanelAppBridgeSession(
          fixture.session.token,
        ).id,
      ).toBe(fixture.session.id);
      await expect(
        kernel.serviceAppManager.listServiceActionGrants(),
      ).resolves.not.toHaveLength(0);
      expect(readStoredPanelState(fixture.panelsPath).apps).toHaveProperty(
        fixture.openedPanelId,
      );
      await expect(
        kernel.serviceAppManager.invokeServiceAction(fixture.listAction, {
          caller: fixture.session.caller,
          declaredActions: fixture.session.declaredActions,
          input: { status: "all" },
        }),
      ).resolves.toMatchObject({ actionId: fixture.listAction });
    } finally {
      await kernel.serviceAppManager.dispose();
    }
  });

  it("restores runtime resources when Panel package cleanup fails", async () => {
    const kernel = createKernel();
    try {
      const fixture = await prepareOrganizerUninstallFixture(kernel);
      vi.spyOn(
        kernel.panelAppManager,
        "removePackageComponentState",
      ).mockRejectedValueOnce(new Error("panel cleanup failed"));

      await expect(
        kernel.appPackageManager.uninstall(
          "nextclaw.personal-organizer",
          false,
        ),
      ).rejects.toThrow("panel cleanup failed");

      expect(
        kernel.panelAppManager.resolvePanelAppBridgeSession(
          fixture.session.token,
        ).id,
      ).toBe(fixture.session.id);
      await expect(
        kernel.appPackageManager.getPackage("nextclaw.personal-organizer"),
      ).resolves.toMatchObject({ enabled: true });
      await expect(
        kernel.serviceAppManager.invokeServiceAction(fixture.listAction, {
          caller: fixture.session.caller,
          declaredActions: fixture.session.declaredActions,
          input: { status: "all" },
        }),
      ).resolves.toMatchObject({ actionId: fixture.listAction });
    } finally {
      await kernel.serviceAppManager.dispose();
    }
  });

  it("restores Panel state and grants when Service grant cleanup fails", async () => {
    const kernel = createKernel();
    try {
      const fixture = await prepareOrganizerUninstallFixture(kernel);
      const externalGrant = await kernel.capabilityGrants.grant({
        subject: { type: "panel-app", id: "external-panel" },
        resource: {
          type: "service.action",
          target: { actionId: fixture.listAction },
        },
        access: ["invoke"],
        declarationFingerprint: "external-panel-service-action",
      });
      const originalRevokeMatching =
        kernel.capabilityGrants.revokeMatching.bind(kernel.capabilityGrants);
      vi.spyOn(kernel.capabilityGrants, "revokeMatching").mockImplementation(
        async (matches) => {
          const matched = (await kernel.capabilityGrants.list()).filter(
            matches,
          );
          const revoked = await originalRevokeMatching(matches);
          if (
            matched.some(
              (grant) =>
                grant.subject.id === externalGrant.subject.id &&
                grant.resource.type === "service.action",
            )
          ) {
            throw new Error("service grant cleanup failed after write");
          }
          return revoked;
        },
      );

      await expect(
        kernel.appPackageManager.uninstall(
          "nextclaw.personal-organizer",
          false,
        ),
      ).rejects.toThrow("service grant cleanup failed after write");

      expect(
        kernel.panelAppManager.resolvePanelAppBridgeSession(
          fixture.session.token,
        ).id,
      ).toBe(fixture.session.id);
      expect(readStoredPanelState(fixture.panelsPath).apps).toHaveProperty(
        fixture.openedPanelId,
      );
      await expect(
        kernel.capabilityGrants.list({
          subject: externalGrant.subject,
          resourceType: "service.action",
        }),
      ).resolves.toEqual([
        expect.objectContaining({
          resource: {
            type: "service.action",
            target: { actionId: fixture.listAction },
          },
        }),
      ]);
    } finally {
      await kernel.serviceAppManager.dispose();
    }
  });

  it("preserves the uninstall and rollback failures in one AggregateError", async () => {
    const kernel = createKernel();
    try {
      await kernel.appPackageManager.start();
      vi.spyOn(
        readPackageInstallationService(kernel),
        "uninstall",
      ).mockRejectedValueOnce(new Error("uninstall failed"));
      kernel.appPackageManager.installRuntimeHooks({
        assertCanActivate: async () => undefined,
        beforeDeactivate: async () => undefined,
        beforeUninstall: async () => async () => {
          throw new Error("rollback failed");
        },
      });

      const error = await kernel.appPackageManager
        .uninstall("nextclaw.personal-organizer", false)
        .catch((caught) => caught);

      expect(error).toBeInstanceOf(AggregateError);
      expect((error as AggregateError).errors).toEqual([
        expect.objectContaining({ message: "uninstall failed" }),
        expect.objectContaining({ message: "rollback failed" }),
      ]);
    } finally {
      await kernel.serviceAppManager.dispose();
    }
  });
});

function readPackageInstallationService(
  kernel: NextclawKernel,
): AppInstallationService {
  return (
    kernel.appPackageManager as unknown as {
      installationService: AppInstallationService;
    }
  ).installationService;
}

function readStoredPanelState(panelsPath: string): {
  apps: Record<string, unknown>;
} {
  return JSON.parse(
    readFileSync(join(panelsPath, ".panel-apps.state.json"), "utf8"),
  ) as {
    apps: Record<string, unknown>;
  };
}

async function prepareOrganizerUninstallFixture(kernel: NextclawKernel) {
  await kernel.appPackageManager.start();
  await kernel.appPackageManager.enable("nextclaw.personal-organizer");
  const panels = await kernel.panelAppManager.listPanelApps();
  const panel = panels.entries.find(
    (entry) => entry.appId === "nextclaw-personal-organizer-todos",
  );
  if (!panel) throw new Error("organizer todos panel fixture is unavailable");
  const session = await kernel.panelAppManager.createPanelAppBridgeSession({
    id: panel.id,
  });
  const listAction = "nextclaw-personal-organizer-data.todo_list";
  await kernel.serviceAppManager.grantServiceAction(listAction, {
    caller: session.caller,
    declaredActions: session.declaredActions,
  });
  await kernel.serviceAppManager.invokeServiceAction(listAction, {
    caller: session.caller,
    declaredActions: session.declaredActions,
    input: { status: "all" },
  });
  const openedPanel = await kernel.panelAppManager.recordPanelAppOpened(
    panel.id,
  );
  return {
    listAction,
    openedPanelId: openedPanel.id,
    panelsPath: panels.panelsPath,
    session,
  };
}
