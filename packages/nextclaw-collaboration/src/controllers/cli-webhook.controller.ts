import type { Command } from "commander";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CliContext } from "../types/cli.types.js";
import type { Connection } from "../types/collaboration.types.js";

export function registerWebhookCommand(program: Command, { open, stopped }: CliContext): void {
  program.command("webhook <connection>")
    .description("Configure GitHub webhook relay or restore polling")
    .option("--relay-url <url>", "HTTPS Smee-compatible relay URL")
    .option("--secret-file <path>", "GitHub webhook secret file")
    .option("--disable", "Disable webhook and restore 30-second polling")
    .action((id: string, options) => {
      const { disable, relayUrl, secretFile } = options;
      const store = open();
      try {
        stopped(store);
        const connection = store.get<Connection>("connection", id);
        if (!connection || connection.adapter !== "github") throw new Error("GitHub connection required");
        if (disable) {
          delete connection.options.webhookRelayUrl;
          delete connection.options.webhookSecretFile;
          connection.intervalMs = 30_000;
          store.remove("webhook", id);
        } else {
          const url = new URL(relayUrl);
          if (url.protocol !== "https:" || url.username || url.password) throw new Error("Relay must use HTTPS without embedded credentials");
          const file = resolve(secretFile);
          if (readFileSync(file, "utf8").trim().length < 32) throw new Error("Webhook secret must contain at least 32 characters");
          Object.assign(connection.options, { webhookRelayUrl: url.toString(), webhookSecretFile: file });
          connection.intervalMs = 0;
        }
        connection.error = undefined;
        store.put("connection", id, connection);
        console.log(JSON.stringify({ id, mode: disable ? "polling" : "webhook", intervalMs: connection.intervalMs }));
      } finally { store.close(); }
    });
}
