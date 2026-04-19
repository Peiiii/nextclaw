type MarketplaceStoredObject = {
  storageKey: string;
  sha256: string;
  sizeBytes: number;
};

export class MarketplaceAppFileStore {
  constructor(private readonly bucket: R2Bucket) {}

  putBundle = async (params: {
    appId: string;
    version: string;
    bytes: Uint8Array;
  }): Promise<MarketplaceStoredObject> => {
    const { appId, version, bytes } = params;
    const storageKey = `apps/${appId}/bundles/${version}/bundle.napp`;
    const sha256 = await this.sha256Hex(bytes);
    await this.bucket.put(storageKey, bytes, {
      httpMetadata: {
        contentType: "application/octet-stream",
      },
    });
    return {
      storageKey,
      sha256,
      sizeBytes: params.bytes.byteLength,
    };
  };

  putFile = async (params: {
    appId: string;
    filePath: string;
    bytes: Uint8Array;
    contentType: string;
  }): Promise<MarketplaceStoredObject> => {
    const { appId, filePath, bytes, contentType } = params;
    const storageKey = `apps/${appId}/files/${filePath}`;
    const sha256 = await this.sha256Hex(bytes);
    await this.bucket.put(storageKey, bytes, {
      httpMetadata: {
        contentType,
      },
    });
    return {
      storageKey,
      sha256,
      sizeBytes: params.bytes.byteLength,
    };
  };

  getObject = async (storageKey: string): Promise<R2ObjectBody | null> => {
    return await this.bucket.get(storageKey);
  };

  deleteObjects = async (storageKeys: string[]): Promise<void> => {
    if (storageKeys.length === 0) {
      return;
    }
    await this.bucket.delete(storageKeys);
  };

  private sha256Hex = async (bytes: Uint8Array): Promise<string> => {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  };
}
