import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FeedbackMaintenanceClient } from "nextclaw";
import { FeedbackWorker, runFeedbackCommand, watchFeedback } from "#feedback-maintainer/services/feedback-worker.service.mjs";
import { FeedbackDeliveryService } from "#feedback-maintainer/services/feedback-delivery.service.mjs";
import { feedbackPolicy, validateFeedbackPaths } from "#feedback-maintainer/configs/feedback-policy.config.mjs";

const [configFile, action = "watch", input, journal] = process.argv.slice(2);
try {
  if (!configFile) throw new Error("Usage: feedback-maintainer <config.json> [watch|scan|check-batch|dispatch-batch|reconcile-batch] [input] [journal]");
  const config = JSON.parse(await readFile(configFile, "utf8"));
  const base = dirname(resolve(configFile));
  const token = config.tokenFile ? (await readFile(resolve(base, config.tokenFile), "utf8")).trim() : process.env.SUPPORT_MAINTAINER_TOKEN;
  const client = new FeedbackMaintenanceClient({ endpoint: config.endpoint, token });
  if (action === "scan") console.log(JSON.stringify(await client.scan(), null, 2));
  else if (action === "watch") {
    validateFeedbackPaths(config.allowedPaths, config.allowedPaths);
    if (!config.workspace) throw new Error("An isolated workspace is required.");
    const cwd = resolve(base, config.workspace), interval = config.intervalMs ?? 30000;
    if (!Number.isFinite(interval) || interval < 1000 || !Number.isFinite(config.timeoutMs ?? 600000) || (config.timeoutMs ?? 600000) < 1000) throw new Error("Invalid interval or timeout.");
    const cliCommand = config.cliCommand ?? ["nextclaw"];
    const skillPath = (await runFeedbackCommand([...cliCommand, "feedback", "maintain", "skill-path"], { cwd })).trim();
    const runner = fileURLToPath(new URL("./utils/codex-runner.utils.mjs", import.meta.url));
    const worker = new FeedbackWorker({ client, timeoutMs: config.timeoutMs, directory: resolve(base, config.stateDirectory ?? "dispatch"),
      execute: (report, signal) => runFeedbackCommand([process.execPath, runner], { cwd, signal,
        environment: { SUPPORT_MAINTAINER_TOKEN: token },
        input: JSON.stringify({ id: report.id, endpoint: client.endpoint, skillPath, cliCommand, allowedPaths: config.allowedPaths }) }) });
    console.log("Feedback maintainer started: code polling, zero idle model calls.");
    await watchFeedback(worker, interval);
  } else {
    const service = new FeedbackDeliveryService({ repository: resolve(base, config.workspace), githubRepository: config.githubRepository, client,
      policy: { ...feedbackPolicy, allowedPaths: config.allowedPaths, allowRelease: config.allowRelease === true } });
    if (action === "reconcile-batch" && input) console.log(await service.reconcile(input));
    else if (action === "check-batch" && input) console.log(await service.check(JSON.parse(await readFile(input, "utf8"))));
    else if (action === "dispatch-batch" && input && journal) console.log(await service.dispatch(JSON.parse(await readFile(input, "utf8")), journal));
    else throw new Error("Unknown action or missing input.");
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
