#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { NextclawKernel } from "@nextclaw/kernel";
import { createUiRouter } from "@nextclaw/server";

function createKernel(homeDirectory) {
  const workspaceDirectory = join(homeDirectory, "workspace");
  const configPath = join(homeDirectory, "config.json");
  const packageRoot = resolve(import.meta.dirname, "../../../../packages/nextclaw");
  const productVersion = JSON.parse(
    readFileSync(join(packageRoot, "package.json"), "utf8"),
  ).version;
  saveConfig(
    ConfigSchema.parse({
      agents: {
        defaults: {
          workspace: workspaceDirectory,
        },
      },
    }),
    configPath,
  );
  return {
    configPath,
    kernel: new NextclawKernel({
      builtInAppsDirectory: join(packageRoot, "resources/apps"),
      configPath,
      homeDir: homeDirectory,
      productVersion,
    }),
  };
}

async function postServiceAction({ app, actionId, input, token }) {
  const response = await app.request(
    `http://localhost/api/service-actions/${encodeURIComponent(actionId)}/invoke`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-nextclaw-panel-bridge-session": token,
      },
      body: JSON.stringify({ input }),
    },
  );
  assert.equal(response.status, 200, `${actionId} must return HTTP 200`);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^application\/json\b/i,
    `${actionId} must return JSON`,
  );
  const payload = await response.json();
  assert.equal(payload.ok, true, `${actionId} must return an ok payload`);
  return payload.data.result;
}

async function grantPanelActions(kernel, panelId, actionIds) {
  const session = await kernel.panelAppManager.createPanelAppBridgeSession({ id: panelId });
  await kernel.serviceAppManager.grantServiceActions(actionIds, {
    caller: session.caller,
    declaredActions: session.declaredActions,
  });
  return session.token;
}

assert.ok(process.versions.electron, "service app host smoke must run inside Electron");
assert.equal(
  process.env.ELECTRON_RUN_AS_NODE,
  "1",
  "service app host smoke must run in Electron Node mode",
);

const homeDirectory = mkdtempSync(join(tmpdir(), "nextclaw-desktop-service-app-host-"));
const originalPath = process.env.PATH;
const pathWithoutNode = join(homeDirectory, "empty-path");
mkdirSync(pathWithoutNode);
process.env.PATH = pathWithoutNode;

let kernel;
try {
  const runtime = createKernel(homeDirectory);
  kernel = runtime.kernel;
  await kernel.appPackageManager.start();
  await kernel.appPackageManager.enable("nextclaw.personal-organizer");

  const app = createUiRouter({
    appEventBus: kernel.eventBus,
    configPath: runtime.configPath,
    kernel,
  });
  const favoriteActions = [
    "nextclaw-personal-organizer-data.favorite_save",
    "nextclaw-personal-organizer-data.favorite_list",
  ];
  const favoriteToken = await grantPanelActions(
    kernel,
    "nextclaw-personal-organizer-favorites",
    favoriteActions,
  );
  await postServiceAction({
    app,
    actionId: favoriteActions[0],
    input: { title: "Electron host smoke", url: "https://nextclaw.io" },
    token: favoriteToken,
  });
  const favorites = await postServiceAction({
    app,
    actionId: favoriteActions[1],
    input: {},
    token: favoriteToken,
  });
  assert.equal(favorites.structuredContent.items.length, 1);
  assert.equal(favorites.structuredContent.items[0]?.title, "Electron host smoke");

  const calendarActions = [
    "nextclaw-personal-organizer-data.event_create",
    "nextclaw-personal-organizer-data.event_list",
  ];
  const calendarToken = await grantPanelActions(
    kernel,
    "nextclaw-personal-organizer-calendar",
    calendarActions,
  );
  await postServiceAction({
    app,
    actionId: calendarActions[0],
    input: {
      start: "2026-08-21T09:00:00.000Z",
      title: "Electron host calendar smoke",
    },
    token: calendarToken,
  });
  const events = await postServiceAction({
    app,
    actionId: calendarActions[1],
    input: {
      start: "2026-08-21T00:00:00.000Z",
      end: "2026-08-22T00:00:00.000Z",
    },
    token: calendarToken,
  });
  assert.equal(events.structuredContent.items.length, 1);
  assert.equal(events.structuredContent.items[0]?.title, "Electron host calendar smoke");

  console.log("desktop Electron service app host smoke passed");
} finally {
  await kernel?.serviceAppManager.dispose();
  if (originalPath === undefined) {
    delete process.env.PATH;
  } else {
    process.env.PATH = originalPath;
  }
  try {
    rmSync(homeDirectory, {
      recursive: true,
      force: true,
      maxRetries: process.platform === "win32" ? 10 : 0,
      retryDelay: 250,
    });
  } catch (error) {
    // The business and lifecycle assertions above have already passed. Windows
    // can retain a short-lived Electron file handle after dispose; CI runners
    // discard their temp root, so cleanup must not turn a valid smoke red.
    console.warn(
      `desktop Electron service app host cleanup warning: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
