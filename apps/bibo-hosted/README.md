# Bibo hosted companion

Independent Cloudflare Worker and Container service at `https://bibo.bot/app/`. The existing `bibo-bot` Worker keeps handling `bibo.bot/*`; the more specific `bibo.bot/app/*` route belongs to this service. No NextClaw service, account database, or existing Bibo concept-site route is changed.

## Runtime

- The Worker serves static assets and proxies registration/login to the existing NextClaw account API. It stores the platform session in an HttpOnly cookie and verifies it for every personal API request.
- A named Durable Object and Container are selected from the verified account ID. One container runs one account's `@nextclaw/harness` with a private `NEXTCLAW_HOME`.
- After each successful run, the container creates a compressed home snapshot, excluding configuration and logs. The Durable Object writes it to R2. On container startup, it restores that snapshot before serving a new run. A failed save does not report success.
- The low-cost first release uses `deepseek-flash` through a Bibo-only model proxy. The DeepSeek key stays in a Worker Secret. A separate Durable Object caps model calls at 30 per account and 200 across the service per UTC day; each call allows up to 128 KiB of input and 2,048 output tokens. Chat is additionally limited to 12 runs per hour per account, up to five active containers, and a one-minute idle sleep.
- Clearing the Bibo workspace stops the container and deletes the R2 snapshot and Durable Object conversation state. It does not delete the shared NextClaw platform account.

## Build and deploy

1. Use a Cloudflare account on the Workers Paid plan. Ensure the `bibo-user-snapshots` R2 bucket exists and `BIBO_DEEPSEEK_API_KEY` is configured as a Wrangler Secret. Never store the key in a file or commit it.
2. Run `pnpm -C apps/bibo-hosted exec wrangler types --include-runtime false` and `pnpm -C apps/bibo-hosted tsc`.
3. From a clean checkout of the frozen remote `master`, run `pnpm -C apps/bibo-hosted exec wrangler deploy`. Docker must be running. Wrangler builds and pushes the Docker image.
4. Wait for Container provisioning, then smoke `https://bibo.bot/app/`, registration, a real NextClaw response, refresh/continuation, account isolation, and `https://bibo.bot/`.

Rollback the `bibo-hosted` Worker to its previous version using Wrangler if a release fails. If this is the first deployment, remove only the `bibo.bot/app/*` route to return that path to the existing site. Retain R2 snapshots until the data handling decision is explicit.
