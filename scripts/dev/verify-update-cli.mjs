export function printHelp() {
  console.log(`Usage: pnpm dev:verify-update -- [options]

Build and start an isolated local NextClaw instance that first proves periodic
update discovery without a restart, then keeps the browser open for manually
verifying download and apply.

Options:
  --no-open       Do not open the browser automatically
  --port <port>   Use a fixed UI port instead of an available dynamic port
  --keep          Keep the temporary verification directory after exit
  --rebuild       Bypass caches and rebuild all source/runtime artifacts
  --help          Show this help`);
}

export function parseOptions(argv) {
  const options = {
    help: false,
    keep: false,
    open: true,
    port: null,
    rebuild: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--") {
      continue;
    }
    if (token === "--help") {
      options.help = true;
      continue;
    }
    if (token === "--keep") {
      options.keep = true;
      continue;
    }
    if (token === "--rebuild") {
      options.rebuild = true;
      continue;
    }
    if (token === "--no-open") {
      options.open = false;
      continue;
    }
    if (token === "--port") {
      const value = argv[index + 1];
      const port = Number(value);
      if (!Number.isInteger(port) || port < 1 || port > 65_535) {
        throw new Error("--port requires an integer between 1 and 65535.");
      }
      options.port = port;
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${token}`);
  }

  return options;
}
