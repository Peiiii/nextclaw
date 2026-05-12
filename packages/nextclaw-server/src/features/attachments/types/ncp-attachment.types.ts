export type UiNcpStoredAssetRecord = {
  id: string;
  uri: string;
  storageKey: string;
  fileName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  sha256: string;
};

export type UiNcpAssetView = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  assetUri: string;
  url: string;
};

export type UiNcpAssetPutView = {
  assets: UiNcpAssetView[];
};
