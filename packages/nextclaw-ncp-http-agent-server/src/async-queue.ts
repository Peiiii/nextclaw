export type AsyncQueue<T> = {
  push(item: T): void;
  close(): void;
  iterable: AsyncIterable<T>;
};

export function createAsyncQueue<T>(): AsyncQueue<T> {
  const items: T[] = [];
  let closed = false;
  let pendingResolve: ((result: IteratorResult<T>) => void) | null = null;

  const iterable: AsyncIterable<T> = {
    [Symbol.asyncIterator]() {
      return {
        next: () => {
          if (items.length > 0) {
            return Promise.resolve({
              value: items.shift() as T,
              done: false,
            });
          }
          if (closed) {
            return Promise.resolve({
              value: undefined as T,
              done: true,
            });
          }
          return new Promise<IteratorResult<T>>((resolve) => {
            pendingResolve = resolve;
          });
        },
      };
    },
  };

  return {
    push(item: T) {
      if (closed) {
        return;
      }
      if (pendingResolve) {
        const resolve = pendingResolve;
        pendingResolve = null;
        resolve({ value: item, done: false });
        return;
      }
      items.push(item);
    },
    close() {
      if (closed) {
        return;
      }
      closed = true;
      if (pendingResolve) {
        const resolve = pendingResolve;
        pendingResolve = null;
        resolve({
          value: undefined as T,
          done: true,
        });
      }
    },
    iterable,
  };
}
