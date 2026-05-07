export type TypedEventKey<T> = {
  readonly id: string;
  readonly _type?: T;
};

export function createTypedEventKey<T>(id: string): TypedEventKey<T> {
  return { id } as TypedEventKey<T>;
}

export function readTypedEventKeyId<T>(key: TypedEventKey<T>): string {
  return key.id;
}
