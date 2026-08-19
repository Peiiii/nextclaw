import type {
  DiagnosticFactValue,
  DiagnosticOutcome,
} from "@nextclaw/shared";
import { DIAGNOSTIC_CORRELATION_METADATA_KEY } from "@nextclaw/shared";
import type { AppLogger } from "./app-logger.js";
import { getAppLogger } from "./logging-runtime.service.js";

export const DIAGNOSTIC_SCHEMA_VERSION = 1;
export { DIAGNOSTIC_CORRELATION_METADATA_KEY };

export type DiagnosticEvent = {
  domain: string;
  event: string;
  component: string;
  outcome: DiagnosticOutcome;
  correlationId?: string;
  parentCorrelationId?: string;
  reasonCode?: string;
  providerCode?: string;
  durationMs?: number;
  attempt?: number;
  facts?: Record<string, DiagnosticFactValue>;
};

export type DiagnosticRecord = DiagnosticEvent & {
  schemaVersion: typeof DIAGNOSTIC_SCHEMA_VERSION;
};

const OUTCOMES = new Set<DiagnosticOutcome>([
  "observed",
  "started",
  "accepted",
  "succeeded",
  "rejected",
  "cancelled",
  "failed",
  "unavailable",
  "suppressed",
]);
const ERROR_OUTCOMES = new Set<DiagnosticOutcome>(["failed", "unavailable"]);
const WARN_OUTCOMES = new Set<DiagnosticOutcome>(["rejected", "cancelled", "suppressed"]);
const SAFE_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const SAFE_FACT_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9._-]*$/;
const MAX_FACTS = 24;
const FORBIDDEN_FACT_KEYS = new Set([
  "apikey",
  "attachment",
  "attachments",
  "authorization",
  "body",
  "chatid",
  "content",
  "cookie",
  "credential",
  "credentials",
  "message",
  "messageid",
  "openid",
  "payload",
  "prompt",
  "response",
  "secret",
  "senderid",
  "token",
  "userid",
]);

function readName(value: unknown, name: string, maxLength = 96): string {
  if (typeof value !== "string") {
    throw new Error(`${name} must be a string`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || !SAFE_NAME_PATTERN.test(normalized)) {
    throw new Error(`${name} is invalid`);
  }
  return normalized;
}

function readOptionalString(value: unknown, name: string, maxLength = 128): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`${name} must be a string`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || /[\r\n]/.test(normalized)) {
    throw new Error(`${name} is invalid`);
  }
  return normalized;
}

function readOptionalName(value: unknown, name: string, maxLength = 96): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return readName(value, name, maxLength);
}

function readOptionalNonNegativeNumber(value: unknown, name: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a finite non-negative number`);
  }
  return value;
}

function normalizeFactKey(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function readFacts(value: unknown): Record<string, DiagnosticFactValue> | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("facts must be an object");
  }
  const entries = Object.entries(value);
  if (entries.length > MAX_FACTS) {
    throw new Error(`facts must contain at most ${MAX_FACTS} entries`);
  }
  const facts: Record<string, DiagnosticFactValue> = {};
  for (const [key, fact] of entries) {
    const normalizedKey = key.trim();
    if (!normalizedKey || normalizedKey.length > 64 || !SAFE_FACT_KEY_PATTERN.test(normalizedKey)) {
      throw new Error("fact key is invalid");
    }
    if (FORBIDDEN_FACT_KEYS.has(normalizeFactKey(normalizedKey))) {
      throw new Error(`fact key is forbidden: ${normalizedKey}`);
    }
    if (fact !== null && typeof fact !== "string" && typeof fact !== "number" && typeof fact !== "boolean") {
      throw new Error(`fact value must be scalar: ${normalizedKey}`);
    }
    if (typeof fact === "string" && (fact.length > 256 || /[\r\n]/.test(fact))) {
      throw new Error(`fact string is invalid: ${normalizedKey}`);
    }
    if (typeof fact === "number" && !Number.isFinite(fact)) {
      throw new Error(`fact number is invalid: ${normalizedKey}`);
    }
    facts[normalizedKey] = fact;
  }
  return facts;
}

export class DiagnosticRuntime {
  constructor(
    private readonly loggerFactory: (scope: string) => AppLogger = getAppLogger,
  ) {}

  validate = (input: DiagnosticEvent): DiagnosticRecord => {
    if (!OUTCOMES.has(input.outcome)) {
      throw new Error("outcome is invalid");
    }
    return {
      schemaVersion: DIAGNOSTIC_SCHEMA_VERSION,
      domain: readName(input.domain, "domain"),
      event: readName(input.event, "event"),
      component: readName(input.component, "component", 128),
      outcome: input.outcome,
      ...(readOptionalString(input.correlationId, "correlationId") ? { correlationId: readOptionalString(input.correlationId, "correlationId") } : {}),
      ...(readOptionalString(input.parentCorrelationId, "parentCorrelationId") ? { parentCorrelationId: readOptionalString(input.parentCorrelationId, "parentCorrelationId") } : {}),
      ...(readOptionalName(input.reasonCode, "reasonCode") ? { reasonCode: readOptionalName(input.reasonCode, "reasonCode") } : {}),
      ...(readOptionalName(input.providerCode, "providerCode") ? { providerCode: readOptionalName(input.providerCode, "providerCode") } : {}),
      ...(readOptionalNonNegativeNumber(input.durationMs, "durationMs") !== undefined ? { durationMs: readOptionalNonNegativeNumber(input.durationMs, "durationMs") } : {}),
      ...(readOptionalNonNegativeNumber(input.attempt, "attempt") !== undefined ? { attempt: readOptionalNonNegativeNumber(input.attempt, "attempt") } : {}),
      ...(readFacts(input.facts) ? { facts: readFacts(input.facts) } : {}),
    };
  };

  record = (input: DiagnosticEvent): DiagnosticRecord => {
    const record = this.validate(input);
    const logger = this.loggerFactory(`diagnostics.${record.domain}`);
    if (ERROR_OUTCOMES.has(record.outcome)) {
      logger.error(record.event, record);
    } else if (WARN_OUTCOMES.has(record.outcome)) {
      logger.warn(record.event, record);
    } else {
      logger.info(record.event, record);
    }
    return record;
  };

  readCorrelationId = (metadata: Record<string, unknown> | undefined): string | undefined =>
    readOptionalString(metadata?.[DIAGNOSTIC_CORRELATION_METADATA_KEY], "correlationId");
}
