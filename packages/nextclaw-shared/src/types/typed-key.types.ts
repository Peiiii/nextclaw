export type TypedKey<T = unknown> = {
  readonly id: string;
  readonly _type?: T;
};

export type Key<T = unknown> = TypedKey<T> | string;

export function createTypedKey<T>(id: string): TypedKey<T> {
  const normalizedId = id.trim();
  if (!normalizedId) {
    throw new Error("typed key id is required");
  }
  return { id: normalizedId };
}

export function getKeyId(key: Key<unknown>): string {
  return typeof key === "string" ? key.trim() : key.id;
}
