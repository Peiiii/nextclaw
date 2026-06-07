#!/usr/bin/env node
import { createBrowserConnectorApp } from "@/app/browser-connector-app.js";

const app = createBrowserConnectorApp();
const output = await app.run(process.argv.slice(2));

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
process.exitCode = output.ok ? 0 : 1;
