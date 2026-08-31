# Troubleshoot Service Apps

Start with the App state and the exact error code. Do not repeatedly enable or invoke an App while it is doing background work; retained Job and Resident records show whether an earlier request is still active or needs recovery.

## The App will not enable

| What you see | What to do |
| --- | --- |
| `needs-configuration` | Inspect required secrets, model or Agent slots, and document-folder permissions. Bind or grant the missing item, then verify it. |
| `needs-capability` | Inspect the dependency. If one compatible Provider is available, setup can bind it; if several are available, choose one explicitly. |
| `SECRET_BINDING_MISSING` | Bind the named required secret slot, then run `nextclaw app secrets verify <app-id> --json`. |
| `SECRET_RESOLUTION_FAILED` | Check the configured secret source without exposing its value, then verify the slot again. |

Useful commands:

```bash
nextclaw app info <app-id> --json
nextclaw app secrets inspect <app-id> --json
nextclaw app ai-capabilities inspect <app-id> --json
nextclaw app dependencies inspect <app-id> --json
```

## An Action failed

| Code | Meaning | Next step |
| --- | --- | --- |
| `WASI_CAPABILITY_DENIED` | The Component asked for access it was not granted | Review folder, domain, storage, or declared capability access |
| `WASI_INPUT_SCHEMA_MISMATCH` | The Action input does not match its declared shape | Correct the input rather than retrying unchanged |
| `WASI_GUEST_EXPORT_MISSING` | The package declares an Action the Component does not expose | Update or reinstall a matching App version |
| `WASI_ABI_VERSION_MISMATCH` | The Component and host contract are incompatible | Update the App or NextClaw to a compatible version |
| `WASI_COMPONENT_TRAP` | The Component stopped unexpectedly | Inspect the redacted observation and contact the App author with the code |
| `WASI_COMPONENT_FAILED` | Another Component runtime error occurred | Inspect the observation and retry only after correcting its reported cause |

Read the saved observation instead of copying sensitive inputs into a support message:

```bash
nextclaw app verification --app <app-id> --json
```

## A long Job or Resident event is stuck

```bash
nextclaw app jobs list <app-id> --json
nextclaw app jobs watch <app-id> <job-id> --json
nextclaw app resident-inbox list <app-id> --dead-letters --json
```

Request cancellation only if you no longer want the work. A Job becomes cancelled only after the runtime confirms it. A dead-letter Resident event can be replayed after you correct the cause; delivery is at least once, so the App should make repeated delivery safe.

## Still blocked

Collect the App id, App version, action or Job id, error code, and the redacted verification record. Do not include secret values, tokens, or copied private documents in a report.
