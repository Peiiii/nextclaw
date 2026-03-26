import { toDisposable, type Disposable } from "@nextclaw/core";
import type { NcpAgentRuntime } from "@nextclaw/ncp";
import type { RuntimeFactoryParams } from "@nextclaw/ncp-toolkit";

export const DEFAULT_UI_NCP_RUNTIME_KIND = "native";

export type UiNcpSessionTypeOption = {
  value: string;
  label: string;
  ready?: boolean;
  reason?: string | null;
  reasonMessage?: string | null;
  supportedModels?: string[];
  recommendedModel?: string | null;
  cta?: {
    kind: string;
    label?: string;
    href?: string;
  } | null;
};

export type UiNcpSessionTypeDescribeParams = {
  describeMode?: "observation" | "probe";
};

export type UiNcpRuntimeRegistration = {
  kind: string;
  label: string;
  createRuntime: (params: RuntimeFactoryParams) => NcpAgentRuntime;
  describeSessionType?: (params?: UiNcpSessionTypeDescribeParams) => Promise<Omit<UiNcpSessionTypeOption, "value" | "label"> | null | undefined>
    | Omit<UiNcpSessionTypeOption, "value" | "label">
    | null
    | undefined;
};

type RuntimeRegistrationEntry = UiNcpRuntimeRegistration & {
  token: symbol;
};

function normalizeRuntimeKind(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function readRequestedRuntimeKind(sessionMetadata: Record<string, unknown>): string | null {
  return (
    normalizeRuntimeKind(sessionMetadata.session_type) ??
    normalizeRuntimeKind(sessionMetadata.sessionType) ??
    null
  );
}

export class UiNcpRuntimeRegistry {
  private readonly registrations = new Map<string, RuntimeRegistrationEntry>();

  constructor(private readonly defaultKind = DEFAULT_UI_NCP_RUNTIME_KIND) {}

  register(registration: UiNcpRuntimeRegistration): Disposable {
    const normalizedKind = normalizeRuntimeKind(registration.kind);
    if (!normalizedKind) {
      throw new Error("ui ncp runtime kind must be a non-empty string");
    }

    const token = Symbol(normalizedKind);
    this.registrations.set(normalizedKind, {
      ...registration,
      kind: normalizedKind,
      token,
    });

    return toDisposable(() => {
      const current = this.registrations.get(normalizedKind);
      if (!current || current.token !== token) {
        return;
      }
      this.registrations.delete(normalizedKind);
    });
  }

  createRuntime(params: RuntimeFactoryParams): NcpAgentRuntime {
    const requestedKind = readRequestedRuntimeKind(params.sessionMetadata) ?? this.defaultKind;
    const registration = this.registrations.get(requestedKind);
    if (!registration) {
      throw new Error(`ncp runtime unavailable: ${requestedKind}`);
    }

    const nextSessionMetadata = {
      ...params.sessionMetadata,
      session_type: registration.kind,
    };
    params.setSessionMetadata(nextSessionMetadata);
    return registration.createRuntime({
      ...params,
      sessionMetadata: nextSessionMetadata,
    });
  }

  async listSessionTypes(params?: UiNcpSessionTypeDescribeParams): Promise<{
    defaultType: string;
    options: UiNcpSessionTypeOption[];
  }> {
    const options = await Promise.all(
      [...this.registrations.values()].map(async (registration) => {
        const descriptor = await registration.describeSessionType?.(params);
        return {
          value: registration.kind,
          label: registration.label,
          ready: descriptor?.ready ?? true,
          reason: descriptor?.reason ?? null,
          reasonMessage: descriptor?.reasonMessage ?? null,
          recommendedModel: descriptor?.recommendedModel ?? null,
          cta: descriptor?.cta ?? null,
          ...(descriptor?.supportedModels ? { supportedModels: descriptor.supportedModels } : {}),
        };
      }),
    );

    return {
      defaultType: this.defaultKind,
      options: options
      .sort((left, right) => {
        if (left.value === this.defaultKind) {
          return -1;
        }
        if (right.value === this.defaultKind) {
          return 1;
        }
        return left.value.localeCompare(right.value);
      }),
    };
  }
}
