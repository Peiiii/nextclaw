const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_RUNS = 1;
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_POLL_MS = 200;
const DEFAULT_COMMAND_TEMPLATE = "pnpm -C packages/nextclaw dev:build serve --ui-port {port}";
const DEFAULT_CRITERION = "ncp-agent-ready";
const CRITERIA = ["ui-api", "auth-status", "health", "ncp-agent-ready", "bootstrap-ready"];

function printHelp() {
  console.log(`Usage: node scripts/smoke/startup-readiness/measure-startup-readiness.mjs [options]

Options:
  --runs <n>                 Number of cold-start runs (default: ${DEFAULT_RUNS})
  --timeout-ms <ms>          Timeout per run in milliseconds (default: ${DEFAULT_TIMEOUT_MS})
  --poll-ms <ms>             Poll interval in milliseconds (default: ${DEFAULT_POLL_MS})
  --host <host>              Host to probe (default: ${DEFAULT_HOST})
  --port <port>              Fixed port to use (random if omitted)
  --criterion <name>         Completion gate: ${CRITERIA.join(" | ")} (default: ${DEFAULT_CRITERION})
  --command-template <cmd>   Startup command template. Supports {host} {port} {baseUrl} {home}
  --keep-artifacts           Keep per-run NEXTCLAW_HOME directories even on success
  --json                     Print machine-readable JSON only
  --help                     Show this help

Examples:
  pnpm smoke:startup-readiness -- --runs 3 --criterion ncp-agent-ready
  pnpm smoke:startup-readiness -- --runs 3 --criterion auth-status
  node scripts/smoke/startup-readiness/measure-startup-readiness.mjs --command-template "pnpm -C packages/nextclaw dev:build serve --ui-port {port}"
`);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

export function parseArgs(argv) {
  const options = {
    runs: DEFAULT_RUNS,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    pollMs: DEFAULT_POLL_MS,
    host: DEFAULT_HOST,
    port: null,
    criterion: DEFAULT_CRITERION,
    commandTemplate: DEFAULT_COMMAND_TEMPLATE,
    keepArtifacts: false,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--") {
      continue;
    }
    switch (arg) {
      case "--runs":
        options.runs = Number.parseInt(next ?? "", 10);
        index += 1;
        break;
      case "--timeout-ms":
        options.timeoutMs = Number.parseInt(next ?? "", 10);
        index += 1;
        break;
      case "--poll-ms":
        options.pollMs = Number.parseInt(next ?? "", 10);
        index += 1;
        break;
      case "--host":
        options.host = (next ?? "").trim();
        index += 1;
        break;
      case "--port":
        options.port = Number.parseInt(next ?? "", 10);
        index += 1;
        break;
      case "--criterion":
        options.criterion = (next ?? "").trim();
        index += 1;
        break;
      case "--command-template":
        options.commandTemplate = next ?? "";
        index += 1;
        break;
      case "--keep-artifacts":
        options.keepArtifacts = true;
        break;
      case "--json":
        options.json = true;
        break;
      case "--help":
        printHelp();
        process.exit(0);
        break;
      default:
        fail(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isInteger(options.runs) || options.runs < 1) {
    fail("--runs must be a positive integer");
  }
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1_000) {
    fail("--timeout-ms must be an integer >= 1000");
  }
  if (!Number.isInteger(options.pollMs) || options.pollMs < 50) {
    fail("--poll-ms must be an integer >= 50");
  }
  if (!options.host) {
    fail("--host is required");
  }
  if (options.port !== null && (!Number.isInteger(options.port) || options.port <= 0)) {
    fail("--port must be a positive integer");
  }
  if (!CRITERIA.includes(options.criterion)) {
    fail(`--criterion must be one of: ${CRITERIA.join(", ")}`);
  }
  if (!options.commandTemplate.trim()) {
    fail("--command-template is required");
  }

  return options;
}

export const startupReadinessDefaults = {
  commandTemplate: DEFAULT_COMMAND_TEMPLATE,
  criterion: DEFAULT_CRITERION,
  host: DEFAULT_HOST,
  pollMs: DEFAULT_POLL_MS,
  runs: DEFAULT_RUNS,
  timeoutMs: DEFAULT_TIMEOUT_MS,
};

export { CRITERIA };
