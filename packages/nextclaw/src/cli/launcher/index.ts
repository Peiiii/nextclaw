#!/usr/bin/env node
import { NpmRuntimeLauncher } from "@nextclaw-service/launcher/npm-runtime-launcher.service.js";

new NpmRuntimeLauncher({ argv: process.argv }).run();
