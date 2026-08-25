#!/usr/bin/env node
import { NextclawDistributionService } from "@nextclaw/service";
import { createNextclawDistribution } from "@nextclaw-cli/cli/shared/lib/distribution/index.js";

NextclawDistributionService.configureRuntime(
  createNextclawDistribution(import.meta.url),
);

const { nextclawCliProgram } = await import("./nextclaw-cli-app.js");
await nextclawCliProgram.parseAsync(process.argv);
