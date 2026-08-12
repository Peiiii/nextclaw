export type AppMarketplaceResourceSnapshot<T> = {
  data: T | null;
  status: "loading" | "ready" | "error";
};

type ResourceLoader<T> = () => Promise<T>;

const INITIAL_RESOURCE: AppMarketplaceResourceSnapshot<never> = {
  data: null,
  status: "loading",
};

export class AppMarketplaceResourceManager {
  private readonly entries = new Map<
    string,
    AppMarketplaceResourceSnapshot<unknown>
  >();
  private readonly generations = new Map<string, number>();
  private readonly listeners = new Set<() => void>();

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly read = <T>(key: string): AppMarketplaceResourceSnapshot<T> =>
    (this.entries.get(key) ?? INITIAL_RESOURCE) as AppMarketplaceResourceSnapshot<T>;

  readonly load = async <T>(key: string, loader: ResourceLoader<T>): Promise<void> => {
    if (this.entries.has(key)) return;
    await this.runLoad(key, loader);
  };

  readonly reload = async <T>(key: string, loader: ResourceLoader<T>): Promise<void> => {
    await this.runLoad(key, loader);
  };

  private readonly runLoad = async <T>(
    key: string,
    loader: ResourceLoader<T>,
  ): Promise<void> => {
    const generation = (this.generations.get(key) ?? 0) + 1;
    this.generations.set(key, generation);
    this.write(key, { data: null, status: "loading" });
    try {
      const data = await loader();
      if (this.generations.get(key) === generation) {
        this.write(key, { data, status: "ready" });
      }
    } catch {
      if (this.generations.get(key) === generation) {
        this.write(key, { data: null, status: "error" });
      }
    }
  };

  private readonly write = <T>(
    key: string,
    snapshot: AppMarketplaceResourceSnapshot<T>,
  ): void => {
    this.entries.set(key, snapshot);
    this.listeners.forEach((listener) => listener());
  };
}

export const appMarketplaceResourceManager = new AppMarketplaceResourceManager();
