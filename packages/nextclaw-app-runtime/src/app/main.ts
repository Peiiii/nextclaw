#!/usr/bin/env node

import { AppRuntimeCliService } from "#app-runtime/services/app-runtime-cli.service.js";

void new AppRuntimeCliService().run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
