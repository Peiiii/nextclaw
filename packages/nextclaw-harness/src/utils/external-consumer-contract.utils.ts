import {
  Contribution,
  NextclawHarness,
  createTypedKey,
  eventKeys,
  type AgentRuntimeProviderRegistration,
} from "@nextclaw/harness";

const fixtureIngressKey = createTypedKey<{ value: string }>(
  "fixture.ingress.handle",
);

class PlatformContribution extends Contribution {
  constructor() {
    super({ id: "external-consumer-contract" });
  }

  protected setup = (): void => {
    this.effect(() => this.kernel.eventBus.on(eventKeys.ncpEvent, () => {}));
    this.effect(() =>
      this.kernel.ingress.addHandler(fixtureIngressKey, ({ payload }) => ({
        value: payload?.value ?? "",
      })),
    );
    this.effect(() =>
      this.kernel.tools.register({
        name: "fixture_tool",
        parameters: { type: "object", properties: {} },
        execute: async () => ({ ok: true }),
      }),
    );
    this.effect(() =>
      this.kernel.context.register({
        provide: () => ["fixture context"],
      }),
    );
    this.effect(() =>
      this.kernel.models.registerProvider({
        id: "fixture-model-plugin",
        providers: [
          {
            name: "fixture-model-provider",
            envKey: "FIXTURE_MODEL_API_KEY",
            keywords: ["fixture-model"],
          },
        ],
      }),
    );
    const runtimeProvider: AgentRuntimeProviderRegistration = {
      kind: "fixture-runtime",
      label: "Fixture runtime",
      createRuntime: () => ({
        run: async function* () {},
      }),
    };
    this.effect(() => this.kernel.runtimes.registerProvider(runtimeProvider));
    this.effect(() =>
      this.kernel.runtimes.registerEntry({
        id: "fixture-runtime",
        label: "Fixture runtime",
        type: "fixture-runtime",
      }),
    );
    this.effect(() =>
      this.kernel.mcp.registerServer("fixture", {
        enabled: false,
        transport: {
          type: "stdio",
          command: "fixture-mcp-server",
          args: [],
          env: {},
          stderr: "pipe",
        },
        scope: { allAgents: true, agents: [] },
        policy: { trust: "explicit", start: "eager" },
      }),
    );
  };
}

export async function compileExternalConsumerContract(): Promise<void> {
  const harness = new NextclawHarness();
  harness.contributions.register(new PlatformContribution());
  await harness.start();
  try {
    const agent = harness.agents.get();
    const session = await agent.sessions.create({ task: "fixture" });
    const run = await session.run({ input: "fixture" });
    run.events();
    await run.cancel();
    await run.result();
    await harness.sessions.resume(session.sessionId);
  } finally {
    await harness.dispose();
  }
}
