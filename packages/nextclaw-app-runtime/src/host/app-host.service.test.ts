import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AppHostService } from "./app-host.service.js";
import { AppInstanceService } from "./app-instance.service.js";
import { AppManifestService } from "../manifest/app-manifest.service.js";

describe("AppHostService", () => {
  const hosts: AppHostService[] = [];

  afterEach(async () => {
    await Promise.all(hosts.map((host) => host.stop()));
    hosts.length = 0;
  });

  it("serves the example ui and bridge run action", async () => {
    const notesDirectory = await mkdtemp(path.join(tmpdir(), "napp-notes-"));
    await writeFile(path.join(notesDirectory, "alpha.md"), "hello");
    await writeFile(path.join(notesDirectory, "beta.md"), "world!!");

    const manifestService = new AppManifestService();
    const bundle = await manifestService.load(
      path.resolve(process.cwd(), "../../apps/examples/hello-notes"),
    );
    const appInstance = new AppInstanceService(bundle);
    await appInstance.initialize({
      notes: notesDirectory,
    });
    const appHost = new AppHostService(appInstance);
    hosts.push(appHost);

    const handle = await appHost.start({
      host: "127.0.0.1",
      port: 0,
    });

    const manifestResponse = await fetch(`${handle.url}/__napp/manifest`);
    const manifestPayload = (await manifestResponse.json()) as {
      manifest: { id: string };
    };
    expect(manifestPayload.manifest.id).toBe("nextclaw.hello-notes");

    const runResponse = await fetch(`${handle.url}/__napp/run`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        action: "summarizeNotes",
      }),
    });
    const runPayload = (await runResponse.json()) as {
      result: { input: { documentCount: number; textBytes: number }; output: { output: number } };
    };

    expect(runPayload.result.input.documentCount).toBe(2);
    expect(runPayload.result.input.textBytes).toBe(12);
    expect(runPayload.result.output.output).toBe(212);
  });
});
