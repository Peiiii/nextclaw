import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import {
  PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT_FINGERPRINT,
  type PortableRuntimeAcceptancePlatform,
} from "@kernel/types/portable-runtime-acceptance.types.js";
import type { PortableRuntimeAcceptanceEvaluationContext } from "@kernel/utils/portable-runtime-acceptance-evaluator.utils.js";

const PORTABLE_RUNTIME_PROTOCOL_VERSION = "0.2.0";

export type PortableRuntimeAcceptanceIdentity = {
  available: true;
  context: PortableRuntimeAcceptanceEvaluationContext;
  runtimeVersionSource: "configured" | "product-version-fallback";
  runnerFingerprint: string;
};

export type PortableRuntimeAcceptanceUnavailableIdentity = {
  available: false;
  reason: string;
  environment: PortableRuntimeAcceptancePlatform | null;
  productVersion: string | null;
  runtimeVersion: string | null;
  runtimeVersionSource: "configured" | "product-version-fallback" | null;
};

export type PortableRuntimeAcceptanceIdentityResult =
  | PortableRuntimeAcceptanceIdentity
  | PortableRuntimeAcceptanceUnavailableIdentity;

/**
 * Resolves the identity against which evidence is judged. It deliberately
 * reads the currently distributed runner rather than deriving identity from a
 * previous VerificationRecord, so an updated runtime cannot self-certify with
 * its own old evidence.
 */
export class PortableRuntimeAcceptanceIdentityService {
  private cachedRunner: { path: string; mtimeMs: number; size: number; fingerprint: string } | undefined;

  constructor(private readonly params: {
    productVersion?: string;
    runtimeVersion?: string;
    portableServiceRunnerPath?: string;
    platform?: NodeJS.Platform;
    arch?: string;
  }) {}

  resolve = async (appId: string): Promise<PortableRuntimeAcceptanceIdentityResult> => {
    const environment = normalizePortableRuntimeEnvironment(
      this.params.platform ?? process.platform,
      this.params.arch ?? process.arch,
    );
    const productVersion = this.params.productVersion?.trim() || null;
    const configuredRuntimeVersion = this.params.runtimeVersion?.trim() || null;
    const runtimeVersion = configuredRuntimeVersion ?? productVersion;
    const runtimeVersionSource = configuredRuntimeVersion
      ? "configured" as const
      : productVersion ? "product-version-fallback" as const : null;
    if (!environment) {
      return unavailable("The current host platform is not in the portable runtime contract.", environment, productVersion, runtimeVersion, runtimeVersionSource);
    }
    if (!productVersion) {
      return unavailable("The product version is unavailable; current evidence cannot be evaluated.", environment, productVersion, runtimeVersion, runtimeVersionSource);
    }
    if (!runtimeVersion || !runtimeVersionSource) {
      return unavailable("The runtime version is unavailable; current evidence cannot be evaluated.", environment, productVersion, runtimeVersion, runtimeVersionSource);
    }
    const runnerPath = this.params.portableServiceRunnerPath?.trim();
    if (!runnerPath) {
      return unavailable("The distributed portable runner path is unavailable.", environment, productVersion, runtimeVersion, runtimeVersionSource);
    }
    try {
      const runnerFingerprint = await this.fingerprintRunner(runnerPath);
      const implementationFingerprint = `sha256:${createHash("sha256")
        .update(JSON.stringify({
          productVersion,
          runtimeVersion,
          runnerFingerprint,
          runnerProtocolVersion: PORTABLE_RUNTIME_PROTOCOL_VERSION,
          contractFingerprint: PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT_FINGERPRINT,
        }))
        .digest("hex")}`;
      return {
        available: true,
        context: {
          appId,
          environment,
          productVersion,
          runtimeVersion,
          implementationFingerprint,
          contractFingerprint: PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT_FINGERPRINT,
        },
        runtimeVersionSource,
        runnerFingerprint,
      };
    } catch (error) {
      return unavailable(
        `The distributed portable runner cannot be fingerprinted: ${error instanceof Error ? error.message : String(error)}`,
        environment,
        productVersion,
        runtimeVersion,
        runtimeVersionSource,
      );
    }
  };

  private fingerprintRunner = async (runnerPath: string): Promise<string> => {
    const metadata = await stat(runnerPath);
    if (!metadata.isFile()) throw new Error("runner is not a file");
    if (this.cachedRunner?.path === runnerPath && this.cachedRunner.mtimeMs === metadata.mtimeMs &&
      this.cachedRunner.size === metadata.size) {
      return this.cachedRunner.fingerprint;
    }
    const fingerprint = `sha256:${createHash("sha256").update(await readFile(runnerPath)).digest("hex")}`;
    this.cachedRunner = { path: runnerPath, mtimeMs: metadata.mtimeMs, size: metadata.size, fingerprint };
    return fingerprint;
  };
}

export function normalizePortableRuntimeEnvironment(
  platform: NodeJS.Platform,
  arch: string,
): PortableRuntimeAcceptancePlatform | null {
  if (platform === "darwin" && arch === "arm64") return "darwin-arm64";
  if (platform === "linux" && arch === "x64") return "linux-x64";
  if (platform === "win32" && arch === "x64") return "windows-x64";
  return null;
}

function unavailable(
  reason: string,
  environment: PortableRuntimeAcceptancePlatform | null,
  productVersion: string | null,
  runtimeVersion: string | null,
  runtimeVersionSource: PortableRuntimeAcceptanceUnavailableIdentity["runtimeVersionSource"],
): PortableRuntimeAcceptanceUnavailableIdentity {
  return { available: false, reason, environment, productVersion, runtimeVersion, runtimeVersionSource };
}
