# Use Service Apps

Service Apps are installed and managed as Apps. Their visible interface is usually a Panel; **Service Apps** is where you inspect what runs behind that Panel.

## Install and enable

Install an App from Marketplace or from a `.napp` file, then inspect its state before enabling it.

```bash
nextclaw app install ./my-app.napp --json
nextclaw app info <app-id> --json
nextclaw app enable <app-id> --json
```

If the state says `needs-configuration` or `needs-capability`, the App has declared required setup. Complete that setup first; do not work around it by putting connection details or tokens into an Action input.

## Use an App from its Panel

1. Open the App from the Apps list.
2. Read the requested access before approving the first protected operation.
3. Use the Panel for the task it presents.
4. Return to **Service Apps** when you need to inspect Actions, an error, or background work.

Panels call only the Actions they declare. If an App asks for an Action approval, approve only the action and risk level you recognize.

## Let an Agent use an Action

In **Service Apps**, expand the service, choose the Action, and grant it to the Agent that should use it. The Agent then sees the same declared Action as a tool. Revoke the grant to remove it from that Agent.

Use this for a clear task such as “sync this repository's Issues and summarize the open bugs.” Do not grant a dangerous Action simply because an Agent asks for it; read the App's Action title and risk first.

## Use the same Action from the command line

The command line calls an enabled installed App through the same host that the Panel uses:

```bash
nextclaw app invoke <app-id> <action-name> --input '{"key":"value"}' --json
```

The result includes an operation and verification-record identifier. To inspect redacted runtime facts for that call:

```bash
nextclaw app verification --app <app-id> --json
```

## Follow a long operation

When an Action starts a durable Job, use its Job id to see retained progress and output. A cancellation request is not a success result: the Job remains pending until the runtime confirms a terminal result.

```bash
nextclaw app jobs list <app-id> --json
nextclaw app jobs inspect <app-id> <job-id> --json
nextclaw app jobs watch <app-id> <job-id> --json
nextclaw app jobs cancel <app-id> <job-id> --json
```

For a Resident App, dead-letter events can be inspected and replayed through the same host:

```bash
nextclaw app resident-inbox list <app-id> --dead-letters --json
nextclaw app resident-inbox replay <app-id> <event-id> --json
```

## Update, roll back, or remove

```bash
nextclaw app update <app-id> --version <version> --json
nextclaw app rollback <app-id> --version <installed-version> --json
nextclaw app uninstall <app-id> --json
```

Uninstall keeps managed App data unless you explicitly request `--purge-data` and confirm the exact App id. Secret bindings are not retained as App data.

Next: [Permissions and data](/en/guide/service-app-permissions-data) · [Troubleshoot Service Apps](/en/guide/service-apps-troubleshooting)
