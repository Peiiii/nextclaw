import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { setTimeout as sleep } from "node:timers/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT_DIR = process.cwd();
const DEFAULT_PUBLISH_CONCURRENCY = 12;
const DEFAULT_VERIFY_CONCURRENCY = 8;
const DEFAULT_VERIFY_ATTEMPTS = 12;
const DEFAULT_VERIFY_DELAY_MS = 1000;
const DEFAULT_VERIFY_MAX_DELAY_MS = 15000;

export async function mapWithConcurrency(items, concurrency, worker) {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error(`Invalid concurrency: ${concurrency}`);
  }
  const results = new Array(items.length);
  const failures = [];
  let cursor = 0;
  async function runWorker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      try {
        results[index] = await worker(items[index], index);
      } catch (error) {
        failures.push({ error, index });
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () =>
      runWorker(),
    ),
  );
  if (failures.length > 0) {
    failures.sort((left, right) => left.index - right.index);
    throw new AggregateError(
      failures.map((entry) => entry.error),
      `${failures.length} of ${items.length} concurrent operation(s) failed`,
    );
  }
  return results;
}

async function runNpm(args, options = {}) {
  return execFileAsync("npm", args, {
    cwd: options.cwd ?? ROOT_DIR,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  });
}

function expectedIntegrity(entry) {
  return typeof entry.sha512 === "string" ? `sha512-${entry.sha512}` : null;
}

async function readPublishedIdentity(entry, registry, runCommand) {
  try {
    const result = await runCommand(
      [
        "view",
        `${entry.name}@${entry.version}`,
        "version",
        "dist.integrity",
        "dist-tags.latest",
        "--json",
        "--registry",
        registry,
      ],
      {},
    );
    const parsed = JSON.parse(result.stdout.trim());
    return parsed && typeof parsed === "object"
      ? {
          integrity: parsed["dist.integrity"] ?? null,
          latest: parsed["dist-tags.latest"] ?? null,
          version: parsed.version ?? null,
        }
      : null;
  } catch {
    return null;
  }
}

function inspectPublishedIdentity(entry, identity) {
  if (!identity || identity.version !== entry.version) {
    return { missing: true, issue: `${entry.name}@${entry.version}: missing` };
  }
  const integrity = expectedIntegrity(entry);
  if (!integrity) {
    return {
      missing: false,
      issue: `${entry.name}@${entry.version}: prepared integrity is missing`,
    };
  }
  if (identity.integrity !== integrity) {
    return {
      missing: false,
      issue: `${entry.name}@${entry.version}: registry integrity mismatch`,
    };
  }
  if (identity.latest !== entry.version) {
    return {
      missing: false,
      issue: `${entry.name}@latest is ${identity.latest ?? "<missing>"}; expected ${entry.version}`,
    };
  }
  return { missing: false, issue: null };
}

async function verifyPublishedBatch(options) {
  const {
    attempts,
    concurrency,
    delayMs,
    maxDelayMs,
    onEvent,
    packages,
    registry,
    runCommand,
  } = options;
  let missingPackages = packages;
  let remainingIssues = packages.map(
    (entry) => `${entry.name}@${entry.version}: not checked`,
  );
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const identities = await mapWithConcurrency(
      missingPackages,
      concurrency,
      (entry) => readPublishedIdentity(entry, registry, runCommand),
    );
    const inspections = missingPackages.map((entry, index) =>
      inspectPublishedIdentity(entry, identities[index]),
    );
    remainingIssues = inspections
      .map((inspection) => inspection.issue)
      .filter(Boolean);
    const integrityIssues = inspections
      .filter(
        (inspection) =>
          !inspection.missing && inspection.issue?.includes("integrity"),
      )
      .map((inspection) => inspection.issue);
    if (integrityIssues.length > 0) {
      throw new Error(
        `Published package identity conflicts with prepared tarballs:\n${integrityIssues.join("\n")}`,
      );
    }
    missingPackages = missingPackages.filter(
      (_entry, index) => inspections[index].issue,
    );
    if (missingPackages.length === 0) return attempt;
    if (attempt < attempts) {
      const nextDelayMs = Math.min(
        delayMs * 2 ** (attempt - 1),
        maxDelayMs,
      );
      onEvent({
        type: "registry-wait",
        attempt,
        delayMs: nextDelayMs,
        remainingPackages: missingPackages.map(
          (entry) => `${entry.name}@${entry.version}`,
        ),
      });
      await sleep(nextDelayMs);
    }
  }
  throw new Error(
    `Registry did not expose complete prepared identities:\n${remainingIssues.join("\n")}`,
  );
}

