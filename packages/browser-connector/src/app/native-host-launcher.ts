#!/usr/bin/env node
import { ConfigRepository } from "@/repositories/config.repository.js";
import { NativeHostService } from "@/services/native-host.service.js";

const app = new NativeHostService(new ConfigRepository());
await app.run();
