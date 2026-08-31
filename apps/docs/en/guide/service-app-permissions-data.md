# Service Apps: permissions and data

An installed App does not automatically gain access to your computer, accounts, or other Apps. Portable Runtime uses host-mediated access: the App requests a named capability, NextClaw checks the App's declaration and your configuration, then passes only the permitted resource to the running Component.

## Files

Portable Components receive a small private filesystem:

| Guest path | Access | Purpose |
| --- | --- | --- |
| `/app` | read-only | The App's packaged assets, when present |
| `/data` | read-write | The App's managed private data |
| `/cache` | read-write | The App's managed cache |
| `/tmp` | read-write | Temporary App files |
| `/documents/<scope>` | the mode you grant | A folder named by the App's `documentAccess` permission |

A file permission names a scope and its maximum mode. Installing an App does not grant any folder automatically. When you need the file feature, open the App's **Files and folders** section, choose a directory on the runtime host, and grant read-only or read-write access. You can replace the directory or revoke access at any time. Read-write access modifies the original files in the selected directory; NextClaw does not make a private copy first.

The CLI uses the same grants:

```bash
nextclaw app permissions inspect <app-id>
nextclaw app permissions document grant <app-id> --scope <scope-id> --path <directory> --mode read|read-write
nextclaw app permissions document revoke <app-id> --scope <scope-id>
```

NextClaw canonicalizes the directory and verifies that it exists. The App sees only `/documents/<scope>`, never the host path, and a read-only grant cannot write. Replacing or revoking a grant stops the old runtime lane so new calls cannot keep using the previous directory. Grants survive a NextClaw restart. If the directory moves or its disk becomes unavailable, replace or revoke the unavailable grant.

Without a folder grant, the App can still use its own `/data`, `/cache`, and `/tmp`. Those paths belong to the NextClaw-managed App instance; they are not your Documents, Desktop, or project directory.

## Network and secrets

An App lists the web domains it needs. Network access is limited to those domains, including redirected requests. Private network targets are rejected by the runtime policy.

Secrets are named slots, not plain text fields. Inspect and configure them through the installed App:

```bash
nextclaw app secrets inspect <app-id> --json
nextclaw app secrets bind <app-id> --slot <slot> --source env|file|exec --id <secret-id> --json
nextclaw app secrets verify <app-id> --json
```

`verify` reports whether the slot is usable without returning its value. A required missing or unreadable slot blocks enablement. Rotating or removing a binding causes the Component to be started with a new capability snapshot; the secret itself is never retained in App data, command arguments, Panel output, or verification records.

## Models, Agents, Providers, and external services

An App can declare non-secret model or Agent slots. Bind only a configured model or Agent you intend that App to use:

```bash
nextclaw app ai-capabilities inspect <app-id> --json
nextclaw app ai-capabilities bind <app-id> --kind model|agent --slot <slot> --target <id> --json
nextclaw app ai-capabilities verify <app-id> --json
```

Apps can also require a Provider or an external resource. This is an exception, not the preferred installation path: a self-contained App is easier to install, update, and remove. NextClaw shows the missing requirement and keeps the App disabled until it is satisfied. It never treats a connection string or credential in a manifest as setup.

```bash
nextclaw app dependencies inspect <app-id> --json
nextclaw app dependencies setup <app-id> --json
nextclaw app dependencies verify <app-id> --json
```

`setup` binds automatically only when there is exactly one compatible Provider. If there is more than one, make an explicit choice with `dependencies bind` or use the Provider's own setup Action. An Agent can use the same management surface after you authorize the change; it must not ask a non-technical user to learn a provider-specific configuration flow.

## Data through the App lifecycle

App data is isolated by App instance. Update and rollback preserve the managed instance unless the App's own migration says otherwise. Uninstall retains managed data by default so that reinstalling the same App can recover it. Permanent deletion requires both `--purge-data` and an exact App-id confirmation.

Use `nextclaw app data list --json` to inspect active and retained data, and `nextclaw app data delete <data-id> --confirm <app-id> --json` only when you intend permanent removal.

## Agent access is separate

Giving an Agent a Service Action does not give it every App permission. The Agent receives only that Action's declared interface. File folders, secrets, models, Providers, and external resources remain controlled by their own grants and bindings.

Related: [Use Service Apps](/en/guide/service-apps-usage) · [Troubleshoot Service Apps](/en/guide/service-apps-troubleshooting)
