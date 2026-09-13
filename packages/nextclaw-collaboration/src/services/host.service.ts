import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type {
  Connection,
  Consumer,
  SourceAdapter,
} from "../types/collaboration.types.js";
import type { CollaborationStore } from "../stores/collaboration.store.js";
import { CollaborationService } from "./collaboration.service.js";
import { CodexConsumer } from "./codex-consumer.service.js";
import { CommandConsumer } from "./command-consumer.service.js";
import { loadSource } from "../utils/source-registry.utils.js";

export class CollaborationHost {
  private stopped = false;
  private readonly owner = randomUUID();
  constructor(
    private readonly store: CollaborationStore,
    private readonly root: string,
  ) {}
  run = async (): Promise<void> => {
    if (!this.store.lease(this.owner))
      throw new Error("A collaboration host is already running");
    const consumers = new Map<string, Consumer>();
    const sources = new Map<string, SourceAdapter>();
    const scans = new Map<string, Promise<void>>();
    const pulse = setInterval(() => {
      if (!this.store.lease(this.owner)) this.stopped = true;
      if (
        this.store.get<{
          owner: string;
        }>("runtime", "stop")?.owner === this.owner
      )
        this.stopped = true;
      this.store.put("runtime", "host", {
        pid: process.pid,
        owner: this.owner,
        heartbeatAt: new Date().toISOString(),
      });
    }, 10000);
    const stop = () => {
      this.stopped = true;
    };
    process.once("SIGTERM", stop);
    process.once("SIGINT", stop);
    try {
      await this.loadParticipants(sources, consumers);
      const service = new CollaborationService(this.store, sources, consumers);
      this.store.compact();
      while (!this.stopped) {
        this.store.put("runtime", "host", {
          pid: process.pid,
          owner: this.owner,
          heartbeatAt: new Date().toISOString(),
        });
        this.store
          .list<Connection>("connection")
          .filter(
            (c) =>
              c.enabled &&
              !scans.has(c.id) &&
              Date.now() - Date.parse(c.lastScan || "1970-01-01") >=
                c.intervalMs,
          )
          .forEach((connection) => {
            const scan = (async () => {
              try {
                await service.collect(connection);
              } catch (error) {
                connection.error = String(error).slice(0, 500);
                connection.lastScan = new Date().toISOString();
                this.store.put("connection", connection.id, connection);
              }
            })().finally(() => scans.delete(connection.id));
            scans.set(connection.id, scan);
          });
        if (this.stopped) break;
        try {
          await service.advance();
          await service.dispatch();
          await service.publish();
          this.store.remove("runtime", "error");
        } catch (error) {
          this.store.put("runtime", "error", {
            message: String(error).slice(0, 500),
            at: new Date().toISOString(),
          });
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    } finally {
      clearInterval(pulse);
      await Promise.allSettled(scans.values());
      process.removeListener("SIGTERM", stop);
      process.removeListener("SIGINT", stop);
      for (const consumer of consumers.values()) await consumer.close();
      this.store.release(this.owner);
      this.store.remove("runtime", "host");
    }
  };
  private loadParticipants = async (
    sources: Map<string, SourceAdapter>,
    consumers: Map<string, Consumer>,
  ): Promise<void> => {
    for (const connection of this.store.list<Connection>("connection")) {
      sources.set(connection.id, await loadSource(connection));
      consumers.set(
        connection.id,
        connection.consumer.kind === "codex"
          ? new CodexConsumer(
              connection.consumer.workspace,
              connection.consumer.executable,
            )
          : new CommandConsumer(
              connection.consumer.command,
              connection.consumer.workspace,
              join(this.root, "commands", connection.id),
            ),
      );
    }
  };
}
