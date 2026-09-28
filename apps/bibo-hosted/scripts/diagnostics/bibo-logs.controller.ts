import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { setDefaultResultOrder } from "node:dns";
import { pathToFileURL } from "node:url";
import { runFailure } from "../../src/app/diagnostics/bibo-diagnostics.utils";

type Event = { timestamp: number; source?: { message?: string; [key: string]: unknown }; $metadata?: { id?: string; service?: string; trigger?: string; requestId?: string; traceId?: string } };
type Options = { session?: string; run?: string; since: number; until: number; json: boolean };

export function parseLogOptions(args: string[], now = Date.now()): Options {
  const options: Options = { since: now - 3_600_000, until: now, json: false };
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (key === "--") continue;
    if (key === "--json") { options.json = true; continue; }
    const value = args[++index];
    if (!value) throw new Error(`Missing value for ${key}`);
    if (key === "--session") options.session = value;
    else if (key === "--run") options.run = value;
    else if (key === "--since" || key === "--until") {
      const duration = /^(\d+)(m|h|d)$/.exec(value);
      const timestamp = duration ? now - Number(duration[1]) * ({ m: 60000, h: 3600000, d: 86400000 }[duration[2] as "m" | "h" | "d"]) : Date.parse(value);
      if (!Number.isFinite(timestamp)) throw new Error(`Invalid time: ${value}`);
      options[key === "--since" ? "since" : "until"] = timestamp;
    } else throw new Error(`Unknown option: ${key}`);
  }
  if (options.since >= options.until || options.until - options.since > 7 * 86400000) throw new Error("Choose a time window between 0 and 7 days.");
  return options;
}

async function token(): Promise<string> {
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN;
  // Reuse Wrangler's local OAuth session in memory; never print or copy credentials.
  const config = process.platform === "darwin"
    ? join(homedir(), "Library/Preferences/.wrangler/config/default.toml")
    : join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), ".wrangler/config/default.toml");
  const raw = await readFile(config, "utf8").catch(() => "");
  const value = /^oauth_token\s*=\s*"([^"]+)"/m.exec(raw)?.[1];
  if (!value) throw new Error("Set CLOUDFLARE_API_TOKEN with Workers Observability read access, or authenticate with Wrangler.");
  return value;
}

export function projectLog(event: Event): Record<string, unknown> {
  const message = event.source?.message ?? "";
  let structured: Record<string, unknown> = event.source ?? {};
  try { structured = JSON.parse(message) as Record<string, unknown>; } catch { /* Legacy text has no correlation. */ }
  const result: Record<string, unknown> = { timestamp: new Date(event.timestamp).toISOString(), service: event.$metadata?.service,
    requestId: event.$metadata?.requestId, traceId: event.$metadata?.traceId };
  if (structured?.schema === "bibo.diagnostic/v1") {
    for (const key of ["event", "component", "level", "runId", "sessionId", "stage", "status", "errorCode", "durationMs", "requestBytes", "messageCount", "toolCount", "snapshotBytes", "persisted", "runtimeId", "compactionStatus", "phase", "errorType", "errorLocation"]) {
      if (["string", "number", "boolean"].includes(typeof structured[key])) result[key] = structured[key];
    }
  } else {
    result.event = "legacy.uncorrelated";
    result.errorCode = /failed|error/i.test(message) ? runFailure(new Error(message)).code : undefined;
    result.operation = /^(GET|POST|PUT|DELETE) https?:\/\/[^/]+(\/[^?\s]*)/.exec(message)?.slice(1).join(" ");
  }
  return result;
}

type LogApi = (path: string, body?: unknown) => Promise<unknown>;
export async function queryLogs(api: LogApi, options: Options, applicationId: string): Promise<{ records: Record<string, unknown>[]; samplingLevel: number }> {
  const { since, until, session, run } = options;
  const records: Record<string, unknown>[] = [];
  let samplingLevel = 0;
  for (const [dataset, service] of [["cloudflare-workers", "bibo-hosted"], ["containers", applicationId]]) {
    let offset: string | undefined;
    for (let page = 0; ; page++) {
      if (page === 100) throw new Error("Query is too large; narrow the time range. Results are not complete.");
      const result = await api("workers/observability/telemetry/query", {
        queryId: "bibo-cli-diagnostics", view: "events", dry: true, chart: false, limit: 500, ...(offset ? { offset } : {}),
        timeframe: { from: since, to: until },
        parameters: { datasets: [dataset], filters: [
          { key: "$metadata.service", type: "string", operation: "eq", value: service },
          ...(session ? [{ key: "sessionId", type: "string", operation: "eq", value: session }] : []),
          ...(run ? [{ key: "runId", type: "string", operation: "eq", value: run }] : []),
        ] },
      }) as { events?: { events?: Event[] }; statistics?: { abr_level?: number } };
      samplingLevel = Math.max(samplingLevel, result.statistics?.abr_level ?? 0);
      if (!Array.isArray(result.events?.events)) throw new Error("Cloudflare returned an unsupported log response.");
      const events = result.events.events;
      for (const event of events) {
        if (event.$metadata?.service !== service) continue;
        const record = projectLog(event);
        if (session && record.sessionId !== session) continue;
        if (run && record.runId !== run) continue;
        records.push(record);
      }
      if (events.length < 500) break;
      const next = events.at(-1)?.$metadata?.id;
      if (!next || next === offset) throw new Error("Log pagination did not advance; narrow the time range.");
      offset = next;
    }
  }
  records.sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
  return { records, samplingLevel };
}

async function main(): Promise<void> {
  if (process.argv.includes("--help")) {
    console.log("Bibo historical diagnostics (read only)\nUsage: pnpm logs -- --session ID --since 24h [--run ID] [--until ISO] [--json]\nOmit IDs to inspect older uncorrelated events. Default: last hour; maximum window: 7 days.\nAuthentication: CLOUDFLARE_API_TOKEN or existing Wrangler OAuth session. Empty results do not prove no failures.");
    return;
  }
  setDefaultResultOrder("ipv4first");
  const options = parseLogOptions(process.argv.slice(2));
  const credential = await token();
  const config = await readFile(new URL("../../wrangler.toml", import.meta.url), "utf8");
  const account = /^account_id\s*=\s*"([a-f0-9]+)"/m.exec(config)?.[1];
  if (!account) throw new Error("Missing Cloudflare account_id in wrangler.toml");
  const api = async (path: string, body?: unknown) => {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/${path}`, {
      method: body ? "POST" : "GET", headers: { authorization: `Bearer ${credential}`, "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`Cloudflare query failed (${response.status}). Check API permissions or refresh Wrangler authentication.`);
    const data = await response.json() as { success: boolean; result: unknown };
    if (!data.success) throw new Error("Cloudflare rejected the log query.");
    return data.result;
  };
  const apps = await api("containers/applications") as { id: string; name: string }[];
  const application = apps.find((app) => app.name === "bibo-hosted-bibousercontainer");
  if (!application) throw new Error("Bibo Container application was not found.");
  const { records, samplingLevel } = await queryLogs(api, options, application.id);
  if (options.json) console.log(JSON.stringify({ from: new Date(options.since).toISOString(), to: new Date(options.until).toISOString(), samplingLevel, complete: samplingLevel === 0, records }, null, 2));
  else {
    for (const record of records) console.log(JSON.stringify(record));
    console.log(`${records.length} events.${samplingLevel > 0 ? ` Cloudflare sampling level ${samplingLevel}; records may be incomplete.` : ""} Empty results may mean pre-instrumentation logs, sampling, retention, or the wrong time range.`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Log query failed");
  process.exitCode = 1;
});
