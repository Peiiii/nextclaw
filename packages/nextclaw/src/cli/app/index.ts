#!/usr/bin/env node
import { NextclawDistributionService } from "@nextclaw/service";
import { createNextclawDistribution } from "@nextclaw-cli/cli/shared/lib/distribution/index.js";

NextclawDistributionService.configureRuntime(
  createNextclawDistribution(import.meta.url),
);

await import("./nextclaw-cli-app.js");
