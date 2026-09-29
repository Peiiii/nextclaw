import type { Config } from "@nextclaw/core";

/** Ready platform storage; asynchronous hosts populate their snapshot during startup. */
export interface ConfigPersistence {
  readonly location: string;
  load(): Config;
  readRaw(): string | null;
  save(config: Config): void | Promise<void>;
}
