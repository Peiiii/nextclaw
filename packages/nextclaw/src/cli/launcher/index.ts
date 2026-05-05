#!/usr/bin/env node
import { NpmRuntimeLauncher } from "./npm-runtime-launcher.service.js";

new NpmRuntimeLauncher({ argv: process.argv }).run();
