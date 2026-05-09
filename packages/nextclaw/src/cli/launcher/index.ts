#!/usr/bin/env node
import { NpmRuntimeLauncher } from "@nextclaw-service";

new NpmRuntimeLauncher({ argv: process.argv }).run();
