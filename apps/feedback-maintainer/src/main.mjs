import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { FeedbackMaintenanceClient } from "nextclaw";
import { FeedbackDeliveryService } from "#feedback-maintainer/services/feedback-delivery.service.mjs";
import { feedbackPolicy } from "#feedback-maintainer/configs/feedback-policy.config.mjs";

const [configFile, action = "scan", input, journal] = process.argv.slice(2);
try {
  if (!configFile) throw new Error("Usage: feedback-maintainer <config.json> [scan|check-batch|dispatch-batch|reconcile-batch] [input] [journal]");
  const config = JSON.parse(await readFile(configFile, "utf8"));
  const base = dirname(resolve(configFile));
  const token = config.tokenFile ? (await readFile(resolve(base, config.tokenFile), "utf8")).trim() : process.env.SUPPORT_MAINTAINER_TOKEN;
  const client = new FeedbackMaintenanceClient({ endpoint: config.endpoint, token });
  if (action === "scan") console.log(JSON.stringify(await client.scan(), null, 2));
  else {
    const service = new FeedbackDeliveryService({ repository: resolve(base, config.workspace), githubRepository: config.githubRepository, client,
      policy: { ...feedbackPolicy, allowedPaths: config.allowedPaths, allowRelease: config.allowRelease === true } });
    if (action === "reconcile-batch" && input) console.log(await service.reconcile(input));
    else if (action === "check-batch" && input) console.log(await service.check(JSON.parse(await readFile(input, "utf8"))));
    else if (action === "dispatch-batch" && input && journal) console.log(await service.dispatch(JSON.parse(await readFile(input, "utf8")), journal));
    else throw new Error("Unknown action or missing input.");
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
