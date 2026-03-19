let cachedModule = null;

async function loadClaudeCodeSdkModule() {
  if (cachedModule) {
    return cachedModule;
  }
  const mod = await import("@anthropic-ai/claude-agent-sdk");
  if (!mod || typeof mod.query !== "function") {
    throw new Error("[claude-agent-sdk] failed to load query() from @anthropic-ai/claude-agent-sdk");
  }
  cachedModule = mod;
  return cachedModule;
}

module.exports = {
  loadClaudeCodeSdkModule,
};
