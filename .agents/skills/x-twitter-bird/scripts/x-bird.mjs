#!/usr/bin/env node

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

class BirdCredentialStore {
  constructor(customPath) {
    this.authFilePath = this.#resolveAuthFilePath(customPath);
  }

  #resolveAuthFilePath(customPath) {
    const rawPath =
      normalizeOptionalString(customPath) ??
      normalizeOptionalString(process.env.NEXTCLAW_X_BIRD_AUTH_FILE) ??
      join(homedir(), ".nextclaw", "secrets", "x-bird.json");
    return isAbsolute(rawPath) ? rawPath : resolve(rawPath);
  }

  ensureParentDir = () => {
    mkdirSync(dirname(this.authFilePath), { recursive: true });
  };

  load = () => {
    if (!existsSync(this.authFilePath)) {
      throw new Error(`Missing X auth file: ${this.authFilePath}`);
    }
    const parsed = JSON.parse(readFileSync(this.authFilePath, "utf8"));
    if (!isRecord(parsed)) {
      throw new Error("X auth file must be a JSON object.");
    }
    const authToken = readRequiredString(parsed.authToken, "authToken");
    const ct0 = readRequiredString(parsed.ct0, "ct0");
    return { authToken, ct0 };
  };

  save = ({ authToken, ct0 }) => {
    this.ensureParentDir();
    writeFileSync(
      this.authFilePath,
      `${JSON.stringify({ authToken, ct0 }, null, 2)}\n`,
      "utf8",
    );
    chmodSync(this.authFilePath, 0o600);
  };

  printStatus = () => {
    if (!existsSync(this.authFilePath)) {
      console.log(JSON.stringify({ ok: false, path: this.authFilePath, configured: false }, null, 2));
      return;
    }
    const parsed = this.load();
    console.log(
      JSON.stringify(
        {
          ok: true,
          path: this.authFilePath,
          configured: true,
          authTokenLength: parsed.authToken.length,
          ct0Length: parsed.ct0.length,
        },
        null,
        2,
      ),
    );
  };
}

class BirdCommandRunner {
  constructor(store) {
    this.store = store;
  }

  run = (args) => {
    const credentials = this.store.load();
    const result = spawnSync(
      "bird",
      ["--auth-token", credentials.authToken, "--ct0", credentials.ct0, ...args],
      {
        stdio: "inherit",
      },
    );
    if (typeof result.status === "number") {
      process.exitCode = result.status;
      return;
    }
    throw result.error ?? new Error("bird exited without a status code");
  };
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeOptionalString(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readRequiredString(value, field) {
  if (typeof value !== "string") {
    throw new Error(`Missing ${field} in X auth file.`);
  }
  return value;
}

function consumeOption(argv, name) {
  const index = argv.indexOf(name);
  if (index < 0) {
    return null;
  }
  const value = argv[index + 1];
  if (!value) {
    throw new Error(`Option ${name} requires a value.`);
  }
  argv.splice(index, 2);
  return value;
}

function printHelp() {
  console.log(`x-bird

Usage:
  node .agents/skills/x-twitter-bird/scripts/x-bird.mjs auth set --auth-token <token> --ct0 <token>
  node .agents/skills/x-twitter-bird/scripts/x-bird.mjs auth status
  node .agents/skills/x-twitter-bird/scripts/x-bird.mjs <bird-command> [...args]

Options:
  --auth-file <path>   Override the local credential file path

Default credential file:
  ~/.nextclaw/secrets/x-bird.json
`);
}

function main() {
  const argv = process.argv.slice(2);
  const authFile = consumeOption(argv, "--auth-file");
  if (argv.length === 0 || argv[0] === "help" || argv[0] === "--help" || argv[0] === "-h") {
    printHelp();
    return;
  }

  const store = new BirdCredentialStore(authFile);

  if (argv[0] === "auth") {
    const subcommand = argv[1];
    if (subcommand === "set") {
      const authToken = consumeOption(argv, "--auth-token");
      const ct0 = consumeOption(argv, "--ct0");
      if (!authToken || !ct0) {
        throw new Error("auth set requires --auth-token and --ct0.");
      }
      store.save({ authToken, ct0 });
      console.log(`Saved X credentials to ${store.authFilePath}`);
      return;
    }
    if (subcommand === "status") {
      store.printStatus();
      return;
    }
    throw new Error(`Unknown auth subcommand: ${String(subcommand ?? "")}`);
  }

  const runner = new BirdCommandRunner(store);
  runner.run(argv);
}

main();
