import { spawnSync } from "node:child_process";
import type { HostDiagnosticEvidence } from "@nextclaw/core";

type CommandResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

type WindowsHostEvidenceOptions = {
  startedAt: string;
  observedEndedAt: string;
  applicationNames: string[];
  platform?: NodeJS.Platform;
  runCommand?: (command: string, args: string[]) => CommandResult;
};

type WindowsEventRecord = {
  eventId: number;
  observedAt: string;
  provider: string;
  text: string;
};

const WINDOWS_EVENT_LOGS = [
  "Application",
  "System",
  "Microsoft-Windows-Windows Defender/Operational"
] as const;

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&amp;/g, "&")
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number.parseInt(code, 10)));
}

function extractAttribute(xml: string, name: string): string {
  return new RegExp(`${name}=["']([^"']*)["']`, "i").exec(xml)?.[1] ?? "";
}

function stripXml(xml: string): string {
  return decodeXml(xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

export function parseWindowsEventXml(xml: string): WindowsEventRecord[] {
  return (xml.match(/<Event(?:\s[^>]*)?>[\s\S]*?<\/Event>/gi) ?? []).flatMap((eventXml) => {
    const eventId = Number(/<EventID(?:\s[^>]*)?>(\d+)<\/EventID>/i.exec(eventXml)?.[1]);
    const observedAt = extractAttribute(eventXml, "SystemTime");
    const provider = /<Provider\s+[^>]*Name=["']([^"']+)["']/i.exec(eventXml)?.[1] ?? "unknown";
    if (!Number.isFinite(eventId) || !observedAt) {
      return [];
    }
    return [{ eventId, observedAt, provider, text: stripXml(eventXml) }];
  });
}

function defaultRunCommand(command: string, args: string[]): CommandResult {
  const result = spawnSync(command, args, { encoding: "utf8", windowsHide: true });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}

function isWithinWindow(value: string, startedAt: string, endedAt: string): boolean {
  const timestamp = Date.parse(value);
  const start = Date.parse(startedAt) - 120_000;
  const end = Date.parse(endedAt) + 120_000;
  return Number.isFinite(timestamp) && timestamp >= start && timestamp <= end;
}

function targetsApplication(record: WindowsEventRecord, applicationNames: string[]): boolean {
  const text = record.text.toLowerCase();
  return applicationNames.some((name) => text.includes(name.toLowerCase()));
}

function createEvidence(kind: string, record: WindowsEventRecord): HostDiagnosticEvidence {
  return {
    source: "windows",
    kind,
    observedAt: record.observedAt,
    facts: { eventId: record.eventId, provider: record.provider }
  };
}

export function collectWindowsHostEvidence(options: WindowsHostEvidenceOptions): HostDiagnosticEvidence[] {
  const {
    applicationNames,
    observedEndedAt,
    platform = process.platform,
    runCommand = defaultRunCommand,
    startedAt
  } = options;
  if (platform !== "win32") {
    return [];
  }
  const evidence: HostDiagnosticEvidence[] = [];
  for (const logName of WINDOWS_EVENT_LOGS) {
    const result = runCommand("wevtutil", ["qe", logName, "/f:RenderedXml", "/rd:true", "/c:96"]);
    if (result.status !== 0) {
      evidence.push({
        source: "windows",
        kind: "windows.event-log-unavailable",
        observedAt: observedEndedAt,
        facts: { logName, status: result.status ?? -1 }
      });
      continue;
    }
    for (const record of parseWindowsEventXml(result.stdout)) {
      if (!isWithinWindow(record.observedAt, startedAt, observedEndedAt)) {
        continue;
      }
      if (logName === "Application" && [1000, 1001, 1002].includes(record.eventId) && targetsApplication(record, applicationNames)) {
        evidence.push(createEvidence("windows.application-crash", record));
        continue;
      }
      if (logName === "System" && [41, 1074, 6006, 6008].includes(record.eventId)) {
        evidence.push(createEvidence("windows.system-shutdown", record));
        continue;
      }
      if (logName === "System" && record.eventId === 2004 && targetsApplication(record, applicationNames)) {
        evidence.push(createEvidence("windows.resource-exhaustion", record));
        continue;
      }
      if (logName.includes("Defender") && [1116, 1117].includes(record.eventId) && targetsApplication(record, applicationNames)) {
        evidence.push(createEvidence("windows.security-remediation", record));
      }
    }
  }
  return evidence;
}
