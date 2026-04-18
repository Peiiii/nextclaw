#!/usr/bin/env node

import { AppRuntimeCliService } from "./cli/app-runtime-cli.service.js";

void new AppRuntimeCliService().run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
