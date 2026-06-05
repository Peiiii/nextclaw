export function resolveFetchImpl(fetchImpl?: typeof fetch): typeof fetch {
  const resolvedFetch = fetchImpl ?? globalThis.fetch;
  if (typeof resolvedFetch !== "function") {
    throw new Error("NextClaw fetch transport is not available in this environment.");
  }
  return ((input, init) => resolvedFetch.call(globalThis, input, init)) as typeof fetch;
}
