# Contributing to Bibo

Start with a reproducible issue or a real use case. Include your Bibo release, Node version, relevant deployment setting names, expected behavior and actual behavior. Remove cookies, passwords, keys, private files and conversation content before sharing logs.

Use Node.js from `.nvmrc` and pnpm from `package.json`. Run `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test`, `pnpm build` and the Wrangler dry-run documented in the README. UI changes should be checked at desktop and mobile widths, including keyboard use and failure recovery. `pnpm dev` provides a credential-free preview.

Agent execution belongs to the public NextClaw Harness. Keep Bibo's domain actions shared between UI and agent; do not introduce another agent loop or duplicate persistence. Core fixes belong in [NextClaw](https://github.com/Peiiii/nextclaw); Bibo's app and UI/client source are exported from that repository, with provenance in `SOURCE.json`. Pull requests here are welcome and can be carried upstream before the next snapshot.

Keep pull requests focused. Describe the user result and your verification; add tests for meaningful behavior or regressions. Do not commit build output, credentials or local data. Contributions retain the MIT license.
