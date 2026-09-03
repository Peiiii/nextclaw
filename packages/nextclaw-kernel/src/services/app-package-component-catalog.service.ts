import type { AppPackageComponentSourceList } from "@kernel/types/app-package.types.js";

const EMPTY_COMPONENT_CATALOG: AppPackageComponentSourceList = {
  sources: [],
  unavailablePackages: [],
};

/**
 * Owns the verified projection of active package components.
 *
 * Expensive package integrity checks happen while refreshing this catalog at
 * lifecycle boundaries. Product reads consume the last complete snapshot and
 * never trigger a package-tree scan after initialization.
 */
export class AppPackageComponentCatalogService {
  private snapshot = EMPTY_COMPONENT_CATALOG;
  private requestedRevision = 0;
  private appliedRevision = 0;
  private refreshPromise: Promise<void> | undefined;

  constructor(private readonly load: () => Promise<AppPackageComponentSourceList>) {}

  read = async (): Promise<AppPackageComponentSourceList> => {
    if (this.appliedRevision === 0) {
      await this.refresh();
    }
    return cloneCatalog(this.snapshot);
  };

  refresh = async (): Promise<void> => {
    this.requestedRevision += 1;
    this.refreshPromise ??= this.runRefreshLoop();
    await this.refreshPromise;
  };

  private runRefreshLoop = async (): Promise<void> => {
    try {
      while (this.appliedRevision < this.requestedRevision) {
        const targetRevision = this.requestedRevision;
        const nextSnapshot = await this.load();
        this.snapshot = cloneCatalog(nextSnapshot);
        this.appliedRevision = targetRevision;
      }
    } finally {
      this.refreshPromise = undefined;
    }
  };
}

function cloneCatalog(catalog: AppPackageComponentSourceList): AppPackageComponentSourceList {
  return {
    sources: catalog.sources.map((source) => ({ ...source })),
    unavailablePackages: catalog.unavailablePackages.map((diagnostic) => ({ ...diagnostic })),
  };
}
