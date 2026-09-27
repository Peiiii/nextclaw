import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Contribution, eventKeys, NextclawHarness } from "@nextclaw/harness";
import { BiboSpaceService } from "@/features/bibo-domain";
import { BiboSpaceContribution } from "./bibo-space.contribution";

class DisplayProducer extends Contribution {
  emit = (_id: string): void => {};
  constructor() { super({ id: "display-test" }); }
  protected setup = (): void => {
    const bus = this.kernel.eventBus;
    this.emit = (id) => { bus.emit(eventKeys.uiShowContent, { id, placement: "side_panel", target: { type: "file", payload: { path: "report.md", viewer: "auto" } } }); };
  };
}

test("existing contribution bridges native display targets once and releases its subscription", async (t) => {
  const home = await mkdtemp(join(tmpdir(), "bibo-display-contribution-"));
  t.after(() => rm(home, { recursive: true, force: true }));
  const harness = new NextclawHarness({ homeDir: home });
  const bibo = new BiboSpaceContribution(new BiboSpaceService(home), "session-a");
  const producer = new DisplayProducer();
  harness.contributions.register(bibo);
  harness.contributions.register(producer);
  try {
    await harness.start();
    producer.emit("show-1"); producer.emit("show-1");
    assert.deepEqual(bibo.displayEvents, [{ id: "show-1", sessionId: "session-a", target: { type: "file", payload: { path: "report.md", viewer: "auto" } } }]);
  } finally { await harness.dispose(); }
  producer.emit("late-event");
  assert.equal(bibo.displayEvents.length, 1);
});
