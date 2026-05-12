#!/usr/bin/env node

import { ClaudeCodeNarpRuntimeWrapper } from "@/services/claude-code-narp-runtime-wrapper.service.js";

new ClaudeCodeNarpRuntimeWrapper().start();
