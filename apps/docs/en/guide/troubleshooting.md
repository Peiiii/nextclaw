# Troubleshooting

## Low cache hit rates or fast-growing model costs

The development version reduces repeated session and messaging instructions and reads the full display skill before inline presentation. Additional skill reads can therefore be expected for those tasks. Compare complete task costs, including these reads, rather than judging savings from system-prompt length or cache percentage alone.

Native sessions retain tool names and descriptions. Foundational tools and the memory-recall tools required by resident instructions expose their full parameters directly, while larger non-foundational schemas are queried through `tool_schema`; execution retains full validation. Session search is declared at startup and reports indexing status until ready. With uniform output caps, all 21 cases in the five-stage experiment passed. Final cost was 62.0% below the original and 10.8% below DSH. These are development-build short-task observations; see the report for stage metrics, provider-cache effects, and limits on generalizing schema-loading quality.

The development workspace also includes a standard three-task benchmark covering file investigation, configuration diagnosis and code repair against official DSH. After installing the optional SDK, run `pnpm benchmark:cache run` with its default shared USD 0.05 budget. Use `pnpm benchmark:cache show <report.json>` to view results and `pnpm benchmark:cache compare <old-report> <new-report>` for offline comparison. The headline rate is cached input / all input across all three tasks, invalidated by task failure or missing usage. See the [measurement report](/en/blog/2026-09-08-deepseek-cache-benchmark) for setup, tokens, timing and results. The retained single-task diagnostic below has a different scoring scope.

Cumulative session cache rates include the first input. Native sessions preserve model-call boundaries so consecutive tool results reach the model in their original order.

From a source checkout, run the fixed real-task benchmark with your configured official DeepSeek `deepseek-v4-flash` account:

```bash
pnpm smoke:prompt-cache -- --transport task-suite --model deepseek/deepseek-v4-flash
```

The headline metric is **whole-task input cache hit rate**: total cached input tokens divided by total input tokens for a five-file investigation and its follow-up, including the first call. File reads, answers, and call count must pass before the score represents a completed task. Files are generated in a temporary workspace; your business files are not used.

This makes paid API calls. Defaults cap estimated spend at USD 0.10, requests at 18, and output at 512 tokens per call. The next request is blocked if it would exceed the budget. Reports are saved under `diagnostics/prompt-cache/` in your NextClaw data directory and include usage, timings, price estimates, and source fingerprints. Estimates use the recorded price snapshot, not invoice deductions. Use `--prices <uncached-input,cached-input,output>` for updated USD prices per million tokens.

```bash
pnpm smoke:prompt-cache -- --transport task-suite --model deepseek/deepseek-v4-flash --output baseline.json
pnpm smoke:prompt-cache -- --transport task-suite --model deepseek/deepseek-v4-flash --baseline baseline.json --output current.json
pnpm smoke:prompt-cache -- --compare baseline.json current.json
```

The last command compares saved reports offline. A run fails if its headline rate is below 80%, drops by more than five percentage points against its baseline, rewrites prior requests, lacks usage data, or fails the task. Set `--min-cache-rate` to change the absolute threshold. Cold input and newly read file contents prevent a universal 95% guarantee. No recurring paid job is created automatically; a scheduler can repeat the same command and retain its reports.

This page is for recovery, not onboarding. When something fails, narrow it down in this order.

## 1. Is the service running?

```bash
nextclaw status
nextclaw doctor
```

If the service is not running, start it:

```bash
nextclaw start
```

If the state is abnormal, try:

```bash
nextclaw restart
```

## 2. The UI does not open

Check:

- the URL is `http://127.0.0.1:55667`
- the service is actually running
- the port is not occupied
- logs do not show a startup error

## 3. The model does not reply

Check:

- the provider was saved
- the API key or login state is valid
- the default model exists
- the machine can reach the provider

## 4. A channel cannot connect

Check:

- token expiration
- channel permissions
- platform callback or network reachability
- `nextclaw channels status`

## 5. Automation does not trigger

Check:

- the job is enabled
- the schedule matches your expectation
- the service was running at trigger time
- the job is not bound to the wrong session

## Useful diagnostics

```bash
nextclaw status --verbose
nextclaw doctor --verbose
nextclaw service autostart doctor
nextclaw remote doctor
```

## Still stuck?

Collect:

- NextClaw version
- operating system
- installation method
- `nextclaw status` output
- `nextclaw doctor` output
- reproduction steps

## 6. Session messages temporarily cannot be written on Windows

Windows can briefly lock a session cache file. Logs may show `EPERM`, `EACCES`, or `EBUSY`. NextClaw retries for a bounded period; if the cache still cannot be committed, it reads messages from the session journal instead, so an already-sent or completed message does not interrupt the session.

A later message update automatically rebuilds the cache and restores paged reads. If the error persists, close security or indexing tools that are scanning the NextClaw data directory, then retry and include the relevant logs and reproduction steps in a report.
