# Jobs, Resident events, and observations

Portable Runtime separates a short Action result from work that continues after the caller returns. Use an ordinary Action when a caller can wait for the response. Use a durable Job when the caller needs progress, output replay, and cancellation. Use a Resident when the App must consume a durable event stream.

## Durable Jobs

The runtime assigns a Job id before dispatching a long operation. Progress and output chunks are retained with the Job; terminal states are irreversible. If the host restarts before completion, unfinished Jobs are recovered as interrupted rather than reported as successful.

Guest code can report bounded progress, emit bounded output chunks, and check whether cancellation was requested through the host WIT imports. It should check cancellation between meaningful units of work and leave persistent data in a state that can be safely inspected or retried.

Use the installed-App CLI to inspect the same records a Panel or Agent sees:

```bash
nextclaw app jobs list <app-id> --json
nextclaw app jobs inspect <app-id> <job-id> --json
nextclaw app jobs watch <app-id> <job-id> --after <sequence> --json
nextclaw app jobs cancel <app-id> <job-id> --json
```

Cancellation is a request, not an inferred terminal state. Do not report a Job as cancelled until the runtime confirms it.

## Durable Resident events

A Resident receives events through a host-owned inbox. The host records receipt, leases one event on the Resident lane, and asks the Component for a typed disposition. The Component acknowledges the event or requests retry with an optional delay and error. Delivery is at least once, so an event handler must be idempotent.

Retries use bounded backoff. An event that exhausts retry attempts becomes a dead letter; a user or authorized Agent can inspect and replay it after correcting the cause.

```bash
nextclaw app resident-inbox list <app-id> --dead-letters --json
nextclaw app resident-inbox replay <app-id> <event-id> --json
```

The `service-app-v2` WIT world gives new Residents a typed `ack` or `retry` result. The compatibility path keeps legacy Components running, but new Resident code should use the versioned world supplied with the package.

## Runtime observations

Every installed-App invocation can write a redacted verification record. It identifies the App, Component, Action, result state, duration, runner process information and bounded diagnostic facts. It must never contain a secret value, raw secret digest, unredacted private document, or a free-form copy of sensitive input.

```bash
nextclaw app verification --app <app-id> --limit 20 --json
```

Use these records to troubleshoot a failed Action and to prove that a specific App version used a specific runtime. They are not a substitute for the App's business audit log.

## Verify the portable runtime available to a host

NextClaw exposes the same current runtime-verification view through the UI and CLI. It evaluates evidence against the active App, runtime, runner, and contract identity; a stale record is not presented as evidence for the current runtime.

```bash
nextclaw app acceptance status --locale en --json
nextclaw app acceptance export --json
```

Use this when maintaining a runtime or diagnosing an installation, not as a user-facing workflow inside an ordinary App.

## Logging guidance

Log a stable operation name, a non-sensitive identifier, and a recoverable error code. Do not log request headers, secret-backed configuration values, absolute user document paths, or full input payloads. Prefer the App's own structured result for user-visible details and retain the runtime observation for operational diagnosis.

Related: [Capabilities and security](/en/developers/portable-runtime-contracts) · [Package and distribute](/en/developers/portable-runtime-distribution)
