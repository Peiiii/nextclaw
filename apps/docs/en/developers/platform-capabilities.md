# Platform capabilities

A Harness contribution can add resources to the Agent runtime without importing Kernel managers. Register contributions before `harness.start()`; the Harness starts their effects in order and disposes them in reverse order.

```ts
import {
  Contribution,
  NextclawHarness,
  createTypedKey,
  eventKeys,
} from '@nextclaw/harness';

const customerLookupIngress = createTypedKey<{ id: string }>(
  'acme.customer.lookup',
);

class BusinessContribution extends Contribution {
  constructor() {
    super({ id: 'acme.business', version: '1.0.0' });
  }

  protected setup = (): void => {
    this.effect(() =>
      this.kernel.eventBus.on(eventKeys.ncpEvent, (event) => {
        observeAgentEvent(event);
      }),
    );

    this.effect(() =>
      this.kernel.ingress.addHandler(customerLookupIngress, ({ payload }) =>
        loadCustomer(String(payload?.id)),
      ),
    );

    this.effect(() =>
      this.kernel.tools.register({
        name: 'lookup_customer',
        parameters: { type: 'object', properties: { id: { type: 'string' } } },
        execute: async ({ id }) => loadCustomer(String(id)),
      }),
    );

    this.effect(() =>
      this.kernel.context.register({
        provide: async (request) => [await loadBusinessContext(request.agentId)],
      }),
    );
  };
}

const harness = new NextclawHarness();
harness.contributions.register(new BusinessContribution());
await harness.start();
```

## Available namespaces

| Namespace | What the host can do |
| --- | --- |
| `kernel.eventBus` | Observe or emit public Kernel events with `eventKeys` |
| `kernel.ingress` | Invoke standard `ingressKeys` or register an extension entry with a typed key |
| `kernel.tools` | Register an `NcpTool` for Agent runs |
| `kernel.context` | Add request-scoped context blocks |
| `kernel.models` | Register provider catalog plugins, list providers, and call chat or streaming chat |
| `kernel.runtimes` | Register an NCP runtime provider and the runtime entries Agents can select |
| `kernel.mcp` | Register a lifecycle-scoped MCP server, list servers and tools, and call a tool |

`kernel.eventBus` and `kernel.ingress` are the actual instances owned by this Harness's Kernel, not a copied SDK event bridge or routing table. `EventBus.on()` and `Ingress.addHandler()` both return disposers, so `this.effect()` releases them with the contribution.

Model provider registration changes only this Harness-owned Kernel. MCP server registration is an in-memory overlay: it uses the normal MCP connection lifecycle but does not write the server into the user's config file.

Every registration returns a disposer. Return that disposer from `this.effect()`; async setup is supported, including `kernel.mcp.registerServer()`. Contributions do not override `start()` or `dispose()` and do not receive a context parameter.

`skills`, `storage`, `sandboxes`, `channels`, and `apps` are not public Harness namespaces yet.
