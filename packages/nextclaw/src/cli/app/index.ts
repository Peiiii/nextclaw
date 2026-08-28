#!/usr/bin/env node
import { NextclawDistributionService } from "@nextclaw/service";
import {
  createNextclawDistribution,
  repairPackagedPortableRunnerPermissions,
} from "@nextclaw-cli/cli/shared/lib/distribution/index.js";

const distribution = createNextclawDistribution(import.meta.url);
repairPackagedPortableRunnerPermissions(distribution);
NextclawDistributionService.configureRuntime(
  distribution,
);

const { nextclawCliProgram } = await import("./nextclaw-cli-app.js");
await nextclawCliProgram.parseAsync(process.argv);
