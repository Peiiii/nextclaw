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
  restartRequired: string[];
  noopPaths: string[];
};

type ReloadRule = {
  prefix: string;
  kind: "restart-channels" | "reload-providers" | "reload-agent" | "restart-required" | "none";
};

const RELOAD_RULES: ReloadRule[] = [
  { prefix: "channels", kind: "restart-channels" },
  { prefix: "providers", kind: "reload-providers" },
  { prefix: "agents.defaults.model", kind: "reload-agent" },
  { prefix: "agents.defaults.maxToolIterations", kind: "reload-agent" },
  { prefix: "agents.context", kind: "reload-agent" },
  { prefix: "agents.defaults.maxTokens", kind: "restart-required" },
  { prefix: "agents.defaults.temperature", kind: "restart-required" },
  { prefix: "tools", kind: "restart-required" },
  { prefix: "plugins", kind: "restart-required" },
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
    const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
    const paths: string[] = [];
    for (const key of keys) {
      const prevValue = prev[key];
      const nextValue = next[key];
      if (prevValue === undefined && nextValue === undefined) {
        continue;
      }
      const childPrefix = prefix ? `${prefix}.${key}` : key;
      const childPaths = diffConfigPaths(prevValue, nextValue, childPrefix);
      if (childPaths.length > 0) {
        paths.push(...childPaths);
      }
    }
    return paths;
  }
  if (Array.isArray(prev) && Array.isArray(next)) {
    if (prev.length === next.length && prev.every((val, idx) => val === next[idx])) {
      return [];
    }
  }
  return [prefix || "<root>"];
}

export function buildReloadPlan(changedPaths: string[]): ReloadPlan {
  const plan: ReloadPlan = {
    changedPaths,
    restartChannels: false,
    reloadProviders: false,
    reloadAgent: false,
    restartRequired: [],
    noopPaths: []
  };

  for (const path of changedPaths) {
    const rule = matchRule(path);
    if (!rule) {
      plan.restartRequired.push(path);
      continue;
    }
    if (rule.kind === "restart-channels") {
      plan.restartChannels = true;
      continue;
    }
    if (rule.kind === "reload-providers") {
      plan.reloadProviders = true;
      continue;
    }
    if (rule.kind === "reload-agent") {
      plan.reloadAgent = true;
      continue;
    }
    if (rule.kind === "restart-required") {
      plan.restartRequired.push(path);
      continue;
    }
    plan.noopPaths.push(path);
  }

  return plan;
}
