#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT,
  PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT_FINGERPRINT,
} from "../../packages/nextclaw-kernel/src/types/portable-runtime-acceptance.types.js";
import {
  evaluatePortableRuntimeAcceptanceArtifact,
  parsePortableRuntimeAcceptanceEvidenceArtifact,
} from "../../packages/nextclaw-kernel/src/utils/portable-runtime-acceptance-evaluator.utils.js";

function readOption(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

async function readArtifact(filePath: string) {
  return parsePortableRuntimeAcceptanceEvidenceArtifact(
    JSON.parse(await readFile(resolve(filePath), "utf8")) as unknown,
  );
}

async function prepareArtifact(): Promise<void> {
  const input = readOption("--input");
  const output = readOption("--output");
  if (!input || !output) {
    throw new Error("Usage: --prepare --input <structured-evidence.json> --output <candidate-evidence.json>");
  }
  const artifact = await readArtifact(input);
  await writeFile(resolve(output), `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  console.log(`[prt-release-gate] prepared structured candidate evidence: ${resolve(output)}`);
}

async function validateArtifact(): Promise<void> {
  const artifactPath = readOption("--artifact");
  const stage = readOption("--stage");
  if (!artifactPath || (stage !== "prepublish" && stage !== "postpublish")) {
    throw new Error("Usage: --stage <prepublish|postpublish> --artifact <candidate-evidence.json>");
  }
  const artifact = await readArtifact(artifactPath);
  if (artifact.contractFingerprint !== PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT_FINGERPRINT ||
    artifact.targets.some((target) => target.contractFingerprint !== PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT_FINGERPRINT)) {
    throw new Error("Candidate evidence uses a stale portable runtime acceptance contract fingerprint.");
  }
  const results = evaluatePortableRuntimeAcceptanceArtifact(artifact);
  const open = PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT
    .filter((definition) => definition.required && (stage === "postpublish" || definition.evidenceSource !== "release"))
    .flatMap((definition) => definition.platforms.map((environment) => {
      const result = results.find((entry) =>
        entry.acceptanceId === definition.id && entry.environment === environment);
      return result?.status === "current-passed" ? undefined : `${definition.id}@${environment}`;
    }))
    .filter((entry): entry is string => Boolean(entry));
  if (open.length > 0) {
    throw new Error(`Required current evidence is open: ${[...new Set(open)].join(", ")}`);
  }
  console.log(`[prt-release-gate] ${stage} acceptance gate passed (${artifact.targets.length} target(s)).`);
}

async function main(): Promise<void> {
  if (process.argv.includes("--print-contract")) {
    console.log(JSON.stringify({
      fingerprint: PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT_FINGERPRINT,
      definitions: PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT,
    }));
    return;
  }
  if (process.argv.includes("--prepare")) {
    await prepareArtifact();
    return;
  }
  await validateArtifact();
}

void main().catch((error: unknown) => {
  console.error(`[prt-release-gate] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
