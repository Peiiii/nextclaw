#!/usr/bin/env node
import { createAigenApp } from "./aigen-app.js";

const app = createAigenApp();
const output = await app.run(process.argv.slice(2));

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
process.exitCode = output.ok ? 0 : 1;
