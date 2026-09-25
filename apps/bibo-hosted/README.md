# Bibo hosted companion

Independent Cloudflare Worker and Container service at `https://app.bibo.bot/`. The existing `bibo-bot` Worker keeps handling `bibo.bot/*`; the previous `bibo.bot/app/*` route redirects to this service. No NextClaw service, account database, or existing Bibo concept-site route is changed.

## Runtime

- The Worker serves static assets and proxies registration/login to the existing NextClaw account API. It stores the platform session in an HttpOnly cookie and verifies it for every personal API request.
- A named Durable Object and Container are selected from the verified account ID. One container runs one account's `@nextclaw/harness` with a private `NEXTCLAW_HOME`.
- After each successful run, the container creates a compressed home snapshot, excluding configuration and logs. The Durable Object writes it to R2. On container startup, it restores that snapshot before serving a new run. A failed save does not report success.
- The low-cost first release uses `deepseek-flash` through a Bibo-only model proxy. The proxy explicitly disables DeepSeek's default thinking mode so visible answer tokens start streaming as they are generated; no second model call or text replay is used. The DeepSeek key stays in a Worker Secret. A separate Durable Object caps model calls at 30 per account and 200 across the service per UTC day; each call allows up to 128 KiB of input and 2,048 output tokens. Chat is additionally limited to 12 runs per hour per account, up to five active containers, and a one-minute idle sleep.
- Clearing the Bibo workspace stops the container and deletes the R2 snapshot and Durable Object conversation state. It does not delete the shared NextClaw platform account.

## Build and deploy

1. Use a Cloudflare account on the Workers Paid plan. Ensure the `bibo-user-snapshots` R2 bucket exists and `BIBO_DEEPSEEK_API_KEY` is configured as a Wrangler Secret. Never store the key in a file or commit it.
2. Run `pnpm -C apps/bibo-hosted tsc`, `pnpm -C apps/bibo-hosted test`, and `pnpm -C apps/bibo-hosted smoke:client`. These cover the Worker, React client, runner, streaming parser, a live SQLite WAL snapshot, and desktop/mobile chat behavior without a deployment.
3. From a clean checkout of the frozen remote `master`, run `pnpm -C apps/bibo-hosted run deploy`. Docker must be running. This command uses Wrangler 4.138.0, which deploys the current Container configuration; the workspace's older Wrangler 4.67.0 fails its observability validation. Wrangler builds and pushes the Docker image.
4. Wait for Container provisioning, then run `BIBO_SMOKE_TOKEN_FILE=/path/to/local-token.json pnpm -C apps/bibo-hosted smoke:live`. The file may contain a raw platform token or a JSON `platformToken`; keep it outside the repository. This makes two small model calls: one checks that the proxy streams visible tokens without hidden pre-answer reasoning, and one checks the full NextClaw chat, R2 commit, refreshed history, and desktop/mobile layout. Separately verify registration, account isolation, and `https://bibo.bot/` when those paths change.

Rollback the `bibo-hosted` Worker to its previous version using Wrangler if a release fails. If this is the first deployment, remove only the `app.bibo.bot` Custom Domain and `bibo.bot/app/*` redirect route. Retain R2 snapshots until the data handling decision is explicit.

## Diagnose a failed run

Use `wrangler tail bibo-hosted --format json` to find `bibo-run-response-failed` or `bibo-snapshot-failed` for the failed request. Those records include a status and a bounded internal error but no chat message or credential. Check the Container application version with `wrangler containers instances <application-id>` after a deploy; the Worker and Container roll out separately. Reproduce storage failures with the local snapshot test before building another image.
