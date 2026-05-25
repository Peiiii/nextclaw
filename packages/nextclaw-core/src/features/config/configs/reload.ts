const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== "object") {
    return false;
  }
  if (Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

export type ReloadPlan = {
  changedPaths: string[];
  restartChannels: boolean;
  reloadProviders: boolean;
  reloadAgent: boolean;
  reloadMcp: boolean;
  reloadCompanion: boolean;
  restartRequired: string[];
  noopPaths: string[];
};

type ReloadRule = {
  prefix: string;
  kind: "restart-channels" | "reload-providers" | "reload-agent" | "reload-mcp" | "reload-companion" | "restart-required" | "none";
};

const RELOAD_RULES: ReloadRule[] = [
  { prefix: "channels", kind: "restart-channels" },
  { prefix: "providers", kind: "reload-providers" },
  { prefix: "mcp", kind: "reload-mcp" },
  { prefix: "agents.defaults.workspace", kind: "reload-agent" },
  { prefix: "agents.defaults.model", kind: "reload-agent" },
  { prefix: "agents.defaults.engine", kind: "reload-agent" },
  { prefix: "agents.defaults.engineConfig", kind: "reload-agent" },
  { prefix: "agents.defaults.thinkingDefault", kind: "reload-agent" },
  { prefix: "agents.defaults.models", kind: "reload-agent" },
  { prefix: "agents.defaults.maxToolIterations", kind: "reload-agent" },
  { prefix: "agents.context", kind: "reload-agent" },
  { prefix: "agents.learningLoop", kind: "reload-agent" },
  { prefix: "agents.defaults.contextTokens", kind: "reload-agent" },
  { prefix: "agents.defaults.reservedContextTokens", kind: "reload-agent" },
  { prefix: "agents.list", kind: "reload-agent" },
  { prefix: "bindings", kind: "reload-agent" },
  { prefix: "session", kind: "reload-agent" },
  { prefix: "search", kind: "reload-agent" },
  { prefix: "tools", kind: "reload-agent" },
  { prefix: "companion", kind: "reload-companion" },
  { prefix: "secrets", kind: "none" },
  { prefix: "gateway", kind: "none" },
  { prefix: "ui", kind: "none" }
];

const matchRule = (path: string): ReloadRule | null => {
  for (const rule of RELOAD_RULES) {
    if (path === rule.prefix || path.startsWith(`${rule.prefix}.`)) {
      return rule;
    }
  }
  return null;
};

export function diffConfigPaths(prev: unknown, next: unknown, prefix = ""): string[] {
  if (prev === next) {
    return [];
  }
  if (isPlainObject(prev) && isPlainObject(next)) {
    return diffPlainObjectConfigPaths(prev, next, prefix);
  }
  if (Array.isArray(prev) && Array.isArray(next)) {
    if (isSameArrayByReference(prev, next)) {
      return [];
    }
  }
  return [prefix || "<root>"];
}

function diffPlainObjectConfigPaths(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
  prefix: string
): string[] {
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  const paths: string[] = [];
  for (const key of keys) {
    const prevValue = prev[key];
    const nextValue = next[key];
    if (prevValue === undefined && nextValue === undefined) {
      continue;
    }
    const childPrefix = prefix ? `${prefix}.${key}` : key;
    paths.push(...diffConfigPaths(prevValue, nextValue, childPrefix));
  }
  return paths;
}

function isSameArrayByReference(prev: unknown[], next: unknown[]): boolean {
  return prev.length === next.length && prev.every((val, idx) => val === next[idx]);
}

export function buildReloadPlan(changedPaths: string[]): ReloadPlan {
  const plan: ReloadPlan = {
    changedPaths,
    restartChannels: false,
    reloadProviders: false,
    reloadAgent: false,
    reloadMcp: false,
    reloadCompanion: false,
    restartRequired: [],
    noopPaths: []
  };

  for (const path of changedPaths) {
    const rule = matchRule(path);
    if (!rule) {
      plan.restartRequired.push(path);
      continue;
    }
    applyReloadRule(plan, rule.kind, path);
  }

  return plan;
}

function applyReloadRule(plan: ReloadPlan, kind: ReloadRule["kind"], path: string): void {
  switch (kind) {
    case "restart-channels":
      plan.restartChannels = true;
      plan.reloadAgent = true;
      return;
    case "reload-providers":
      plan.reloadProviders = true;
      return;
    case "reload-agent":
      plan.reloadAgent = true;
      return;
    case "reload-mcp":
      plan.reloadMcp = true;
      return;
    case "reload-companion":
      plan.reloadCompanion = true;
      return;
    case "restart-required":
      plan.restartRequired.push(path);
      return;
    case "none":
      plan.noopPaths.push(path);
      return;
  }
}
