import fs from "node:fs";
import {
  DEFAULT_SECRET_PROVIDER_ALIAS,
  ENV_SECRET_REF_ID_RE,
  formatExecSecretRefIdValidationMessage,
  isValidExecSecretRefId,
  isValidFileSecretRefId,
} from "./secrets-core.js";
import type { ClawdbotConfig, SecretInput, SecretRefSource, WizardPrompter } from "./types.js";

type SecretPromptResult =
  | { action: "keep" }
  | { action: "use-env" }
  | { action: "set"; value: SecretInput; resolvedValue: string };

function resolveDefaultSecretProviderAlias(
  cfg: ClawdbotConfig,
  source: SecretRefSource,
): string {
  const configured =
    source === "env"
      ? cfg.secrets?.defaults?.env
      : source === "file"
        ? cfg.secrets?.defaults?.file
        : cfg.secrets?.defaults?.exec;
  if (configured?.trim()) {
    return configured.trim();
  }
  const providers = cfg.secrets?.providers;
  if (providers) {
    for (const [name, provider] of Object.entries(providers)) {
      if (provider?.source === source) {
        return name;
      }
    }
  }
  return DEFAULT_SECRET_PROVIDER_ALIAS;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readJsonPointerValue(payload: unknown, pointer: string): string | null {
  if (pointer === "value") {
    return typeof payload === "string" ? payload : null;
  }
  const segments = pointer
    .slice(1)
    .split("/")
    .map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"));
  let cursor: unknown = payload;
  for (const segment of segments) {
    if (!isRecord(cursor) && !Array.isArray(cursor)) {
      return null;
    }
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return typeof cursor === "string" ? cursor : null;
}

function tryResolveFileProviderValue(cfg: ClawdbotConfig, provider: string, id: string): string | null {
  const providerConfig = cfg.secrets?.providers?.[provider];
  if (!providerConfig || providerConfig.source !== "file" || !providerConfig.path) {
    return null;
  }
  try {
    const raw = fs.readFileSync(providerConfig.path, "utf-8");
    if (providerConfig.mode === "singleValue") {
      return raw.trim();
    }
    const parsed = JSON.parse(raw) as unknown;
    return readJsonPointerValue(parsed, id);
  } catch {
    return null;
  }
}

function promptSingleChannelToken(params: {
  prompter: Pick<WizardPrompter, "confirm" | "text">;
  accountConfigured: boolean;
  canUseEnv: boolean;
  hasConfigToken: boolean;
  envPrompt: string;
  keepPrompt: string;
  inputPrompt: string;
}): Promise<{ useEnv: boolean; token: string | null }> {
  const promptToken = async (): Promise<string> =>
    String(
      await params.prompter.text({
        message: params.inputPrompt,
        validate: (value) => (value?.trim() ? undefined : "Required"),
      }),
    ).trim();

  return (async () => {
    if (params.canUseEnv) {
      const keepEnv = await params.prompter.confirm({
        message: params.envPrompt,
        initialValue: true,
      });
      if (keepEnv) {
        return { useEnv: true, token: null };
      }
      return { useEnv: false, token: await promptToken() };
    }

    if (params.hasConfigToken && params.accountConfigured) {
      const keep = await params.prompter.confirm({
        message: params.keepPrompt,
        initialValue: true,
      });
      if (keep) {
        return { useEnv: false, token: null };
      }
    }

    return { useEnv: false, token: await promptToken() };
  })();
}

async function resolveSecretInputMode(params: {
  prompter: Pick<WizardPrompter, "select">;
  explicitMode?: "plaintext" | "ref";
  credentialLabel: string;
}): Promise<"plaintext" | "ref"> {
  if (params.explicitMode) {
    return params.explicitMode;
  }
  return await params.prompter.select({
    message: `How do you want to provide this ${params.credentialLabel}?`,
    initialValue: "plaintext",
    options: [
      {
        value: "plaintext",
        label: `Enter ${params.credentialLabel}`,
        hint: "Stores the credential directly in NextClaw config",
      },
      {
        value: "ref",
        label: "Use secret reference",
        hint: "Stores a reference to env or configured secret providers",
      },
    ],
  });
}

async function promptSecretRefForSetup(params: {
  cfg: ClawdbotConfig;
  prompter: Pick<WizardPrompter, "note" | "select" | "text">;
  preferredEnvVar?: string;
}): Promise<{ value: SecretInput; resolvedValue: string }> {
  const providers = Object.entries(params.cfg.secrets?.providers ?? {}).filter(
    ([, provider]) => provider?.source === "file" || provider?.source === "exec",
  );
  const source = await params.prompter.select({
    message: "Where is this secret stored?",
    initialValue: "env",
    options: [
      { value: "env", label: "Environment variable", hint: "Reference an env var" },
      ...(providers.length > 0
        ? [{ value: "provider", label: "Configured provider", hint: "Reference file/exec provider" }]
        : []),
    ],
  });

  if (source === "env") {
    const envVar = String(
      await params.prompter.text({
        message: "Environment variable name",
        initialValue: params.preferredEnvVar,
        placeholder: params.preferredEnvVar ?? "NEXTCLAW_SECRET",
        validate: (value) => {
          const candidate = value.trim();
          if (!ENV_SECRET_REF_ID_RE.test(candidate)) {
            return 'Use an env var name like "OPENAI_API_KEY".';
          }
          if (!process.env[candidate]?.trim()) {
            return `Environment variable "${candidate}" is missing or empty in this session.`;
          }
          return undefined;
        },
      }),
    ).trim();
    return {
      value: {
        source: "env",
        provider: resolveDefaultSecretProviderAlias(params.cfg, "env"),
        id: envVar,
      },
      resolvedValue: process.env[envVar]?.trim() ?? "",
    };
  }

  const provider = await params.prompter.select({
    message: "Select secret provider",
    initialValue: providers[0]?.[0],
    options: providers.map(([name, providerConfig]) => ({
      value: name,
      label: name,
      hint: providerConfig?.source === "exec" ? "Exec provider" : "File provider",
    })),
  });
  const providerConfig = params.cfg.secrets?.providers?.[provider];
  const id = String(
    await params.prompter.text({
      message:
        providerConfig?.source === "file"
          ? "Secret id (JSON pointer, or 'value' for singleValue mode)"
          : "Secret id for the exec provider",
      initialValue: providerConfig?.source === "file" ? "/providers/feishu/appSecret" : undefined,
      validate: (value) => {
        const candidate = value.trim();
        if (!candidate) {
          return "Required";
        }
        if (providerConfig?.source === "file") {
          return isValidFileSecretRefId(candidate) ? undefined : "Invalid file secret reference id.";
        }
        return isValidExecSecretRefId(candidate)
          ? undefined
          : formatExecSecretRefIdValidationMessage();
      },
    }),
  ).trim();

  const resolvedValue =
    providerConfig?.source === "file" ? (tryResolveFileProviderValue(params.cfg, provider, id) ?? "") : "";
  if (!resolvedValue && providerConfig?.source === "exec") {
    await params.prompter.note(
      "Exec provider reference saved. Connection probe will rely on runtime secret resolution later.",
      "Secret reference saved",
    );
  }

  return {
    value: {
      source: providerConfig?.source === "exec" ? "exec" : "file",
      provider,
      id,
    },
    resolvedValue,
  };
}

export async function promptSingleChannelSecretInput(params: {
  cfg: ClawdbotConfig;
  prompter: Pick<WizardPrompter, "confirm" | "note" | "select" | "text">;
  providerHint: string;
  credentialLabel: string;
  secretInputMode?: "plaintext" | "ref";
  accountConfigured: boolean;
  canUseEnv: boolean;
  hasConfigToken: boolean;
  envPrompt: string;
  keepPrompt: string;
  inputPrompt: string;
  preferredEnvVar?: string;
}): Promise<SecretPromptResult> {
  const selectedMode = await resolveSecretInputMode({
    prompter: params.prompter,
    explicitMode: params.secretInputMode,
    credentialLabel: params.credentialLabel,
  });

  if (selectedMode === "plaintext") {
    const plainResult = await promptSingleChannelToken({
      prompter: params.prompter,
      accountConfigured: params.accountConfigured,
      canUseEnv: params.canUseEnv,
      hasConfigToken: params.hasConfigToken,
      envPrompt: params.envPrompt,
      keepPrompt: params.keepPrompt,
      inputPrompt: params.inputPrompt,
    });
    if (plainResult.useEnv) {
      return { action: "use-env" };
    }
    if (plainResult.token) {
      return { action: "set", value: plainResult.token, resolvedValue: plainResult.token };
    }
    return { action: "keep" };
  }

  if (params.hasConfigToken && params.accountConfigured) {
    const keep = await params.prompter.confirm({
      message: params.keepPrompt,
      initialValue: true,
    });
    if (keep) {
      return { action: "keep" };
    }
  }

  const refResult = await promptSecretRefForSetup({
    cfg: params.cfg,
    prompter: params.prompter,
    preferredEnvVar: params.preferredEnvVar,
  });
  return {
    action: "set",
    value: refResult.value,
    resolvedValue: refResult.resolvedValue,
  };
}
