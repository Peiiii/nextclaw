import { Ingress } from "@nextclaw/shared";
import type { UiKernelHost } from "@nextclaw-server/app/types/router-options.types.js";

function unavailable(name: string): never {
  throw new Error(`test kernel ${name} is not configured`);
}

export function createRouterTestKernel(overrides: Partial<UiKernelHost> = {}): UiKernelHost {
  return {
    sessionRunManager: {
      streamSessionEvents: async function* () {
        yield unavailable("sessionRunManager.streamSessionEvents");
      },
    } as never,
    agentRuntimeManager: {
      listSessionTypes: async () => ({
        defaultType: "native",
        options: [{ value: "native", label: "Native" }],
      }),
    } as never,
    assetStore: {
      putBytes: async () => unavailable("assetStore.putBytes"),
      statRecord: async () => null,
      resolveContentPath: () => null,
    } as never,
    ingress: new Ingress(),
    llmProviders: {} as never,
    ncpSessionApi: {
      listSessions: async () => [],
      listSessionMessages: async () => [],
      getSession: async () => null,
      updateSession: async () => null,
      deleteSession: async () => undefined,
    } as never,
    ...overrides,
  };
}
