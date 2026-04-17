#!/usr/bin/env node

import { HermesHttpAdapterServer } from "./hermes-http-adapter.service.js";

class HermesHttpAdapterCli {
  run = async (): Promise<void> => {
    const server = new HermesHttpAdapterServer(this.readArgs());
    await server.start();
    process.stdout.write(
      `[hermes-http-adapter] listening on http://${server.config.host}:${server.config.port}${server.config.basePath}\n`,
    );

    const shutdown = async (): Promise<void> => {
      await server.stop();
      process.exit(0);
    };

    process.once("SIGINT", () => {
      void shutdown();
    });
    process.once("SIGTERM", () => {
      void shutdown();
    });
  };

  private readArgs = (): Record<string, unknown> => {
    const args = process.argv.slice(2);
    const config: Record<string, unknown> = {};

    for (let index = 0; index < args.length; index += 1) {
      const current = args[index];
      if (!current?.startsWith("--")) {
        continue;
      }
      const key = current.slice(2);
      const nextValue = args[index + 1];
      if (!nextValue || nextValue.startsWith("--")) {
        config[key] = true;
        continue;
      }
      config[key] = nextValue;
      index += 1;
    }

    return {
      host: config.host,
      port: config.port,
      basePath: config["base-path"],
      hermesBaseUrl: config["hermes-base-url"],
      hermesApiKey: config["api-key"],
      model: config.model,
      systemPrompt: config["system-prompt"],
    };
  };
}

void new HermesHttpAdapterCli().run();