export async function publishPreparedNpmRelease(options) {
  const startedAt = performance.now();
  const {
    publishConcurrency = DEFAULT_PUBLISH_CONCURRENCY,
    onEvent = () => {},
    record,
    registry = record.manifest.registry,
    runCommand = (args, commandOptions) => runNpm(args, commandOptions),
    verifyAttempts = DEFAULT_VERIFY_ATTEMPTS,
    verifyConcurrency = DEFAULT_VERIFY_CONCURRENCY,
    verifyDelayMs = DEFAULT_VERIFY_DELAY_MS,
    verifyMaxDelayMs = DEFAULT_VERIFY_MAX_DELAY_MS,
  } = options;
  const packages = record.manifest.packages;
  const existingIdentities = await mapWithConcurrency(
    packages,
    verifyConcurrency,
    (entry) => readPublishedIdentity(entry, registry, runCommand),
  );
  const existingInspections = packages.map((entry, index) =>
    inspectPublishedIdentity(entry, existingIdentities[index]),
  );
  const integrityIssues = existingInspections
    .filter(
      (inspection) =>
        !inspection.missing && inspection.issue?.includes("integrity"),
    )
    .map((inspection) => inspection.issue);
  if (integrityIssues.length > 0) {
    throw new Error(
      `Published package identity conflicts with prepared tarballs:\n${integrityIssues.join("\n")}`,
    );
  }
  const missingPackages = packages
    .filter((_entry, index) => existingInspections[index].missing)
    .sort(
      (left, right) =>
        right.size - left.size || left.name.localeCompare(right.name),
    );
  const precheckCompletedAt = performance.now();
  onEvent({
    type: "publish-plan",
    packageCount: packages.length,
    publishCount: missingPackages.length,
    reuseCount: packages.length - missingPackages.length,
  });
  await mapWithConcurrency(
    missingPackages,
    publishConcurrency,
    async (entry) => {
      const tarballPath = resolve(record.batchDirectory, entry.tarballPath);
      onEvent({ type: "publish-start", package: entry });
      await runCommand(
        [
          "publish",
          tarballPath,
          "--access",
          "public",
          "--tag",
          "latest",
          "--ignore-scripts",
          "--json",
          "--registry",
          registry,
        ],
        {},
      );
      onEvent({ type: "publish-complete", package: entry });
    },
  );
  const uploadsCompletedAt = performance.now();
  const attemptsUsed = await verifyPublishedBatch({
    attempts: verifyAttempts,
    concurrency: verifyConcurrency,
    delayMs: verifyDelayMs,
    maxDelayMs: verifyMaxDelayMs,
    onEvent,
    packages,
    registry,
    runCommand,
  });
  onEvent({
    type: "registry-verified",
    attemptsUsed,
    packageCount: packages.length,
  });
  return {
    attemptsUsed,
    packageCount: packages.length,
    publishedCount: missingPackages.length,
    reusedCount: packages.length - missingPackages.length,
    timings: {
      precheckMs: precheckCompletedAt - startedAt,
      uploadMs: uploadsCompletedAt - precheckCompletedAt,
      verifyMs: performance.now() - uploadsCompletedAt,
    },
  };
}
