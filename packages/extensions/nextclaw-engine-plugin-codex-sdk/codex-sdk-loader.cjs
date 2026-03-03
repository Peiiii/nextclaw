let cachedCtor = null;

async function loadCodexConstructor() {
  if (cachedCtor) {
    return cachedCtor;
  }
  const mod = await import("@openai/codex-sdk");
  if (!mod || typeof mod.Codex !== "function") {
    throw new Error("[codex-sdk] failed to load Codex constructor from @openai/codex-sdk");
  }
  cachedCtor = mod.Codex;
  return cachedCtor;
}

module.exports = {
  loadCodexConstructor
};
