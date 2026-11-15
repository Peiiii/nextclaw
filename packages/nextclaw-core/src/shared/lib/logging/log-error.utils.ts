export type AppLogError = {
  name: string;
  message: string;
  stack?: string;
  code?: string | number;
  errno?: string | number;
  syscall?: string;
  path?: string;
  dest?: string;
  cause?: AppLogError;
  errors?: AppLogError[];
};

function readField(value: object, key: string): unknown {
  try { return Reflect.get(value, key); }
  catch { return undefined; }
}

function projectErrorFields(value: object): AppLogError {
  const name = readField(value, "name");
  const message = readField(value, "message");
  const result: AppLogError = {
    name: typeof name === "string" ? name.slice(0, 128) : "NonError",
    message: typeof message === "string" ? message.slice(0, 2048) : "Non-Error object thrown",
  };
  for (const key of ["code", "errno"] as const) {
    const field = readField(value, key);
    if (typeof field === "string") result[key] = field.slice(0, 2048);
    else if (typeof field === "number" && Number.isFinite(field)) result[key] = field;
  }
  for (const key of ["stack", "syscall", "path", "dest"] as const) {
    const field = readField(value, key);
    if (typeof field === "string") result[key] = field.slice(0, key === "stack" ? 8192 : 2048);
  }
  return result;
}

/** Project diagnostic fields only: thrown objects may also contain requests or credentials. */
export function normalizeLogError(value: unknown): AppLogError {
  let remainingNodes = 64;
  const visit = (current: unknown, ancestors: ReadonlySet<object>, depth: number): AppLogError => {
    if (depth >= 8 || remainingNodes-- <= 0) return { name: "TruncatedError", message: "[Error graph budget exhausted]" };
    if (!current || typeof current !== "object") return { name: "NonError", message: String(current).slice(0, 2048) };
    if (ancestors.has(current)) return { name: "CircularError", message: "[Circular cause]" };
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(current);
    const result = projectErrorFields(current);
    const cause = readField(current, "cause");
    if (cause !== undefined) result.cause = visit(cause, nextAncestors, depth + 1);
    const errors = readField(current, "errors");
    if (current instanceof AggregateError && Array.isArray(errors)) {
      result.errors = errors.slice(0, 8).map(error => visit(error, nextAncestors, depth + 1));
    }
    return result;
  };
  return visit(value, new Set(), 0);
}
