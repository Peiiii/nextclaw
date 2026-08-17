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
    targetKey?: string;
  }): Promise<MarketplaceStoredObject> => {
    const { appId, version, bytes, targetKey } = params;
    const sha256 = await this.sha256Hex(bytes);
    const storageKey = `apps/${appId}/bundles/${version}/${targetKey ? `${targetKey}/` : ""}${sha256}.napp`;
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
    const sha256 = await this.sha256Hex(bytes);
    const storageKey = `apps/${appId}/files/${sha256}/${filePath}`;
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

  getObject = async (storageKey: string, range?: string): Promise<R2ObjectBody | null> => {
    return await this.bucket.get(storageKey, range ? { range: new Headers({ range }) } : undefined);
  };

  findContentAddressedObject = async (params: {
    appId: string;
    sha256: string;
    filePath: string;
  }): Promise<R2ObjectBody | null> => {
    const storageKey = `apps/${params.appId}/files/${params.sha256}/${params.filePath}`;
    return await this.bucket.get(storageKey);
  };

  preserveFileRevision = async (params: {
    appId: string;
    filePath: string;
    storageKey: string;
    sha256: string;
    contentType: string;
  }): Promise<void> => {
    const { appId, contentType, filePath, sha256, storageKey } = params;
    const targetKey = `apps/${appId}/files/${sha256}/${filePath}`;
    if (storageKey === targetKey || await this.bucket.head(targetKey)) {
      return;
    }
    const current = await this.bucket.get(storageKey);
    if (!current) {
      return;
    }
    await this.bucket.put(targetKey, current.body, {
      httpMetadata: {
        contentType,
      },
    });
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
