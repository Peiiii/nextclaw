# Runtime Resource Usage

NextClaw can stay available on a VPS, NAS, or Linux device without keeping every installed messaging channel running. An unused channel has no separate extension process; its runtime starts when you enable the channel or begin an authorization flow, then stops after the last demand ends.

## Recommended server starting point

The current verified server baseline is **2 vCPU and 2 GiB of memory** on Linux. This is a tested starting point, not a universal minimum. Size the host separately for local models, browser automation, external Agent runtimes, MCP servers, and other services that share the machine.

A 1 GiB VPS has not yet completed the same startup-peak and real-task acceptance matrix, so it is not a published support promise.

## Verified ARM64 Linux measurements

The measurements below use the source build at commit `248bf88b`, with Node.js 22 in a Debian 12 container on ARM64 Linux. Each run was limited to 2 vCPU and 2 GiB, started with a fresh data directory and empty workspace, and had no active Agent or model request. Sampling began after the health check passed and the runtime stayed idle for 60 seconds.

| Scenario | Channel processes | Working set, three runs (MiB) | Average | Peak, three runs (MiB) | Average | PSS, three runs (MiB) | Average |
| --- | ---: | --- | ---: | --- | ---: | --- | ---: |
| Empty configuration | 0 / 0 / 0 | 172.67 / 161.41 / 160.74 | 164.94 | 222.84 / 187.91 / 187.25 | 199.33 | 208.16 / 209.87 / 209.58 | 209.20 |
| One Weixin channel | 1 / 1 / 1 | 201.96 / 187.05 / 189.84 | 192.95 | 231.29 / 217.78 / 218.52 | 222.53 | 249.67 / 234.89 / 237.26 | 240.61 |
| One Discord channel | 1 / 1 / 1 | 247.95 / 245.84 / 239.62 | 244.47 | 310.70 / 288.37 / 278.61 | 292.56 | 292.72 / 292.44 / 286.10 | 290.42 |

The previous eager-start runtime kept ten channel processes resident and used about 865–885 MiB of idle working set under the same ARM64 Linux measurement approach. The empty configuration now averages 164.94 MiB, a reduction of about 81%, with no channel extension process running.

After disabling the last Weixin channel, its process stopped after the 30-second grace period. At 60 seconds, no channel process remained and the working set had returned to 160.48 MiB.

## How the numbers are measured

- Working set is Linux cgroup `memory.current - inactive_file`.
- Peak is cgroup `memory.peak` for the complete container run.
- PSS is aggregated from `/proc/*/smaps_rollup`.
- Every scenario runs three times; the table keeps all three results instead of selecting the lowest value.
- Process inspection includes a short-lived sampling shell, while channel process counts are checked independently.

Working set and PSS use different accounting rules, so compare each metric with the same metric rather than subtracting one from the other.

## What increases memory during use

The empty-configuration figure is an idle runtime baseline. Memory increases when you:

- enable messaging channels;
- start Native, Codex, Claude Code, OpenCode, Hermes, or another Agent runtime;
- run browser automation or browser connectors;
- connect MCP servers or other child processes;
- preview or process large documents, spreadsheets, images, or generated apps;
- run a local model on the same host.

Local model memory is dominated by the model and inference runtime and is not included in this benchmark.

## Architecture boundary

The ARM64 results prove the on-demand process lifecycle and its relative reduction. The production AMD64 image has passed architecture and functional checks, but emulator memory is not used as a VPS result. A real AMD64 VPS will be added here after the empty, one-Weixin, and one-Discord scenarios each pass three runs with the same measurement method.

Until then, do not treat 164.94 MiB as a fixed value for every VPS or operating system.

## Continue deployment

- [Choose an install path](/en/guide/install)
- [Docker deployment](/en/guide/tutorials/docker-one-click)
- [Runtime and hosting](/en/guide/runtime-hosting)
