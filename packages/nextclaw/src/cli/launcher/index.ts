#!/usr/bin/env node
import { NextclawDistributionService, runNextclawNpmRuntimeLauncher } from "@nextclaw/service";
import { createNextclawDistribution } from "@nextclaw-cli/cli/shared/lib/distribution/index.js";

NextclawDistributionService.configure(createNextclawDistribution(import.meta.url));
runNextclawNpmRuntimeLauncher(process.argv);
