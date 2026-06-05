import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import { AigenError } from "@/types/cli-output.types.js";

type AigenSecretEntry = {
  kind: "apiKey";
  value: string;
  updatedAt: string;
};

type AigenSecretsFile = {
  version: 1;
  secrets: Record<string, AigenSecretEntry>;
};

export type AigenSecretMetadata = {
  ref: string;
  kind: "apiKey";
  exists: true;
  maskedValue: string;
  fingerprint: string;
  updatedAt: string;
};

export class SecretsRepository {
  readonly homeDir: string;
  readonly secretsPath: string;

  constructor(homeDir = process.env.AIGEN_HOME ?? join(homedir(), ".aigen")) {
    this.homeDir = homeDir;
    this.secretsPath = join(homeDir, "secrets.json");
  }

  setProviderApiKey = async (providerId: string, value: string): Promise<AigenSecretMetadata> => {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      throw new AigenError("INVALID_ARGUMENT", "API key cannot be empty.");
    }

    const secretsFile = await this.readSecretsOrCreate();
    const ref = this.providerRef(providerId);

    secretsFile.secrets[ref] = {
      kind: "apiKey",
      value: trimmedValue,
      updatedAt: new Date().toISOString()
    };

    await this.writeSecrets(secretsFile);
    return this.toMetadata(ref, secretsFile.secrets[ref]);
  };

  getProviderApiKey = async (providerId: string): Promise<string> => {
    const ref = this.providerRef(providerId);
    const entry = await this.getSecretEntry(ref);
    return entry.value;
  };

  getProviderSecret = async (providerId: string): Promise<AigenSecretMetadata> => {
    const ref = this.providerRef(providerId);
    const entry = await this.getSecretEntry(ref);
    return this.toMetadata(ref, entry);
  };

  listSecrets = async (): Promise<AigenSecretMetadata[]> => {
    const secretsFile = await this.readSecretsOrCreate();
    return Object.entries(secretsFile.secrets).map(([ref, entry]) => this.toMetadata(ref, entry));
  };

  removeProviderSecret = async (providerId: string): Promise<void> => {
    const secretsFile = await this.readSecretsOrCreate();
    const ref = this.providerRef(providerId);

    if (!secretsFile.secrets[ref]) {
      throw new AigenError("SECRET_NOT_FOUND", `Secret '${ref}' does not exist.`);
    }

    delete secretsFile.secrets[ref];
    await this.writeSecrets(secretsFile);
  };

  clear = async (): Promise<void> => {
    await rm(this.secretsPath, { force: true });
  };

  private getSecretEntry = async (ref: string): Promise<AigenSecretEntry> => {
    const secretsFile = await this.readSecretsOrCreate();
    const entry = secretsFile.secrets[ref];

    if (!entry) {
      throw new AigenError("MISSING_API_KEY", `Secret '${ref}' does not exist.`);
    }

    return entry;
  };

  private readSecretsOrCreate = async (): Promise<AigenSecretsFile> => {
    try {
      const text = await readFile(this.secretsPath, "utf8");
      const value = JSON.parse(text) as Partial<AigenSecretsFile>;

      if (value.version !== 1 || !value.secrets || typeof value.secrets !== "object") {
        throw new AigenError("CONFIG_INVALID", "aigen secrets.json is invalid.");
      }

      return {
        version: 1,
        secrets: value.secrets as Record<string, AigenSecretEntry>
      };
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        return {
          version: 1,
          secrets: {}
        };
      }

      throw error;
    }
  };

  private writeSecrets = async (secretsFile: AigenSecretsFile): Promise<void> => {
    await mkdir(this.homeDir, { recursive: true });
    await writeFile(this.secretsPath, `${JSON.stringify(secretsFile, null, 2)}\n`, { mode: 0o600 });
    await chmod(this.secretsPath, 0o600);
  };

  private providerRef = (providerId: string): string => `provider:${providerId}`;

  private toMetadata = (ref: string, entry: AigenSecretEntry): AigenSecretMetadata => ({
    ref,
    kind: entry.kind,
    exists: true,
    maskedValue: this.maskValue(entry.value),
    fingerprint: this.fingerprint(entry.value),
    updatedAt: entry.updatedAt
  });

  private maskValue = (value: string): string => {
    if (value.length <= 8) {
      return "********";
    }

    return `${value.slice(0, 3)}...${value.slice(-4)}`;
  };

  private fingerprint = (value: string): string =>
    `sha256:${createHash("sha256").update(value).digest("hex").slice(0, 12)}`;
}
